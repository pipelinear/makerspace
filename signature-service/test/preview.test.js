import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { once } from 'node:events';
import { createPreviewHandler } from '../preview.mjs';

const backend = 'https://makerspace-signatures.test-account.workers.dev';
async function request(handler, url, { method = 'GET', body, headers = {} } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(req, { url, method, headers: { host: '127.0.0.1:4173', ...headers }, socket: { localPort: 4173 } });
  const chunks = [], res = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
  res.writeHead = (status, responseHeaders) => { res.status = status; res.headers = responseHeaders; res.headersSent = true; };
  const finished = once(res, 'finish');
  await handler(req, res); await finished;
  return { status: res.status, headers: res.headers, body: Buffer.concat(chunks) };
}
test('local preview loads the website and routes the configured book service through the same origin', async () => {
  const handler = createPreviewHandler({ apiURL: backend, fetcher: () => { throw new Error('Unexpected network call'); } });
  const home = await request(handler, '/');
  assert.equal(home.status, 200); assert.match(home.body.toString(), /admin-battle.js/);
  const content = await request(handler, '/content.js');
  assert.equal(content.status, 200); assert.match(content.body.toString(), /apiUrl: '\/signature-api'/);
  assert.equal(content.headers['Cache-Control'], 'no-store');
  const image = await request(handler, '/assets/battle/mascot-sheet.png');
  assert.equal(image.status, 200); assert.equal(image.headers['Content-Type'], 'image/png');
  assert.equal(image.body.subarray(1, 4).toString(), 'PNG');
});
test('local login, saves and uploads reach the real service with password, tokens and bytes intact', async () => {
  const calls = [];
  const handler = createPreviewHandler({ apiURL: backend, fetcher: async (url, options) => {
    calls.push({ url, options });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } });
  for (const [url, method, type, body] of [
    ['/signature-api/admin/login', 'POST', 'application/json', '{"password":"test-password"}'],
    ['/signature-api/admin/layout', 'PUT', 'application/json', '{"placements":[],"signatures":[]}'],
    ['/signature-api/submissions', 'POST', 'multipart/form-data; boundary=preview', 'prepared-image-bytes']
  ]) {
    const result = await request(handler, url, { method, body, headers: { origin: 'http://127.0.0.1:4173', 'content-type': type, authorization: 'Bearer real-test-token' } });
    assert.equal(result.status, 200);
    const sent = calls.at(-1);
    assert.equal(sent.url, backend + url.slice('/signature-api'.length));
    assert.equal(sent.options.headers.Origin, 'https://pipelinear.github.io');
    assert.equal(sent.options.headers.authorization, 'Bearer real-test-token');
    assert.equal(sent.options.headers['content-type'], type); assert.equal(sent.options.body.toString(), body);
    assert.equal(sent.options.redirect, 'error');
  }
});
test('preview preserves real authentication failures and image cache headers', async () => {
  const handler = createPreviewHandler({ apiURL: backend, fetcher: async url => url.endsWith('/admin/login')
    ? Response.json({ error: 'Incorrect password.' }, { status: 401 })
    : new Response('png-bytes', { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400', ETag: '"image-id"' } }) });
  const denied = await request(handler, '/signature-api/admin/login', { method: 'POST', body: '{}', headers: { origin: 'http://127.0.0.1:4173' } });
  assert.equal(denied.status, 401); assert.match(denied.body.toString(), /Incorrect password/);
  const image = await request(handler, '/signature-api/images/image-id');
  assert.equal(image.status, 200); assert.equal(image.headers['cache-control'], 'private, max-age=86400'); assert.equal(image.headers.etag, '"image-id"');
});
test('preview rejects other origins, hostnames, oversized uploads and arbitrary backend targets', async () => {
  let calls = 0;
  const handler = createPreviewHandler({ apiURL: backend, fetcher: async () => { calls++; return Response.json({}); } });
  for (const headers of [
    { origin: 'https://other-site.example' }, { origin: 'null' }, {},
    { origin: 'http://127.0.0.1:4173', host: 'other-site.example:4173' },
    { origin: 'http://127.0.0.1:4173', host: 'localhost.evil.example:4173' }
  ]) assert.equal((await request(handler, '/signature-api/admin/login', { method: 'POST', body: '{}', headers })).status, 403);
  assert.equal((await request(handler, '/signature-api/submissions', { method: 'POST', body: Buffer.alloc(3 * 1024 * 1024 + 1), headers: { origin: 'http://127.0.0.1:4173' } })).status, 413);
  assert.equal((await request(handler, '/%2e%2e%2fpackage.json')).status, 404);
  assert.equal(calls, 0);
  for (const apiURL of ['http://127.0.0.1:9999', 'https://other-service.example', backend + '/secret', 'https://user:password@makerspace-signatures.test.workers.dev']) assert.throws(() => createPreviewHandler({ apiURL }), /configured Makerspace/);
});
