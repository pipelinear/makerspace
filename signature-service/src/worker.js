import { normalizePNG } from './png.js';
import { R2_LIMITS, BudgetError, reserveOperation, reserveStorage, releaseStorage, deleteObject, usage, usageWindow } from './r2-budget.js';

class APIError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new APIError(status, message); };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const digest = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, '0')).join('');
const publicSignature = (row) => ({
  id: row.id, name: row.name, page: row.page, x: row.x, y: row.y,
  width: row.display_width, height: row.display_height, revision: row.revision,
  imageWidth: row.image_width, imageHeight: row.image_height,
  image: `/images/${row.id}`, status: row.status
});
async function boundedBody(request, maximum) {
  if (Number(request.headers.get('Content-Length')) > maximum) fail(413, 'This upload is too large.');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let length = 0; const parts = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maximum) { await reader.cancel(); fail(413, 'This upload is too large.'); }
    parts.push(value);
  }
  const result = new Uint8Array(length); let at = 0;
  for (const part of parts) { result.set(part, at); at += part.length; }
  return result;
}
async function bodyJSON(request, maximum = 4096) {
  try { return JSON.parse(new TextDecoder().decode(await boundedBody(request, maximum))); }
  catch (error) { if (error instanceof APIError) throw error; fail(400, 'Invalid request.'); }
}
async function rateLimit(request, env, purpose, limit, seconds) {
  const now = Math.floor(Date.now() / 1000), bucket = Math.floor(now / seconds);
  const key = `${purpose}:${bucket}:${await digest(request.headers.get('CF-Connecting-IP') || 'local')}`;
  const row = await env.DB.prepare('INSERT INTO rate_limits(key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, (bucket + 1) * seconds).first();
  if (row.count > limit) fail(429, 'Please wait a little before trying again.');
}
async function authenticate(request, env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) fail(401, 'Sign in to manage signatures.');
  const hash = await digest(token);
  const session = await env.DB.prepare('SELECT token_hash FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(hash, Date.now()).first();
  if (!session) fail(401, 'Your session ended. Sign in again.');
  return hash;
}
function placement(row, page, x, y, width) {
  if (!['left', 'right'].includes(page) || ![x, y, width].every(Number.isFinite)) fail(400, 'Invalid signature position.');
  const height = width * row.image_height / row.image_width * .827;
  if (width < 5 || width > 70 || height > 70 || x < 4 || x + width > 96 || y < (page === 'left' ? 12 : 4) || y + height > 94) fail(400, 'Keep the signature inside the signing area.');
  return { page, x, y, width, height };
}
function slots(row) {
  const positions = [];
  for (const page of ['left', 'right']) for (let line = 0; line < 6; line++) for (const x of [8, 54]) {
    const width = Math.min(38, 11 / (.827 * row.image_height / row.image_width));
    if (width >= 5) positions.push(placement(row, page, x, 12 + line * 14, width));
  }
  return positions;
}
async function autoPlace(env, row, approving, revision) {
  for (const pos of slots(row)) {
    // Atomic overlap check and update prevents two moderators choosing the same slot.
    const saved = await env.DB.prepare(`UPDATE signatures SET status = 'approved', page = ?, x = ?, y = ?, display_width = ?, display_height = ?, revision = revision + 1
      WHERE id = ? AND revision = ? AND status = ? AND NOT EXISTS (
        SELECT 1 FROM signatures other WHERE other.id != ? AND other.status = 'approved' AND other.page = ?
        AND other.x < ? AND other.x + other.display_width > ? AND other.y < ? AND other.y + other.display_height > ?
      ) RETURNING *`).bind(pos.page, pos.x, pos.y, pos.width, pos.height, row.id, revision, approving ? 'pending' : 'approved', row.id, pos.page, pos.x + pos.width + 2, pos.x - 2, pos.y + pos.height + 2, pos.y - 2).first();
    if (saved) return saved;
  }
  const current = await env.DB.prepare('SELECT revision, status FROM signatures WHERE id = ?').bind(row.id).first();
  if (current?.revision !== revision || current?.status !== row.status) fail(409, 'Another admin changed this signature. Refresh and try again.');
  fail(409, 'Both pages are full. Move or remove a signature to make room.');
}
async function handle(request, env) {
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
  const method = request.method;
  if (path === '/health' && method === 'GET') return json({ ready: Boolean(env.DB && env.SIGNATURE_IMAGES && env.ADMIN_PASSWORD) });
  if (!env.DB || !env.SIGNATURE_IMAGES || !env.ADMIN_PASSWORD) fail(503, 'Signature uploads are not connected yet.');
  if (path === '/signatures' && method === 'GET') {
    const { results } = await env.DB.prepare("SELECT * FROM signatures WHERE status = 'approved' ORDER BY created_at, id").all();
    return json({ signatures: results.map(publicSignature) });
  }
  if (path === '/layout' && method === 'GET') {
    const row = await env.DB.prepare('SELECT revision, placements FROM book_layout WHERE id = 1').first();
    return json({ revision: row.revision, placements: JSON.parse(row.placements) });
  }
  if (path === '/submissions' && method === 'POST') {
    await rateLimit(request, env, 'upload', 60, 3600);
    const type = request.headers.get('Content-Type') || '';
    if (!type.startsWith('multipart/form-data;')) fail(400, 'Choose a PNG and enter your name.');
    let form;
    try { form = await new Request(request.url, { method: 'POST', headers: { 'Content-Type': type }, body: await boundedBody(request, 2 * 1024 * 1024 + 8192) }).formData(); }
    catch (error) { if (error instanceof APIError) throw error; fail(400, 'Invalid upload.'); }
    const name = String(form.get('name') || '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 80 || /[\x00-\x1f\x7f]/.test(name)) fail(400, 'Enter your name (up to 80 characters).');
    const id = String(form.get('submissionId') || '');
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) fail(400, 'Invalid submission ID.');
    const existing = await env.DB.prepare('SELECT id FROM signatures WHERE id = ?').bind(id).first();
    if (existing) return json({ id, pending: true }, 202);
    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM signatures WHERE status = 'pending'").first();
    if (count.total >= 250) fail(503, 'Uploads are paused for now. Please try again later.');
    const file = form.get('image');
    if (!(file instanceof Blob) || file.type !== 'image/png') fail(400, 'Choose a transparent PNG.');
    let image;
    try { image = await normalizePNG(new Uint8Array(await file.arrayBuffer()), { maxBytes: R2_LIMITS.imageBytes }); }
    catch (error) { fail(400, error.message); }
    if (image.bytes.length > R2_LIMITS.imageBytes) fail(413, 'Choose an image under 512 KB.');
    const key = `signatures/${id}/${crypto.randomUUID()}.png`;
    await reserveStorage(env, key, image.bytes.length);
    let attempted = false;
    try {
      await reserveOperation(env, 'write'); attempted = true;
      await env.SIGNATURE_IMAGES.put(key, image.bytes, { storageClass: 'Standard', httpMetadata: { contentType: 'image/png' } });
      await env.DB.prepare('INSERT INTO signatures(id, name, image_key, image_width, image_height, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, name, key, image.width, image.height, Date.now()).run();
    } catch (error) {
      // A failed delete keeps its storage reservation, including ambiguous PUT failures.
      // Unique keys mean retry cleanup cannot delete another successful submission.
      try { if (attempted) await deleteObject(env, key); else await releaseStorage(env, key); } catch { /* Keep the conservative reservation. */ }
      if (!await env.DB.prepare('SELECT id FROM signatures WHERE id = ?').bind(id).first()) throw error;
    }
    return json({ id, pending: true }, 202);
  }
  if (path === '/admin/login' && method === 'POST') {
    await rateLimit(request, env, 'login', 5, 60);
    const body = await bodyJSON(request);
    const supplied = await digest(String(body.password || ''));
    const expected = await digest(env.ADMIN_PASSWORD);
    let different = 0;
    for (let i = 0; i < expected.length; i++) different |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
    if (different) fail(401, 'That password did not match.');
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = Date.now() + 4 * 3600 * 1000;
    await env.DB.prepare('INSERT INTO sessions(token_hash, expires_at) VALUES (?, ?)').bind(await digest(token), expiresAt).run();
    return json({ token, expiresAt });
  }
  const publicImage = path.match(/^\/images\/([a-f0-9-]{36})$/i);
  const adminImage = path.match(/^\/admin\/images\/([a-f0-9-]{36})$/i);
  let session;
  if (path.startsWith('/admin/')) session = await authenticate(request, env);
  if ((publicImage || adminImage) && ['GET', 'HEAD'].includes(method)) {
    const id = (publicImage || adminImage)[1];
    const row = await env.DB.prepare(`SELECT image_key FROM signatures WHERE id = ?${publicImage ? " AND status = 'approved'" : ''}`).bind(id).first();
    if (!row) fail(404, 'Image not found.');
    const etag = `"${id}"`;
    const imageHeaders = { 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline',
      'Cache-Control': publicImage ? 'private, max-age=86400' : 'no-store', 'ETag': etag };
    if (method === 'HEAD') return new Response(null, { headers: imageHeaders });
    // Approval is checked before accepting a cached validator, so a removed
    // image cannot be retrieved or revalidated by a new server request.
    if (publicImage && request.headers.get('If-None-Match')?.split(',').map(value => value.trim()).includes(etag)) return new Response(null, { status: 304, headers: imageHeaders });
    await reserveOperation(env, 'read');
    const object = await env.SIGNATURE_IMAGES.get(row.image_key);
    if (!object) fail(404, 'Image not found.');
    return new Response(object.body, { headers: imageHeaders });
  }
  if (path === '/admin/usage' && method === 'GET') return json(await usage(env));
  if (path === '/admin/logout' && method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session).run();
    return json({ ok: true });
  }
  if (path === '/admin/layout' && method === 'PUT') {
    const body = await bodyJSON(request, 256000);
    if (!Number.isInteger(body.revision) || !Array.isArray(body.placements) || body.placements.length > 40) fail(400, 'Invalid book layout.');
    const presets = { makerspace: [360, 110], sbhs: [180, 180], robot: [180, 180], spark: [180, 180], orbit: [240, 160], 'make-something': [320, 160] };
    const ids = new Set();
    const placements = body.placements.map(item => {
      if (!item || !Object.hasOwn(presets, item.key) || !/^preset-[a-f0-9-]{36}$/.test(item.id || '') || ids.has(item.id)) fail(400, 'Choose a design from the palette.');
      ids.add(item.id);
      const [image_width, image_height] = presets[item.key];
      const pos = placement({ image_width, image_height }, item.page, item.x, item.y, item.width);
      return { id: item.id, key: item.key, page: pos.page, x: pos.x, y: pos.y, width: pos.width };
    });
    const uploads = body.signatures ?? [], removed = body.removed ?? [];
    if (!Array.isArray(uploads) || !Array.isArray(removed) || uploads.length + removed.length > R2_LIMITS.images) fail(400, 'Invalid collection.');
    const { results: rows } = await env.DB.prepare('SELECT * FROM signatures').all();
    const indexed = new Map(rows.map(row => [row.id, row]));
    const validate = item => {
      if (!item || ids.has(item.id) || !Number.isInteger(item.revision)) fail(400, 'Invalid image selection.');
      ids.add(item.id);
      const row = indexed.get(item.id);
      if (!row || row.revision !== item.revision) fail(409, 'An image changed. Reload the saved collection before trying again.');
      return row;
    };
    const selected = uploads.map(item => { const row = validate(item); return { id: item.id, revision: item.revision, ...placement(row, item.page, item.x, item.y, item.width) }; });
    removed.forEach(validate);
    const expected = [...selected, ...removed].map(({ id, revision }) => ({ id, revision }));
    const saveID = crypto.randomUUID();
    const guard = 'EXISTS (SELECT 1 FROM book_layout WHERE id = 1 AND save_id = ?)';
    // D1 batch is one transaction. The unique save marker ensures a stale
    // layout cannot publish or move any image after its revision check fails.
    const statements = [env.DB.prepare(`UPDATE book_layout SET placements = ?, revision = revision + 1, save_id = ?
      WHERE id = 1 AND revision = ? AND NOT EXISTS (
        SELECT 1 FROM json_each(?) expected LEFT JOIN signatures s ON s.id = json_extract(expected.value, '$.id')
        WHERE s.id IS NULL OR s.revision != json_extract(expected.value, '$.revision')
      ) RETURNING revision, placements`).bind(JSON.stringify(placements), saveID, body.revision, JSON.stringify(expected))];
    if (selected.length) statements.push(env.DB.prepare(`WITH chosen AS (
      SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.page') AS page,
        json_extract(value, '$.x') AS x, json_extract(value, '$.y') AS y,
        json_extract(value, '$.width') AS width, json_extract(value, '$.height') AS height FROM json_each(?)
      ) UPDATE signatures SET status = 'approved', page = chosen.page, x = chosen.x, y = chosen.y,
        display_width = chosen.width, display_height = chosen.height, revision = signatures.revision + 1
      FROM chosen WHERE signatures.id = chosen.id AND ${guard}`).bind(JSON.stringify(selected), saveID));
    if (removed.length) statements.push(env.DB.prepare(`UPDATE signatures SET status = 'pending', page = NULL, x = NULL, y = NULL, display_width = NULL, display_height = NULL, revision = revision + 1
      WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?)) AND ${guard}`).bind(JSON.stringify(removed), saveID));
    statements.push(env.DB.prepare("SELECT * FROM signatures WHERE status = 'approved' ORDER BY created_at, id"));
    const results = await env.DB.batch(statements), row = results[0].results?.[0];
    if (!row) fail(409, 'Another admin saved this page. Reload the saved collection before trying again.');
    return json({ revision: row.revision, placements: JSON.parse(row.placements), signatures: results.at(-1).results.map(publicSignature) });
  }
  if (path === '/admin/signatures' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM signatures ORDER BY created_at, id').all();
    return json({ signatures: results.map(publicSignature) });
  }
  const match = path.match(/^\/admin\/signatures\/([a-f0-9-]{36})(?:\/(approve|place))?$/i);
  if (match) {
    const row = await env.DB.prepare('SELECT * FROM signatures WHERE id = ?').bind(match[1]).first();
    if (!row) fail(404, 'Signature not found.');
    if (method === 'DELETE' && !match[2]) {
      await env.DB.prepare('DELETE FROM signatures WHERE id = ?').bind(row.id).run();
      await deleteObject(env, row.image_key);
      return json({ ok: true });
    }
    if (method === 'POST' && match[2]) {
      const { revision } = await bodyJSON(request);
      if (!Number.isInteger(revision) || revision !== row.revision) fail(409, 'Another admin changed this signature. Refresh and try again.');
      if (match[2] === 'approve' && row.status !== 'pending' || match[2] === 'place' && row.status !== 'approved') fail(409, 'Refresh this signature before trying again.');
      return json({ signature: publicSignature(await autoPlace(env, row, match[2] === 'approve', revision)) });
    }
    if (method === 'PATCH' && !match[2]) {
      const body = await bodyJSON(request);
      if (row.status !== 'approved') fail(409, 'Approve the signature before arranging it.');
      if (!Number.isInteger(body.revision) || body.revision !== row.revision) fail(409, 'Another admin changed this signature. Refresh and try again.');
      const pos = placement(row, body.page, body.x, body.y, body.width);
      const saved = await env.DB.prepare('UPDATE signatures SET page = ?, x = ?, y = ?, display_width = ?, display_height = ?, revision = revision + 1 WHERE id = ? AND revision = ? RETURNING *').bind(pos.page, pos.x, pos.y, pos.width, pos.height, row.id, body.revision).first();
      if (!saved) fail(409, 'Another admin changed this signature. Refresh and try again.');
      return json({ signature: publicSignature(saved) });
    }
  }
  fail(404, 'Not found.');
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    let response;
    try {
      if (origin && !allowed.includes(origin)) fail(403, 'This origin is not allowed.');
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !origin) fail(403, 'Open the Makerspace site to use this service.');
      if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
      else response = await handle(request, env);
    } catch (error) {
      response = json({ error: (error instanceof APIError || error instanceof BudgetError) ? error.message : 'The service could not save this change. Please try again.' }, error.status || 500);
    }
    const headers = new Headers(response.headers);
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Vary', 'Origin');
    if (origin && allowed.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    return new Response(response.body, { status: response.status, headers });
  },
  async scheduled(_event, env) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()),
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)),
      env.DB.prepare('DELETE FROM r2_usage WHERE day < ?').bind(usageWindow().cutoff)
    ]);
  }
};
