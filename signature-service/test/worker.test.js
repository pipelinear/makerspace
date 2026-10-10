import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';
import { encodePNG, normalizePNG } from '../src/png.js';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of ['0001_signatures.sql', '0002_layout.sql', '0003_collection_save.sql', '0004_r2_budget.sql']) sqlite.exec(readFileSync(new URL('../migrations/' + migration, import.meta.url), 'utf8'));
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const wrap = params => ({
        bind: (...values) => wrap(values),
        first: async () => statement.get(...params) || null,
        all: async () => ({ results: statement.all(...params) }),
        run: async () => statement.run(...params)
      });
      return wrap([]);
    },
    batch: async statements => {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  };
  const objects = new Map(), r2Calls = { reads: 0, writes: 0, deletes: 0, options: [] };
  const SIGNATURE_IMAGES = {
    put: async (key, bytes, options) => { r2Calls.writes++; r2Calls.options.push(options); return objects.set(key, new Uint8Array(bytes)); },
    get: async key => { r2Calls.reads++; return objects.has(key) ? { body: objects.get(key) } : null; },
    delete: async key => { r2Calls.deletes++; objects.delete(key); }
  };
  const env = { DB, SIGNATURE_IMAGES, ADMIN_PASSWORD: 'private-test-password', ALLOWED_ORIGINS: 'https://pipelinear.github.io' };
  async function request(path, { method = 'GET', body, token, origin = 'https://pipelinear.github.io', headers: suppliedHeaders = {} } = {}) {
    const headers = { Origin: origin, 'CF-Connecting-IP': '192.0.2.1', ...suppliedHeaders };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    return worker.fetch(new Request('https://signatures.test' + path, { method, headers, body }), env);
  }
  async function login(password = env.ADMIN_PASSWORD) {
    const response = await request('/admin/login', { method: 'POST', body: { password } });
    return { response, data: await response.json() };
  }
  return { sqlite, objects, r2Calls, env, request, login };
}
async function image({ blank = false, opaque = false } = {}) {
  const rgba = new Uint8Array(64 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
    const at = (y * 64 + x) * 4;
    rgba[at] = 220; rgba[at + 1] = 70; rgba[at + 2] = 30;
    rgba[at + 3] = opaque || !blank && x >= 16 && x < 48 && y >= 8 && y < 24 ? 255 : 0;
  }
  return encodePNG(64, 32, rgba);
}
async function submit(f, name = 'A maker', bytes, id = crypto.randomUUID()) {
  const form = new FormData(); form.set('name', name); form.set('submissionId', id);
  form.set('image', new Blob([bytes || await image()], { type: 'image/png' }), 'name.png');
  const response = await f.request('/submissions', { method: 'POST', body: form });
  return { response, data: await response.json(), id };
}

test('pending uploads are private, approved signatures are public, and removal immediately hides them', async () => {
  const f = fixture(); const upload = await submit(f, 'Nick & friends');
  assert.equal(upload.response.status, 202); assert.equal(f.objects.size, 1);
  assert.deepEqual((await (await f.request('/signatures')).json()).signatures, []);
  assert.equal((await f.request('/images/' + upload.id)).status, 404);
  assert.equal((await f.request('/admin/images/' + upload.id)).status, 401);
  const { data: { token } } = await f.login();
  assert.equal((await f.request('/admin/images/' + upload.id, { token })).status, 200);
  assert.equal((await f.request('/admin/signatures', { token })).status, 200);
  const approved = await f.request(`/admin/signatures/${upload.id}/approve`, { method: 'POST', token, body: { revision: 0 } });
  assert.equal(approved.status, 200);
  const { signature } = await approved.json();
  assert.equal(signature.name, 'Nick & friends'); assert.equal(signature.revision, 1);
  assert.equal(signature.y, 12); assert.ok(signature.width <= 38);
  assert.equal((await f.request('/images/' + upload.id)).status, 200);
  assert.equal((await (await f.request('/signatures')).json()).signatures.length, 1);
  const removed = await f.request(`/admin/signatures/${upload.id}`, { method: 'DELETE', token });
  assert.equal(removed.status, 200); assert.equal(f.objects.size, 0);
  assert.equal((await f.request('/images/' + upload.id)).status, 404);
  assert.equal((await f.request('/admin/images/' + upload.id, { token })).status, 404);
});

test('approval chooses separate slots; resize preserves aspect ratio and stale edits cannot overwrite', async () => {
  const f = fixture(); const first = await submit(f), second = await submit(f);
  const { data: { token } } = await f.login();
  const approve = id => f.request(`/admin/signatures/${id}/approve`, { method: 'POST', token, body: { revision: 0 } });
  const responses = await Promise.all([approve(first.id), approve(second.id)]);
  const [one, two] = await Promise.all(responses.map(async r => { assert.equal(r.status, 200); return (await r.json()).signature; }));
  assert.ok(one.page !== two.page || one.x !== two.x || one.y !== two.y);
  const moved = await f.request(`/admin/signatures/${first.id}`, { method: 'PATCH', token, body: { page: 'right', x: 15, y: 20, width: 40, revision: 1 } });
  assert.equal(moved.status, 200);
  const changed = (await moved.json()).signature;
  assert.equal(changed.page, 'right'); assert.equal(changed.x, 15);
  assert.equal(changed.height, 40 * changed.imageHeight / changed.imageWidth * .827);
  assert.equal((await f.request(`/admin/signatures/${first.id}`, { method: 'PATCH', token, body: { page: 'right', x: 10, y: 10, width: 20, revision: 1 } })).status, 409);
  assert.equal((await f.request(`/admin/signatures/${first.id}`, { method: 'PATCH', token, body: { page: 'left', x: 10, y: 8, width: 20, revision: 2 } })).status, 400);
  assert.equal((await f.request(`/admin/signatures/${first.id}/place`, { method: 'POST', token, body: { revision: 2 } })).status, 200);
});

test('password checks, origin restrictions, session expiry and logout protect moderation', async () => {
  const f = fixture(); assert.equal((await f.login('nick')).response.status, 401);
  const { data: { token } } = await f.login();
  assert.equal((await f.request('/admin/signatures', { token, origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await f.request('/admin/signatures', { token })).status, 200);
  assert.equal((await f.request('/admin/logout', { method: 'POST', token })).status, 200);
  assert.equal((await f.request('/admin/signatures', { token })).status, 401);
  const next = (await f.login()).data.token;
  f.sqlite.exec('UPDATE sessions SET expires_at = 0');
  assert.equal((await f.request('/admin/signatures', { token: next })).status, 401);
  for (let i = 0; i < 2; i++) assert.equal((await f.login('wrong')).response.status, 401);
  assert.equal((await f.login('wrong')).response.status, 429);
  const preflight = await f.request('/admin/signatures', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://pipelinear.github.io');
  await worker.scheduled({}, f.env);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
});

test('PNG normalization accepts photos, crops transparent margins and rejects invalid data', async () => {
  const normalized = await normalizePNG(await image());
  assert.equal(normalized.width, 48); assert.equal(normalized.height, 32);
  assert.equal((await normalizePNG(normalized.bytes)).width, 48);
  const opaque = await normalizePNG(await image({ opaque: true })); assert.equal(opaque.width, 64); assert.equal(opaque.height, 32);
  await assert.rejects(() => image({ blank: true }).then(normalizePNG), /blank/);
  const damaged = await image(); damaged[45] ^= 1;
  await assert.rejects(() => normalizePNG(damaged), /transparent PNG/);
  await assert.rejects(() => normalizePNG(new Uint8Array(2 * 1024 * 1024 + 1)), /under 2 MB/);
  const f = fixture();
  for (const bytes of [await image({ blank: true }), damaged]) assert.equal((await submit(f, 'Maker', bytes)).response.status, 400);
  assert.equal(f.objects.size, 0);
  assert.equal((await submit(f, '   ')).response.status, 400);
});

test('retrying a submission does not duplicate it; full pages report capacity without publishing pending images', async () => {
  const f = fixture(); const first = await submit(f);
  assert.equal((await submit(f, 'Same maker', undefined, first.id)).response.status, 202);
  assert.equal(f.objects.size, 1);
  const { data: { token } } = await f.login();
  for (let i = 0; i < 24; i++) {
    const upload = i ? await submit(f) : first;
    assert.equal((await f.request(`/admin/signatures/${upload.id}/approve`, { method: 'POST', token, body: { revision: 0 } })).status, 200);
  }
  const extra = await submit(f);
  const response = await f.request(`/admin/signatures/${extra.id}/approve`, { method: 'POST', token, body: { revision: 0 } });
  assert.equal(response.status, 409); assert.match((await response.json()).error, /full/);
  assert.equal((await f.request('/images/' + extra.id)).status, 404);
  assert.equal((await (await f.request('/signatures')).json()).signatures.length, 24);
});

test('saved preset layouts are public, authenticated, bounded and protected against stale writes', async () => {
  const f = fixture();
  assert.deepEqual(await (await f.request('/layout')).json(), { revision: 0, placements: [] });
  const item = { id: 'preset-' + crypto.randomUUID(), key: 'robot', page: 'left', x: 8, y: 20, width: 30 };
  const body = { revision: 0, placements: [item] };
  assert.equal((await f.request('/admin/layout', { method: 'PUT', body })).status, 401);
  const { data: { token } } = await f.login();
  for (const invalid of [{ ...item, key: '__proto__' }, { ...item, x: 99 }, { ...item, width: 71 }, { ...item, page: 'outside' }]) {
    assert.equal((await f.request('/admin/layout', { method: 'PUT', token, body: { revision: 0, placements: [invalid] } })).status, 400);
  }
  const saved = await f.request('/admin/layout', { method: 'PUT', token, body }); assert.equal(saved.status, 200);
  assert.deepEqual(await (await f.request('/layout')).json(), { revision: 1, placements: [item] });
  assert.equal((await f.request('/admin/layout', { method: 'PUT', token, body })).status, 409);
  assert.equal((await f.request('/admin/layout', { method: 'PUT', token, body: { revision: 1, placements: [item,item] } })).status, 400);
  assert.equal((await f.request('/admin/layout', { method: 'PUT', token, body: { revision: 1, placements: [] } })).status, 200);
  assert.deepEqual((await (await f.request('/layout')).json()).placements, []);
});

test('Save publishes a reviewed collection globally and stale saves cannot partially approve or move images', async () => {
  const f = fixture(), one = await submit(f, 'First maker'), two = await submit(f, 'Second maker');
  const { data: { token } } = await f.login();
  const item = { id: one.id, revision: 0, page: 'left', x: 8, y: 20, width: 30 };
  const put = body => f.request('/admin/layout', { method: 'PUT', token, body });
  assert.equal((await f.request('/images/' + one.id)).status, 404);
  const saved = await put({ revision: 0, placements: [], signatures: [item] });
  assert.equal(saved.status, 200);
  const data = await saved.json(); assert.equal(data.revision, 1); assert.equal(data.signatures[0].revision, 1);
  assert.equal((await f.request('/images/' + one.id)).status, 200);
  assert.deepEqual((await (await f.request('/signatures')).json()).signatures, data.signatures);
  const next = { id: two.id, revision: 0, page: 'right', x: 18, y: 24, width: 25 };
  assert.equal((await put({ revision: 0, placements: [], signatures: [next] })).status, 409, 'old layout cannot publish a pending image');
  assert.equal((await f.request('/images/' + two.id)).status, 404);
  assert.equal((await put({ revision: 1, placements: [], signatures: [{ ...item, revision: 0, x: 15 }, next] })).status, 409, 'old upload revision prevents the entire save');
  assert.equal((await f.request('/images/' + two.id)).status, 404);
  assert.equal((await (await f.request('/signatures')).json()).signatures[0].x, 8);
  const savedBoth = await put({ revision: 1, placements: [], signatures: [{ ...item, revision: 1, page: 'right' }, next] });
  assert.equal(savedBoth.status, 200); assert.equal((await savedBoth.json()).signatures.length, 2, 'collection grows without replacing existing uploads');
  const removed = await put({ revision: 2, placements: [], signatures: [{ ...next, revision: 1 }], removed: [{ id: one.id, revision: 2 }] });
  assert.equal(removed.status, 200); assert.equal((await f.request('/images/' + one.id)).status, 404);
  assert.equal((await f.request('/admin/images/' + one.id, { token })).status, 200, 'removed image returns to review without being destroyed');
  assert.equal((await (await f.request('/admin/signatures', { token })).json()).signatures.find(row => row.id === one.id).status, 'pending');
  assert.equal((await put({ revision: 3, placements: [], signatures: [null] })).status, 400);
});

test('uploads reserve write and storage limits before R2; retries do not spend twice', async () => {
  const f = fixture(); f.env.R2_WRITE_LIMIT = '2';
  const first = await submit(f); assert.equal(first.response.status, 202);
  assert.equal((await submit(f, 'Retry', undefined, first.id)).response.status, 202);
  assert.equal(f.r2Calls.writes, 1);
  assert.equal((await submit(f)).response.status, 202);
  assert.equal((await submit(f)).response.status, 503);
  assert.equal(f.r2Calls.writes, 2);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS total FROM r2_storage').get().total, 2);
  assert.ok(f.r2Calls.options.every(options => options.storageClass === 'Standard'));
});

test('public images reuse browser cache; validators and HEAD avoid R2 while removed images stay private', async () => {
  const f = fixture(); f.env.R2_READ_LIMIT = '2'; const upload = await submit(f);
  const { data: { token } } = await f.login();
  await f.request(`/admin/signatures/${upload.id}/approve`, { method: 'POST', token, body: { revision: 0 } });
  const path = '/images/' + upload.id;
  const response = await f.request(path);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, max-age=86400');
  const etag = response.headers.get('ETag');
  assert.equal((await f.request(path, { headers: { 'If-None-Match': etag } })).status, 304);
  assert.equal((await f.request(path, { method: 'HEAD' })).status, 200);
  assert.equal(f.r2Calls.reads, 1);
  const privateImage = await f.request('/admin/images/' + upload.id, { token });
  assert.equal(privateImage.headers.get('Cache-Control'), 'no-store');
  assert.equal(f.r2Calls.reads, 2);
  assert.equal((await f.request(path)).status, 503); assert.equal(f.r2Calls.reads, 2);
  await f.request('/admin/signatures/' + upload.id, { method: 'DELETE', token });
  assert.equal((await f.request(path, { headers: { 'If-None-Match': etag } })).status, 404);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS total FROM r2_storage').get().total, 0);
});

test('rolling operation limits include prior-month requests and survive service restarts', async () => {
  const f = fixture(); f.env.R2_WRITE_LIMIT = '2';
  const day = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
  f.sqlite.prepare('INSERT INTO r2_usage(day, kind, count) VALUES (?, ?, ?)').run(day, 'write', 2);
  assert.equal((await submit(f)).response.status, 503); assert.equal(f.r2Calls.writes, 0);
  // Once usage is truly older than the 32-day window it no longer blocks uploads.
  const expired = new Date(Date.now() - 32 * 86400000).toISOString().slice(0, 10);
  f.sqlite.prepare('UPDATE r2_usage SET day = ?').run(expired);
  assert.equal((await submit(f)).response.status, 202); assert.equal(f.r2Calls.writes, 1);
});

test('concurrent uploads cannot exceed storage or image count limits', async () => {
  for (const constraint of ['R2_IMAGE_LIMIT', 'R2_STORAGE_LIMIT']) {
    const f = fixture(), prepared = await image(), normalized = await normalizePNG(prepared);
    f.env[constraint] = String(constraint === 'R2_IMAGE_LIMIT' ? 2 : normalized.bytes.length * 2);
    const results = await Promise.all(Array.from({ length: 8 }, () => submit(f, 'A maker', prepared)));
    assert.equal(results.filter(result => result.response.status === 202).length, 2);
    assert.equal(results.filter(result => result.response.status === 503).length, 6);
    assert.equal(f.r2Calls.writes, 2);
    assert.equal(f.sqlite.prepare('SELECT SUM(byte_count) AS total FROM r2_storage').get().total, normalized.bytes.length * 2);
  }
});

test('ambiguous upload and cleanup failures retain conservative reservations', async () => {
  const f = fixture(); f.env.R2_IMAGE_LIMIT = '1';
  f.env.SIGNATURE_IMAGES.put = async (key, bytes) => { f.r2Calls.writes++; f.objects.set(key, bytes); throw new Error('Timeout after storage'); };
  f.env.SIGNATURE_IMAGES.delete = async () => { throw new Error('Delete unavailable'); };
  assert.equal((await submit(f)).response.status, 500);
  assert.equal(f.objects.size, 1); assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS total FROM r2_storage').get().total, 1);
  assert.equal((await submit(f)).response.status, 503); assert.equal(f.r2Calls.writes, 1);
});

test('a missing counter table, invalid caps or disabled R2 fails closed without storage operations', async () => {
  for (const reason of ['missing-counter', 'disabled', 'invalid-limit']) {
    const f = fixture();
    if (reason === 'missing-counter') f.sqlite.exec('DROP TABLE r2_usage');
    if (reason === 'disabled') f.env.R2_ENABLED = 'false';
    if (reason === 'invalid-limit') f.env.R2_WRITE_LIMIT = '999999999';
    const result = await submit(f); assert.ok([500,503].includes(result.response.status));
    assert.equal(f.r2Calls.writes, 0); assert.equal(f.objects.size, 0);
  }
});

test('large prepared photos shrink on the server before entering R2', async () => {
  const f = fixture(), pixels = new Uint8Array(384 * 384 * 4);
  let random = 5729;
  for (let i = 0; i < pixels.length; i++) { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; pixels[i] = random & 255; }
  const bytes = await encodePNG(384, 384, pixels); assert.ok(bytes.length > 512 * 1024);
  assert.equal((await submit(f, 'Photo', bytes)).response.status, 202);
  assert.equal(f.r2Calls.writes, 1); assert.equal(f.objects.size, 1);
  assert.ok([...f.objects.values()][0].length <= 512 * 1024);
  const dimensions = f.sqlite.prepare('SELECT image_width, image_height FROM signatures').get();
  assert.ok(dimensions.image_width < 384); assert.equal(dimensions.image_width, dimensions.image_height);
});

test('a 1,000-image collection saves with a fixed number of database statements', async () => {
  const f = fixture(), selected = [], insert = f.sqlite.prepare('INSERT INTO signatures(id,name,image_key,image_width,image_height,created_at) VALUES (?,?,?,?,?,?)');
  for (let i = 0; i < 1000; i++) {
    const id = crypto.randomUUID(); insert.run(id, 'Maker ' + i, 'signatures/' + id + '.png', 180, 180, i);
    selected.push({ id, revision: 0, page: i % 2 ? 'left' : 'right', x: 8, y: 20, width: 5 });
  }
  const { data: { token } } = await f.login();
  const batch = f.env.DB.batch; let statements;
  f.env.DB.batch = async items => { statements = items.length; return batch(items); };
  const result = await f.request('/admin/layout', { method: 'PUT', token, body: { revision: 0, placements: [], signatures: selected } });
  assert.equal(result.status, 200); assert.equal((await result.json()).signatures.length, 1000);
  assert.equal(statements, 3); assert.equal(f.r2Calls.writes, 0); assert.equal(f.r2Calls.reads, 0);
});
