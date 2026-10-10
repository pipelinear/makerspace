(() => {
  'use strict';
  const settings = window.MAKERSPACE.signatureSettings, signatures = window.MAKERSPACE.clubSignatures;
  const base = settings.apiUrl.replace(/\/$/, ''), presets = window.MAKERSPACE_PRESETS || [];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const message = (id, text) => { if ($(id)) $(id).textContent = text; };
  let repaint, available, token = '', pendingBattleToken = '', battleLoginGeneration = 0;
  let localAdmin = false, pendingPreview = false, adminRows = [], adminGeneration = 0, reviewLoading = false;
  let placements = [], savedPlacements = [], savedUploads = [], removedUploads = [], layoutRevision = 0, layoutDirty = false;
  let editing = '', saving = false, drag = null, wasOnSpread = false;
  let prepared = null, previewURL = '', submissionId = '', generation = 0, sending = false;
  const adminURLs = new Map(), canEdit = () => Boolean(token || localAdmin), isPreset = row => Boolean(row?.key);
  const current = () => signatures.find(row => row.id === editing);
  function presetRows() {
    return placements.flatMap(item => {
      const preset = presets.find(p => p.key === item.key);
      return preset ? [{ ...preset, ...item, height: item.width * preset.imageHeight / preset.imageWidth * .827, status: 'approved' }] : [];
    });
  }
  function syncEditing() {
    document.body.classList.toggle('signature-editing', Boolean(editing && canEdit()));
    document.body.classList.toggle('signature-admin-session', canEdit());
  }
  function renderDraft() { syncEditing(); if (available?.()) repaint(); syncRail(); }
  function applyLayout(data) {
    layoutRevision = data.revision || 0; placements = structuredClone(data.placements || []);
    savedPlacements = structuredClone(placements); removedUploads = []; layoutDirty = false;
  }
  function applyRows(rows) {
    savedUploads = rows.filter(row => row.status === 'approved').map(row => ({ ...row, image: base + row.image }));
    signatures.splice(0, signatures.length, ...structuredClone(savedUploads), ...presetRows());
    if (!current()) editing = '';
    renderDraft();
  }
  function discardDraft() {
    placements = structuredClone(savedPlacements); removedUploads = []; layoutDirty = false; editing = ''; drag = null;
    signatures.splice(0, signatures.length, ...structuredClone(savedUploads), ...presetRows());
  }
  function endSession() {
    token = ''; localAdmin = false; adminGeneration++; reviewLoading = false; adminRows = [];
    discardDraft(); $('signature-admin-dialog')?.close();
    adminURLs.forEach(url => URL.revokeObjectURL(url)); adminURLs.clear(); renderDraft();
  }
  async function api(path, { auth = false, body, method = 'GET', binary = false } = {}) {
    if (!base) throw new Error('The shared book is not connected yet.');
    if (window.location?.protocol === 'file:' && (auth || method !== 'GET')) throw new Error('Open Local-Preview.command, then try again.');
    const headers = {};
    if (auth) headers.Authorization = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const response = await fetch(base + path, { method, body, headers, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (auth && response.status === 401) endSession();
    if (!response.ok) {
      const data = await response.json().catch(() => ({})), error = new Error(data.error || 'Could not connect. Please try again.');
      error.status = response.status; throw error;
    }
    return binary ? response.blob() : response.json();
  }
  function syncRail() {
    const onSpread = Boolean(available?.()), entered = onSpread && !wasOnSpread; wasOnSpread = onSpread;
    if (entered) refresh();
    const rail = $('signature-admin-rail'); if (!rail) return;
    rail.hidden = !canEdit() || !onSpread;
    if (rail.hidden) return;
    const pending = adminRows.filter(row => (row.status === 'pending' && !signatures.some(s => s.id === row.id)) || removedUploads.some(s => s.id === row.id));
    rail.innerHTML = `<span class="eyebrow">SIGNING DESK</span><div class="signature-rail-actions"><button data-save-layout ${saving || !base ? 'disabled' : ''}>${saving ? 'Saving…' : 'Save'}</button><button data-reload-layout ${saving ? 'disabled' : ''}>Reload</button></div><section class="signature-review-tray" aria-label="Uploads to review"><h3>To review</h3>${pending.map(row => `<button class="signature-review-thumb" data-inspect-upload="${row.id}" draggable="${Boolean(adminURLs.get(row.id))}" aria-label="View ${escape(row.name)}">${adminURLs.has(row.id) ? `<img src="${adminURLs.get(row.id)}" alt="${escape(row.name)}" draggable="false">` : `<span>${escape(row.name)}</span>`}</button>`).join('') || `<p>${reviewLoading ? 'Loading…' : !base ? 'Connect the shared book to receive uploads.' : 'All caught up.'}</p>`}<button data-refresh-reviews ${!token || reviewLoading ? 'disabled' : ''} aria-label="Refresh uploads">↻</button></section><section aria-label="Design palette"><h3>Designs</h3><div class="signature-palette">${presets.map(p => `<button draggable="true" data-preset-key="${p.key}" aria-label="Add ${escape(p.name)}"><img src="${p.image}" draggable="false" alt=""><span>${escape(p.name)}</span></button>`).join('')}</div></section><button data-signature-signout>Sign out</button><p id="signature-layout-status" role="status">${!base ? 'Preview · shared service not connected' : layoutDirty ? 'Unsaved changes' : 'Saved'}</p>`;
  }
  function markDirty(row) {
    if (row && isPreset(row)) {
      const item = placements.find(p => p.id === row.id);
      if (item) Object.assign(item, { page: row.page, x: row.x, y: row.y, width: row.width });
    }
    layoutDirty = true; syncRail();
  }
  function clampPosition(row) {
    row.width = Math.max(5, Math.min(row.width, 70, 70 / (.827 * row.imageHeight / row.imageWidth)));
    row.height = row.width * row.imageHeight / row.imageWidth * .827;
    row.x = Math.max(4, Math.min(row.x, 96 - row.width));
    row.y = Math.max(row.page === 'left' ? 12 : 4, Math.min(row.y, 94 - row.height));
  }
  function addPreset(key, page = 'right', x = 14, y = 20) {
    if (!canEdit() || !available() || saving || placements.length >= 40) return;
    const preset = presets.find(p => p.key === key); if (!preset) return;
    const row = { ...preset, id: 'preset-' + crypto.randomUUID(), page, x, y, width: 30 };
    clampPosition(row); placements.push({ id: row.id, key, page, x: row.x, y: row.y, width: row.width });
    signatures.push(row); editing = row.id; markDirty(); renderDraft();
  }
  function addUpload(id, page = 'right', x = 14, y = 20) {
    if (!token || !available() || saving || signatures.some(row => row.id === id)) return;
    const source = adminRows.find(row => row.id === id), image = adminURLs.get(id); if (!source || !image) return;
    const row = { ...source, image, page, x, y, width: 30 };
    clampPosition(row); removedUploads = removedUploads.filter(item => item.id !== id);
    signatures.push(row); editing = id; markDirty(); renderDraft();
  }
  function removeCurrent() {
    if (!canEdit() || saving || !current()) return;
    const row = current();
    if (isPreset(row)) placements = placements.filter(item => item.id !== row.id);
    else if (savedUploads.some(item => item.id === row.id)) removedUploads.push({ id: row.id, revision: row.revision });
    signatures.splice(signatures.indexOf(row), 1); editing = ''; markDirty(); renderDraft(); if (token) loadReviews();
  }
  async function saveLayout() {
    if (!canEdit() || saving || drag || !layoutDirty) return;
    if (!base) { message('signature-layout-status', 'Connect the shared service before publishing.'); return; }
    saving = true; syncRail();
    try {
      const uploads = signatures.filter(row => !isPreset(row)).map(({ id, revision, page, x, y, width }) => ({ id, revision, page, x, y, width }));
      const result = await api('/admin/layout', { auth: true, method: 'PUT', body: { revision: layoutRevision, placements, signatures: uploads, removed: removedUploads } });
      applyLayout(result); applyRows(result.signatures); saving = false; syncRail();
      message('signature-layout-status', 'Saved for everyone.'); loadReviews();
    } catch (error) { saving = false; syncRail(); message('signature-layout-status', error.message); }
  }
  async function reloadLayout() {
    if (!canEdit() || saving || drag || layoutDirty && !window.confirm('Discard unsaved changes?')) return;
    if (!base) { discardDraft(); renderDraft(); return; }
    saving = true;
    try {
      const [rows, layout] = await Promise.all([api('/signatures'), api('/layout')]);
      applyLayout(layout); editing = ''; applyRows(rows.signatures);
      if (token) loadReviews();
    } catch (error) { message('signature-layout-status', error.message); }
    finally { saving = false; syncRail(); }
  }
  async function refresh() {
    if (!base || saving || drag || layoutDirty || editing) return;
    const startedAtRevision = layoutRevision;
    try {
      const [rows, layout] = await Promise.all([api('/signatures'), api('/layout')]);
      if (saving || drag || layoutDirty || editing || layoutRevision !== startedAtRevision) return;
      applyLayout(layout); applyRows(rows.signatures);
    } catch { /* Preserve the last loaded book during connection interruptions. */ }
  }
  async function loadReviews() {
    if (!token || reviewLoading) return;
    const version = ++adminGeneration; reviewLoading = true; syncRail();
    try {
      const data = await api('/admin/signatures', { auth: true });
      if (version !== adminGeneration || !token) return;
      adminRows = data.signatures;
      await Promise.allSettled(adminRows.filter(row => !adminURLs.has(row.id) && (row.status === 'pending' || removedUploads.some(item => item.id === row.id))).map(async row => {
        const blob = await api(`/admin/images/${row.id}`, { auth: true, binary: true });
        if (version === adminGeneration && token) adminURLs.set(row.id, URL.createObjectURL(blob));
      }));
    } catch (error) { if (token) message('signature-layout-status', error.message); }
    finally { if (version === adminGeneration) { reviewLoading = false; syncRail(); } }
  }
  function showAdmin(id) {
    if (!token) return;
    const row = adminRows.find(item => item.id === id), image = adminURLs.get(id); if (!row || !image) return;
    $('signature-admin-image').src = image; $('signature-admin-image').alt = row.name;
    $('signature-admin-title').textContent = row.name;
    $('signature-admin-dialog').showModal();
    $('signature-place-upload').dataset.uploadId = id;
  }
  function noteHTML() {
    return `<aside class="signature-note" aria-label="Signature page controls"><div class="signature-help"><button type="button" class="signature-help-button" data-signature-help aria-label="How to sign the book" aria-expanded="false" aria-controls="signature-help-text">?</button><div id="signature-help-text" class="signature-help-popover" role="note"><p>Leave your mark. Click Upload.</p><p><a href="${escape(settings.creatorUrl)}" target="_blank" rel="noopener noreferrer">shaderlabs.app ↗</a><br>By Ewan McCorkell, Makerspace student.</p></div></div><button type="button" class="signature-upload-button" data-signature-upload aria-label="Upload your image"><span aria-hidden="true">↥</span> Upload</button></aside>`;
  }
  function handlesHTML(row) {
    if (!canEdit() || editing !== row.id) return '';
    return `<button class="signature-remove" data-signature-remove aria-label="Remove ${escape(row.name)} from this page">×</button>${['nw','ne','sw','se'].map(corner => `<button class="signature-resize signature-resize-${corner}" data-signature-resize="${corner}" aria-label="Resize ${escape(row.name)}" title="Drag to resize"></button>`).join('')}`;
  }
  function toolbarHTML() { return ''; }
  async function preparePNG(file) {
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG, or WebP image.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image under 8 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 16000000) throw new Error('Export a smaller image (up to 16 million pixels).');
      const scale = Math.min(1, 1024 / bitmap.width, 1024 / bitmap.height, Math.sqrt(262144 / (bitmap.width * bitmap.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(bitmap.width * scale)); canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const alpha = pixels[(y * canvas.width + x) * 4 + 3];
        if (alpha >= 8) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
      if (maxX < 0) throw new Error('This PNG is blank. Add your name before exporting.');
      minX = Math.max(0, minX - 8); minY = Math.max(0, minY - 8);
      maxX = Math.min(canvas.width - 1, maxX + 8); maxY = Math.min(canvas.height - 1, maxY + 8);
      const cropped = document.createElement('canvas'); cropped.width = maxX - minX + 1; cropped.height = maxY - minY + 1;
      cropped.getContext('2d').drawImage(canvas, minX, minY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      let output = cropped, blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
      for (let attempt = 0; blob?.size > 512 * 1024 && attempt < 8; attempt++) {
        const smaller = document.createElement('canvas');
        smaller.width = Math.max(1, Math.floor(output.width * .8)); smaller.height = Math.max(1, Math.floor(output.height * .8));
        smaller.getContext('2d').drawImage(output, 0, 0, smaller.width, smaller.height); output = smaller;
        blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
      }
      if (!blob || blob.size > 512 * 1024) throw new Error('This image is too detailed. Choose a smaller image.');
      return blob;
    } finally { bitmap.close(); }
  }
  function clearPreview() {
    generation++; prepared = null; submissionId = '';
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = ''; $('signature-preview').removeAttribute('src'); $('signature-preview-wrap').hidden = true;
    $('signature-send').disabled = true;
  }
  async function fileChanged() {
    clearPreview();
    const version = generation;
    const file = $('signature-file').files[0];
    if (!file) return;
    message('signature-upload-status', 'Preparing your image…');
    try {
      const blob = await preparePNG(file);
      if (version !== generation) return;
      prepared = blob; submissionId = crypto.randomUUID(); previewURL = URL.createObjectURL(blob);
      $('signature-preview').src = previewURL; $('signature-preview-wrap').hidden = false;
      $('signature-send').disabled = false;
      message('signature-upload-status', 'Ready to send.');
    } catch (error) { if (version === generation) message('signature-upload-status', error.message); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!prepared || sending) return;
    if (!base) { message('signature-upload-status', 'Uploads are unavailable right now. Please try again later.'); return; }
    const form = new FormData(); form.set('name', $('signature-name').value.trim()); form.set('image', prepared, 'signature.png'); form.set('submissionId', submissionId);
    const imageURL = previewURL;
    sending = true; $('signature-send').disabled = true; $('signature-file').disabled = true;
    message('signature-upload-status', 'Sending…');
    let accepted = false;
    try {
      await api('/submissions', { method: 'POST', body: form }); accepted = true;
      if ($('signature-upload-dialog').open && imageURL === previewURL) {
        await window.MAKERSPACE_FLIGHT.play($('signature-upload-dialog'), imageURL);
        $('signature-upload-dialog').close();
      }
      message('signature-upload-status', 'Sent.');
    } catch (error) {
      if (accepted) { $('signature-upload-dialog').close(); message('signature-upload-status', 'Sent.'); }
      else { message('signature-upload-status', error.message); $('signature-send').disabled = !prepared; }
    } finally { sending = false; $('signature-file').disabled = false; }
  }
  function revokeBattleToken(abandoned) {
    if (abandoned && base) fetch(base + '/admin/logout', { method: 'POST', headers: { Authorization: `Bearer ${abandoned}` }, keepalive: true }).catch(() => {});
  }
  async function authenticateAdmin(password) {
    if (!base) { pendingPreview = password === 'nick'; return { granted: pendingPreview, mode: 'preview' }; }
    const generation = ++battleLoginGeneration;
    try {
      const received = (await api('/admin/login', { method: 'POST', body: { password } })).token;
      if (generation !== battleLoginGeneration) { revokeBattleToken(received); return { granted: false, mode: 'live' }; }
      pendingBattleToken = received;
      return { granted: true, mode: 'live' };
    } catch (error) {
      if (error.status === 401) return { granted: false, mode: 'live' };
      throw error;
    }
  }
  function completeBattleLogin() { token = pendingBattleToken; pendingBattleToken = ''; localAdmin = pendingPreview; pendingPreview = false; syncEditing(); syncRail(); if (token) loadReviews(); }
  function discardBattleLogin() {
    battleLoginGeneration++; pendingPreview = false;
    const abandoned = pendingBattleToken; pendingBattleToken = '';
    revokeBattleToken(abandoned);
  }

  function paintPosition(row) {
    const entry = document.querySelector(`[data-signature-id="${row.id}"]`);
    if (entry) { entry.style.left = `${row.x}%`; entry.style.top = `${row.y}%`; entry.style.width = `${row.width}%`; }
  }
  function onPointerDown(event) {
    let entry = event.target.closest('[data-signature-id]');
    if (!canEdit() || !entry || saving || event.button !== 0 || !available() || event.target.closest('[data-signature-remove]')) return;
    const corner = event.target.closest('[data-signature-resize]')?.dataset.signatureResize;
    if (entry.dataset.signatureId !== editing) {
      editing = entry.dataset.signatureId; syncEditing(); repaint();
      entry = document.querySelector(`[data-signature-id="${editing}"]`); if (!entry) return;
    }
    const row = current(), rect = entry.closest('.signature-paper').getBoundingClientRect();
    drag = { entry, row, corner, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, snapshot: { ...row }, rect,
      grabX: (event.clientX - rect.left) / rect.width * 100 - row.x,
      grabY: (event.clientY - rect.top) / rect.height * 100 - row.y };
    entry.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
  }
  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { row, snapshot, corner } = drag;
    if (corner) {
      const dx = (event.clientX - drag.startX) / drag.rect.width * 100 * (corner.includes('w') ? -1 : 1);
      const ratio = .827 * row.imageHeight / row.imageWidth;
      const dy = (event.clientY - drag.startY) / drag.rect.height * 100 / ratio * (corner.includes('n') ? -1 : 1);
      let width = snapshot.width + (Math.abs(dx) >= Math.abs(dy) ? dx : dy);
      const anchorX = corner.includes('w') ? snapshot.x + snapshot.width : snapshot.x;
      const anchorY = corner.includes('n') ? snapshot.y + snapshot.height : snapshot.y;
      const maxWidth = Math.min(70, (corner.includes('w') ? anchorX - 4 : 96 - anchorX), (corner.includes('n') ? anchorY - (row.page === 'left' ? 12 : 4) : 94 - anchorY) / ratio);
      width = Math.max(5, Math.min(width, maxWidth));
      row.width = width; row.x = corner.includes('w') ? anchorX - width : anchorX; row.y = corner.includes('n') ? anchorY - width * ratio : anchorY;
    } else {
      const paper = document.elementFromPoint?.(event.clientX, event.clientY)?.closest('.signature-paper');
      if (paper && paper !== drag.entry.closest('.signature-paper')) {
        paper.querySelector('.signature-marks').append(drag.entry);
        drag.rect = paper.getBoundingClientRect(); row.page = paper.closest('#poster-page') ? 'left' : 'right';
        drag.entry.setPointerCapture(event.pointerId);
      }
      row.x = (event.clientX - drag.rect.left) / drag.rect.width * 100 - drag.grabX;
      row.y = (event.clientY - drag.rect.top) / drag.rect.height * 100 - drag.grabY;
    }
    clampPosition(row); paintPosition(row); event.preventDefault();
  }
  function endDrag(event, cancelled = false) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const active = drag; drag = null;
    if (active.entry.hasPointerCapture(event.pointerId)) active.entry.releasePointerCapture(event.pointerId);
    if (cancelled) Object.assign(active.row, active.snapshot);
    else markDirty(active.row);
    renderDraft();
  }
  async function signOut() {
    if (saving || layoutDirty && !window.confirm('Sign out and discard unsaved changes?')) return;
    try { if (token) await api('/admin/logout', { auth: true, method: 'POST' }); endSession(); }
    catch (error) { message('signature-layout-status', error.message); }
  }
  function init(options) {
    repaint = options.repaint; available = options.available;
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="signature-upload-dialog" class="signature-dialog" aria-labelledby="signature-upload-title"><button class="signature-dialog-close" data-signature-close aria-label="Close">×</button><h2 id="signature-upload-title">Leave your mark.</h2><p>Choose your image.</p><form id="signature-upload-form"><label>Your name<input id="signature-name" name="name" maxlength="80" required autocomplete="name"></label><label>Image<input id="signature-file" name="image" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" required></label><div id="signature-preview-wrap" class="signature-preview" hidden><img id="signature-preview" alt="Your image"></div><p id="signature-upload-status" role="status"></p><button id="signature-send" type="submit" disabled>Send ↗</button></form><p class="signature-creator-credit"><a href="${escape(settings.creatorUrl)}" target="_blank" rel="noopener noreferrer">shaderlabs.app ↗</a><br>By Ewan McCorkell, Makerspace student.</p></dialog>
      <dialog id="signature-admin-dialog" class="signature-dialog signature-inspect-dialog" aria-labelledby="signature-admin-title"><button class="signature-dialog-close" data-signature-close aria-label="Close">×</button><h2 id="signature-admin-title"></h2><img id="signature-admin-image" class="signature-inspect-image" alt=""><button id="signature-place-upload" data-place-upload>Add to page</button></dialog>`);
    $('reader')?.insertAdjacentHTML('beforeend', '<aside id="signature-admin-rail" class="signature-admin-rail" aria-label="Signing desk" hidden></aside>');
    $('signature-file').addEventListener('change', fileChanged);
    $('signature-upload-form').addEventListener('submit', submit);
    $('signature-upload-dialog').addEventListener('close', () => { window.MAKERSPACE_FLIGHT?.cancel(); clearPreview(); });
    $('signature-admin-dialog').addEventListener('close', () => $('signature-admin-image').removeAttribute('src'));
    document.addEventListener('click', event => {
      const target = event.target;
      if (target.closest('[data-save-layout]')) saveLayout();
      if (target.closest('[data-reload-layout]')) reloadLayout();
      if (target.closest('[data-refresh-reviews]')) loadReviews();
      if (target.closest('[data-signature-signout]')) signOut();
      const inspect = target.closest('[data-inspect-upload]'); if (inspect) showAdmin(inspect.dataset.inspectUpload);
      const place = target.closest('[data-place-upload]'); if (place) { addUpload(place.dataset.uploadId); $('signature-admin-dialog').close(); }
      const preset = target.closest('[data-preset-key]'); if (preset) addPreset(preset.dataset.presetKey);
      if (target.closest('[data-signature-remove]')) removeCurrent();
      const help = target.closest('[data-signature-help]');
      if (help) {
        const group = help.closest('.signature-help'), open = !group.classList.contains('is-open');
        group.classList.toggle('is-open', open); group.classList.toggle('is-dismissed', !open); help.setAttribute('aria-expanded', String(open));
      }
      if (!target.closest('.signature-help')) document.querySelectorAll('.signature-help.is-open').forEach(group => {
        group.classList.remove('is-open'); group.querySelector('[data-signature-help]').setAttribute('aria-expanded', 'false');
      });
      if (target.closest('[data-signature-close]')) target.closest('dialog').close();
      if (target.closest('[data-signature-upload]')) { clearPreview(); $('signature-upload-form').reset(); message('signature-upload-status', ''); $('signature-upload-dialog').showModal(); }
    });
    document.addEventListener('mouseover', event => event.target.closest('[data-signature-help]')?.closest('.signature-help')?.classList.remove('is-dismissed'));
    document.addEventListener('dragstart', event => {
      if (!canEdit() || saving) { event.preventDefault(); return; }
      const preset = event.target.closest('[data-preset-key]'), upload = event.target.closest('[data-inspect-upload]');
      if (preset) event.dataTransfer.setData('application/x-makerspace-design', preset.dataset.presetKey);
      else if (upload && token && adminURLs.has(upload.dataset.inspectUpload)) event.dataTransfer.setData('application/x-makerspace-upload', upload.dataset.inspectUpload);
      else return;
      event.dataTransfer.effectAllowed = 'copy';
    });
    document.addEventListener('dragover', event => {
      if (canEdit() && !saving && available() && event.target.closest('.signature-paper') && Array.from(event.dataTransfer.types).some(t => ['application/x-makerspace-design','application/x-makerspace-upload'].includes(t))) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }
    });
    document.addEventListener('drop', event => {
      const paper = event.target.closest('.signature-paper'); if (!canEdit() || !available() || !paper || saving) return;
      const key = event.dataTransfer.getData('application/x-makerspace-design'), id = event.dataTransfer.getData('application/x-makerspace-upload'); if (!key && !id) return;
      event.preventDefault(); const rect = paper.getBoundingClientRect();
      const args = [paper.closest('#poster-page') ? 'left' : 'right', (event.clientX - rect.left) / rect.width * 100 - 15, (event.clientY - rect.top) / rect.height * 100 - 8];
      if (key) addPreset(key, ...args); else addUpload(id, ...args);
    });
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', moveDrag);
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', event => endDrag(event, true));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && event.target.closest('.signature-help')) {
        const group = event.target.closest('.signature-help'); group.classList.remove('is-open'); group.classList.add('is-dismissed');
        group.querySelector('[data-signature-help]').setAttribute('aria-expanded', 'false'); event.preventDefault(); event.stopPropagation(); return;
      }
      if (event.key === 'Escape' && drag) { endDrag({ pointerId: drag.pointerId }, true); event.preventDefault(); return; }
      const entry = event.target.closest('[data-signature-id]');
      if (!entry || !canEdit() || saving || !available()) return;
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace','Escape'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); const changedSelection = editing !== entry.dataset.signatureId; editing = entry.dataset.signatureId;
      const row = current(); if (!row) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { removeCurrent(); return; }
      if (event.key === 'Escape') { editing = ''; renderDraft(); return; }
      const step = event.shiftKey ? 3 : 1;
      if (event.target.closest('[data-signature-resize]')) row.width += ['ArrowLeft','ArrowDown'].includes(event.key) ? -step : step;
      else { row.x += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0; row.y += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0; }
      clampPosition(row); markDirty(row); syncEditing(); paintPosition(row);
      if (changedSelection) { repaint(); document.querySelector(`[data-signature-id="${row.id}"]`)?.focus({ preventScroll: true }); }
    });
    window.addEventListener('focus', refresh);
    setInterval(() => { if (available() && !document.hidden && !editing) { refresh(); if (token) loadReviews(); } }, 30000);
    refresh(); syncRail();
  }
  window.MAKERSPACE_SIGNATURES = { init, noteHTML, toolbarHTML, handlesHTML, authenticateAdmin, completeBattleLogin, discardBattleLogin, hasAdminSession: canEdit, syncRail, saveLayout, openAdmin: showAdmin, isEditing: id => Boolean(canEdit() && editing === id), interacting: () => Boolean(canEdit() && available?.() || $('signature-upload-dialog')?.open || $('signature-admin-dialog')?.open) };
})();
