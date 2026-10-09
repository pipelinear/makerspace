import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../dist/admin-battle.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function fixture({ width = 1440, height = 900, reduced = false, live = false, authenticated = false } = {}) {
  let now = 0, counter = 0, prepared = 0, opened = 0, committed = 0, discarded = 0;
  const nodes = new Map(), timers = new Map(), frames = new Map(), listeners = {}, phases = [], locks = [], announcements = [], draws = [];
  const context2D = { clearRect() {}, fillRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, translate() {}, rotate() {}, scale() {}, drawImage(...args) { args.phase = nodes.get('admin-battle').dataset.phase; draws.push(args); } };
  class Element {
    constructor(id) {
      this.id = id; this.style = { transform: '', transformOrigin: '' }; this.hidden = false; this.open = false; this.inert = false; this.disabled = false; this.value = ''; this.listeners = {}; this.attrs = {};
      const classes = new Set();
      this.classList = { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n), toggle: (n, yes) => yes ? classes.add(n) : classes.delete(n) };
      const state = {};
      this.dataset = new Proxy(state, { set(target, name, value) { target[name] = value; if (id === 'admin-battle' && name === 'phase') phases.push(value); return true; } });
    }
    get clientWidth() { return window.innerWidth; }
    get clientHeight() { return window.innerHeight; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name) { const results = (this.listeners[name] || []).map(fn => fn({ target: this, preventDefault() {} })); return Promise.all(results); }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    focus() { document.activeElement = this; }
    setAttribute(name, value) { this.attrs[name] = value; }
    getAnimations() { return []; }
    getContext() { return context2D; }
    getBoundingClientRect() {
      if (this.id === 'admin-battle-button') return { left: window.innerWidth - 70, top: window.innerHeight - 170, width: 44, height: 44 };
      if (this.id === 'battle-dialogue') return { height: 160 };
      return { left: window.innerWidth < 700 ? 130 : 400, top: 150, width: window.innerWidth < 700 ? 235 : 550, height: 500 };
    }
  }
  for (const id of ['main-content', 'site-header', 'cover-stage', 'footer-volume', 'admin-battle-button', 'volume-selector']) nodes.set(id, new Element(id));
  const document = {
    activeElement: null,
    body: new Element('body'),
    getElementById: id => nodes.get(id),
    querySelector: selector => nodes.get(selector === '.site-header' ? 'site-header' : 'volume-selector')
  };
  document.body.style.overflow = 'auto';
  document.body.insertAdjacentHTML = (_where, html) => {
    for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, new Element(id));
    for (const side of ['enemy', 'player']) nodes.get(`battle-${side}-health`).parentElement = new Element();
  };
  const window = {
    innerWidth: width, innerHeight: height,
    matchMedia: () => ({ matches: reduced }),
    MAKERSPACE: { signatureSettings: { apiUrl: live ? 'https://service.test' : '' } },
    MAKERSPACE_SIGNATURES: {
      hasAdminSession: () => authenticated,
      authenticateAdmin: async password => ({ granted: password === 'nick', mode: live ? 'live' : 'preview' }),
      completeBattleLogin: () => { committed++; },
      discardBattleLogin: () => { discarded++; },
      openAdmin: async () => { opened++; }
    },
    addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); }
  };
  const sandbox = vm.createContext({
    window, document, console, DOMException, AbortController, performance: { now: () => now },
    Image: class { naturalWidth = 1536; naturalHeight = 1024; decode() { return Promise.resolve(); } },
    setTimeout(fn, delay) { const id = ++counter; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame(fn) { const id = ++counter; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  vm.runInContext(source, sandbox);
  const battle = window.MAKERSPACE_BATTLE;
  battle.init({ canStart: () => true, closeMenu() {}, lock: value => locks.push(value), bookRect: () => nodes.get('cover-stage').getBoundingClientRect(), prepareApprovals: async () => { prepared++; }, announce: value => announcements.push(value) });
  function render() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); }
  async function advance() {
    await flush();
    const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) { render(); return false; }
    now = next[1].at - 1; render(); now++; timers.delete(next[0]); next[1].fn(); await flush(); render(); return true;
  }
  async function until(target) {
    for (let i = 0; i < 30; i++) { await flush(); if (nodes.get('admin-battle').dataset.phase === target) return; if (!await advance()) break; }
    assert.equal(nodes.get('admin-battle').dataset.phase, target);
  }
  return { battle, nodes, window, document, phases, locks, draws, announcements, timers, frames, until, advance, async finish() { for (let i = 0; i < 30 && battle.active(); i++) await advance(); assert.equal(battle.active(), false); }, get result() { return { prepared, opened, committed, discarded }; }, dispatch(name) { (listeners[name] || []).forEach(fn => fn()); } };
}

async function reachPassword(f) {
  const started = f.battle.start(); await f.until('choose-attack'); await started;
  const attack = f.nodes.get('battle-laser').emit('click'); await f.until('password'); await attack;
  assert.equal(f.nodes.get('battle-enemy-health').style.width, '42%');
  assert.equal(f.nodes.get('battle-player-health-text').textContent, '18 / 43');
  assert.equal(f.nodes.get('battle-password-form').hidden, false);
}
test('preview victory follows every phase and never opens approvals', async () => {
  const f = fixture(); await reachPassword(f);
  assert.deepEqual(f.phases.slice(1, 8), ['bounce-one', 'bounce-two', 'throw', 'land', 'release', 'takeover', 'choose-attack']);
  assert.ok(f.draws.some(args => args[0].src.includes('mascot-sheet')));
  assert.ok(f.draws.some(args => args[0].src.includes('spark-sheet')));
  const release = f.draws.find(args => args.phase === 'release');
  assert.ok((release[5] + release[7]) * 1440 / 512 < 400, 'released sprite stays entirely to the left of the book');
  f.nodes.get('battle-password').value = 'nick'; const submitted = f.nodes.get('battle-password-form').emit('submit');
  await f.finish(); await submitted;
  assert.ok(f.phases.includes('faint-enemy')); assert.ok(!f.phases.includes('faint-player'));
  assert.deepEqual(f.phases.slice(-4), ['result', 'off', 'reveal', 'device-exit']);
  assert.equal(f.result.opened, 0); assert.equal(f.result.committed, 0); assert.equal(f.result.prepared, 0);
  assert.match(f.announcements[0], /Preview complete/);
  assert.equal(f.document.body.style.overflow, 'auto'); assert.equal(f.nodes.get('main-content').inert, false);
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  assert.equal(f.nodes.get('battle-password').value, '');
  assert.equal(f.document.activeElement.id, 'footer-volume');
});
test('wrong password knocks out Spark and real victory commits access after device removal', async () => {
  const loser = fixture({ live: true }); await reachPassword(loser);
  loser.nodes.get('battle-password').value = 'wrong'; const lost = loser.nodes.get('battle-password-form').emit('submit');
  await loser.finish(); await lost;
  assert.ok(loser.phases.includes('final-water')); assert.ok(loser.phases.includes('faint-player'));
  assert.equal(loser.nodes.get('battle-player-health-text').textContent, '0 / 43');
  assert.equal(loser.result.opened, 0); assert.equal(loser.result.committed, 0);
  const winner = fixture({ live: true }); await reachPassword(winner);
  winner.nodes.get('battle-password').value = 'nick'; const won = winner.nodes.get('battle-password-form').emit('submit');
  await winner.until('device-exit'); assert.equal(winner.result.committed, 0);
  await winner.finish(); await won;
  assert.equal(winner.result.prepared, 1); assert.equal(winner.result.committed, 1); assert.equal(winner.result.opened, 1);
});
test('network errors retry without losing health, and cancellation during a login cannot open the desk', async () => {
  const f = fixture({ live: true }); await reachPassword(f);
  f.window.MAKERSPACE_SIGNATURES.authenticateAdmin = async () => { throw new Error('Please wait before retrying.'); };
  f.nodes.get('battle-password').value = 'nick'; await f.nodes.get('battle-password-form').emit('submit');
  assert.equal(f.nodes.get('admin-battle').dataset.phase, 'password');
  assert.match(f.nodes.get('battle-password-error').textContent, /wait/);
  assert.equal(f.nodes.get('battle-password-submit').disabled, false);
  assert.equal(f.nodes.get('battle-player-health-text').textContent, '18 / 43');
  let resolve;
  f.window.MAKERSPACE_SIGNATURES.authenticateAdmin = () => new Promise(r => { resolve = r; });
  f.nodes.get('battle-password').value = 'nick'; const pending = f.nodes.get('battle-password-form').emit('submit');
  await f.nodes.get('battle-close').emit('click'); resolve({ granted: true, mode: 'live' }); await pending;
  assert.equal(f.battle.active(), false); assert.equal(f.result.opened, 0); assert.equal(f.result.committed, 0);
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
});
test('mobile, reduced motion, resize, repeated clicks and cancellation restore the page', async () => {
  const f = fixture({ width: 390, height: 844, reduced: true });
  const started = f.battle.start(); const duplicate = f.battle.start(); await duplicate;
  await f.until('throw');
  assert.equal(f.nodes.get('cover-stage').style.transform, 'translateX(6vw) scale(.72)');
  assert.deepEqual(f.locks, [true]);
  f.window.innerWidth = 740; f.window.innerHeight = 390; f.dispatch('resize');
  assert.equal(f.nodes.get('cover-stage').style.transform, '');
  await f.nodes.get('admin-battle').emit('cancel'); await started;
  assert.deepEqual(f.locks, [true, false]); assert.equal(f.battle.active(), false);
  assert.equal(f.nodes.get('cover-stage').style.transform, ''); assert.equal(f.frames.size, 0);
  assert.equal(f.document.body.style.overflow, 'auto');
  await reachPassword(f); await f.nodes.get('battle-sound').emit('click');
  assert.equal(f.nodes.get('battle-sound').attrs['aria-pressed'], 'false');
  f.dispatch('hashchange'); assert.equal(f.battle.active(), false); assert.equal(f.frames.size, 0);
});
test('an active admin session reopens the desk without running another battle', async () => {
  const f = fixture({ live: true, authenticated: true }); await f.battle.start();
  assert.equal(f.result.prepared, 1); assert.equal(f.result.opened, 1); assert.equal(f.battle.active(), false);
  assert.deepEqual(f.locks, []);
});
