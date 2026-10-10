import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../dist/signatures.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve)); };
function ui(connected, storage = new Map(), photoOptions = {}) {
  const nodes = new Map(), listeners = {}, calls = [], classes = new Set(), figures = new Map();
  class Element {
    constructor(id = '') { this.id = id; this.listeners = {}; this.style = {}; this.value = ''; this.files = []; this.disabled = false; this.open = false; this.dataset = {}; }
    set innerHTML(html) { this.html = html; for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, new Element(id)); }
    get innerHTML() { return this.html || ''; }
    getBoundingClientRect() { return this.rect; }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
    append(child) { child.paper = this.paper; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    async emit(type, more = {}) { return this.listeners[type]?.({ target: this, preventDefault() {}, ...more }); }
    removeAttribute(key) { delete this[key]; }
    focus() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    reset() {}
    insertAdjacentHTML(_where, html) { for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, new Element(id)); }
    querySelector() { return new Element(); }
    matches(selector) { return selector === this.selector; }
    closest(selector) {
      if (selector === '.signature-paper') return this.paper || (this.side ? this : null);
      if (selector === '#poster-page') return this.side === 'left' ? this : null;
      if (selector === '[data-signature-id]') return this.figure || (this.dataset.signatureId ? this : null);
      return selector === this.selector ? this : null;
    }
  }
  nodes.set('reader', new Element('reader'));
  const papers = Object.fromEntries(['left','right'].map((side, index) => {
    const paper = new Element(); paper.side = side; paper.rect = { left: index * 500, top: 0, width: 500, height: 500 / .827 };
    paper.querySelector = () => { const marks = new Element(); marks.paper = paper; return marks; };
    return [side, paper];
  }));
  const row = { id: 'b7d9fdcb-b65e-420e-a179-9500dff7bbaa', name: 'A maker <&>', status: 'pending', image: '/images/b7d9fdcb-b65e-420e-a179-9500dff7bbaa', imageWidth: 500, imageHeight: 120, revision: 0 };
  let serverRow = { ...row };
  const canvasContext = { drawImage() {}, getImageData(_x,_y,w,h) { return { data: new Uint8ClampedArray(w*h*4).fill(255) }; } };
  const document = {
    createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => canvasContext };
      canvas.toBlob = fn => fn(new Blob([photoOptions.detailed ? new Uint8Array(canvas.width * canvas.height * 4) : 'prepared'], { type: 'image/png' }));
      return canvas;
    },
    hidden: false,
    body: {
      classList: { toggle(name, yes) { yes ? classes.add(name) : classes.delete(name); } },
      insertAdjacentHTML(_where, html) {
        for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, new Element(id));
      }
    },
    getElementById: id => nodes.get(id) || null,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    querySelector: selector => figures.get(selector) || null,
    elementFromPoint: x => x < 500 ? papers.left : papers.right,
    querySelectorAll: () => []
  };
  const flightCalls = [];
  const window = {
    MAKERSPACE_FLIGHT: { async play(dialog, imageURL) { flightCalls.push({ dialog, imageURL }); }, cancel() {} },
    MAKERSPACE: { clubSignatures: [], signatureSettings: { creatorUrl: 'https://shaderlabs.app/', apiUrl: connected ? 'https://signatures.test' : '' } },
    localStorage: { getItem: key => storage.get(key), setItem: (key,value) => storage.set(key,value) },
    addEventListener() {}, confirm: () => true
  };
  let uploadFailure = false;
  let layout = { revision: 0, placements: [] };
  const fetch = async (url, options) => {
    const route = new URL(url).pathname; calls.push({ route, ...options });
    if (route === '/submissions') return Response.json(uploadFailure ? { error: 'Try again.' } : { pending: true }, { status: uploadFailure ? 503 : 202 });
    if (route === '/admin/login') return Response.json(JSON.parse(options.body).password === 'secret' ? { token: 'a'.repeat(64) } : { error: 'That password did not match.' }, { status: JSON.parse(options.body).password === 'secret' ? 200 : 401 });
    if (route.startsWith('/admin/') && options.headers.Authorization !== 'Bearer ' + 'a'.repeat(64)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    if (route === '/layout') return Response.json(layout);
    if (route === '/admin/layout') {
      const input = JSON.parse(options.body);
      if (input.signatures?.length) serverRow = { ...serverRow, ...input.signatures[0], status: 'approved', height: input.signatures[0].width * 120 / 500 * .827, revision: serverRow.revision + 1 };
      if (input.removed?.some(item => item.id === serverRow?.id)) serverRow = { ...serverRow, status: 'pending', revision: serverRow.revision + 1 };
      layout = { placements: input.placements, revision: layout.revision + 1 };
      return Response.json({ ...layout, signatures: serverRow?.status === 'approved' ? [serverRow] : [] });
    }
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
  const context = vm.createContext({ window, document, fetch, console, FormData, Blob, URL, AbortSignal, crypto, structuredClone, Uint8ClampedArray, createImageBitmap: async () => ({ width: photoOptions.width || 64, height: photoOptions.height || 32, close() {} }), setInterval() {} });
  vm.runInContext(readFileSync(new URL('../../dist/signature-presets.js', import.meta.url), 'utf8'), context);
  vm.runInContext(source, context);
  const module = window.MAKERSPACE_SIGNATURES;
  let paintCount = 0;
  module.init({ available: () => true, repaint() {
    paintCount++;
    for (const s of window.MAKERSPACE.clubSignatures) {
      const figure = new Element(); figure.dataset.signatureId = s.id; figure.paper = papers[s.page];
      figures.set(`[data-signature-id="${s.id}"]`, figure);
    }
    if (module.toolbarHTML()) { nodes.set('signature-save-status', new Element()); nodes.get('signature-save-status').textContent = 'Changes save to the book.'; }
  } });
  const click = async (selector, dataset = {}) => {
    const target = new Element(); target.selector = selector; target.dataset = dataset;
    for (const fn of listeners.click || []) fn({ target });
    await flush();
  };
  const dispatch = async (type, event) => {
    for (const fn of listeners[type] || []) fn({ preventDefault() {}, stopPropagation() {}, ...event });
    await flush();
  };
  return { nodes, window, module, calls, classes, click, flightCalls, dispatch, papers, figures, Element, set uploadFailure(value) { uploadFailure = value; }, get paintCount() { return paintCount; }, async change(selector, value) {
    const target = new Element(); target.selector = selector; target.value = value;
    for (const fn of listeners.input || []) fn({ target });
    for (const fn of listeners.change || []) fn({ target }); await flush();
  } };
}
test('minimal signature help credits the student and offers upload without email', async () => {
  const f = ui(false); await flush();
  const note = f.module.noteHTML(); assert.match(note, /shaderlabs.app/); assert.match(note, /Ewan McCorkell, Makerspace student/); assert.match(note, /data-signature-help/); assert.match(note, /Upload/); assert.match(note, /signature-help-popover/);
  assert.doesNotMatch(note, /<h2>/); assert.doesNotMatch(note, /email|mailto|TextStudio|approve/);
  assert.doesNotMatch(note, /Admin sign in|will review/); assert.equal(f.calls.length, 0);
  await f.click('[data-signature-upload]');
  assert.equal(f.nodes.get('signature-upload-dialog').open, true);
  assert.equal(f.nodes.get('signature-send').disabled, true);
  f.nodes.get('signature-upload-dialog').close();
  assert.equal(f.module.interacting(), false);
  assert.equal(f.window.MAKERSPACE.clubSignatures.length, 0);
});
test('direct file login explains how to open the connected local preview without faking admin access', async () => {
  const f = ui(true); await flush(); f.window.location = { protocol: 'file:' };
  const before = f.calls.length;
  await assert.rejects(f.module.authenticateAdmin('nick'), /Open Local-Preview.command/);
  assert.equal(f.calls.length, before);
  f.module.completeBattleLogin(); assert.equal(f.module.hasAdminSession(), false);
  assert.equal(f.nodes.get('signature-admin-rail').hidden, true);
});
test('battle win unlocks private reviews; drafts publish together only when Save is clicked', async () => {
  const f = ui(true); await flush();
  assert.equal(f.nodes.get('signature-admin-rail').hidden, true);
  assert.equal((await f.module.authenticateAdmin('secret')).granted, true);
  assert.equal(f.module.hasAdminSession(), false);
  assert.equal(f.nodes.get('signature-admin-rail').hidden, true);
  assert.ok(!f.calls.some(call => call.route === '/admin/signatures'));
  f.module.completeBattleLogin(); await flush();
  assert.equal(f.nodes.get('signature-admin-rail').hidden, false);
  assert.match(f.nodes.get('signature-admin-rail').innerHTML, /To review/);
  assert.match(f.nodes.get('signature-admin-rail').innerHTML, /A maker &lt;&amp;&gt;/);
  const id = 'b7d9fdcb-b65e-420e-a179-9500dff7bbaa';
  await f.click('[data-inspect-upload]', { inspectUpload: id });
  assert.equal(f.nodes.get('signature-admin-dialog').open, true);
  assert.match(f.nodes.get('signature-admin-image').src, /^blob:/);
  await f.click('[data-place-upload]', { uploadId: id });
  assert.equal(f.nodes.get('signature-admin-dialog').open, false);
  const row = f.window.MAKERSPACE.clubSignatures[0];
  assert.equal(row.revision, 0); assert.equal(f.module.toolbarHTML(), '');
  assert.match(f.module.handlesHTML(row), /data-signature-resize="se"/);
  assert.doesNotMatch(f.module.handlesHTML(row), /<label|select|range|swap/i);
  assert.ok(!f.calls.some(call => call.route === '/admin/layout' || call.route.endsWith('/approve')));
  await f.module.saveLayout(); await flush();
  assert.equal(f.window.MAKERSPACE.clubSignatures[0].revision, 1);
  assert.equal(f.window.MAKERSPACE.clubSignatures[0].image, 'https://signatures.test/images/' + id);
  await f.click('[data-signature-remove]');
  assert.equal(f.window.MAKERSPACE.clubSignatures.length, 0);
  assert.match(f.nodes.get('signature-admin-rail').innerHTML, /data-inspect-upload/);
  await f.module.saveLayout(); await flush();
  const saves = f.calls.filter(call => call.route === '/admin/layout');
  assert.equal(JSON.parse(saves[0].body).signatures[0].id, id);
  assert.equal(JSON.parse(saves[1].body).removed[0].id, id);
  await f.click('[data-signature-signout]');
  assert.equal(f.nodes.get('signature-admin-rail').hidden, true);
  assert.equal(f.module.hasAdminSession(), false);
});
test('preview unlocks local controls only, and cancelled real logins are discarded', async () => {
  const preview = ui(false); await flush();
  assert.equal((await preview.module.authenticateAdmin('nick')).granted, true);
  assert.equal((await preview.module.authenticateAdmin('Nick')).granted, false);
  assert.equal(preview.module.hasAdminSession(), false);
  await preview.module.authenticateAdmin('nick'); preview.module.completeBattleLogin();
  assert.equal(preview.module.hasAdminSession(), true, 'preview only unlocks local controls');
  assert.equal(preview.calls.length, 0);
  const live = ui(true); await flush();
  await live.module.authenticateAdmin('secret'); live.module.discardBattleLogin();
  assert.equal(live.module.hasAdminSession(), false);
  await flush(); assert.ok(live.calls.some(call => call.route === '/admin/logout'));
  const inFlight = live.module.authenticateAdmin('secret'); live.module.discardBattleLogin();
  await inFlight; live.module.completeBattleLogin();
  assert.equal(live.module.hasAdminSession(), false, 'a response arriving after cancellation cannot grant access');
});

test('unconnected preview never claims a browser-only draft is saved for everyone', async () => {
  const storage = new Map(), f = ui(false, storage); await flush();
  await f.click('[data-preset-key]', { presetKey: 'robot' }); assert.equal(f.window.MAKERSPACE.clubSignatures.length, 0);
  await f.module.authenticateAdmin('nick'); f.module.completeBattleLogin();
  await f.click('[data-preset-key]', { presetKey: 'robot' });
  assert.equal(f.window.MAKERSPACE.clubSignatures.length, 1);
  await f.module.saveLayout(); assert.equal(storage.size, 0);
  assert.match(f.nodes.get('signature-layout-status').textContent, /Connect the shared service/);
  const later = ui(false, storage); await flush();
  assert.equal(later.window.MAKERSPACE.clubSignatures.length, 0);
  assert.equal(later.nodes.get('signature-admin-rail').hidden, true);
});
test('live palette saves authenticated layouts and signout discards later drafts', async () => {
  const f = ui(true); await flush(); await f.module.authenticateAdmin('secret'); f.module.completeBattleLogin();
  await f.click('[data-preset-key]', { presetKey: 'makerspace' }); await f.module.saveLayout();
  const save = f.calls.find(call => call.route === '/admin/layout');
  assert.equal(save.method, 'PUT'); assert.equal(save.headers.Authorization, 'Bearer ' + 'a'.repeat(64));
  assert.equal(JSON.parse(save.body).placements[0].key, 'makerspace');
  await f.click('[data-preset-key]', { presetKey: 'spark' }); assert.equal(f.window.MAKERSPACE.clubSignatures.length, 2);
  await f.click('[data-signature-signout]'); assert.equal(f.window.MAKERSPACE.clubSignatures.length, 1);
  assert.equal(f.module.hasAdminSession(), false);
});

async function chooseImage(f, type = 'image/jpeg') {
  await f.click('[data-signature-upload]');
  f.nodes.get('signature-name').value = 'Nick';
  f.nodes.get('signature-file').files = [new Blob(['photo'], { type })];
  await f.nodes.get('signature-file').emit('change'); await flush();
}
test('accepted photos launch the actual prepared image and close the upload dialog', async () => {
  const f = ui(true); await flush(); await chooseImage(f);
  assert.equal(f.nodes.get('signature-send').disabled, false);
  const actualImage = f.nodes.get('signature-preview').src;
  await f.nodes.get('signature-upload-form').emit('submit'); await flush();
  assert.equal(f.flightCalls.length, 1); assert.equal(f.flightCalls[0].imageURL, actualImage);
  assert.equal(f.nodes.get('signature-upload-dialog').open, false);
  const sent = f.calls.find(call => call.route === '/submissions');
  assert.equal(sent.body.get('name'), 'Nick'); assert.equal(sent.body.get('image').type, 'image/png');
  assert.equal(f.nodes.get('signature-upload-status').textContent, 'Sent.');
});
test('failed sends never launch a plane and retry the same submission without duplicates', async () => {
  const f = ui(true); await flush(); await chooseImage(f, 'image/webp'); f.uploadFailure = true;
  await f.nodes.get('signature-upload-form').emit('submit'); await flush();
  assert.equal(f.flightCalls.length, 0); assert.equal(f.nodes.get('signature-send').disabled, false);
  assert.equal(f.nodes.get('signature-upload-dialog').open, true);
  assert.equal(f.nodes.get('signature-upload-status').textContent, 'Try again.');
  f.uploadFailure = false; await f.nodes.get('signature-upload-form').emit('submit'); await flush();
  const attempts = f.calls.filter(call => call.route === '/submissions');
  assert.equal(attempts[0].body.get('submissionId'), attempts[1].body.get('submissionId'));
  assert.equal(f.flightCalls.length, 1);
});
test('an unconnected service prepares the image but never reports or animates a sent upload', async () => {
  const f = ui(false); await flush(); await chooseImage(f);
  await f.nodes.get('signature-upload-form').emit('submit'); await flush();
  assert.equal(f.flightCalls.length, 0); assert.equal(f.calls.length, 0);
  assert.match(f.nodes.get('signature-upload-status').textContent, /Uploads are unavailable/);
  assert.equal(f.nodes.get('signature-upload-dialog').open, true);
});

test('direct drag crosses sheets continuously, corner resizing preserves aspect, cancellation restores the draft', async () => {
  const f = ui(true); await flush(); await f.module.authenticateAdmin('secret'); f.module.completeBattleLogin(); await flush();
  await f.click('[data-preset-key]', { presetKey: 'robot' });
  const row = f.window.MAKERSPACE.clubSignatures[0], selector = `[data-signature-id="${row.id}"]`;
  const start = { ...row };
  await f.dispatch('pointerdown', { target: f.figures.get(selector), button: 0, pointerId: 1, clientX: 600, clientY: 180 });
  await f.dispatch('pointermove', { pointerId: 1, clientX: 200, clientY: 220 });
  assert.equal(row.page, 'left', 'page follows the pointer before releasing');
  assert.equal(f.figures.get(selector).paper, f.papers.left);
  await f.dispatch('pointerup', { pointerId: 1, clientX: 200, clientY: 220 });
  assert.ok(!f.calls.some(call => call.route === '/admin/layout'), 'drag never publishes immediately');
  const corner = new f.Element(); corner.selector = '[data-signature-resize]'; corner.dataset.signatureResize = 'se'; corner.figure = f.figures.get(selector);
  const beforeResize = { ...row };
  await f.dispatch('pointerdown', { target: corner, button: 0, pointerId: 2, clientX: 300, clientY: 280 });
  await f.dispatch('pointermove', { pointerId: 2, clientX: 350, clientY: 280 });
  assert.equal(row.width, beforeResize.width + 10); assert.equal(row.height, row.width * .827);
  await f.dispatch('pointercancel', { pointerId: 2 });
  assert.equal(row.width, beforeResize.width); assert.equal(row.page, 'left');
  await f.dispatch('pointerdown', { target: f.figures.get(selector), button: 0, pointerId: 3, clientX: 200, clientY: 220 });
  await f.dispatch('pointermove', { pointerId: 3, clientX: 600, clientY: 220 });
  await f.dispatch('pointercancel', { pointerId: 3 });
  assert.equal(row.page, 'left', 'cancel restores the original sheet');
  assert.equal(f.figures.get(selector).paper, f.papers.left);
  await f.module.saveLayout();
  const saved = JSON.parse(f.calls.find(call => call.route === '/admin/layout').body).placements[0];
  assert.equal(saved.page, 'left'); assert.equal(saved.width, start.width);
});

test('detailed photos shrink automatically below the storage size limit before sending', async () => {
  const f = ui(true, new Map(), { detailed: true, width: 1024, height: 512 }); await flush(); await chooseImage(f);
  assert.equal(f.nodes.get('signature-send').disabled, false);
  await f.nodes.get('signature-upload-form').emit('submit'); await flush();
  const prepared = f.calls.find(call => call.route === '/submissions').body.get('image');
  assert.ok(prepared.size > 0 && prepared.size <= 512 * 1024);
  assert.equal(f.flightCalls.length, 1);
});
