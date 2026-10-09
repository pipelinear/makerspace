(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const loadSheet = async src => { const image = new Image(); image.src = src; await image.decode(); return image; };
  let sheets;
  const ensureSheets = () => {
    if (!sheets) {
      sheets = Promise.all([loadSheet('assets/battle/spark-sheet.png'), loadSheet('assets/battle/mascot-sheet.png')]);
      sheets.catch(() => { sheets = null; });
    }
    return sheets;
  };
  let hooks, run = null, soundOn = true;

  class BattleSound {
    constructor() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      try { this.context = Audio ? new Audio() : null; this.context?.resume().catch(() => {}); } catch { this.context = null; }
      this.voices = new Set();
    }
    tone(frequency, end, length = .13, delay = 0, type = 'square', volume = .055) {
      if (!soundOn || !this.context || this.context.state !== 'running') return;
      const context = this.context, oscillator = context.createOscillator(), gain = context.createGain();
      const start = context.currentTime + delay;
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + length);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, start + length);
      oscillator.connect(gain); gain.connect(context.destination);
      this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(start + length + .02);
    }
    play(kind) {
      if (kind === 'bounce') this.tone(180, 75, .1, 0, 'triangle', .1);
      if (kind === 'release') [330, 440, 660, 880].forEach((f, i) => this.tone(f, f * 1.2, .13, i * .075));
      if (kind === 'laser') { this.tone(1300, 80, .55, 0, 'sawtooth', .035); this.tone(650, 50, .5, .06, 'square', .025); }
      if (kind === 'water') [480, 720, 350, 580, 260, 420].forEach((f, i) => this.tone(f, f / 2, .18, i * .06, 'triangle', .07));
      if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, .19, i * .1));
      if (kind === 'lose') [392, 294, 196].forEach((f, i) => this.tone(f, f * .8, .26, i * .14));
      if (kind === 'off') this.tone(620, 22, .28, 0, 'triangle', .07);
    }
    mute() { for (const voice of this.voices) { try { voice.stop(); } catch {} } }
    close() { this.mute(); this.context?.close().catch(() => {}); }
  }

  function phase(name, milliseconds) {
    const active = run;
    if (!active) return Promise.reject(new DOMException('Closed', 'AbortError'));
    active.phase = name; active.started = performance.now(); active.duration = motion.matches ? Math.min(milliseconds, 180) : milliseconds;
    $('admin-battle').dataset.phase = name;
    if (['password', 'final-laser', 'final-water'].includes(name)) resize();
    if (milliseconds === undefined) { active.duration = 0; return Promise.resolve(); }
    return new Promise((resolve, reject) => {
      const cancelled = () => { clearTimeout(timer); active.timers.delete(timer); reject(new DOMException('Closed', 'AbortError')); };
      const timer = setTimeout(() => { active.timers.delete(timer); active.abort.signal.removeEventListener('abort', cancelled); resolve(); }, active.duration);
      active.timers.add(timer); active.abort.signal.addEventListener('abort', cancelled, { once: true });
    });
  }
  function tell(text) { $('battle-message').textContent = text; }
  function health(which, value) {
    const active = run;
    active[which === 'enemy' ? 'enemyHP' : 'playerHP'] = value;
    const maximum = which === 'enemy' ? 100 : 43;
    const bar = $(`battle-${which}-health`);
    bar.style.width = `${value / maximum * 100}%`;
    bar.classList.toggle('is-low', value / maximum < .3);
    bar.parentElement.setAttribute('aria-valuenow', String(value));
    if (which === 'player') $('battle-player-health-text').textContent = `${value} / 43`;
  }
  function resize() {
    if (!run) return;
    const canvas = $('battle-canvas'), width = $('admin-battle').clientWidth || window.innerWidth, height = $('admin-battle').clientHeight || window.innerHeight;
    canvas.width = 512; canvas.height = Math.max(216, Math.round(height / width * 512));
    run.width = width; run.height = height; run.scale = width / canvas.width;
    run.context = canvas.getContext('2d'); run.context.imageSmoothingEnabled = false;
    run.dialogHeight = $('battle-dialogue').getBoundingClientRect().height || 150;
    if (!['off', 'reveal', 'device-exit'].includes(run.phase)) {
      run.stage.style.transform = width < 700 ? 'translateX(6vw) scale(.72)' : run.stageTransform;
      run.stage.style.transformOrigin = width < 700 ? 'right center' : run.stageOrigin;
      const book = hooks.bookRect();
      run.landing = { x: clamp(book.left - 53, 36, width - 60), y: clamp(book.top + book.height * .72, 160, height - 95) };
      run.source.x = clamp(run.source.x, 20, width - 20); run.source.y = clamp(run.source.y, 20, height - 20);
    }
    run.cells = [];
    const source = { x: run.landing.x / run.scale, y: run.landing.y / run.scale };
    for (let y = 0; y < canvas.height; y += 16) for (let x = 0; x < 512; x += 16) {
      const noise = ((x * 13 + y * 37) % 97) / 97;
      run.cells.push({ x, y, at: Math.hypot(x - source.x, y - source.y) / Math.hypot(512, canvas.height) * .8 + noise * .15 });
    }
  }
  function ellipse(context, x, y, width, height, color) {
    // Horizontal strips retain hard pixel edges, including the contact shadows.
    context.fillStyle = color;
    const step = height < 5 ? 1 : 3;
    for (let row = -height; row <= height; row += step) {
      const span = Math.floor(width * Math.sqrt(Math.max(0, 1 - row * row / (height * height))) / step) * step;
      context.fillRect(Math.round(x - span), Math.round(y + row), span * 2, step);
    }
  }
  function shadow(context, x, y, width, opacity = 1, height = 9) {
    context.save(); context.globalAlpha = opacity;
    ellipse(context, x, y, width, height, '#6e806f55');
    ellipse(context, x, y, width * .7, height * .55, '#334d5266');
    context.restore();
  }
  function sprite(context, sheet, frame, x, feet, size, alpha = 1, offset = 0) {
    if (!sheet) return;
    const cellW = sheet.naturalWidth / 3, cellH = sheet.naturalHeight / 2;
    context.save(); context.globalAlpha = alpha;
    context.drawImage(sheet, frame % 3 * cellW, Math.floor(frame / 3) * cellH, cellW, cellH, Math.round(x - size / 2), Math.round(feet - size * .94 + offset), size, size);
    context.restore();
  }
  function ball(context, x, y, size, angle = 0, open = 0) {
    context.save(); context.translate(Math.round(x), Math.round(y)); context.rotate(angle);
    const step = Math.max(1, Math.round(size / 12)), radius = step * 6;
    for (let py = -6; py < 6; py++) for (let px = -6; px < 6; px++) {
      const distance = Math.hypot(px + .5, py + .5);
      if (distance > 6) continue;
      context.fillStyle = distance > 4.9 || py === -1 || py === 0 ? '#233843' : py < 0 ? '#cf4d42' : '#faf0d0';
      context.fillRect(px * step, py * step + (py < 0 ? -open : open), step, step);
    }
    if (!open) {
      context.fillStyle = '#233843'; context.fillRect(-step * 2, -step * 2, step * 4, step * 4);
      context.fillStyle = '#faf0d0'; context.fillRect(-step, -step, step * 2, step * 2);
      context.fillStyle = '#acd8cb'; context.fillRect(0, -step, step, step);
    }
    context.restore();
  }
  function background(context, width, height, battleH) {
    context.fillStyle = '#d5e8e3'; context.fillRect(0, 0, width, height);
    for (let y = 0; y < battleH; y += 4) { context.fillStyle = y % 8 ? '#eef0d52c' : '#a3cec325'; context.fillRect(0, y, width, 2); }
    context.fillStyle = '#f7f3d650';
    for (let i = 0; i < 6; i++) { const x = (i * 113 + 22) % width, y = battleH * .16 + i % 3 * 12; context.fillRect(x, y, 55, 5); context.fillRect(x + 12, y - 5, 30, 5); }
    ellipse(context, width * .75, battleH * .55, width * .25, 22, '#d5c487');
    ellipse(context, width * .75, battleH * .54, width * .225, 17, '#b7d889');
    ellipse(context, width * .75, battleH * .54, width * .16, 10, '#a6cf7b');
    ellipse(context, width * .24, battleH * .92, width * .34, 30, '#d5c487');
    ellipse(context, width * .24, battleH * .91, width * .3, 24, '#b7d889');
    context.fillStyle = '#96bb7055';
    for (let i = 0; i < 12; i++) { context.fillRect(width * .63 + i % 5 * 25, battleH * .47 + i % 3 * 4, 9, 2); }
  }
  function draw(now) {
    const active = run; if (!active) return;
    const canvas = $('battle-canvas'), context = active.context, W = canvas.width, H = canvas.height;
    const p = active.duration ? clamp((now - active.started) / active.duration, 0, 1) : 0;
    const time = (now - active.birth) / 1000;
    if (['off', 'reveal', 'device-exit'].includes(active.phase)) { active.frame = requestAnimationFrame(draw); return; }
    const entry = ['loading', 'bounce-one', 'bounce-two', 'throw', 'land', 'release', 'takeover'].includes(active.phase);
    context.clearRect(0, 0, W, H);
    if (entry) {
      let x = active.source.x / active.scale, y = active.source.y / active.scale, size = 32 / active.scale, angle = 0;
      const lx = active.landing.x / active.scale, ly = active.landing.y / active.scale;
      if (active.phase.startsWith('bounce')) y -= Math.sin(p * Math.PI) * (active.phase === 'bounce-one' ? 30 : 20) / active.scale;
      else if (active.phase === 'throw') { x = lerp(x, lx, p); y = lerp(y, ly, p) - Math.sin(p * Math.PI) * Math.min(150 / active.scale, H * .25); angle = p * Math.PI * 4; size = lerp(32, 42, p) / active.scale; }
      else if (['land', 'release', 'takeover'].includes(active.phase)) { x = lx; y = ly; size = 42 / active.scale; }
      if (active.phase !== 'loading') {
        shadow(context, lx, ly + 16 / active.scale, 28 / active.scale, active.phase === 'throw' ? p : 1, 6 / active.scale);
        const open = active.phase === 'release' ? smooth(p) * 12 / active.scale : active.phase === 'takeover' ? 12 / active.scale : 0;
        context.save();
        if (active.phase === 'takeover') context.globalAlpha = 1 - p;
        if (active.phase === 'land') { context.translate(x, y); context.scale(1 + Math.sin(p * Math.PI) * .18, 1 - Math.sin(p * Math.PI) * .14); ball(context, 0, 0, size, angle); }
        else ball(context, x, y, size, angle, open);
        context.restore();
      }
      if (active.phase === 'release' || active.phase === 'takeover') {
        const appear = active.phase === 'release' ? smooth(p) : 1;
        sprite(context, active.spark, 5, lx - 8 / active.scale, ly + 9 / active.scale, 96 * appear / active.scale, appear, -Math.abs(Math.sin(time * 5)) * 4 / active.scale);
        if (active.phase === 'release') {
          context.fillStyle = '#f4d374';
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 45 * p; context.fillRect(lx + Math.cos(a) * r, ly - 25 + Math.sin(a) * r, 3, 3); }
        }
      }
      if (active.phase === 'takeover') {
        context.save(); context.beginPath();
        for (const cell of active.cells) if (p >= cell.at || p > .97) context.rect(cell.x, cell.y, 16, 16);
        context.clip(); drawBattle(context, W, H, time, p); context.restore();
      }
    } else if (!['off', 'reveal', 'device-exit'].includes(active.phase)) drawBattle(context, W, H, time, p);
    active.frame = requestAnimationFrame(draw);
  }
  function drawBattle(context, W, H, time, p) {
    const active = run;
    const battleH = Math.max(128, H - active.dialogHeight / active.scale);
    const player = { x: W * .25, y: battleH * .9, size: W < 600 && active.width < 600 ? 152 : 132 };
    if (active.phase === 'takeover') {
      const progress = smooth(p);
      player.x = lerp((active.landing.x - 8) / active.scale, player.x, progress);
      player.y = lerp((active.landing.y + 9) / active.scale, player.y, progress);
      player.size = lerp(96 / active.scale, player.size, progress);
    }
    const enemy = { x: W * .75, y: battleH * .53, size: Math.min(active.width < 600 ? 174 : 148, battleH * .62) };
    background(context, W, H, battleH);
    shadow(context, player.x, player.y + 3, 42); shadow(context, enemy.x, enemy.y + 4, 39);
    const idle = Math.floor(time * 2.7) % 2;
    let pf = idle, ef = idle, pa = 1, ea = 1, py = motion.matches ? 0 : -Math.abs(Math.sin(time * 3.3)) * 4, ey = motion.matches ? 0 : -Math.abs(Math.sin(time * 2.8 + 1)) * 3;
    if (active.phase === 'laser' || active.phase === 'final-laser') { pf = 2; if (p > .4) { ef = 3; ey += Math.sin(p * 30) * 3; } }
    if (active.phase === 'water' || active.phase === 'final-water') { ef = 2; if (p > .45) { pf = 3; py += Math.sin(p * 30) * 3; } }
    if (active.phase === 'faint-enemy') { ef = 4; ey = p * 42; ea = 1 - smooth(p); }
    if (active.phase === 'faint-player') { pf = 4; py = p * 42; pa = 1 - smooth(p); }
    if (active.enemyHP === 0 && active.phase !== 'faint-enemy') ea = 0;
    if (active.playerHP === 0 && active.phase !== 'faint-player') pa = 0;
    sprite(context, active.mascot, ef, enemy.x, enemy.y, enemy.size, ea, ey);
    sprite(context, active.spark, pf, player.x, player.y, player.size, pa, py);
    if (['laser', 'final-laser'].includes(active.phase)) {
      const reach = clamp(p / .4, 0, 1), fade = p > .7 ? (1 - p) / .3 : 1;
      context.save(); context.globalAlpha = fade;
      const ax = player.x + 30, ay = player.y - player.size * .48, bx = enemy.x - 28, by = enemy.y - enemy.size * .48;
      const dx = bx - ax, dy = by - ay;
      context.translate(ax, ay); context.rotate(Math.atan2(dy, dx));
      context.fillStyle = '#d9573a'; context.fillRect(0, -6, Math.hypot(dx, dy) * reach, 12);
      context.fillStyle = '#ffd261'; context.fillRect(0, -3, Math.hypot(dx, dy) * reach, 6);
      context.fillStyle = '#fff6cb'; context.fillRect(0, -1, Math.hypot(dx, dy) * reach, 2); context.restore();
      if (p > .35) { context.fillStyle = '#ffdc66'; for (let i = 0; i < 12; i++) { const a = i * 2.4; const r = ((p * 70 + i * 4) % 44); context.fillRect(bx + Math.cos(a) * r, by + Math.sin(a) * r, 4, 4); } }
    }
    if (['water', 'final-water'].includes(active.phase)) {
      for (let i = 0; i < 22; i++) {
        const q = clamp(p * 1.6 - i * .025, 0, 1); if (q <= 0 || q >= 1) continue;
        const x = lerp(enemy.x - 32, player.x + 22, q), y = lerp(enemy.y - 55, player.y - 45, q) - Math.sin(q * Math.PI) * 12 + Math.sin(i * 2) * 8;
        context.fillStyle = i % 3 ? '#448db9' : '#a0e2ef'; context.fillRect(Math.round(x), Math.round(y), 7 + i % 3 * 2, 5);
      }
    }
    // A single soft impact wash, without repeated screen flashes.
    if (['laser', 'final-laser', 'water', 'final-water'].includes(active.phase) && p > .42 && p < .55) { context.fillStyle = '#fff4cf18'; context.fillRect(0, 0, W, H); }
  }
  function showFightControls(show) {
    $('battle-huds').hidden = !show; $('battle-dialogue').hidden = !show;
  }
  function snapshot(element) { return { element, inert: element.inert }; }
  function restoreFraming(active) {
    if (active.stage) { active.stage.style.transform = active.stageTransform; active.stage.style.transformOrigin = active.stageOrigin; }
  }
  function cleanup() {
    const active = run; if (!active) return;
    run = null; active.abort.abort(); cancelAnimationFrame(active.frame);
    active.timers.forEach(clearTimeout); active.sound.close(); restoreFraming(active);
    active.background.forEach(({ element, inert }) => { element.inert = inert; });
    document.body.style.overflow = active.overflow;
    document.body.classList.remove('admin-battle-active');
    $('admin-battle').classList.remove('battle-covered', 'battle-is-off', 'battle-revealing', 'battle-device-leaving');
    $('battle-password').value = ''; $('battle-password-form').hidden = true;
    window.MAKERSPACE_SIGNATURES.discardBattleLogin();
    $('battle-handheld').getAnimations({ subtree: true }).forEach(a => a.cancel());
    if ($('admin-battle').open) $('admin-battle').close();
    hooks.lock(false);
    $('footer-volume').focus({ preventScroll: true });
    return active;
  }
  async function finish(won, mode) {
    const active = run;
    tell(won ? 'THE MASCOT fainted! Access granted.' : 'SPARK fainted! Try another battle.');
    active.sound.play(won ? 'win' : 'lose');
    await phase('result', 1100);
    active.sound.play('off'); $('admin-battle').classList.add('battle-is-off');
    await phase('off', 450);
    restoreFraming(active);
    if (won && mode === 'live') await hooks.prepareApprovals();
    if (run !== active) return;
    $('admin-battle').classList.add('battle-revealing');
    await phase('reveal', 950);
    $('admin-battle').classList.add('battle-device-leaving');
    await phase('device-exit', 650);
    if (won && mode === 'live') window.MAKERSPACE_SIGNATURES.completeBattleLogin();
    cleanup();
    if (won && mode === 'live') await window.MAKERSPACE_SIGNATURES.openAdmin();
    else if (won) hooks.announce('Preview complete. Signature approvals will open here once Cloudflare is connected.');
    else hooks.announce('Battle lost. Open the capture ball to try again.');
  }
  async function laser() {
    const active = run;
    if (!active || active.phase !== 'choose-attack') return;
    $('battle-laser').hidden = true; tell('SPARK used LASER CUTTER!'); active.sound.play('laser');
    try {
      await phase('laser', 950); health('enemy', 42);
      await phase('laser-impact', 480);
      tell('THE MASCOT used WATER BLAST!'); active.sound.play('water');
      await phase('water', 950); health('player', 18);
      await phase('water-impact', 420);
      tell('One last move. Enter the site password.');
      $('battle-password-form').hidden = false; $('battle-password-submit').disabled = false;
      await phase('password'); $('battle-password').focus({ preventScroll: true });
    } catch (error) { if (error.name !== 'AbortError') failGracefully(error); }
  }
  async function password(event) {
    event.preventDefault();
    const active = run;
    if (!active || active.phase !== 'password' || $('battle-password-submit').disabled) return;
    const entered = $('battle-password').value; $('battle-password').value = '';
    $('battle-password-submit').disabled = true; $('battle-password-error').textContent = '';
    tell('Checking your finishing move…');
    try {
      const result = await window.MAKERSPACE_SIGNATURES.authenticateAdmin(entered);
      if (run !== active) return;
      $('battle-password-form').hidden = true;
      if (result.granted) {
        tell('SPARK used AUTHORIZED LASER!'); active.sound.play('laser');
        await phase('final-laser', 950); health('enemy', 0); await phase('faint-enemy', 650);
      } else {
        tell('Wrong password! THE MASCOT used WATER BLAST!'); active.sound.play('water');
        await phase('final-water', 950); health('player', 0); await phase('faint-player', 650);
      }
      await finish(result.granted, result.mode);
    } catch (error) {
      if (run !== active || error.name === 'AbortError') return;
      // Connection errors are retryable, rather than causing a false defeat.
      $('battle-password-form').hidden = false; $('battle-password-submit').disabled = false;
      $('battle-password-error').textContent = error.message;
      tell('Connection interrupted. Try your password again.'); phase('password'); $('battle-password').focus({ preventScroll: true });
    }
  }
  function failGracefully(error) { cleanup(); hooks.announce(error.message || 'The battle could not load. Please try again.'); }
  async function start() {
    if (run || !hooks.canStart()) return;
    if (window.MAKERSPACE_SIGNATURES.hasAdminSession()) { await hooks.prepareApprovals(); await window.MAKERSPACE_SIGNATURES.openAdmin(); return; }
    const sourceRect = $('admin-battle-button').getBoundingClientRect();
    const active = {
      birth: performance.now(), phase: 'loading', started: performance.now(), duration: 0,
      timers: new Set(), abort: new AbortController(), sound: new BattleSound(), frame: 0,
      source: { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 },
      background: [snapshot($('main-content')), snapshot(document.querySelector('.site-header'))],
      overflow: document.body.style.overflow,
      stage: $('cover-stage'), stageTransform: $('cover-stage').style.transform, stageOrigin: $('cover-stage').style.transformOrigin,
      playerHP: 43, enemyHP: 100
    };
    run = active; hooks.closeMenu(); hooks.lock(true);
    active.background.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden'; document.body.classList.add('admin-battle-active');
    if (window.innerWidth < 700) { active.stage.style.transformOrigin = 'right center'; active.stage.style.transform = 'translateX(6vw) scale(.72)'; }
    const book = hooks.bookRect();
    active.landing = { x: clamp(book.left - 53, 36, window.innerWidth - 60), y: clamp(book.top + book.height * .72, 160, window.innerHeight - 95) };
    const dialog = $('admin-battle'); dialog.classList.remove('battle-covered', 'battle-is-off', 'battle-revealing', 'battle-device-leaving');
    dialog.showModal(); dialog.dataset.phase = 'loading';
    showFightControls(false); $('battle-password-form').hidden = true; $('battle-laser').hidden = true;
    $('battle-preview-label').hidden = Boolean(window.MAKERSPACE.signatureSettings.apiUrl);
    $('battle-preview-label').textContent = 'PREVIEW · approvals connect later';
    $('battle-sound').setAttribute('aria-pressed', String(soundOn)); $('battle-sound').textContent = soundOn ? 'Sound on' : 'Sound off';
    $('battle-close').focus({ preventScroll: true }); resize(); active.frame = requestAnimationFrame(draw);
    try {
      [active.spark, active.mascot] = await ensureSheets();
      if (run !== active) return;
      active.sound.play('bounce'); await phase('bounce-one', 320);
      active.sound.play('bounce'); await phase('bounce-two', 260);
      await phase('throw', 700); active.sound.play('bounce'); await phase('land', 180);
      active.sound.play('release'); await phase('release', 650);
      await phase('takeover', 1050);
      dialog.classList.add('battle-covered'); showFightControls(true); resize();
      health('enemy', 100); health('player', 43);
      tell('Laser him with the laser cutter!'); $('battle-laser').hidden = false;
      await phase('choose-attack'); $('battle-laser').focus({ preventScroll: true });
    } catch (error) { if (run === active && error.name !== 'AbortError') failGracefully(error); }
  }
  function init(options) {
    hooks = options;
    document.body.insertAdjacentHTML('beforeend', `<dialog id="admin-battle" class="admin-battle" aria-label="Hidden mascot battle"><div class="battle-tools"><span id="battle-preview-label">PREVIEW · approvals connect later</span><button id="battle-sound" type="button" aria-pressed="true">Sound on</button><button id="battle-close" type="button" aria-label="Close battle">×</button></div><p class="battle-loading" role="status">Loading the cartridge…</p><div id="battle-display" class="battle-display"><canvas id="battle-canvas" aria-hidden="true"></canvas><div id="battle-huds" hidden><section class="battle-health-panel enemy-panel" aria-label="Opponent"><div><strong>THE MASCOT</strong><span>Lv 18</span></div><div class="battle-hp-line"><span>HP</span><div role="progressbar" aria-label="Mascot health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="battle-enemy-health"></i></div></div></section><section class="battle-health-panel player-panel" aria-label="Player"><div><strong>SPARK</strong><span>Lv 18</span></div><div class="battle-hp-line"><span>HP</span><div role="progressbar" aria-label="Spark health" aria-valuemin="0" aria-valuemax="43" aria-valuenow="43"><i id="battle-player-health"></i></div></div><span id="battle-player-health-text">43 / 43</span></section></div><div id="battle-dialogue" class="battle-dialogue" hidden><p id="battle-message" role="status" aria-live="polite"></p><button id="battle-laser" type="button">LASER CUTTER <span aria-hidden="true">▶</span></button><form id="battle-password-form" hidden><label for="battle-password">Site password</label><div class="battle-password-row"><input id="battle-password" type="password" autocomplete="current-password" maxlength="256" required><button id="battle-password-submit" type="submit">FINISH <span aria-hidden="true">▶</span></button></div><p id="battle-password-error" role="alert"></p></form></div></div><div class="battle-off-line" aria-hidden="true"></div><div id="battle-handheld" class="battle-handheld" aria-hidden="true"><div class="handheld-top"><span>MAKER / COLOR</span><i></i></div><div class="handheld-bezel"><span class="handheld-power">●<br>POWER</span><div class="handheld-screen"></div><span class="handheld-brand">MAKER <b>C</b><b>O</b><b>L</b><b>O</b><b>R</b></span></div><div class="handheld-imprint">FIELD / 01</div><div class="handheld-controls"><div class="handheld-dpad"></div><div class="handheld-b">B</div><div class="handheld-a">A</div></div><div class="handheld-bottom"><div><i></i><i></i><span>SELECT &nbsp; START</span></div><div class="handheld-speaker"></div></div></div></dialog>`);
    const menu = document.querySelector('.volume-selector');
    menu.addEventListener('pointerenter', ensureSheets);
    menu.addEventListener('focusin', ensureSheets);
    $('admin-battle-button').addEventListener('click', start);
    $('battle-laser').addEventListener('click', laser);
    $('battle-password-form').addEventListener('submit', password);
    $('battle-close').addEventListener('click', cleanup);
    $('admin-battle').addEventListener('cancel', event => { event.preventDefault(); cleanup(); });
    $('admin-battle').addEventListener('close', () => { if (run) cleanup(); });
    $('battle-sound').addEventListener('click', () => {
      soundOn = !soundOn; if (!soundOn) run?.sound.mute(); else run?.sound.context?.resume().catch(() => {});
      $('battle-sound').textContent = soundOn ? 'Sound on' : 'Sound off'; $('battle-sound').setAttribute('aria-pressed', String(soundOn));
    });
    window.addEventListener('resize', resize);
    window.addEventListener('hashchange', () => { if (run) cleanup(); });
    window.addEventListener('pagehide', () => { if (run) cleanup(); });
  }
  window.MAKERSPACE_BATTLE = { init, start, active: () => Boolean(run) };
})();
