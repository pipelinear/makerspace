import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../dist/signature-flight.js', import.meta.url), 'utf8');
function fixture({ reduced = false, slow = false } = {}) {
  let now = 0, sequence = 0, pendingDecode;
  const frames = new Map(), listeners = new Map(), overlays = [], classes = new Set();
  const context = new Proxy({}, { get: () => () => {}, set: () => true });
  const canvas = () => ({ width: 0, height: 0, getContext: () => context });
  const document = { createElement(type) {
    if (type === 'canvas') return canvas();
    const drawing = canvas(), button = { focus() {}, addEventListener(type, fn) { this[type] = fn; } };
    return { dataset: {}, querySelector: selector => selector === 'canvas' ? drawing : button, remove() { this.removed = true; } };
  } };
  const window = { innerWidth: 1440, innerHeight: 900, devicePixelRatio: 2,
    matchMedia: () => ({ matches: reduced }), addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
  const box = vm.createContext({ window, document, console,
    Image: class { naturalWidth = 500; naturalHeight = 200; decode() { return slow ? new Promise(resolve => { pendingDecode = resolve; }) : Promise.resolve(); } },
    performance: { now: () => now }, requestAnimationFrame(fn) { const id = ++sequence; frames.set(id,fn); return id; }, cancelAnimationFrame: id => frames.delete(id) });
  vm.runInContext(source, box);
  const dialog = { open: true, appendChild: node => overlays.push(node), classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
  return { module: window.MAKERSPACE_FLIGHT, dialog, frames, classes, listeners, overlays,
    tick(seconds) { now = seconds*1000; const current = [...frames.values()]; frames.clear(); current.forEach(fn => fn(now)); }, decode() { pendingDecode(); } };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
test('the uploaded paper folds through its stages and flies completely outside the viewport', async () => {
  const f = fixture(); const playing = f.module.play(f.dialog, 'blob:uploaded-image'); await flush();
  assert.equal(f.overlays.length, 1); assert.ok(f.classes.has('is-sending'));
  for (const [time, stage] of [[0,'paper'],[1.1,'corners'],[2.2,'dart'],[3.3,'keel'],[4.3,'wings'],[5.2,'flight']]) {
    f.tick(time); assert.equal(f.overlays[0].dataset.stage, stage);
  }
  for (const [w,h] of [[1440,900],[390,844],[320,568],[740,390]]) {
    const end = f.module.pose(7.15,w,h); assert.ok(end.x - 300*end.scale > w, 'finished flight clears the viewport');
  }
  f.tick(7.2); await playing;
  assert.equal(f.frames.size, 0); assert.equal(f.listeners.has('resize'), false);
  assert.equal(f.classes.has('is-sending'), false); assert.equal(f.overlays[0].removed, true);
});
test('skip, cancel, pagehide and reduced motion clean up the modal and animation loop', async () => {
  for (const action of ['skip','cancel','pagehide']) {
    const f = fixture(); const playing = f.module.play(f.dialog,'blob:image'); await flush();
    if (action === 'skip') f.overlays[0].querySelector('button').click();
    else if (action === 'pagehide') f.listeners.get('pagehide')();
    else f.module.cancel();
    await playing; assert.equal(f.frames.size,0); assert.equal(f.classes.size,0); assert.equal(f.overlays[0].removed,true);
  }
  const reduced = fixture({ reduced: true }); const playing = reduced.module.play(reduced.dialog,'blob:image'); await flush();
  reduced.tick(.5); assert.equal(reduced.overlays[0].dataset.stage,'sent');
  reduced.tick(1.3); await playing; assert.equal(reduced.frames.size,0);
});
test('cancelling while the image decodes prevents a stale flight from appearing', async () => {
  const f = fixture({ slow: true }); const playing = f.module.play(f.dialog,'blob:image');
  f.module.cancel(); f.decode(); await playing;
  assert.equal(f.overlays.length,0); assert.equal(f.frames.size,0);
});
