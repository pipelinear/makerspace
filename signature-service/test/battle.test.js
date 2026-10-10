import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../dist/admin-battle.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function fixture({ width = 1440, height = 900, reduced = false, live = false, authenticated = false, localFile = false, decodeImage, closeBook = async () => {}, bookRect } = {}) {
  let now = 0, counter = 0, prepared = 0, opened = 0, committed = 0, discarded = 0;
  const nodes = new Map(), timers = new Map(), frames = new Map(), listeners = {}, phases = [], locks = [], announcements = [], draws = [], music = [], clips = [], phaseTimes = [], beams = [], images = [];
  let transform = { x: 0, y: 0, rotation: 0, alpha: 1, facing: 1 }; const stack = [];
  const context2D = {
    clearRect() { transform = { x: 0, y: 0, rotation: 0, alpha: 1, facing: 1 }; }, fillRect() { if (this.fillStyle === '#d9573a') beams.push({ at: now, phase: nodes.get('admin-battle').dataset.phase, transform: { ...transform } }); },
    save() { stack.push({ ...transform }); }, restore() { transform = stack.pop(); }, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {},
    rect(...args) { if (nodes.get('admin-battle').dataset.phase === 'takeover') clips.push({ at: now, args }); }, clip() {},
    translate(x, y) { transform.x += x; transform.y += y; }, rotate(r) { transform.rotation += r; }, scale(x) { transform.facing *= x; },
    set globalAlpha(value) { transform.alpha = value; },
    drawImage(...args) { args.at = now; args.phase = nodes.get('admin-battle').dataset.phase; args.transform = { ...transform }; draws.push(args); }
  };
  class Element {
    constructor(id) {
      this.id = id; this.style = { transform: '', transformOrigin: '', setProperty(name, value) { this[name] = value; } }; this.hidden = false; this.open = false; this.inert = false; this.disabled = false; this.value = ''; this.listeners = {}; this.attrs = {};
      const classes = new Set();
      this.classList = { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n), toggle: (n, yes) => yes ? classes.add(n) : classes.delete(n) };
      const state = {};
      this.dataset = new Proxy(state, { set(target, name, value) { target[name] = value; if (id === 'admin-battle' && name === 'phase') { phases.push(value); phaseTimes.push({ name: value, at: now }); } return true; } });
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
    for (const [, id, text] of html.matchAll(/<button[^>]*id="([^"]+)"[^>]*>([^<]*)/g)) nodes.get(id).textContent = text;
    for (const side of ['enemy', 'player']) nodes.get(`battle-${side}-health`).parentElement = new Element();
  };
  const window = {
    Audio: class {
      constructor(src) { this.src = src; this.paused = true; this.listeners = {}; this.failures = []; this.playCalls = 0; music.push(this); }
      addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
      emit(name) { (this.listeners[name] || []).forEach(fn => fn()); }
      play() {
        this.playCalls++;
        const failure = this.failures.shift();
        if (failure) return Promise.reject(failure);
        this.paused = false; this.emit('playing'); return Promise.resolve();
      }
      pause() { this.paused = true; }
    },
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
    Image: class {
      naturalWidth = 1536; naturalHeight = 1024;
      constructor() { images.push(this); }
      decode() {
        if (localFile && !/^https?:/.test(this.src) && this.crossOrigin === 'anonymous') return Promise.reject(new Error('Local file blocked by CORS'));
        return decodeImage ? decodeImage(this) : Promise.resolve();
      }
    },
    setTimeout(fn, delay) { const id = ++counter; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame(fn) { const id = ++counter; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  vm.runInContext(source, sandbox);
  const battle = window.MAKERSPACE_BATTLE;
  battle.init({ canStart: () => true, closeMenu() {}, closeBook, lock: value => locks.push(value), bookRect: bookRect || (() => nodes.get('cover-stage').getBoundingClientRect()), prepareApprovals: async () => { prepared++; }, announce: value => announcements.push(value) });
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
  return { battle, nodes, window, document, phases, locks, draws, announcements, timers, frames, music, clips, phaseTimes, beams, images, until, advance, render, tick(ms) { now += ms; render(); }, async finish() { for (let i = 0; i < 30 && battle.active(); i++) await advance(); assert.equal(battle.active(), false); }, get result() { return { prepared, opened, committed, discarded }; }, dispatch(name) { (listeners[name] || []).forEach(fn => fn()); } };
}

test('clicking the ball on a local file loads bundled artwork without a CORS request and reaches the battle', async () => {
  const f = fixture({ localFile: true });
  const started = f.nodes.get('admin-battle-button').emit('click');
  await f.until('choose-action'); await started;
  assert.ok(f.phases.includes('throw'));
  assert.equal(f.images.find(image => image.src.includes('mascot-sheet')).crossOrigin, undefined);
  assert.equal(f.images.find(image => image.src.includes('/platinum/')).crossOrigin, 'anonymous');
  await f.nodes.get('admin-battle').emit('cancel');
});

test('slow sprite decoding does not delay the ball throw, and closing during decoding cancels the battle', async () => {
  let resolvePlayer;
  const f = fixture({ decodeImage: image => image.src.includes('/platinum/') ? new Promise(resolve => { resolvePlayer = resolve; }) : Promise.resolve() });
  const started = f.battle.start();
  await f.until('throw');
  assert.ok(!f.phases.includes('release'));
  await f.nodes.get('admin-battle').emit('cancel'); resolvePlayer(); await started;
  assert.equal(f.battle.active(), false); assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  assert.ok(!f.phases.includes('release'));
});

async function reachPassword(f) {
  const started = f.battle.start(); await f.until('choose-action'); await started;
  assert.equal(f.nodes.get('battle-message').textContent, 'What will PIKACHU do?');
  await f.nodes.get('battle-fight').emit('click'); await f.until('choose-attack');
  f.render();
  const attack = f.nodes.get('battle-laser').emit('click'); await f.until('password'); await attack;
  assert.equal(f.nodes.get('battle-enemy-health').style.width, '42%');
  assert.equal(f.nodes.get('battle-player-health-text').textContent, '18 / 43');
  assert.equal(f.nodes.get('battle-password-form').hidden, false);
  assert.match(f.nodes.get('battle-message').textContent, /magic word!/);
}
test('preview victory unlocks local controls after every battle phase', async () => {
  const f = fixture(); await reachPassword(f);
  assert.deepEqual(f.phases.slice(1, 10), ['bounce-one', 'bounce-two', 'throw', 'land', 'release', 'takeover', 'encounter', 'send-out', 'choose-action']);
  assert.ok(f.draws.some(args => args[0].src.includes('mascot-sheet')));
  assert.ok(f.draws.some(args => args[0].src.includes('/platinum/25.png')));
  const release = f.draws.find(args => args.phase === 'release');
  assert.ok((release.transform.x + release[5] + release[7]) * 1440 / 384 < 400, 'released sprite stays entirely to the left of the book');
  const takeover = f.phaseTimes.find(p => p.name === 'takeover');
  assert.equal(f.phaseTimes.find(p => p.name === 'encounter').at - takeover.at, 2550);
  assert.ok(f.clips.filter(c => c.at === takeover.at).length >= 40, 'takeover starts as a larger established patch');
  assert.equal(f.music.length, 1); assert.equal(f.music[0].loop, true); assert.equal(f.music[0].paused, false);
  const standing = f.draws.filter(d => d.phase === 'choose-attack');
  f.tick(1);
  assert.ok(standing.length >= 2);
  assert.ok(standing.every(d => d[6] + d[8] === 0), 'opaque sprite bottoms stay on the foot anchor during idle');
  assert.ok(standing.filter(d => d[0].src.includes('/platinum/25.png')).every(d => d[1] === 0 && d[2] === 0), 'Pikachu keeps the standing pose');
  assert.ok(standing.filter(d => d[0].src.includes('/platinum/25.png')).every(d => d.transform.y + d[6] >= 69), 'Pikachu clears the enemy health panel');
  assert.ok(standing.filter(d => d[0].src.includes('mascot-sheet')).every(d => d.transform.y + d[6] >= 26), 'The Don clears the top controls');
  f.nodes.get('battle-password').value = 'nick'; const submitted = f.nodes.get('battle-password-form').emit('submit');
  await f.finish(); await submitted;
  assert.ok(f.phases.includes('celebrate')); assert.ok(f.draws.some(d => d.phase === 'celebrate' && d[0].src.includes('/platinum/25.png') && d.transform.facing > .9), 'victory turns Pikachu toward the viewer'); assert.ok(standing.filter(d => d[0].src.includes('/platinum/25.png')).every(d => d.transform.facing === -1), 'normal pose faces the opponent'); assert.ok(f.phases.includes('faint-enemy')); assert.ok(!f.phases.includes('faint-player'));
  assert.deepEqual(f.phases.slice(-4), ['result', 'off', 'reveal', 'device-exit']);
  assert.equal(f.result.opened, 0); assert.equal(f.result.committed, 1); assert.equal(f.result.prepared, 1);
  assert.match(f.announcements[0], /Signing desk unlocked/);
  assert.equal(f.document.body.style.overflow, 'auto'); assert.equal(f.nodes.get('main-content').inert, false);
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  assert.equal(f.nodes.get('battle-password').value, '');
  assert.equal(f.document.activeElement.id, 'footer-volume');
  assert.equal(f.music[0].paused, true);
});
test('wrong password tumbles Pikachu without fading and real victory commits access after device removal', async () => {
  const loser = fixture({ live: true }); await reachPassword(loser);
  loser.nodes.get('battle-password').value = 'wrong'; const lost = loser.nodes.get('battle-password-form').emit('submit');
  await loser.finish(); await lost;
  assert.ok(loser.phases.includes('final-water')); assert.ok(loser.phases.includes('faint-player'));
  assert.equal(loser.nodes.get('battle-player-health-text').textContent, '0 / 43');
  assert.equal(loser.result.opened, 0); assert.equal(loser.result.committed, 0);
  assert.equal(loser.result.prepared, 0, 'lost battles keep the original book location');
  const falling = loser.draws.filter(d => d[0].src.includes('/platinum/25.png') && d.phase === 'faint-player');
  assert.ok(falling.some(d => d.transform.rotation < -1.5), 'Pikachu falls onto its side');
  assert.ok(falling.every(d => d.transform.alpha === 1), 'the character never fades during defeat');
  assert.ok(loser.draws.some(d => d[0].src.includes('/platinum/25.png') && d.phase === 'result' && d.transform.alpha === 1 && d.transform.rotation < -1.5), 'fallen Pikachu remains until TV off');
  const winner = fixture({ live: true }); await reachPassword(winner);
  winner.nodes.get('battle-password').value = 'nick'; const won = winner.nodes.get('battle-password-form').emit('submit');
  await winner.until('device-exit'); assert.equal(winner.result.committed, 0);
  await winner.finish(); await won;
  assert.equal(winner.result.prepared, 1); assert.equal(winner.result.committed, 1); assert.equal(winner.result.opened, 0, 'the desk appears alongside the book rather than in a dialog');
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
  await f.nodes.get('admin-battle').emit('cancel'); resolve({ granted: true, mode: 'live' }); await pending;
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
  assert.equal(f.music[0].paused, true);
  await reachPassword(f); await f.nodes.get('battle-sound').emit('click');
  assert.equal(f.nodes.get('battle-sound').attrs['aria-pressed'], 'false');
  assert.equal(f.music[1].muted, true);
  await f.nodes.get('battle-sound').emit('click'); assert.equal(f.music[1].muted, false);
  f.dispatch('hashchange'); assert.equal(f.battle.active(), false); assert.equal(f.frames.size, 0);
});
test('an active admin session reopens the desk without running another battle', async () => {
  const f = fixture({ live: true, authenticated: true }); await f.battle.start();
  assert.equal(f.result.prepared, 1); assert.equal(f.result.opened, 0); assert.equal(f.battle.active(), false);
  assert.deepEqual(f.locks, []);
});

test('failed and slow external music use the bundled loop and stop at shutdown', async () => {
  const failed = fixture(); const started = failed.battle.start();
  failed.music[0].emit('error');
  await failed.until('choose-action'); await started;
  assert.equal(failed.music[0].src, 'assets/battle/battle-theme.mp3');
  assert.equal(failed.music[0].paused, false);
  assert.equal(failed.music[0].loop, true);
  assert.equal(failed.music[0].playCalls, 2, 'switching sources explicitly starts the fallback');
  await failed.nodes.get('admin-battle').emit('cancel');
  failed.music[0].emit('error'); await failed.nodes.get('admin-battle').emit('click');
  assert.equal(failed.music[0].paused, true);
  assert.equal(failed.timers.size, 0);

  const slow = fixture(); const play = slow.window.Audio.prototype.play;
  slow.window.Audio.prototype.play = function () {
    if (this.src.startsWith('https:')) return new Promise(() => {});
    return play.call(this);
  };
  const loading = slow.battle.start(); await slow.until('choose-action'); await loading;
  assert.equal(slow.music[0].src, 'assets/battle/battle-theme.mp3');
  assert.equal(slow.music[0].paused, false);
  const escaped = slow.nodes.get('battle-run').emit('click'); assert.equal(slow.battle.active(), false);
  assert.equal(slow.music[0].paused, true);
  await slow.nodes.get('admin-battle').emit('click');
  await slow.nodes.get('battle-sound').emit('click'); await slow.nodes.get('battle-sound').emit('click');
  assert.equal(slow.music[0].paused, true, 'gestures and unmuting cannot restart shutdown music');
  await slow.finish(); await escaped;
});

test('a player gesture retries blocked music without changing tracks or overriding mute', async () => {
  const f = fixture();
  const play = f.window.Audio.prototype.play;
  f.window.Audio.prototype.play = function () {
    this.failures.push(new DOMException('Gesture required', 'NotAllowedError'));
    f.window.Audio.prototype.play = play;
    return play.call(this);
  };
  const started = f.battle.start(); await flush();
  assert.equal(f.music[0].paused, true);
  await f.nodes.get('admin-battle').emit('keydown');
  assert.equal(f.music[0].paused, false);
  assert.match(f.music[0].src, /^https:/);
  await f.until('choose-action'); await started;
  await f.nodes.get('battle-sound').emit('click'); f.music[0].pause();
  const calls = f.music[0].playCalls;
  await f.nodes.get('admin-battle').emit('click'); assert.equal(f.music[0].playCalls, calls);
  await f.nodes.get('battle-sound').emit('click');
  assert.equal(f.music[0].paused, false); assert.equal(f.music[0].muted, false);
  await f.nodes.get('admin-battle').emit('cancel');
});

test('health panels clear the full standing sprites at desktop, short-window and mobile sizes', async () => {
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (const [width, height] of [[2048, 900], [2048, 1100], [1440, 900], [740, 390], [390, 844], [320, 568], [3440, 1440]]) {
    const f = fixture({ width, height });
    const started = f.battle.start(); await f.until('choose-action'); await started; f.render();
    const before = JSON.stringify(f.battle.layoutForViewport(width, height));
    const layout = f.battle.layoutForViewport(width, height);
    const panels = ['battle-enemy-panel', 'battle-player-panel'].map(id => {
      const r = layout.ui[id]; return { ...r, w: r.w + 4, h: r.h + 5 };
    });
    for (const draw of f.draws.filter(d => d.phase === 'choose-action')) {
      const body = { x: draw.transform.x + draw[5], y: draw.transform.y + draw[6], w: draw[7], h: draw[8] };
      assert.ok(body.x >= 0 && body.x + body.w <= layout.width, `sprite fits horizontally at ${width}×${height}`);
      assert.ok(body.y >= 22 && body.y + body.h < layout.fieldH - 3, 'sprite clears controls and dialogue');
      assert.ok(panels.every(panel => !overlaps(body, panel)), `health boxes clear ${draw[0].src} at ${width}×${height}`);
    }
    await f.nodes.get('battle-fight').emit('click'); f.render();
    const fired = f.nodes.get('battle-laser').emit('click'); await f.until('laser'); f.tick(450);
    for (const beam of f.beams) {
      const draw = f.draws.find(d => d.at === beam.at && d.phase === beam.phase && d[0].src.includes('/platinum/25.png'));
      assert.ok(draw, 'laser has a matching player pose');
      assert.ok(beam.transform.x > draw.transform.x + draw[5] && beam.transform.x < draw.transform.x + draw[5] + draw[7], 'laser starts within player body width');
      assert.ok(beam.transform.y > draw.transform.y + draw[6] && beam.transform.y < draw.transform.y + draw[6] + draw[8], 'laser starts within player body height');
    }
    assert.ok(f.beams.length > 0, 'attack drew a laser');
    await f.until('password'); await fired; f.render();
    assert.equal(JSON.stringify(f.battle.layoutForViewport(width, height)), before, 'password leaves the field and actors stationary');
    for (const [id, rect] of Object.entries(layout.ui)) {
      const global = ['battle-enemy-panel', 'battle-player-panel', 'battle-dialogue', 'battle-preview-label', 'battle-sound'].includes(id);
      const control = f.nodes.get(id);
      assert.equal(parseFloat(control.style.left), rect.x * layout.scale, `${id} hit target matches painted position`);
      assert.equal(parseFloat(control.style.top), (rect.y - (global ? 0 : layout.fieldH)) * layout.scale, `${id} hit target matches painted position`);
    }
    await f.nodes.get('admin-battle').emit('cancel');
  }
});

test('the battle menu supports bag, party and escape without granting approval access', async () => {
  const f = fixture({ live: true });
  const started = f.battle.start(); await f.until('choose-action'); await started;
  await f.nodes.get('battle-party').emit('click');
  assert.match(f.nodes.get('battle-message').textContent, /no POKEMON left/);
  assert.equal(f.nodes.get('battle-menu').hidden, false);
  assert.equal(f.nodes.has('battle-close'), false);
  await f.nodes.get('battle-run').emit('click');
  assert.equal(f.battle.active(), false); assert.equal(f.nodes.get('admin-battle').open, false);
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0); assert.equal(f.music[0].paused, true);
  assert.ok(!f.phases.includes('off'), 'RUN quits immediately');
  assert.equal(f.result.prepared, 0); assert.equal(f.result.opened, 0); assert.equal(f.result.committed, 0);
  assert.match(f.announcements[0], /Back to the book/);
});

test('BAG throws a ball from the foreground, recalls Pikachu along a ray, and exits without unlocking', async () => {
  for (const width of [1440, 390]) {
    const f = fixture({ width, live: true });
    const started = f.battle.start(); await f.until('choose-action'); await started;
    const layout = f.battle.layoutForViewport(width, 900);
    const origin = f.battle.recallBall(layout, 'bag-throw', 0), landed = f.battle.recallBall(layout, 'bag-throw', 1);
    assert.ok(origin.y - origin.size / 2 > layout.height, 'ball begins beyond the bottom of the viewport');
    assert.ok(landed.y < layout.fieldH && landed.size < origin.size, 'ball lands in the scene and shrinks with depth');
    const bag = f.nodes.get('battle-bag').emit('click');
    await f.until('bag-recall');
    f.tick(550);
    const shrinking = f.draws.filter(d => d.phase === 'bag-recall' && d[0].src.includes('/platinum/'));
    assert.ok(shrinking.at(-1)[8] < shrinking[0][8], 'Pikachu shrinks into the ball');
    assert.ok(shrinking.at(-1).transform.x > shrinking[0].transform.x, 'Pikachu moves toward the ball');
    assert.ok(f.beams.some(b => b.phase === 'bag-recall'), 'a ray connects the ball and Pikachu');
    await f.until('bag-rest'); f.render();
    assert.ok(!f.draws.some(d => d.phase === 'bag-rest' && d[0].src.includes('/platinum/')), 'captured Pikachu stays inside the closed ball');
    await f.finish(); await bag;
    assert.equal(f.result.prepared, 0); assert.equal(f.result.committed, 0); assert.equal(f.nodes.get('main-content').inert, false);
  }
});

test('Escape during the Bag recall restores the book and cancels the ray without unlocking the desk', async () => {
  const f = fixture({ reduced: true });
  const started = f.battle.start(); await f.until('choose-action'); await started;
  const bag = f.nodes.get('battle-bag').emit('click'); await f.until('bag-recall');
  await f.nodes.get('admin-battle').emit('cancel'); await bag;
  assert.equal(f.battle.active(), false); assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  assert.equal(f.nodes.get('main-content').inert, false); assert.equal(f.music[0].paused, true);
  assert.equal(f.result.committed, 0); assert.equal(f.result.prepared, 0);
});

test('transparent sprite margins are removed and the visible body grows by one third', () => {
  const f = fixture(), pixels = new Uint8ClampedArray(80 * 80 * 4);
  for (let y = 15; y < 66; y++) for (let x = 10; x < 50; x++) pixels[(y * 80 + x) * 4 + 3] = 255;
  const bounds = f.battle.opaqueBounds(pixels, 80, 80);
  assert.deepEqual(Array.from(bounds), [10, 15, 40, 51]);
  const layout = f.battle.layoutForViewport(1440, 900, bounds);
  const previousVisibleSize = Math.min(104, layout.fieldH * .45, layout.fieldH - 83) * 51 / 80;
  assert.ok(Math.abs(layout.player.size / previousVisibleSize - 4 / 3) < .001);
  assert.equal(layout.player.y, layout.fieldH - 8, 'cropped sprite feet use the ground anchor');
});

test('local and connected battles await the closed book before measuring and starting; repeated clicks do not restart closing', async () => {
  for (const live of [false, true]) {
    let finishClosing, closed = false, closingCalls = 0;
    const f = fixture({ live, closeBook: () => { closingCalls++; return new Promise(resolve => { finishClosing = () => { closed = true; resolve(); }; }); }, bookRect: () => {
      assert.equal(closed, true, 'landing position is measured after the cover closes');
      return { left: 400, top: 150, width: 550, height: 500 };
    } });
    const started = f.battle.start();
    assert.equal(closingCalls, 1); assert.equal(f.battle.active(), true);
    assert.equal(f.nodes.get('admin-battle').open, false, 'battle canvas stays hidden during book closing');
    assert.equal(f.frames.size, 0); assert.equal(f.document.body.style.overflow, 'auto');
    await f.battle.start(); assert.equal(closingCalls, 1);
    finishClosing(); await f.until('choose-action'); await started;
    assert.equal(f.nodes.get('admin-battle').open, true);
    await f.nodes.get('admin-battle').emit('cancel');
    assert.equal(f.battle.active(), false);
  }
});

test('navigation during book closing cancels the pending battle and never opens a stale canvas', async () => {
  let finishClosing;
  const f = fixture({ closeBook: () => new Promise(resolve => { finishClosing = resolve; }) });
  const started = f.battle.start();
  f.dispatch('hashchange'); finishClosing(); await started;
  assert.equal(f.battle.active(), false); assert.equal(f.nodes.get('admin-battle').open, false);
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  assert.deepEqual(f.locks, [true, false]); assert.equal(f.document.body.style.overflow, 'auto');
});
