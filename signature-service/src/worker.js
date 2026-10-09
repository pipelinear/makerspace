import { normalizePNG } from './png.js';

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
async function bodyJSON(request) {
  try { return JSON.parse(new TextDecoder().decode(await boundedBody(request, 4096))); }
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
    if (count.total >= 250) fail(503, 'The approval queue is full. Try again after an admin reviews it.');
    const file = form.get('image');
    if (!(file instanceof Blob) || file.type !== 'image/png') fail(400, 'Choose a transparent PNG.');
    let image;
    try { image = await normalizePNG(new Uint8Array(await file.arrayBuffer())); }
    catch (error) { fail(400, error.message); }
    const key = `signatures/${id}/${crypto.randomUUID()}.png`;
    await env.SIGNATURE_IMAGES.put(key, image.bytes, { httpMetadata: { contentType: 'image/png' } });
    try {
      await env.DB.prepare('INSERT INTO signatures(id, name, image_key, image_width, image_height, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, name, key, image.width, image.height, Date.now()).run();
    } catch (error) {
      // Each attempt has a unique object key, so cleanup cannot delete another upload.
      await env.SIGNATURE_IMAGES.delete(key);
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
  if ((publicImage || adminImage) && method === 'GET') {
    const id = (publicImage || adminImage)[1];
    const row = await env.DB.prepare(`SELECT image_key FROM signatures WHERE id = ?${publicImage ? " AND status = 'approved'" : ''}`).bind(id).first();
    if (!row) fail(404, 'Image not found.');
    const object = await env.SIGNATURE_IMAGES.get(row.image_key);
    if (!object) fail(404, 'Image not found.');
    return new Response(object.body, { headers: { 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
  }
  if (path === '/admin/logout' && method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session).run();
    return json({ ok: true });
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
      await env.SIGNATURE_IMAGES.delete(row.image_key);
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
      response = json({ error: error instanceof APIError ? error.message : 'The service could not save this change. Please try again.' }, error.status || 500);
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Vary', 'Origin');
    if (origin && allowed.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    return new Response(response.body, { status: response.status, headers });
  },
  async scheduled(_event, env) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()),
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000))
    ]);
  }
};
