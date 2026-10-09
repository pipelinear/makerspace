import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../dist/signatures.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve)); };
function ui(connected) {
  const nodes = new Map(), listeners = {}, calls = [], classes = new Set(), figures = new Map();
  class Element {
    constructor(id = '') { this.id = id; this.listeners = {}; this.style = {}; this.value = ''; this.files = []; this.disabled = false; this.open = false; this.dataset = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    async emit(type, more = {}) { return this.listeners[type]?.({ target: this, preventDefault() {}, ...more }); }
    removeAttribute(key) { delete this[key]; }
    focus() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    reset() {}
    querySelector() { return new Element(); }
    matches(selector) { return selector === this.selector; }
    closest(selector) { return selector === this.selector ? this : null; }
  }
  const row = { id: 'b7d9fdcb-b65e-420e-a179-9500dff7bbaa', name: 'A maker <&>', status: 'pending', image: '/images/b7d9fdcb-b65e-420e-a179-9500dff7bbaa', imageWidth: 500, imageHeight: 120, revision: 0 };
  let serverRow = { ...row };
  const document = {
    hidden: false,
    body: {
      classList: { toggle(name, yes) { yes ? classes.add(name) : classes.delete(name); } },
      insertAdjacentHTML(_where, html) {
        for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, new Element(id));
      }
    },
    getElementById: id => nodes.get(id) || null,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    querySelector: selector => figures.get(selector) || null
  };
  const window = {
    MAKERSPACE: { clubSignatures: [], signatureSettings: { creatorUrl: 'https://www.textstudio.com/design/studio', email: '668442@my.sbunified.org', apiUrl: connected ? 'https://signatures.test' : '' } },
    addEventListener() {}, confirm: () => true
  };
  const fetch = async (url, options) => {
    const route = new URL(url).pathname; calls.push({ route, ...options });
    if (route === '/admin/login') return Response.json(JSON.parse(options.body).password === 'secret' ? { token: 'a'.repeat(64) } : { error: 'That password did not match.' }, { status: JSON.parse(options.body).password === 'secret' ? 200 : 401 });
    if (route.startsWith('/admin/') && options.headers.Authorization !== 'Bearer ' + 'a'.repeat(64)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    if (route === '/signatures') return Response.json({ signatures: serverRow?.status === 'approved' ? [serverRow] : [] });
    if (route === '/admin/signatures') return Response.json({ signatures: serverRow ? [serverRow] : [] });
    if (route.startsWith('/admin/images/')) return new Response(new Blob(['preview'], { type: 'image/png' }));
    if (route.endsWith('/approve')) {
      serverRow = { ...serverRow, status: 'approved', page: 'left', x: 8, y: 40, width: 38, height: 38 * 120 / 500 * .827, revision: 1 };
      return Response.json({ signature: serverRow });
    }
    if (options.method === 'PATCH') {
      const input = JSON.parse(options.body); assert.equal(input.revision, serverRow.revision);
      serverRow = { ...serverRow, ...input, height: input.width * 120 / 500 * .827, revision: input.revision + 1 };
      return Response.json({ signature: serverRow });
    }
    if (options.method === 'DELETE') { serverRow = null; return Response.json({ ok: true }); }
    if (route === '/admin/logout') return Response.json({ ok: true });
    throw new Error('Unexpected API call: ' + route);
  };
  const context = vm.createContext({ window, document, fetch, console, FormData, Blob, URL, AbortSignal, crypto, setInterval() {} });
  vm.runInContext(source, context);
  const module = window.MAKERSPACE_SIGNATURES;
  let paintCount = 0;
  module.init({ available: () => true, repaint() {
    paintCount++;
    for (const s of window.MAKERSPACE.clubSignatures) figures.set(`[data-signature-id="${s.id}"]`, new Element());
    if (module.toolbarHTML()) { nodes.set('signature-save-status', new Element()); nodes.get('signature-save-status').textContent = 'Changes save to the book.'; }
  } });
  const click = async (selector, dataset = {}) => {
    const target = new Element(); target.selector = selector; target.dataset = dataset;
    for (const fn of listeners.click || []) fn({ target });
    await flush();
  };
  return { nodes, window, module, calls, classes, click, get paintCount() { return paintCount; }, async change(selector, value) {
    const target = new Element(); target.selector = selector; target.value = value;
    for (const fn of listeners.change || []) fn({ target }); await flush();
  } };
}
test('unconnected spread uses email instructions and image preparation without advertising live approval', async () => {
  const f = ui(false); await flush();
  const note = f.module.noteHTML(); assert.match(note, /668442@my.sbunified.org/); assert.match(note, /Prepare image/);
  assert.doesNotMatch(note, /Admin sign in|will review/); assert.equal(f.calls.length, 0);
  await f.click('[data-signature-upload]');
  assert.equal(f.nodes.get('signature-upload-dialog').open, true);
  assert.equal(f.nodes.get('signature-send').disabled, true);
  f.nodes.get('signature-upload-dialog').close();
  assert.equal(f.module.interacting(), false);
  assert.equal(f.window.MAKERSPACE.clubSignatures.length, 0);
});
test('admin login, approval, arranging, resizing, moving pages, and removal synchronize the book', async () => {
  const f = ui(true); await flush(); assert.match(f.module.noteHTML(), /Upload/);
  assert.equal(f.window.MAKERSPACE.clubSignatures.length, 0);
  await f.click('[data-signature-upload]'); f.nodes.get('signature-upload-dialog').close();
  await f.click('[data-signature-admin]');
  f.nodes.get('signature-password').value = 'wrong'; await f.nodes.get('signature-login-form').emit('submit');
  assert.match(f.nodes.get('signature-login-status').textContent, /did not match/);
  f.nodes.get('signature-password').value = 'secret'; await f.nodes.get('signature-login-form').emit('submit');
  assert.equal(f.nodes.get('signature-password').value, '');
  assert.match(f.nodes.get('signature-admin-list').innerHTML, /A maker &lt;&amp;&gt;/);
  await f.click('[data-review-action]', { reviewAction: 'approve', id: 'b7d9fdcb-b65e-420e-a179-9500dff7bbaa' });
  assert.equal(f.window.MAKERSPACE.clubSignatures.length, 1);
  assert.equal(f.window.MAKERSPACE.clubSignatures[0].image, 'https://signatures.test/images/b7d9fdcb-b65e-420e-a179-9500dff7bbaa');
  await f.click('[data-review-action]', { reviewAction: 'arrange', id: 'b7d9fdcb-b65e-420e-a179-9500dff7bbaa' });
  assert.equal(f.nodes.get('signature-admin-dialog').open, false); assert.ok(f.classes.has('signature-editing'));
  assert.match(f.module.toolbarHTML(), /data-signature-size/); assert.equal(f.module.interacting(), true);
  await f.change('[data-signature-page]', 'right');
  assert.equal(f.window.MAKERSPACE.clubSignatures[0].page, 'right');
  assert.equal(f.window.MAKERSPACE.clubSignatures[0].revision, 2);
  await f.click('[data-signature-done]'); assert.equal(f.classes.has('signature-editing'), false);
  await f.click('[data-review-action]', { reviewAction: 'remove', id: 'b7d9fdcb-b65e-420e-a179-9500dff7bbaa' });
  assert.equal(f.window.MAKERSPACE.clubSignatures.length, 0);
  assert.ok(f.calls.filter(c => c.route.startsWith('/admin/') && c.route !== '/admin/login').every(c => c.headers.Authorization === 'Bearer ' + 'a'.repeat(64)));
});
