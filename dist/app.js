(() => {
  'use strict';
  const { tools: equipment, projects, roboticsImage, roboticsCredit } = window.MAKERSPACE;
  const tools = [...equipment, { slug: 'the-club', name: 'The club', category: 'SBHS / GOLDEN TIME', number: '13', background: '#e5e2f0', color: '#172a23' }];
  const CLUB_PAGE = tools.length - 1;
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const state = { view: 'collections', page: 0, open: false, busy: false, navigating: false, pendingClub: false, introTimer: null };
  const INTRO_REVEAL_MS = 900;
  const INTRO_HOLD_MS = 1500;
  const INTRO_FADE_MS = 750;
  const views = { collections: $('collections-view'), 'future-projects': $('projects-view'), robotics: $('robotics-view') };
  let paperMaterials;
  const picture = (src, alt, extra = '') => `<img src="${escape(src)}" alt="${escape(alt)}" ${extra}>`;
  const credit = (item) => `<a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.name)}</a>${item.license ? ` · <a href="${escape(item.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escape(item.license)}</a> · cropped` : ''}`;

  function showIntro() {
    clearTimeout(state.introTimer);
    const intro = $('intro');
    intro.hidden = false;
    intro.classList.remove('is-leaving');
    document.body.classList.add('intro-active');
    // Masked letters echo the saved reference's .intro-content-item span treatment.
    intro.querySelector('.intro-word').innerHTML = [...'Makerspace'].map((char, index) => `<span class="reveal-letter" style="--delay:${0.11 + index * 0.03}s">${char}</span>`).join('');
    $('main-content').inert = true;
    document.querySelector('.site-header').inert = true;
    state.introTimer = setTimeout(finishIntro, reducedMotion.matches ? INTRO_HOLD_MS : INTRO_REVEAL_MS + INTRO_HOLD_MS);
  }

  function finishIntro() {
    clearTimeout(state.introTimer);
    $('intro').classList.add('is-leaving');
    document.body.classList.remove('intro-active');
    // Finish hiding only this intro; a replay started in the meantime stays visible.
    state.introTimer = setTimeout(() => {
      $('intro').hidden = true;
      $('main-content').inert = false;
      document.querySelector('.site-header').inert = false;
      if ($('intro').contains(document.activeElement)) document.querySelector('.nav-link.active').focus();
    }, reducedMotion.matches ? 1 : INTRO_FADE_MS);
  }

  function posterHTML(tool) {
    if (tool.slug === 'the-club') return `<div class="club-frontmatter"><span class="eyebrow">SANTA BARBARA HIGH SCHOOL</span><h2>This room<br>is <em>ours.</em></h2><p>A club for curious people.</p><div class="club-imprint"><span>DESIGN<br>FABRICATION<br>ELECTRONICS<br>ART</span><span>25–26</span></div></div>`;
    return `${picture(tool.image, tool.alt, 'class="poster-image" loading="eager" decoding="async"')}<span class="poster-wash"></span>
      <span class="poster-kicker"><span>THE MAKERSPACE COLLECTION</span><span>SBHS / 2026</span></span>
      <h2 class="poster-heading">${escape(tool.headline[0])}<em>${escape(tool.headline[1])}</em></h2>
      <p class="poster-copy">${escape(tool.poster)}</p>
      <span class="poster-bottom"><span>${escape(tool.category)}<br>SANTA BARBARA, CALIFORNIA</span><span class="poster-number">${tool.number}</span></span>`;
  }

  function detailHTML(tool, index) {
    if (tool.slug === 'the-club') return `<div class="detail-top"><span>THE CLUB</span><span>SBHS / 25–26</span></div>
      <div class="club-page-copy"><p class="club-search-line">A club for curious people.</p><p class="club-search-line">A room to try something new.</p>
      <h2 id="club-target" tabindex="-1">A place to make<br>something of an idea.</h2>
      <div class="club-times"><div><span class="eyebrow">GOLDEN TIME</span><p>Tuesdays & Fridays<br>During homeroom</p></div><div><span class="eyebrow">WHO IT’S FOR</span><p>SBHS students.<br>Beginners welcome.</p></div></div>
      <p>Try a tool, join a shared project, or bring your own idea. Find Makerspace in the school’s Golden Time options.</p></div>
      <div class="detail-bottom"><span>SANTA BARBARA HIGH SCHOOL</span><button data-replay-intro>Replay the opening</button></div>`;
    return `<div class="detail-top"><span>THE COLLECTION</span><span>${escape(tool.category)}</span></div>
      <div class="detail-main"><h2>${escape(tool.name)}</h2><p class="detail-description">${escape(tool.description)}</p>
      <h3 class="detail-subtitle">A FEW THINGS YOU COULD MAKE</h3><ul class="idea-list">${tool.ideas.map((idea) => `<li>${escape(idea)}</li>`).join('')}</ul>
      <p class="detail-note">${escape(tool.note)}</p></div>
      <div class="detail-bottom"><span>EXAMPLE PHOTO · ${credit(tool.credit)}</span><span>${String((index + 1) * 2).padStart(2, '0')}</span></div>`;
  }

  function paintPoster(tool) {
    $('poster-page').style.setProperty('--poster-bg', tool.background);
    $('poster-page').style.setProperty('--poster-color', tool.color);
    $('poster-page').innerHTML = posterHTML(tool);
  }

  function paintDetail(tool, index) {
    $('detail-page').innerHTML = detailHTML(tool, index);
  }

  function updateControls() {
    const tool = tools[state.page];
    $('previous-page').disabled = state.busy;
    $('next-page').disabled = state.page === tools.length - 1 || state.busy;
    $('footer-volume').textContent = 'Vol. 01';
    $('announcement').textContent = state.open ? `${tool.name}, collection ${state.page + 1} of ${tools.length}` : 'Makerspace collection cover';
    $('book-spread').setAttribute('aria-label', state.open ? state.page === CLUB_PAGE ? 'The Makerspace club: Golden Time and membership' : `${tool.name}: poster and project ideas` : 'Makerspace collection');
    $('poster-page').classList.toggle('is-club-page', state.page === CLUB_PAGE);
    $('detail-page').classList.toggle('is-club-page', state.page === CLUB_PAGE);
    $('about-button').classList.toggle('club-active', state.view === 'collections' && state.open && state.page === CLUB_PAGE);
    for (const id of ['poster-page', 'detail-page', 'reader-controls']) {
      $(id).inert = !state.open || state.busy;
      $(id).setAttribute('aria-hidden', String(!state.open));
    }
    $('open-book').inert = state.open || state.busy;
    $('open-book').setAttribute('aria-hidden', String(state.open));
  }

  function paintSpread() {
    const tool = tools[state.page];
    paintPoster(tool);
    paintDetail(tool, state.page);
    updateControls();
    preloadNeighbors();
  }

  function preloadNeighbors() {
    [state.page - 1, state.page + 1].forEach((index) => {
      if (tools[index]?.image) { const image = new Image(); image.src = tools[index].image; }
    });
  }

  function paintCoverBack() {
    const tool = tools[state.page];
    const back = $('cover-back-page');
    back.style.setProperty('--poster-bg', tool.background);
    back.style.setProperty('--poster-color', tool.color);
    back.innerHTML = posterHTML(tool);
    return preparePictures(back);
  }

  function preparePictures(element) {
    const images = [...element.querySelectorAll('img')];
    if (!images.length) return Promise.resolve();
    let timeout;
    const ready = Promise.all(images.map((image) => image.decode().catch(() => {})));
    // A failed external photo must not trap the visitor in a busy animation.
    return Promise.race([ready, new Promise((resolve) => { timeout = setTimeout(resolve, 1500); })])
      .finally(() => clearTimeout(timeout));
  }

  function loadPaperMaterials() {
    if (!paperMaterials) paperMaterials = Promise.all(['crumpled', 'charred'].map(async (name) => {
      const image = new Image();
      image.src = `assets/robotics-${name}-paper.png`;
      let timeout;
      return Promise.race([
        image.decode().then(() => image).catch(() => null),
        new Promise((resolve) => { timeout = setTimeout(() => resolve(null), 1500); })
      ]).finally(() => clearTimeout(timeout));
    }));
    return paperMaterials;
  }

  function settleCover() {
    if (reducedMotion.matches) return Promise.resolve();
    // Watch the permanent cover itself; a timeout handles backgrounded tabs.
    return new Promise((resolve) => {
      const cover = $('open-book');
      const finish = (event) => {
        if (event && (event.target !== cover || event.propertyName !== 'transform')) return;
        cover.removeEventListener('transitionend', finish);
        clearTimeout(timeout);
        resolve();
      };
      const timeout = setTimeout(finish, 1250);
      cover.addEventListener('transitionend', finish);
    });
  }

  async function openBook(index = state.page, animate = true, { forNavigation = false } = {}) {
    if (state.busy || (state.navigating && !forNavigation)) return;
    state.page = Math.max(0, Math.min(tools.length - 1, index));
    if (state.open) { paintSpread(); return; }
    state.busy = true;
    paintSpread();
    await paintCoverBack();
    const stage = $('cover-stage');
    stage.classList.remove('is-closing');
    stage.classList.remove('is-settled');
    stage.classList.toggle('without-motion', !animate || reducedMotion.matches);
    // The cover, image and type never leave this DOM node or change opacity.
    void $('open-book').offsetWidth;
    const settled = animate ? settleCover() : Promise.resolve();
    state.open = true;
    stage.classList.add('is-open');
    updateControls();
    await settled;
    $('poster-page').replaceChildren(...$('cover-back-page').childNodes);
    stage.classList.add('is-settled');
    stage.classList.remove('without-motion');
    state.busy = false;
    updateControls();
    $('book-spread').focus({ preventScroll: true });
    preloadNeighbors();
  }

  async function closeBook({ forNavigation = false } = {}) {
    if (state.busy || !state.open) return;
    state.busy = true;
    updateControls();
    await paintCoverBack();
    const stage = $('cover-stage');
    stage.classList.add('is-closing');
    stage.classList.remove('is-settled');
    // Show the matching reverse of the existing cover before it folds shut.
    void $('open-book').offsetWidth;
    const settled = settleCover();
    stage.classList.remove('is-open');
    await settled;
    stage.classList.remove('is-closing');
    state.open = false;
    state.busy = false;
    state.page = 0;
    paintSpread();
    if (!forNavigation) {
      history.replaceState(null, '', '#collections');
      $('open-book').focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  }

  function clonePage(page) {
    const clone = page.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    return clone;
  }

  async function turnPage(direction, { forNavigation = false, duration = 850, shadowDuration = 1100, updateHistory = true } = {}) {
    const next = state.page + direction;
    if (state.busy || (state.navigating && !forNavigation) || !state.open) return;
    if (next < 0) { await closeBook(); return; }
    if (next >= tools.length) return;
    state.busy = true;
    updateControls();
    const turn = $('page-turn');
    const oldPoster = clonePage($('poster-page'));
    const oldDetail = clonePage($('detail-page'));
    const nextTool = tools[next];
    const mobile = window.innerWidth <= 900;
    const forward = forNavigation || direction > 0;
    if (!reducedMotion.matches) {
      const front = document.createElement('div');
      const back = document.createElement('div');
      front.className = 'turn-face turn-front';
      back.className = 'turn-face turn-back';
      if (mobile) {
        front.appendChild(oldPoster);
        paintPoster(nextTool);
        back.appendChild(clonePage($('poster-page')));
      } else if (forward) {
        front.appendChild(oldDetail);
        paintDetail(nextTool, next);
        const newPoster = clonePage($('poster-page'));
        newPoster.innerHTML = posterHTML(nextTool);
        newPoster.style.setProperty('--poster-color', nextTool.color);
        newPoster.style.setProperty('--poster-bg', nextTool.background);
        back.appendChild(newPoster);
      } else {
        front.appendChild(oldPoster);
        paintPoster(nextTool);
        const newDetail = clonePage($('detail-page'));
        newDetail.innerHTML = detailHTML(nextTool, next);
        back.appendChild(newDetail);
      }
      const shadows = [front, back].map((face) => {
        const shadow = document.createElement('span');
        shadow.className = 'sheet-shadow';
        face.appendChild(shadow);
        return shadow;
      });
      turn.replaceChildren(front, back);
      turn.className = `page-turn active${mobile ? ' mobile' : !forward ? ' backward' : ''}`;
      try {
        if (!forNavigation) await preparePictures(back);
        const rotation = turn.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${forward ? '-180' : '180'}deg)` }], { duration, easing: 'cubic-bezier(.35,.25,.15,1)', fill: 'forwards' });
        const shadowFades = shadows.map((shadow) => shadow.animate([
          { opacity: 0, offset: 0 }, { opacity: 1, offset: 0.15 },
          { opacity: 1, offset: 0.72 }, { opacity: 0, offset: 1 }
        ], { duration: shadowDuration, easing: 'ease-in-out', fill: 'forwards' }));
        // Let the shadow dissipate after the sheet lands, then remove its layer.
        await Promise.all([rotation.finished, ...shadowFades.map((fade) => fade.finished)]);
      } finally {
        state.page = next;
        // Keep decoded image nodes from the arriving sheet instead of rebuilding it.
        const arrived = back.firstElementChild;
        if (mobile || forward) {
          $('poster-page').style.setProperty('--poster-bg', nextTool.background);
          $('poster-page').style.setProperty('--poster-color', nextTool.color);
          $('poster-page').replaceChildren(...arrived.childNodes);
        } else {
          $('detail-page').replaceChildren(...arrived.childNodes);
        }
        turn.getAnimations().forEach((animation) => animation.cancel());
        turn.className = 'page-turn';
        turn.replaceChildren();
      }
    }
    state.page = next;
    state.busy = false;
    if (reducedMotion.matches) paintSpread();
    else { updateControls(); preloadNeighbors(); }
    if (mobile && !forNavigation) {
      $('reader').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    }
    if (updateHistory) history.replaceState(null, '', `#collections/${tools[next].slug}`);
    // Keep keyboard focus on an enabled control at the first and last spreads.
    if (document.activeElement === $('next-page') && $('next-page').disabled) $('previous-page').focus({ preventScroll: true });
    if (document.activeElement === $('previous-page') && $('previous-page').disabled) $('next-page').focus({ preventScroll: true });
  }

  async function showClub({ continuation = false } = {}) {
    if (!continuation && (state.busy || state.navigating)) return;
    activateTab('collections');
    if (state.view !== 'collections') {
      state.pendingClub = true;
      if (state.view === 'future-projects') return closeProjects();
      return swapBooks('collections');
    }
    state.navigating = true;
    state.busy = false;
    $('main-content').inert = true;
    document.querySelector('.site-header').inert = true;
    document.body.classList.add('club-searching');
    const motions = [];
    let overlay, interrupted = false;
    const finishOnResize = () => {
      interrupted = true;
      motions.forEach((motion) => { try { motion.finish(); } catch {} });
      $('page-turn').getAnimations({ subtree: true }).forEach((motion) => { try { motion.finish(); } catch {} });
    };
    const play = async (parts, duration, easing = 'cubic-bezier(.25,.8,.25,1)') => {
      if (interrupted) return;
      const group = parts.map(([element, frames]) => {
        const motion = element.animate(frames, { duration, easing, fill: 'forwards' });
        motions.push(motion);
        return motion.finished;
      });
      await Promise.allSettled(group);
    };
    window.addEventListener('resize', finishOnResize);
    try {
      // Warm the photographs while the cover opens; the quick sheets never wait on a network request.
      equipment.forEach((tool) => { const image = new Image(); image.src = tool.image; });
      overlay = document.createElement('div');
      overlay.className = 'club-search-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.inert = true;
      const hand = document.createElement('div');
      hand.className = 'club-search-hand';
      hand.innerHTML = '<img class="club-point-pose" src="assets/club-hand-point.png" alt=""><img class="club-tap-pose" src="assets/club-hand-tap.png" alt="">';
      overlay.append(hand);
      document.body.append(overlay);
      const picturesReady = preparePictures(hand);
      if (!state.open) await openBook(Math.floor(Math.random() * equipment.length), true, { forNavigation: true });
      if (!reducedMotion.matches && !interrupted) {
        // A burst of sheets through the collection, easing back into the final chapter.
        const start = state.page;
        const sequence = Array.from({ length: 18 }, (_, index) => (start + index + 1) % equipment.length);
        sequence.push(CLUB_PAGE);
        for (let index = 0; index < sequence.length && !interrupted; index++) {
          const duration = index === 0 ? 230 : index === sequence.length - 1 ? 390 : index > 14 ? 145 : 95;
          await turnPage(sequence[index] - state.page, { forNavigation: true, duration, shadowDuration: duration + 35, updateHistory: false });
        }
      }
      state.page = CLUB_PAGE;
      paintSpread();
      state.busy = true;
      updateControls();
      await picturesReady;
      if (reducedMotion.matches || interrupted) return;

      const detail = $('detail-page');
      if (window.innerWidth <= 900) {
        const top = detail.getBoundingClientRect().top + window.scrollY - document.querySelector('.site-header').getBoundingClientRect().height - 24;
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      }
      const target = detail.querySelector('#club-target');
      const lines = [...detail.querySelectorAll('.club-search-line')];
      const pageRect = detail.getBoundingClientRect();
      const handWidth = Math.max(360, Math.min(650, pageRect.width * 1.65));
      hand.style.width = `${handWidth}px`;
      hand.style.height = `${handWidth / 2}px`;
      // Both poses share the same fingertip registration, so a tap never jumps sideways.
      const position = (x, y, angle = 0, scale = 1) => `translate3d(${x - handWidth * .053}px,${y - handWidth * .5 * .44}px,0) rotate(${angle}deg) scale(${scale})`;
      const linePath = (line) => {
        const rect = line.getBoundingClientRect();
        const fontSize = parseFloat(getComputedStyle(line).fontSize) || 16;
        // Inline ranges stop the finger at the actual text, rather than the paragraph's full width.
        const range = document.createRange();
        range.selectNodeContents(line);
        const text = range.getBoundingClientRect();
        return { left: rect.left + 3, right: Math.min(pageRect.right - 30, text.right || rect.right), y: rect.top + fontSize * .8 };
      };
      const first = linePath(lines[0]);
      const second = linePath(lines[1]);
      const title = target.getBoundingClientRect();
      const found = { x: title.left + Math.min(title.width * .65, 190), y: title.top + (parseFloat(getComputedStyle(target).fontSize) || 32) * .85 };
      const start = position(first.left, first.y, -3);
      hand.style.transform = position(window.innerWidth + 80, first.y + 70, -12);
      await play([[hand, [{ transform: hand.style.transform }, { transform: start }]]], 500);
      await play([[hand, [{ transform: start }, { transform: position(first.right, first.y + 2, 1) }]]], 460, 'ease-in-out');
      await play([[hand, [{ transform: position(first.right, first.y + 2, 1) }, { transform: position(second.left, second.y, -2) }]]], 260);
      await play([[hand, [{ transform: position(second.left, second.y, -2) }, { transform: position(second.right, second.y + 1, 1) }]]], 420, 'ease-in-out');
      await play([[hand, [{ transform: position(second.right, second.y + 1, 1) }, { transform: position(title.left, found.y, -2) }]]], 240);
      const contact = position(found.x, found.y);
      await play([[hand, [{ transform: position(title.left, found.y, -2) }, { transform: contact }]]], 410, 'ease-in-out');
      await play([[hand, [{ transform: contact }, { transform: contact }]]], 220);
      const pointing = hand.querySelector('.club-point-pose');
      const tapping = hand.querySelector('.club-tap-pose');
      for (let count = 0; count < 2 && !interrupted; count++) {
        await play([
          [hand, [{ transform: contact }, { transform: position(found.x, found.y, 0, 1.035), offset: .28 }, { transform: position(found.x, found.y, 0, .985), offset: .52 }, { transform: contact }]],
          [pointing, [{ opacity: 1 }, { opacity: 0, offset: .5 }, { opacity: 1 }]],
          [tapping, [{ opacity: 0 }, { opacity: 1, offset: .5 }, { opacity: 0 }]],
          [target, [{ textShadow: '0 0 0 transparent' }, { textShadow: '0 2px 12px #82759c55', offset: .5 }, { textShadow: '0 0 0 transparent' }]]
        ], 340, 'ease-in-out');
      }
      await play([[hand, [{ transform: contact, opacity: 1 }, { transform: position(window.innerWidth + 100, found.y + 80, -10), opacity: 0 }]]], 540);
    } catch (error) {
      if (!interrupted) console.warn('The club chapter opened without its remaining motion.', error);
    } finally {
      window.removeEventListener('resize', finishOnResize);
      motions.forEach((motion) => motion.cancel());
      overlay?.remove();
      document.body.classList.remove('club-searching');
      state.page = CLUB_PAGE;
      state.open = true;
      state.busy = false;
      state.navigating = false;
      $('cover-stage').classList.add('is-open', 'is-settled');
      $('cover-stage').classList.remove('is-closing');
      paintSpread();
      $('main-content').inert = false;
      document.querySelector('.site-header').inert = false;
      history.pushState(null, '', '#collections/the-club');
      document.title = 'The club — SBHS Makerspace';
      $('detail-page').querySelector('#club-target')?.focus({ preventScroll: true });
    }
  }

  async function openProjects() {
    if (state.busy || state.navigating || state.view !== 'collections') return;
    activateTab('future-projects');
    state.navigating = true;
    const main = $('main-content');
    const header = document.querySelector('.site-header');
    const stage = $('cover-stage');
    const cover = $('open-book');
    const projectsView = views['future-projects'];
    const back = $('cover-back-page');
    const animations = [];
    const saved = { projectStyle: projectsView.getAttribute('style'), backStyle: back.getAttribute('style'), backClass: back.className };
    let home, paper, overlay, savedBack, interrupted = false;
    const animate = (element, frames, options) => {
      const animation = element.animate(frames, { fill: 'both', ...options });
      animations.push(animation);
      return animation;
    };
    const finishOnResize = () => {
      interrupted = true;
      animations.forEach((animation) => animation.finish());
    };
    main.inert = true;
    header.inert = true;
    document.body.classList.add('page-transitioning');
    window.addEventListener('resize', finishOnResize, { once: true });
    try {
      const firstPhoto = projectsView.querySelector('.project-study-image');
      if (firstPhoto) firstPhoto.querySelector('img').loading = 'eager';
      const photoReady = firstPhoto ? preparePictures(firstPhoto) : Promise.resolve();
      if (state.open) await closeBook({ forNavigation: true });
      state.busy = true;
      updateControls();
      if (reducedMotion.matches) return;
      await photoReady;
      if (interrupted) return;

      const spread = $('book-spread');
      const canvasWidth = document.documentElement.clientWidth;
      const scale = spread.getBoundingClientRect().width / canvasWidth;
      home = document.createComment('Future Projects home');
      projectsView.before(home);
      projectsView.hidden = false;
      projectsView.inert = true;
      projectsView.style.width = `${canvasWidth}px`;
      projectsView.style.transformOrigin = '0 0';
      projectsView.style.transform = `scale(${scale})`;
      paper = document.createElement('div');
      paper.className = 'project-opening-paper';
      paper.appendChild(projectsView);
      spread.appendChild(paper);

      savedBack = [...back.childNodes];
      const preview = projectsView.cloneNode(true);
      preview.removeAttribute('id');
      preview.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      preview.classList.add('project-opening-preview');
      back.className = 'paper-page project-opening-inside';
      back.replaceChildren(preview);
      stage.classList.add('is-project-opening');
      void cover.offsetWidth;
      // Use the original cover, parent, perspective and 1100ms opening motion.
      // Its width and height stay fixed throughout the entire hinge rotation.
      const unfolded = settleCover();
      stage.classList.add('is-open');
      await unfolded;
      if (interrupted) return;
      stage.classList.add('is-settled');

      // Only the already-open paper moves into a fixed surface. A single uniform
      // transform enlarges everything together; a crop controls the visible height.
      const rect = spread.getBoundingClientRect();
      const scrollTop = window.scrollY;
      const headerBottom = header.getBoundingClientRect().bottom + scrollTop;
      const viewportHeight = Math.max(1, window.innerHeight - headerBottom);
      const canvasHeight = Math.max(viewportHeight, rect.height / scale);
      overlay = document.createElement('div');
      overlay.className = 'chapter-transition';
      overlay.inert = true;
      overlay.setAttribute('aria-hidden', 'true');
      const surface = document.createElement('div');
      surface.className = 'project-expansion-surface';
      surface.style.width = `${canvasWidth}px`;
      surface.style.height = `${canvasHeight}px`;
      projectsView.style.transform = 'none';
      paper.className = 'project-expansion-paper';
      let seam;
      if (window.innerWidth > 900) {
        seam = document.createElement('span');
        seam.className = 'project-expansion-seam';
        seam.style.width = `${24 / scale}px`;
        paper.appendChild(seam);
      }
      surface.appendChild(paper);
      overlay.appendChild(surface);
      document.body.appendChild(overlay);
      document.body.classList.add('chapter-transitioning');
      const duration = 1450;
      const easing = 'cubic-bezier(.3,.65,.2,1)';
      animate(surface, [
        { transform: `translate(${rect.left}px,${rect.top}px) scale(${scale})`, clipPath: `inset(0 0 ${Math.max(0, canvasHeight - rect.height / scale)}px 0)` },
        { transform: `translate(0,${headerBottom}px) scale(1)`, clipPath: `inset(0 0 ${Math.max(0, canvasHeight - viewportHeight)}px 0)` }
      ], { duration, easing });
      animate(document.body, [{ backgroundColor: '#b7ddd2' }, { backgroundColor: '#d6e5ee' }], { duration, easing });
      if (seam) animate(seam, [{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' });
      if (scrollTop) animate(header, [{ transform: 'translateY(0)' }, { transform: `translateY(${scrollTop}px)` }], { duration, easing });
      animate(document.querySelector('.collection-footer'), [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(24px)' }], { duration: 550, easing: 'ease-in' });
      await Promise.allSettled(animations.map((animation) => animation.finished));
    } finally {
      window.removeEventListener('resize', finishOnResize);
      if (savedBack) back.replaceChildren(...savedBack);
      back.className = saved.backClass;
      restoreStyle(back, saved.backStyle);
      if (home) home.replaceWith(projectsView);
      restoreStyle(projectsView, saved.projectStyle);
      projectsView.inert = false;
      stage.classList.add('without-motion');
      stage.classList.remove('is-project-opening', 'is-open', 'is-settled', 'is-closing');
      paper?.remove();
      state.open = false;
      state.page = 0;
      finishNavigation('future-projects', animations, overlay);
      requestAnimationFrame(() => stage.classList.remove('without-motion'));
    }
  }

  async function closeProjects({ continueTo = null } = {}) {
    if (state.busy || state.navigating || state.view !== 'future-projects') return;
    activateTab(continueTo || 'collections');
    state.navigating = true;
    state.busy = true;
    const main = $('main-content');
    const header = document.querySelector('.site-header');
    const stage = $('cover-stage');
    const collectionsView = views.collections;
    const projectsView = views['future-projects'];
    const index = projectsView.querySelector('.project-index');
    const back = $('cover-back-page');
    const animations = [];
    const saved = {
      collectionStyle: collectionsView.getAttribute('style'),
      projectStyle: projectsView.getAttribute('style'),
      indexStyle: index?.getAttribute('style'),
      backStyle: back.getAttribute('style'), backClass: back.className
    };
    let home, paper, overlay, savedBack, interrupted = false;
    const animate = (element, frames, options) => {
      const animation = element.animate(frames, { fill: 'both', ...options });
      animations.push(animation);
      return animation;
    };
    const finishOnResize = () => {
      interrupted = true;
      animations.forEach((animation) => animation.finish());
    };
    main.inert = true;
    header.inert = true;
    updateControls();
    document.body.classList.add('page-transitioning');
    window.addEventListener('resize', finishOnResize, { once: true });
    try {
      if (reducedMotion.matches) return;
      const canvasWidth = document.documentElement.clientWidth;
      const scrollTop = window.scrollY;
      const headerBottom = header.getBoundingClientRect().bottom + scrollTop;
      const initialTop = Math.max(0, headerBottom - scrollTop);
      const projectTop = projectsView.getBoundingClientRect().top;
      const contentOffset = projectTop - initialTop;
      // Keep a scrolled, sticky project index at its current visual position.
      if (index) {
        const indexOffset = index.getBoundingClientRect().top - projectTop;
        const padding = parseFloat(getComputedStyle(projectsView).paddingTop) || 0;
        Object.assign(index.style, { position: 'relative', top: '0', transform: `translateY(${indexOffset - padding}px)` });
      }
      collectionsView.hidden = false;
      collectionsView.inert = true;
      Object.assign(collectionsView.style, { position: 'fixed', left: '0', top: `${headerBottom}px`, width: `${canvasWidth}px`, visibility: 'hidden' });
      stage.classList.add('without-motion', 'is-project-opening', 'is-open', 'is-settled');
      stage.classList.remove('is-closing');
      void $('open-book').offsetWidth;
      const spread = $('book-spread');
      const rect = spread.getBoundingClientRect();
      const scale = rect.width / canvasWidth;
      const viewportHeight = Math.max(1, window.innerHeight - initialTop);
      const canvasHeight = Math.max(viewportHeight, rect.height / scale);
      home = document.createComment('Future Projects home');
      projectsView.before(home);
      Object.assign(projectsView.style, { width: `${canvasWidth}px`, position: 'relative', margin: '0', transformOrigin: '0 0', transform: `translateY(${contentOffset}px)` });
      projectsView.inert = true;
      paper = document.createElement('div');
      paper.className = 'project-expansion-paper';
      paper.appendChild(projectsView);
      overlay = document.createElement('div');
      overlay.className = 'chapter-transition';
      overlay.inert = true;
      overlay.setAttribute('aria-hidden', 'true');
      const surface = document.createElement('div');
      surface.className = 'project-expansion-surface';
      Object.assign(surface.style, { width: `${canvasWidth}px`, height: `${canvasHeight}px` });
      surface.appendChild(paper);
      overlay.appendChild(surface);
      document.body.appendChild(overlay);
      document.body.classList.add('chapter-transitioning');
      collectionsView.style.visibility = 'visible';
      let seam;
      if (window.innerWidth > 900) {
        seam = document.createElement('span');
        seam.className = 'project-expansion-seam';
        seam.style.width = `${24 / scale}px`;
        paper.appendChild(seam);
        animate(seam, [{ opacity: 0 }, { opacity: 1 }], { duration: 650, delay: 800, easing: 'ease-in' });
      }
      // Reverse the same uniform growth, including the easing curve and crop.
      animate(surface, [
        { transform: `translate(0,${initialTop}px) scale(1)`, clipPath: `inset(0 0 ${Math.max(0, canvasHeight - viewportHeight)}px 0)` },
        { transform: `translate(${rect.left}px,${rect.top}px) scale(${scale})`, clipPath: `inset(0 0 ${Math.max(0, canvasHeight - rect.height / scale)}px 0)` }
      ], { duration: 1450, easing: 'cubic-bezier(.8,0,.7,.35)' });
      animate(document.body, [{ backgroundColor: '#d6e5ee' }, { backgroundColor: '#b7ddd2' }], { duration: 1450, easing: 'cubic-bezier(.8,0,.7,.35)' });
      animate(document.querySelector('.collection-footer'), [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550, delay: 900, easing: 'ease-out' });
      if (scrollTop) animate(header, [{ transform: 'translateY(0)' }, { transform: `translateY(${scrollTop}px)` }], { duration: 1450, easing: 'ease-out' });
      await Promise.allSettled(animations.map((animation) => animation.finished));
      if (interrupted) return;

      // Hand the reduced paper back to the original spread before folding its
      // attached cover shut. Its reverse shows exactly the same project content.
      seam?.remove();
      paper.className = 'project-opening-paper';
      projectsView.style.transform = `scale(${scale}) translateY(${contentOffset}px)`;
      savedBack = [...back.childNodes];
      const preview = projectsView.cloneNode(true);
      preview.removeAttribute('id');
      preview.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      preview.classList.add('project-opening-preview');
      back.className = 'paper-page project-opening-inside';
      back.replaceChildren(preview);
      spread.appendChild(paper);
      document.body.classList.remove('chapter-transitioning');
      overlay.remove();
      void $('open-book').offsetWidth;
      stage.classList.remove('without-motion');
      const folded = settleCover();
      stage.classList.add('is-closing');
      stage.classList.remove('is-settled', 'is-open');
      await folded;
    } finally {
      window.removeEventListener('resize', finishOnResize);
      if (savedBack) back.replaceChildren(...savedBack);
      back.className = saved.backClass;
      restoreStyle(back, saved.backStyle);
      if (home) home.replaceWith(projectsView);
      restoreStyle(projectsView, saved.projectStyle);
      if (index) restoreStyle(index, saved.indexStyle);
      restoreStyle(collectionsView, saved.collectionStyle);
      projectsView.inert = false;
      collectionsView.inert = false;
      stage.classList.add('without-motion');
      stage.classList.remove('is-project-opening', 'is-open', 'is-settled', 'is-closing');
      paper?.remove();
      state.open = false;
      state.page = 0;
      paintSpread();
      if (continueTo === 'robotics' && !interrupted && !reducedMotion.matches) {
        // The closed Collection is a physical intermediate surface, not a
        // second navigation. Keep focus/clicks locked and commit history once.
        state.view = 'collections';
        document.body.dataset.view = 'collections';
        Object.entries(views).forEach(([view, element]) => { element.hidden = view !== 'collections'; });
        window.scrollTo({ top: 0, behavior: 'instant' });
        void document.body.offsetWidth;
        animations.forEach((animation) => animation.cancel());
        overlay?.remove();
        document.body.classList.remove('chapter-transitioning');
        await swapBooks('robotics', { continuation: true });
      } else {
        finishNavigation(continueTo || 'collections', animations, overlay);
        requestAnimationFrame(() => stage.classList.remove('without-motion'));
      }
    }
  }

  function restoreStyle(element, style) {
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
  }

  function finishNavigation(view, animations = [], overlay) {
    if (state.pendingClub && view === 'collections') {
      state.pendingClub = false;
      state.view = 'collections';
      document.body.dataset.view = 'collections';
      Object.entries(views).forEach(([key, element]) => { element.hidden = key !== 'collections'; });
      window.scrollTo({ top: 0, behavior: 'instant' });
      void document.body.offsetWidth;
      animations.forEach((animation) => animation.cancel());
      document.body.classList.remove('page-transitioning', 'chapter-transitioning', 'book-swapping');
      overlay?.remove();
      return showClub({ continuation: true });
    }
    state.busy = false;
    state.navigating = false;
    $('main-content').inert = false;
    document.querySelector('.site-header').inert = false;
    history.pushState(null, '', `#${view}`);
    route();
    void document.body.offsetWidth;
    animations.forEach((animation) => animation.cancel());
    document.body.classList.remove('page-transitioning', 'chapter-transitioning', 'book-swapping');
    overlay?.remove();
    document.querySelector(`.nav-link[data-view="${view}"]`).focus({ preventScroll: true });
    updateControls();
  }

  async function swapBooks(destination, { continuation = false } = {}) {
    if (!continuation && (state.busy || state.navigating)) return;
    const origin = state.view;
    if (!['collections', 'robotics'].includes(origin) || origin === destination) return;
    activateTab(destination);
    state.navigating = true;
    const main = $('main-content');
    const header = document.querySelector('.site-header');
    const stage = $('cover-stage');
    const sourceView = views[origin];
    const targetView = views[destination];
    const sourceBook = origin === 'collections' ? $('open-book') : document.querySelector('.robotics-poster');
    const targetBook = destination === 'collections' ? $('open-book') : document.querySelector('.robotics-poster');
    const roboticsIntro = document.querySelector('.robotics-intro');
    const introStyle = roboticsIntro.getAttribute('style');
    const rootStyles = [sourceView, targetView].map((view) => view.getAttribute('style'));
    const animations = [];
    const placements = [];
    let overlay, interrupted = false;
    const animate = (element, frames, options) => {
      if (interrupted) throw new Error('Viewport changed during the book exchange.');
      const animation = element.animate(frames, { fill: 'both', ...options });
      animations.push(animation);
      return animation;
    };
    const play = async (motions, duration, easing = 'cubic-bezier(.25,.8,.25,1)') => {
      await Promise.allSettled(motions.map(([element, frames]) => animate(element, frames, { duration, easing }).finished));
      if (interrupted) throw new Error('Viewport changed during the book exchange.');
    };
    const finishOnResize = () => {
      interrupted = true;
      animations.forEach((animation) => animation.finish());
    };
    main.inert = true;
    header.inert = true;
    document.body.classList.add('page-transitioning');
    try {
      const robotImage = $('robotics-image');
      robotImage.loading = 'eager';
      const hand = document.createElement('div');
      hand.className = 'book-hand';
      const handPhoto = document.createElement('img');
      handPhoto.className = 'hand-grip';
      handPhoto.src = 'assets/book-hand-long.png';
      handPhoto.alt = '';
      handPhoto.decoding = 'async';
      hand.appendChild(handPhoto);
      const relaxedPhoto = document.createElement('img');
      relaxedPhoto.className = 'hand-relaxed';
      relaxedPhoto.src = 'assets/book-hand-release-long.png';
      relaxedPhoto.alt = '';
      relaxedPhoto.decoding = 'async';
      hand.appendChild(relaxedPhoto);
      let isGripping = false;
      const gripHand = (gripping) => {
        animate(handPhoto, [{ opacity: Number(isGripping) }, { opacity: Number(gripping) }], { duration: 110, easing: 'ease-out' });
        animate(relaxedPhoto, [{ opacity: Number(!isGripping) }, { opacity: Number(!gripping) }], { duration: 110, easing: 'ease-out' });
        isGripping = gripping;
      };
      const photosReady = Promise.all([preparePictures(hand), preparePictures(document.querySelector('.robotics-poster')), loadPaperMaterials()]);
      if (origin === 'collections' && state.open) await closeBook({ forNavigation: true });
      state.busy = true;
      updateControls();
      if (reducedMotion.matches) return;
      await photosReady;

      const viewportWidth = document.documentElement.clientWidth;
      const scrollTop = window.scrollY;
      const headerBottom = header.getBoundingClientRect().bottom + scrollTop;
      const initialColor = getComputedStyle(document.body).backgroundColor;
      targetView.hidden = false;
      if (destination === 'robotics') roboticsIntro.style.visibility = 'hidden';
      Object.assign(targetView.style, { position: 'fixed', left: '0', top: `${headerBottom}px`, width: `${viewportWidth}px`, visibility: 'hidden', animation: 'none' });
      targetView.inert = true;
      if (destination === 'collections') {
        stage.classList.add('without-motion');
        stage.classList.remove('is-open', 'is-settled', 'is-closing');
        state.open = false;
        state.page = 0;
        paintSpread();
      }
      overlay = document.createElement('div');
      overlay.className = 'book-swap-scene';
      overlay.inert = true;
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
      document.body.classList.add('book-swapping');

      const takeBook = (book, view) => {
        const rect = book.getBoundingClientRect();
        const width = book.offsetWidth;
        const height = book.offsetHeight;
        const angle = view === 'robotics' ? 2 : 0;
        const placeholder = view === 'robotics' ? document.createElement('div') : document.createComment('Collection book home');
        if (view === 'robotics') {
          placeholder.className = 'book-swap-placeholder';
          Object.assign(placeholder.style, { width: `${width}px`, height: `${height}px`, margin: getComputedStyle(book).margin });
        }
        book.before(placeholder);
        const carrier = document.createElement('div');
        carrier.className = 'book-swap-carrier';
        Object.assign(carrier.style, { width: `${width}px`, height: `${height}px` });
        const pose = { x: rect.left + rect.width / 2 - width / 2, y: rect.top + rect.height / 2 - height / 2, angle, scale: 1 };
        carrier.style.transform = `translate(${pose.x}px,${pose.y}px) rotate(${angle}deg)`;
        placements.push({ book, placeholder, style: book.getAttribute('style') });
        // Freeze the book's original border box before moving it to the tabletop.
        // All image and lettering nodes stay in the same book surface.
        Object.assign(book.style, { position: 'absolute', left: '0', right: 'auto', top: '0', width: '100%', height: '100%', maxWidth: 'none', margin: '0', aspectRatio: 'auto', transform: 'none', transition: 'none', visibility: 'visible', isolation: 'auto' });
        carrier.appendChild(book);
        overlay.appendChild(carrier);
        return { carrier, pose, width, height };
      };
      const outgoing = takeBook(sourceBook, origin);
      const incoming = takeBook(targetBook, destination);
      // Opacity hides the entire surface; visibility can be overridden by the
      // book's explicit visible style and would expose it before the throw.
      incoming.carrier.style.opacity = '0';
      const originalHandHeight = Math.min(760, Math.max(340, outgoing.width * 1.4)) / 2;
      const leftmostGrip = incoming.pose.x + incoming.width * (destination === 'robotics' ? .08 : .85);
      // The longer, 3:1 sprites retain their natural proportions. Account for
      // the innermost pinch and wrist tilt, keeping the forearm crop offscreen.
      const handWidth = Math.max(originalHandHeight * 3, (viewportWidth + 100 - leftmostGrip) / .86);
      const handHeight = handWidth / 3;
      Object.assign(hand.style, { width: `${handWidth}px`, height: `${handHeight}px` });
      hand.style.visibility = 'hidden';
      overlay.appendChild(hand);
      window.addEventListener('resize', finishOnResize, { once: true });
      if (scrollTop) animate(header, [{ transform: 'translateY(0)' }, { transform: `translateY(${scrollTop}px)` }], { duration: 650, easing: 'ease-out' });
      const bookTransform = (pose) => `translate(${pose.x}px,${pose.y}px) rotate(${pose.angle}deg) scale(${pose.scale ?? 1})`;
      const handTransform = (book, pose, dx = 0, dy = 0, wrist = 0) => {
        const radians = pose.angle * Math.PI / 180;
        const scale = pose.scale ?? 1;
        const gripX = pose.x + book.width / 2 + (book.width * .4 * Math.cos(radians) + book.height * .12 * Math.sin(radians)) * scale;
        const gripY = pose.y + book.height / 2 + (book.width * .4 * Math.sin(radians) - book.height * .12 * Math.cos(radians)) * scale;
        return `translate(${gripX - handWidth * .072 + dx}px,${gripY - handHeight * .56 + dy}px) rotate(${pose.angle + wrist}deg)`;
      };
      const handleBook = (book, poses, duration, easing) => play([
        [book.carrier, poses.map((pose) => ({ transform: bookTransform(pose), offset: pose.offset }))],
        [hand, poses.map((pose) => ({ transform: handTransform(book, pose), offset: pose.offset }))]
      ], duration, easing);

      // Slide, reach, and preload the wrist before a quick upward/rightward pull.
      const bench = { ...outgoing.pose, x: Math.max(outgoing.pose.x, viewportWidth - outgoing.width - Math.max(22, viewportWidth * .035)), y: outgoing.pose.y + 5, angle: -2 };
      await play([[outgoing.carrier, [{ transform: bookTransform(outgoing.pose) }, { transform: bookTransform(bench) }]]], 520);
      hand.style.visibility = 'visible';
      await play([[hand, [
        { transform: handTransform(outgoing, bench, handWidth, -100, -12) },
        { transform: handTransform(outgoing, bench, -5, 3, 2), offset: .82 },
        { transform: handTransform(outgoing, bench) }
      ]]], 470);
      gripHand(true);
      const grip = { ...bench, x: bench.x - 6, y: bench.y - 4, angle: -5 };
      await handleBook(outgoing, [bench, grip], 170);
      const removed = { x: viewportWidth + outgoing.width * .6, y: bench.y - 190, angle: -23, scale: .96 };
      await handleBook(outgoing, [grip, { ...grip, x: grip.x + 28, y: grip.y - 16, angle: -8, offset: .25 }, removed], 510, 'cubic-bezier(.6,.03,.85,.5)');
      outgoing.carrier.style.opacity = '0';

      // The surrounding course arrives while the hand and removed book are offscreen.
      sourceView.hidden = true;
      targetView.style.visibility = 'visible';
      document.body.dataset.view = destination;
      animate(document.body, [{ backgroundColor: initialColor }, { backgroundColor: destination === 'robotics' ? '#cfcee4' : '#b7ddd2' }], { duration: 500, easing: 'ease-in-out' });
      const rest = incoming.pose;
      const arrive = { x: viewportWidth + incoming.width * .25, y: rest.y - 290, angle: 17, scale: 1.02 };
      const release = { x: rest.x + 15, y: rest.y - 74, angle: -9, scale: 1.02 };
      incoming.carrier.style.opacity = '1';
      await handleBook(incoming, [arrive, { x: rest.x + incoming.width * .22, y: rest.y - 160, angle: 9, scale: 1.03, offset: .62 }, release], 470, 'cubic-bezier(.35,.05,.75,.65)');
      gripHand(false);
      const landing = { x: rest.x + 9, y: rest.y + 3, angle: -4.5, scale: 1 };
      animate(incoming.carrier, [{ filter: 'drop-shadow(0 24px 22px #172a2344)' }, { filter: 'drop-shadow(0 3px 5px #172a2322)' }], { duration: 330, easing: 'ease-in' });
      await play([
        [incoming.carrier, [
          { transform: bookTransform(release) },
          { transform: bookTransform({ ...landing, y: rest.y + 9, angle: -7 }), offset: .66 },
          { transform: bookTransform({ ...landing, y: rest.y - 3, angle: -3 }), offset: .85 },
          { transform: bookTransform(landing) }
        ]],
        [hand, [{ transform: handTransform(incoming, release) }, { transform: handTransform(incoming, landing, 75, -70, 9) }]]
      ], 330, 'linear');

      // Re-grip and give the placed book one small, imperfect correction to its tilt.
      await play([[hand, [{ transform: handTransform(incoming, landing, 75, -70, 9) }, { transform: handTransform(incoming, landing) }]]], 280);
      gripHand(true);
      await handleBook(incoming, [landing, { ...rest, x: rest.x - 2, angle: rest.angle + .8, offset: .8 }, rest], 310);
      gripHand(false);
      if (destination === 'robotics') {
        await burnRoboticsPaper(overlay, incoming, animate, { hand, gripHand, handWidth, handHeight, isInterrupted: () => interrupted });
      } else {
        await play([
          [hand, [{ transform: handTransform(incoming, rest) }, { transform: handTransform(incoming, rest, handWidth, -35, 10) }]],
          [incoming.carrier, [{ filter: 'drop-shadow(0 3px 5px #172a2322)' }, { filter: 'drop-shadow(0 0 0 #172a2300)' }]]
        ], 430, 'cubic-bezier(.45,0,.8,.4)');
      }
    } catch (error) {
      if (!interrupted) console.warn('Book exchange finished without its remaining motion.', error);
    } finally {
      window.removeEventListener('resize', finishOnResize);
      placements.forEach(({ book, placeholder, style }) => { placeholder.replaceWith(book); restoreStyle(book, style); });
      restoreStyle(roboticsIntro, introStyle);
      [sourceView, targetView].forEach((view, index) => { restoreStyle(view, rootStyles[index]); view.inert = false; });
      state.open = false;
      state.page = 0;
      stage.classList.add('without-motion');
      stage.classList.remove('is-open', 'is-settled', 'is-closing');
      finishNavigation(destination, animations, overlay);
      requestAnimationFrame(() => stage.classList.remove('without-motion'));
    }
  }

  function makePaperRelief({ data, width, height }) {
    const values = new Float32Array(width * height);
    for (let index = 0; index < values.length; index++) {
      const pixel = index * 4;
      values[index] = data[pixel + 3] ? (data[pixel] * .2126 + data[pixel + 1] * .7152 + data[pixel + 2] * .0722) / 255 : .78;
    }
    const at = (x, y) => values[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
    const folds = new Float32Array(width * height * 3);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 3;
      folds[index] = at(x, y);
      folds[index + 1] = Math.max(-8, Math.min(8, (at(x + 1, y) - at(x - 1, y)) * 36));
      folds[index + 2] = Math.max(-10, Math.min(10, (at(x, y + 1) - at(x, y - 1)) * 42));
    }
    return (u, v) => {
      const x = Math.max(0, Math.min(1, u)) * (width - 1);
      const y = Math.max(0, Math.min(1, v)) * (height - 1);
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
      const fx = x - x0, fy = y - y0;
      const interpolate = (component) => {
        const a = folds[(y0 * width + x0) * 3 + component], b = folds[(y0 * width + x1) * 3 + component];
        const c = folds[(y1 * width + x0) * 3 + component], d = folds[(y1 * width + x1) * 3 + component];
        return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
      };
      return { height: interpolate(0), dx: interpolate(1), dy: interpolate(2) };
    };
  }

  function mapWrinkledInk(source, destination, relief, ratio) {
    const { width, height, data } = source;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const fold = relief(x / Math.max(1, width - 1), y / Math.max(1, height - 1));
      // Inverse sampling avoids holes and retains smooth letter edges across a crease.
      const sx = x - fold.dx * ratio, sy = y - fold.dy * ratio;
      if (sx < 0 || sx > width - 1 || sy < 0 || sy > height - 1) continue;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const pixel = (y * width + x) * 4;
      const light = .65 + fold.height * .45;
      for (let channel = 0; channel < 4; channel++) {
        const a = data[(y0 * width + x0) * 4 + channel], b = data[(y0 * width + x1) * 4 + channel];
        const c = data[(y1 * width + x0) * 4 + channel], d = data[(y1 * width + x1) * 4 + channel];
        const value = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
        destination.data[pixel + channel] = Math.round(value * (channel === 3 ? 1 : light));
      }
    }
  }

  async function burnRoboticsPaper(scene, book, animate, { hand, gripHand, handWidth, handHeight, isInterrupted }) {
    const [paperTexture, charTexture] = await loadPaperMaterials();
    if (isInterrupted()) return;
    const intro = document.querySelector('.robotics-intro');
    const glyphs = [];
    // Native ranges preserve the final font spacing without changing the DOM.
    for (const block of intro.children) {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const type = getComputedStyle(node.parentElement);
        const range = document.createRange();
        let offset = 0;
        for (const letter of node.textContent) {
          range.setStart(node, offset);
          offset += letter.length;
          range.setEnd(node, offset);
          const rect = range.getBoundingClientRect();
          if (!letter.trim() || !rect.width || !rect.height) continue;
          glyphs.push({ letter, rect, font: `${type.fontStyle} ${type.fontWeight} ${type.fontSize} ${type.fontFamily}`, color: type.color });
        }
      }
    }
    if (!glyphs.length) return;
    const left = Math.min(...glyphs.map(({ rect }) => rect.left)) - 18;
    const top = Math.min(...glyphs.map(({ rect }) => rect.top)) - 18;
    const width = Math.max(...glyphs.map(({ rect }) => rect.right)) - left + 18;
    const height = Math.max(...glyphs.map(({ rect }) => rect.bottom)) - top + 18;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.className = 'robotics-burn-canvas';
    canvas.width = Math.ceil(document.documentElement.clientWidth * ratio);
    canvas.height = Math.ceil(window.innerHeight * ratio);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    scene.appendChild(canvas);
    const makeTexture = (w, h, scale = ratio) => {
      const surface = document.createElement('canvas');
      surface.width = Math.ceil(w * scale);
      surface.height = Math.ceil(h * scale);
      const paint = surface.getContext('2d');
      paint.setTransform(scale, 0, 0, scale, 0, 0);
      return { surface, paint };
    };
    const base = makeTexture(width, height);
    const burned = makeTexture(width, height);
    const maskWidth = Math.ceil(width / 4);
    const maskHeight = Math.ceil(height / 4);
    const mask = makeTexture(maskWidth, maskHeight, 1);
    const heat = makeTexture(maskWidth, maskHeight, 1);
    const charMask = makeTexture(maskWidth, maskHeight, 1);
    const charred = makeTexture(width, height);
    const maskPixels = mask.paint.createImageData(maskWidth, maskHeight);
    const heatPixels = heat.paint.createImageData(maskWidth, maskHeight);
    const charPixels = charMask.paint.createImageData(maskWidth, maskHeight);
    const clamp = (value) => Math.max(0, Math.min(1, value));
    const noise = (x, y) => {
      const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const lattice = (x, y) => {
      let hash = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
    };
    const turbulence = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = lattice(ix, iy), b = lattice(ix + 1, iy);
      const c = lattice(ix, iy + 1), d = lattice(ix + 1, iy + 1);
      return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    };
    // A coherent, uneven burn travels from the ignition point, rather than a wipe.
    const burnField = (u, v) => clamp(.04 + Math.hypot(u - .05, (v - .95) * 1.1) * .58
      + .065 * (turbulence(u * 12, v * 17) - .5)
      + .03 * (turbulence(u * 39, v * 47) - .5)
      - .075 * Math.exp(-Math.abs(turbulence(u * 7, v * 9) - .5) * 18));
    const thresholds = new Float32Array(maskWidth * maskHeight);
    for (let y = 0; y < maskHeight; y++) for (let x = 0; x < maskWidth; x++) {
      thresholds[y * maskWidth + x] = Math.min(.96, burnField(x / maskWidth, y / maskHeight));
    }
    const drawWords = (paint, dx, dy, progress = null) => {
      paint.textBaseline = 'alphabetic';
      for (const glyph of glyphs) {
        paint.font = glyph.font;
        if (glyph.ascent === undefined) {
          const metrics = paint.measureText(glyph.letter);
          glyph.ascent = metrics.fontBoundingBoxAscent ?? parseFloat(glyph.font.match(/[\d.]+px/)?.[0] || '16') * .8;
        }
        const age = progress === null ? 1 : clamp((progress - burnField((glyph.rect.left - left) / width, (glyph.rect.top - top) / height)) / .13);
        paint.fillStyle = age < .65 ? '#3c241a' : glyph.color;
        paint.shadowColor = '#ff6927';
        paint.shadowBlur = progress === null ? 0 : (1 - age) * 5;
        paint.fillText(glyph.letter, glyph.rect.left + dx, glyph.rect.top + dy + glyph.ascent);
      }
      paint.shadowBlur = 0;
    };
    base.paint.fillStyle = '#eee7d6';
    base.paint.fillRect(0, 0, width, height);
    if (paperTexture) base.paint.drawImage(paperTexture, 0, 0, width, height);
    else for (let i = 0; i < 1800; i++) {
      base.paint.fillStyle = `rgba(95,76,45,${.02 + noise(i, 9) * .055})`;
      base.paint.fillRect(noise(i, 1) * width, noise(i, 2) * height, 1, 1);
    }
    drawWords(base.paint, -left, -top);

    // The same photograph supplies the local fold relief for the ink and the
    // moving sheet. Fine creases deform individual strokes before the sheet moves.
    const reliefWidth = 96, reliefHeight = 128;
    const reliefTexture = makeTexture(reliefWidth, reliefHeight, 1);
    if (paperTexture) reliefTexture.paint.drawImage(paperTexture, 0, 0, reliefWidth, reliefHeight);
    const reliefPixels = reliefTexture.paint.getImageData(0, 0, reliefWidth, reliefHeight);
    const relief = makePaperRelief(reliefPixels);
    const ink = makeTexture(width, height);
    drawWords(ink.paint, -left, -top);
    const inkPixels = ink.paint.getImageData(0, 0, ink.surface.width, ink.surface.height);
    const mappedInk = ink.paint.createImageData(ink.surface.width, ink.surface.height);
    mapWrinkledInk(inkPixels, mappedInk, relief, ratio);
    ink.paint.clearRect(0, 0, width, height);
    ink.paint.putImageData(mappedInk, 0, 0);
    // Rebuild the material with displaced print, rather than straight print on
    // top of the photographed creases. Multiply also carries fold lighting into ink.
    base.paint.clearRect(0, 0, width, height);
    base.paint.fillStyle = '#eee7d6';base.paint.fillRect(0, 0, width, height);
    if (paperTexture) base.paint.drawImage(paperTexture, 0, 0, width, height);
    base.paint.globalCompositeOperation = 'multiply';
    base.paint.drawImage(ink.surface, 0, 0, width, height);
    base.paint.globalCompositeOperation = 'source-over';

    const columns = 12, rows = 16;
    const triangle = (source, sourcePoints, points, shade) => {
      const [a, b, c] = sourcePoints;
      const [p, q, r] = points;
      const determinant = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
      const ax = ((q.x - p.x) * (c.y - a.y) - (r.x - p.x) * (b.y - a.y)) / determinant;
      const ay = ((q.y - p.y) * (c.y - a.y) - (r.y - p.y) * (b.y - a.y)) / determinant;
      const bx = ((r.x - p.x) * (b.x - a.x) - (q.x - p.x) * (c.x - a.x)) / determinant;
      const by = ((r.y - p.y) * (b.x - a.x) - (q.y - p.y) * (c.x - a.x)) / determinant;
      const centre = { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
      context.save();context.beginPath();
      points.forEach((point, index) => {
        const x = centre.x + (point.x - centre.x) * 1.004;
        const y = centre.y + (point.y - centre.y) * 1.004;
        if (index) context.lineTo(x, y); else context.moveTo(x, y);
      });
      context.closePath();context.clip();
      context.transform(ax, ay, bx, by, p.x - ax * a.x - bx * a.y, p.y - ay * a.x - by * a.y);
      context.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height);
      if (shade) { context.fillStyle = `rgba(48,35,15,${shade})`;context.fillRect(0, 0, width, height); }
      context.restore();
    };
    const renderSheet = (source, position, crumple) => {
      const vertices = [];
      const centreX = position.x + width * position.sx / 2;
      const centreY = position.y + height * position.sy / 2;
      for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
        const u = x / columns, v = y / rows;
        const fold = relief(u, v);
        const z = crumple * ((fold.height - .78) * 160 + Math.sin(u * 11 + v * 7) * 16 + Math.cos(v * 13 - u * 8) * 12);
        const projection = 850 / (850 + z);
        const radians = (position.angle || 0) * Math.PI / 180;
        const dx = position.x + u * width * position.sx - centreX + crumple * fold.dx;
        const dy = position.y + v * height * position.sy - centreY + crumple * fold.dy;
        vertices.push({ x: centreX + (dx * Math.cos(radians) - dy * Math.sin(radians)) * projection,
          y: centreY + (dx * Math.sin(radians) + dy * Math.cos(radians)) * projection, z });
      }
      for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        const ids = [y * (columns + 1) + x, y * (columns + 1) + x + 1, (y + 1) * (columns + 1) + x, (y + 1) * (columns + 1) + x + 1];
        const uv = [{ x: x * width / columns, y: y * height / rows }, { x: (x + 1) * width / columns, y: y * height / rows },
          { x: x * width / columns, y: (y + 1) * height / rows }, { x: (x + 1) * width / columns, y: (y + 1) * height / rows }];
        for (const face of [[0, 1, 2], [1, 3, 2]]) {
          const points = face.map((index) => vertices[ids[index]]);
          const shade = crumple * Math.min(.18, Math.abs(points[0].z - points[2].z) / 360);
          triangle(source, face.map((index) => uv[index]), points, shade);
        }
      }
    };
    const fire = makeTexture(64, 96, 1);
    const firePixels = fire.paint.createImageData(64, 96);
    const prepareFlame = (time) => {
      for (let y = 0; y < 96; y++) {
        const v = y / 95;
        const sway = Math.sin((1 - v) * 7 - time * 9) * (1 - v) * .23;
        const spread = .06 + Math.pow(v, .7) * .68;
        for (let x = 0; x < 64; x++) {
          const u = x / 63 * 2 - 1;
          const cloud = turbulence(u * 4 + time * .5, v * 5 + time * 4) * .58
            + turbulence(u * 9 - time, v * 12 + time * 8) * .29
            + turbulence(u * 21, v * 27 + time * 14) * .13;
          const density = clamp((1 - Math.abs(u - sway) / spread + (cloud - .5) * 1.3 - (1 - v) * .28) * 1.7);
          const temperature = clamp(density * .7 + v * .38 + cloud * .2);
          const index = (y * 64 + x) * 4;
          firePixels.data[index] = 255;
          firePixels.data[index + 1] = Math.round(42 + temperature * 202);
          firePixels.data[index + 2] = Math.round(4 + Math.pow(temperature, 5) * 188);
          firePixels.data[index + 3] = Math.round(Math.pow(density, .85) * 235 * clamp(v * 15));
        }
      }
      fire.paint.putImageData(firePixels, 0, 0);
    };
    const flame = (x, y, strength, time, seed = 0) => {
      const h = Math.max(3, (38 + Math.sin(time * 19 + seed) * 11) * strength);
      const w = h * (.42 + noise(seed, 31) * .16);
      const glow = context.createRadialGradient(x, y - h / 4, 1, x, y - h / 4, h * .9);
      glow.addColorStop(0, '#ff851644');glow.addColorStop(1, '#ff441100');
      context.fillStyle = glow;context.fillRect(x - h, y - h * 1.4, h * 2, h * 2);
      context.drawImage(fire.surface, x - w / 2 + Math.sin(time * 11 + seed) * 2, y - h, w, h);
    };
    const renderSmoke = (progress, time) => {
      for (let i = 0; i < 52; i++) {
        const u = noise(i, 21), v = noise(i, 22);
        const age = progress - burnField(u, v);
        if (age <= 0 || age >= .42) continue;
        const radius = 8 + age * 110;
        const x = left + u * width + Math.sin(time * 3 + i) * age * 70;
        const y = top + v * height - age * 250;
        const alpha = (1 - age / .42) * Math.min(.16, age * 2);
        const smoke = context.createRadialGradient(x, y, 1, x, y, radius);
        smoke.addColorStop(0, `rgba(48,42,38,${alpha})`);
        smoke.addColorStop(.5, `rgba(83,77,69,${alpha * .6})`);
        smoke.addColorStop(1, 'rgba(83,77,69,0)');
        context.fillStyle = smoke;context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    };
    const clear = () => context.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    const flat = { x: left, y: top, sx: 1, sy: 1 };
    const renderBurn = (progress, time) => {
      clear();
      // The print is already underneath the paper: burning holes physically
      // expose it, and a short amber heat glow cools into the normal typography.
      drawWords(context, 0, 0, progress);
      const edges = [];
      for (let y = 0; y < maskHeight; y++) for (let x = 0; x < maskWidth; x++) {
        const index = y * maskWidth + x;
        const distance = progress - thresholds[index];
        const amount = clamp((distance + .01) / .02);
        charPixels.data[index * 4 + 3] = Math.round(clamp((distance + .12) / .12) * 255);
        maskPixels.data[index * 4 + 3] = Math.round(amount * 255);
        const edge = Math.max(0, 1 - Math.abs(distance) / .014);
        heatPixels.data[index * 4] = 255;heatPixels.data[index * 4 + 1] = Math.round(36 + edge * 120);
        heatPixels.data[index * 4 + 2] = 24;heatPixels.data[index * 4 + 3] = Math.round(edge * 205);
        if (edge > .7 && index % 37 === 0) edges.push({ x: left + x / maskWidth * width, y: top + y / maskHeight * height });
      }
      mask.paint.putImageData(maskPixels, 0, 0);heat.paint.putImageData(heatPixels, 0, 0);
      charMask.paint.putImageData(charPixels, 0, 0);
      charred.paint.clearRect(0, 0, width, height);
      charred.paint.globalCompositeOperation = 'source-over';
      if (charTexture) charred.paint.drawImage(charTexture, 0, 0, width, height);
      else { charred.paint.fillStyle = '#29221a';charred.paint.fillRect(0, 0, width, height); }
      charred.paint.globalCompositeOperation = 'destination-in';
      charred.paint.drawImage(charMask.surface, 0, 0, width, height);
      charred.paint.globalCompositeOperation = 'source-over';
      burned.paint.clearRect(0, 0, width, height);
      burned.paint.globalCompositeOperation = 'source-over';
      burned.paint.drawImage(base.surface, 0, 0, width, height);
      burned.paint.drawImage(charred.surface, 0, 0, width, height);
      burned.paint.globalCompositeOperation = 'destination-out';
      burned.paint.drawImage(mask.surface, 0, 0, width, height);
      burned.paint.globalCompositeOperation = 'source-over';
      // The unconsumed paper stays wrinkled. Only exposed print below it is flat.
      renderSheet(burned.surface, flat, .48);
      context.drawImage(heat.surface, left, top, width, height);
      prepareFlame(time);
      for (let i = 0; i < edges.length; i += Math.max(1, Math.ceil(edges.length / 36))) flame(edges[i].x, edges[i].y, .65 + noise(i, 6) * .85, time, i);
      renderSmoke(progress, time);
      for (let i = 0; i < 80; i++) {
        const u = noise(i, 21), v = noise(i, 22);
        const age = progress - burnField(u, v);
        if (age < 0 || age > .3) continue;
        context.globalAlpha = (1 - age / .3) * .4;
        const x = left + u * width + Math.sin(age * 18 + i) * (12 + age * 80);
        const y = top + v * height - age * (150 + noise(i, 34) * 170);
        context.save();context.translate(x, y);context.rotate(age * 15 + i);
        context.fillStyle = i % 4 ? '#29241e' : '#ffb459';
        context.fillRect(-2, -1, 2 + noise(i, 35) * 4, 1 + noise(i, 36) * 2);context.restore();
      }
      context.globalAlpha = 1;
    };
    const rasterMotion = async (duration, render, name) => {
      canvas.dataset.phase = name;
      const animation = animate(canvas, [{ opacity: 1 }, { opacity: 1 }], { duration, easing: 'linear' });
      let frame;
      const drawFrame = () => {
        const progress = clamp(Number(animation.currentTime || 0) / duration);
        render(progress);frame = requestAnimationFrame(drawFrame);
      };
      drawFrame();
      try { await animation.finished; } finally { cancelAnimationFrame(frame); }
      render(1);
    };
    const depth = document.createElement('div');
    depth.className = 'robotics-book-depth';
    depth.innerHTML = '<span class="robotics-book-back"></span><span class="robotics-book-inside"></span><span class="robotics-book-pages"></span><span class="robotics-book-bottom"></span>';
    book.carrier.appendChild(depth);
    // Filter and isolation grouping flatten a 3D subtree, even for a clear shadow.
    book.carrier.getAnimations().forEach((animation) => {
      if (animation.effect?.getKeyframes().some((frame) => 'filter' in frame)) animation.cancel();
    });
    book.carrier.classList.add('book-has-depth');
    const front = book.carrier.firstElementChild;
    const frontStyle = front.getAttribute('style');
    Object.assign(front.style, { transformOrigin: 'right center', transform: 'rotateY(0deg)', backfaceVisibility: 'hidden' });
    // Hinge on the right, so the left fore-edge opens toward the course text.
    // The carrier stays on the table: only the actual cover opens in 3D.
    const coverGrip = (angle) => {
      const radians = angle * Math.PI / 180;
      const z = book.width * .9 * Math.sin(radians);
      const projection = 1300 / (1300 - z);
      const x = (book.width - book.width * .9 * Math.cos(radians) - book.width / 2) * projection;
      const y = -book.height * .12 * projection;
      const tilt = book.pose.angle * Math.PI / 180;
      return { x: book.pose.x + book.width / 2 + x * Math.cos(tilt) - y * Math.sin(tilt),
        y: book.pose.y + book.height / 2 + x * Math.sin(tilt) + y * Math.cos(tilt) };
    };
    const handAt = (angle, wrist = 0, dx = 0, dy = 0) => {
      const point = coverGrip(angle);
      return `translate(${point.x - handWidth * .072 + dx}px,${point.y - handHeight * .56 + dy}px) rotate(${book.pose.angle + wrist}deg)`;
    };
    try {
      const tilt = book.pose.angle * Math.PI / 180;
      const oldGripX = book.pose.x + book.width / 2 + book.width * .4 * Math.cos(tilt) + book.height * .12 * Math.sin(tilt);
      const oldGripY = book.pose.y + book.height / 2 + book.width * .4 * Math.sin(tilt) - book.height * .12 * Math.cos(tilt);
      await animate(hand, [{ transform: `translate(${oldGripX - handWidth * .072}px,${oldGripY - handHeight * .56}px) rotate(${book.pose.angle}deg)` },
        { transform: handAt(0, -3, 12, -12), offset: .8 }, { transform: handAt(0) }], { duration: 340, easing: 'cubic-bezier(.25,.8,.25,1)' }).finished;
      if (isInterrupted()) return;
      gripHand(true);
      await Promise.all([
        animate(front, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(6deg)', offset: .23 }, { transform: 'rotateY(34deg)' }], { duration: 620, easing: 'cubic-bezier(.3,.65,.2,1)' }).finished,
        animate(hand, [{ transform: handAt(0) }, { transform: handAt(6, -2), offset: .23 }, { transform: handAt(34, -8) }], { duration: 620, easing: 'cubic-bezier(.3,.65,.2,1)' }).finished
      ]);
      if (isInterrupted()) return;
      // A short extra opening and wrist flick provide the paper's launch impulse.
      await Promise.all([
        animate(front, [{ transform: 'rotateY(34deg)' }, { transform: 'rotateY(43deg)' }], { duration: 160, easing: 'cubic-bezier(.5,0,.8,.4)' }).finished,
        animate(hand, [{ transform: handAt(34, -8) }, { transform: handAt(43, -15) }], { duration: 160, easing: 'cubic-bezier(.5,0,.8,.4)' }).finished
      ]);
      if (isInterrupted()) return;
      gripHand(false);
      const exit = coverGrip(43);
      const paperOrigin = { x: exit.x - width * .12, y: exit.y - height * .03 };
      const closing = (async () => {
        await animate(front, [{ transform: 'rotateY(43deg)' }, { transform: 'rotateY(31deg)' }], { duration: 240, easing: 'ease-out' }).finished;
        if (isInterrupted()) return;
        await animate(front, [{ transform: 'rotateY(31deg)' }, { transform: 'rotateY(0deg)' }], { duration: 580, delay: 170, easing: 'cubic-bezier(.35,.25,.15,1)' }).finished;
      })();
      await Promise.all([
        rasterMotion(1000, (progress) => {
          clear();const ease = 1 - Math.pow(1 - progress, 3);
          context.globalAlpha = clamp(progress * 10);
          renderSheet(base.surface, { x: paperOrigin.x + (left - paperOrigin.x) * ease,
            y: paperOrigin.y + (top - paperOrigin.y) * ease - Math.sin(progress * Math.PI) * 75,
            sx: .12 + .88 * ease, sy: .06 + .94 * ease, angle: (1 - ease) * -12 - Math.sin(progress * Math.PI) * 6 }, 1 - .4 * ease);
          context.globalAlpha = 1;
        }, 'flick-paper'),
        animate(hand, [{ transform: handAt(43, -15) }, { transform: handAt(31, 2, 55, -35), offset: .35 }, { transform: handAt(0, 10, handWidth, -35) }], { duration: 430, easing: 'cubic-bezier(.45,0,.8,.4)' }).finished,
        closing
      ]);
      if (isInterrupted()) return;
      await rasterMotion(280, (progress) => { clear();renderSheet(base.surface, flat, .6 - .12 * progress); }, 'unfold-paper');
      if (isInterrupted()) return;
      await rasterMotion(360, (progress) => {
        clear();renderSheet(base.surface, flat, .48);
        prepareFlame(progress * .36);
        flame(left + width * .05, top + height * .95, progress * 1.7, progress * .36);
      }, 'ignite-paper');
      if (isInterrupted()) return;
      await rasterMotion(2400, (progress) => renderBurn(progress, progress * 2.4), 'burn-paper');
      if (isInterrupted()) return;
      await Promise.all([
        rasterMotion(300, (progress) => { clear();drawWords(context, 0, 0);renderSmoke(1 + progress * .5, 2.4 + progress * .3); }, 'cooled-print'),
        animate(depth, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' }).finished
      ]);
    } finally {
      restoreStyle(front, frontStyle);
      book.carrier.classList.remove('book-has-depth');
      depth.remove();
    }
  }

  function activateTab(view) {
    document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
      const active = link.dataset.view === view;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function route() {
    if (state.busy || state.navigating) return;
    const [rawView, slug] = location.hash.slice(1).split('/');
    const courseAnchor = rawView === 'robotics-course' || rawView === 'robotics-modules';
    const requested = courseAnchor ? 'robotics' : rawView;
    const view = Object.hasOwn(views, requested) ? requested : 'collections';
    const changed = view !== state.view;
    state.view = view;
    document.body.dataset.view = view;
    Object.entries(views).forEach(([key, element]) => { element.hidden = key !== view; });
    activateTab(view);
    document.title = `${view === 'collections' ? 'Makerspace' : view === 'robotics' ? 'Robotics — Makerspace' : 'Future Projects — Makerspace'} · SBHS 2026`;
    if (view === 'collections' && slug) {
      const index = tools.findIndex((tool) => tool.slug === slug);
      if (index >= 0) openBook(index, !state.open);
    }
    if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
    if (courseAnchor) $('robotics-course').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    if (view === 'future-projects' && slug) {
      const project = projects.find((item) => item.slug === slug);
      if (project) $(`project-${project.slug}`).scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    }
  }

  let suppressPageClickUntil = 0;
  function clickPage(event, direction) {
    if (event.defaultPrevented || event.target.closest('a,button,input,textarea,select,[contenteditable]')) return;
    if (Date.now() < suppressPageClickUntil || window.getSelection()?.toString()) return;
    if (window.innerWidth <= 900) {
      // Stacked pages retain left/back and right/forward tap regions.
      const rect = event.currentTarget.getBoundingClientRect();
      direction = event.clientX < rect.left + rect.width / 2 ? -1 : 1;
    }
    turnPage(direction);
  }

  function buildProjects() {
    $('project-index-links').innerHTML = projects.map((project, index) => `<a href="#future-projects/${project.slug}"><span>${String(index + 1).padStart(2, '0')}</span>${escape(project.title)}</a>`).join('');
    $('projects-list').innerHTML = projects.map((project, index) => `<article class="project-study" id="project-${project.slug}" aria-labelledby="project-title-${index}">
      <header class="project-study-heading"><span class="project-study-number">${String(index + 1).padStart(2, '0')}</span><h2 id="project-title-${index}">${escape(project.title)}</h2></header>
      <figure class="project-study-image">${picture(project.image, project.alt, 'loading="lazy" decoding="async"')}<figcaption>${credit(project.credit)}</figcaption></figure>
      <div class="project-study-notes"><p class="project-study-description">${escape(project.description)}</p><div class="project-study-working"><p>${escape(project.plan)}</p><p>${escape(project.detail)}</p><p class="project-study-tools">Tools: ${project.tools.map((slug) => { const tool = tools.find((item) => item.slug === slug); return `<a href="#collections/${slug}">${escape(tool.name)}</a>`; }).join(' · ')}</p></div></div>
    </article>`).join('');
    $('robotics-image').src = roboticsImage;
    const roboticsPhotoCredit = document.createElement('div');
    roboticsPhotoCredit.className = 'image-credit robotics-credit';
    roboticsPhotoCredit.innerHTML = `EXAMPLE PHOTO · ${credit(roboticsCredit)}`;
    const poster = document.querySelector('.robotics-poster');
    const wrapper = document.createElement('div');
    wrapper.className = 'robotics-image-wrapper';
    poster.replaceWith(wrapper);
    wrapper.append(poster, roboticsPhotoCredit);
  }

  $('skip-intro').addEventListener('click', finishIntro);
  $('open-book').addEventListener('click', () => openBook());
  document.querySelectorAll('.nav-link[data-view]').forEach((link) => link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || state.busy || state.navigating) return;
    activateTab(link.dataset.view);
  }));
  document.querySelector('.nav-link[data-view="future-projects"]').addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (state.busy || state.navigating) { event.preventDefault(); return; }
    if (state.view === 'collections') {
      event.preventDefault();
      openProjects();
    }
  });
  document.querySelectorAll('.nav-link[data-view="collections"], .wordmark').forEach((link) => {
    link.addEventListener('click', async (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (state.busy || state.navigating) { event.preventDefault(); return; }
      activateTab('collections');
      if (state.view === 'future-projects') {
        event.preventDefault();
        closeProjects();
        return;
      }
      if (state.view === 'robotics') {
        event.preventDefault();
        swapBooks('collections');
        return;
      }
      if (state.view === 'collections' && state.open) {
        event.preventDefault();
        await closeBook();
      } else if (state.view !== 'collections') {
        // A return from another section always lands on the front cover.
        state.open = false;
        state.page = 0;
        $('cover-stage').classList.add('without-motion');
        $('cover-stage').classList.remove('is-open', 'is-settled', 'is-closing');
        paintSpread();
        requestAnimationFrame(() => $('cover-stage').classList.remove('without-motion'));
      }
    });
  });
  document.querySelector('.nav-link[data-view="robotics"]').addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (state.busy || state.navigating) { event.preventDefault(); return; }
    if (state.view === 'collections') { event.preventDefault(); swapBooks('robotics'); }
    else if (state.view === 'future-projects') { event.preventDefault(); closeProjects({ continueTo: 'robotics' }); }
  });
  $('next-page').addEventListener('click', () => turnPage(1));
  $('previous-page').addEventListener('click', () => turnPage(-1));
  $('poster-page').addEventListener('click', (event) => clickPage(event, -1));
  $('detail-page').addEventListener('click', (event) => clickPage(event, 1));
  $('about-button').addEventListener('click', () => showClub());
  $('robotics-club-button').addEventListener('click', () => showClub());
  $('book-spread').addEventListener('click', (event) => {
    if (event.target.closest('[data-replay-intro]') && !state.busy && !state.navigating) { showIntro(); $('skip-intro').focus(); }
  });
  document.addEventListener('keydown', (event) => {
    if (state.view !== 'collections' || document.body.classList.contains('intro-active') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (state.open && event.key === 'ArrowRight') { event.preventDefault(); turnPage(1); }
    if (state.open && event.key === 'ArrowLeft') { event.preventDefault(); turnPage(-1); }
    if (state.open && event.key === 'Escape') closeBook();
  });
  let touchStart = null;
  $('book-spread').addEventListener('touchstart', (event) => {
    if (event.touches.length === 1 && !event.target.closest('a,button')) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  $('book-spread').addEventListener('touchend', (event) => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressPageClickUntil = Date.now() + 400;
      turnPage(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
  $('book-spread').addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  // A hash change during an animation is applied once the animation completes.
  window.addEventListener('hashchange', () => {
    if (!state.busy && !state.navigating) route();
    else {
      const check = () => { if (state.busy || state.navigating) setTimeout(check, 80); else route(); };
      check();
    }
  });
  buildProjects();
  loadPaperMaterials();
  paintSpread();
  route();
  showIntro();
})();
