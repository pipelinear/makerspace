import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';
import { encodePNG, normalizePNG } from '../src/png.js';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_signatures.sql', import.meta.url), 'utf8'));
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
    batch: async statements => Promise.all(statements.map(s => s.run()))
  };
  const objects = new Map();
  const SIGNATURE_IMAGES = {
    put: async (key, bytes) => objects.set(key, new Uint8Array(bytes)),
    get: async key => objects.has(key) ? { body: objects.get(key) } : null,
    delete: async key => objects.delete(key)
  };
  const env = { DB, SIGNATURE_IMAGES, ADMIN_PASSWORD: 'private-test-password', ALLOWED_ORIGINS: 'https://pipelinear.github.io' };
  async function request(path, { method = 'GET', body, token, origin = 'https://pipelinear.github.io' } = {}) {
    const headers = { Origin: origin, 'CF-Connecting-IP': '192.0.2.1' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    return worker.fetch(new Request('https://signatures.test' + path, { method, headers, body }), env);
  }
  async function login(password = env.ADMIN_PASSWORD) {
    const response = await request('/admin/login', { method: 'POST', body: { password } });
    return { response, data: await response.json() };
  }
  return { sqlite, objects, env, request, login };
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

test('PNG normalization crops margins, rejects opaque, blank, corrupt and oversized data', async () => {
  const normalized = await normalizePNG(await image());
  assert.equal(normalized.width, 48); assert.equal(normalized.height, 32);
  assert.equal((await normalizePNG(normalized.bytes)).width, 48);
  await assert.rejects(() => image({ opaque: true }).then(normalizePNG), /transparent background/);
  await assert.rejects(() => image({ blank: true }).then(normalizePNG), /blank/);
  const damaged = await image(); damaged[45] ^= 1;
  await assert.rejects(() => normalizePNG(damaged), /transparent PNG/);
  await assert.rejects(() => normalizePNG(new Uint8Array(2 * 1024 * 1024 + 1)), /under 2 MB/);
  const f = fixture();
  for (const bytes of [await image({ opaque: true }), await image({ blank: true }), damaged]) assert.equal((await submit(f, 'Maker', bytes)).response.status, 400);
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
