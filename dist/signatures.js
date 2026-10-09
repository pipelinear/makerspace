(() => {
  'use strict';
  const settings = window.MAKERSPACE.signatureSettings;
  const signatures = window.MAKERSPACE.clubSignatures;
  const base = settings.apiUrl.replace(/\/$/, '');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const emailURL = name => `mailto:${settings.email}?subject=${encodeURIComponent('Makerspace signature' + (name ? ` — ${name}` : ''))}&body=${encodeURIComponent('Name: ' + (name || '') + '\n\nPlease add my signature to the club book. I have attached my transparent PNG.')}`;
  let repaint, available, token = '', pendingBattleToken = '', battleLoginGeneration = 0, adminRows = [], editing = '', saving = false, drag = null;
  let prepared = null, previewURL = '', submissionId = '', generation = 0;
  const adminURLs = new Set();
  const $ = id => document.getElementById(id);
  const current = () => signatures.find(s => s.id === editing);
  const message = (id, text) => { $(id).textContent = text; };
  async function api(path, { auth = false, body, method = 'GET', binary = false } = {}) {
    if (!base) throw new Error('Shared uploads are not connected yet. Use the email option below.');
    const headers = {};
    if (auth) headers.Authorization = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const response = await fetch(base + path, { method, body, headers, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (auth && response.status === 401) { token = ''; editing = ''; syncEditing(); }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || 'Could not connect. Please try again.');
      error.status = response.status;
      throw error;
    }
    return binary ? response.blob() : response.json();
  }
  function applyRows(rows) {
    signatures.splice(0, signatures.length, ...rows.filter(s => s.status === 'approved').map(s => ({ ...s, image: base + s.image })));
    if (!current()) editing = '';
    syncEditing();
    if (available()) repaint();
  }
  async function refresh() {
    if (!base || saving || drag) return;
    try { applyRows((await api('/signatures')).signatures); }
    catch { /* Keep the last successfully loaded spread through a connection interruption. */ }
  }
  function syncEditing() { document.body.classList.toggle('signature-editing', Boolean(editing && token)); }
  function noteHTML() {
    return `<aside class="signature-note"><h2>Want to sign it?</h2><p><a href="${escape(settings.creatorUrl)}" target="_blank" rel="noopener noreferrer">Make your signature ↗</a>. Click <em>Add new text</em>, type your name, then export a <em>Transparent PNG</em>.</p><p>${base ? 'Come back and upload it below. An admin will review it before it appears in the book.' : `Email your image and name to <a href="${escape(emailURL(''))}">${escape(settings.email)}</a> to have it added.`}</p><div class="signature-note-actions"><button type="button" data-signature-upload aria-label="${base ? 'Upload your signature' : 'Prepare your signature for email'}"><span aria-hidden="true">↥</span> ${base ? 'Upload' : 'Prepare image'}</button></div></aside>`;
  }
  function toolbarHTML() {
    const row = current();
    if (!row || !token) return '';
    const max = Math.min(70, (row.page === 'left' ? 56 : 70) / (.827 * row.imageHeight / row.imageWidth));
    return `<div class="signature-editor" role="group" aria-label="Arrange ${escape(row.name)}"><span>${escape(row.name)} · drag to move</span><label>Size <input data-signature-size type="range" min="5" max="${max}" step=".5" value="${row.width}"></label><label>Page <select data-signature-page><option value="left"${row.page === 'left' ? ' selected' : ''}>Left</option><option value="right"${row.page === 'right' ? ' selected' : ''}>Right</option></select></label><button data-signature-fit>Auto fit</button><button data-signature-done>Done</button><p id="signature-save-status" role="status">${saving ? 'Saving…' : 'Changes save to the book.'}</p></div>`;
  }
  async function preparePNG(file) {
    if (!file || file.type !== 'image/png') throw new Error('Choose a PNG exported with a transparent background.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Choose a PNG under 8 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 16000000) throw new Error('Export a smaller image (up to 16 million pixels).');
      const scale = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height, Math.sqrt(1000000 / (bitmap.width * bitmap.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(bitmap.width * scale)); canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1, transparent = false;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const alpha = pixels[(y * canvas.width + x) * 4 + 3];
        if (alpha < 8) transparent = true;
        if (alpha >= 8) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
      if (!transparent) throw new Error('This PNG has a solid background. Export as Transparent PNG.');
      if (maxX < 0) throw new Error('This PNG is blank. Add your name before exporting.');
      minX = Math.max(0, minX - 8); minY = Math.max(0, minY - 8);
      maxX = Math.min(canvas.width - 1, maxX + 8); maxY = Math.min(canvas.height - 1, maxY + 8);
      const cropped = document.createElement('canvas'); cropped.width = maxX - minX + 1; cropped.height = maxY - minY + 1;
      cropped.getContext('2d').drawImage(canvas, minX, minY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      const blob = await new Promise(resolve => cropped.toBlob(resolve, 'image/png'));
      if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('This image is too detailed. Export a smaller signature.');
      return blob;
    } finally { bitmap.close(); }
  }
  function clearPreview() {
    generation++; prepared = null; submissionId = '';
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = ''; $('signature-preview').removeAttribute('src'); $('signature-preview-wrap').hidden = true;
    $('signature-download')?.removeAttribute('href'); $('signature-send').disabled = true;
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
      if ($('signature-download')) $('signature-download').href = previewURL;
      $('signature-send').disabled = false;
      message('signature-upload-status', base ? 'Ready for review.' : 'Download this PNG, then attach it to your email with your name.');
    } catch (error) { if (version === generation) message('signature-upload-status', error.message); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!prepared || !base) return;
    const form = new FormData(); form.set('name', $('signature-name').value.trim()); form.set('image', prepared, 'signature.png'); form.set('submissionId', submissionId);
    $('signature-send').disabled = true; $('signature-file').disabled = true;
    message('signature-upload-status', 'Sending for approval…');
    try {
      await api('/submissions', { method: 'POST', body: form });
      $('signature-upload-form').reset(); clearPreview();
      message('signature-upload-status', 'Sent! Your signature will appear after an admin approves it.');
    } catch (error) { message('signature-upload-status', error.message); $('signature-send').disabled = false; }
    finally { $('signature-file').disabled = false; }
  }
  function releaseAdminImages() { adminURLs.forEach(url => URL.revokeObjectURL(url)); adminURLs.clear(); }
  let adminGeneration = 0;
  async function showAdmin() {
    if (!base) return;
    if (!$('signature-admin-dialog').open) $('signature-admin-dialog').showModal();
    $('signature-session-ended').hidden = Boolean(token); $('signature-admin-panel').hidden = !token;
    if (!token) return;
    const version = ++adminGeneration;
    message('signature-admin-status', 'Loading signatures…');
    try {
      const data = await api('/admin/signatures', { auth: true });
      if (version !== adminGeneration || !$('signature-admin-dialog').open) return;
      adminRows = data.signatures; applyRows(adminRows); releaseAdminImages();
      $('signature-admin-list').innerHTML = ['pending', 'approved'].map(status => `<section><h3>${status === 'pending' ? 'Waiting for approval' : 'In the book'}</h3>${adminRows.filter(s => s.status === status).map(s => `<article class="signature-review" data-review="${s.id}"><div class="signature-review-image"><img alt="${escape(s.name)}’s signature"></div><p>${escape(s.name)}</p><div>${status === 'pending' ? `<button data-review-action="approve" data-id="${s.id}">Approve</button><button data-review-action="remove" data-id="${s.id}">Reject</button>` : `<button data-review-action="arrange" data-id="${s.id}">Arrange in book</button><button data-review-action="remove" data-id="${s.id}">Remove</button>`}</div></article>`).join('') || '<p class="signature-empty">No signatures here yet.</p>'}</section>`).join('');
      message('signature-admin-status', '');
      await Promise.allSettled(adminRows.map(async row => {
        const blob = await api(`/admin/images/${row.id}`, { auth: true, binary: true });
        if (version !== adminGeneration || !$('signature-admin-dialog').open) return;
        const url = URL.createObjectURL(blob); adminURLs.add(url);
        const image = $('signature-admin-list').querySelector(`[data-review="${row.id}"] img`);
        if (image) image.src = url;
      }));
    } catch (error) { message('signature-admin-status', error.message); $('signature-session-ended').hidden = Boolean(token); $('signature-admin-panel').hidden = !token; }
  }
  function revokeBattleToken(abandoned) {
    if (abandoned && base) fetch(base + '/admin/logout', { method: 'POST', headers: { Authorization: `Bearer ${abandoned}` }, keepalive: true }).catch(() => {});
  }
  async function authenticateAdmin(password) {
    if (!base) return { granted: password === 'nick', mode: 'preview' };
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
  function completeBattleLogin() { token = pendingBattleToken; pendingBattleToken = ''; }
  function discardBattleLogin() {
    battleLoginGeneration++;
    const abandoned = pendingBattleToken; pendingBattleToken = '';
    revokeBattleToken(abandoned);
  }
  async function reviewAction(button) {
    const row = adminRows.find(s => s.id === button.dataset.id); if (!row || saving) return;
    const action = button.dataset.reviewAction;
    if (action === 'arrange') { editing = row.id; syncEditing(); $('signature-admin-dialog').close(); repaint(); document.querySelector(`[data-signature-id="${editing}"]`)?.focus({ preventScroll: true }); return; }
    if (action === 'remove' && !window.confirm(`${row.status === 'pending' ? 'Reject' : 'Remove'} ${row.name}’s signature?`)) return;
    saving = true; button.disabled = true;
    try {
      await api(`/admin/signatures/${row.id}${action === 'approve' ? '/approve' : ''}`, { auth: true, method: action === 'approve' ? 'POST' : 'DELETE', body: action === 'approve' ? { revision: row.revision } : undefined });
      await showAdmin();
    } catch (error) { message('signature-admin-status', error.message); }
    finally { saving = false; button.disabled = false; }
  }
  function clampPosition(row) {
    row.width = Math.max(5, Math.min(row.width, 70, (row.page === 'left' ? 56 : 70) / (.827 * row.imageHeight / row.imageWidth)));
    row.height = row.width * row.imageHeight / row.imageWidth * .827;
    row.x = Math.max(4, Math.min(row.x, 96 - row.width));
    row.y = Math.max(row.page === 'left' ? 38 : 4, Math.min(row.y, 94 - row.height));
  }
  function paintPosition(row) {
    const entry = document.querySelector(`[data-signature-id="${row.id}"]`);
    if (entry) { entry.style.left = `${row.x}%`; entry.style.top = `${row.y}%`; entry.style.width = `${row.width}%`; }
  }
  async function savePlacement(auto = false) {
    const row = current(); if (!row || saving) return;
    saving = true; if ($('signature-save-status')) message('signature-save-status', 'Saving…');
    try {
      const result = await api(`/admin/signatures/${row.id}${auto ? '/place' : ''}`, { auth: true, method: auto ? 'POST' : 'PATCH', body: auto ? { revision: row.revision } : { page: row.page, x: row.x, y: row.y, width: row.width, revision: row.revision } });
      Object.assign(row, result.signature, { image: base + result.signature.image });
      repaint();
    } catch (error) {
      const reason = error.message;
      saving = false; await refresh();
      if ($('signature-save-status')) message('signature-save-status', reason);
      else { message('signature-admin-status', reason); await showAdmin(); }
    } finally { saving = false; if ($('signature-save-status')?.textContent === 'Saving…') message('signature-save-status', 'Saved.'); }
  }
  function onPointerDown(event) {
    const entry = event.target.closest('[data-signature-id]');
    if (!editing || !entry || saving || event.button !== 0 || !available()) return;
    if (entry.dataset.signatureId !== editing) { editing = entry.dataset.signatureId; repaint(); return; }
    const row = current(), rect = entry.closest('.signature-paper').getBoundingClientRect();
    drag = { entry, row, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: row.x, y: row.y, rect };
    entry.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
  }
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const active = drag; drag = null;
    if (active.entry.hasPointerCapture(event.pointerId)) active.entry.releasePointerCapture(event.pointerId);
    savePlacement();
  }
  function init(options) {
    repaint = options.repaint; available = options.available;
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="signature-upload-dialog" class="signature-dialog" aria-labelledby="signature-upload-title"><button class="signature-dialog-close" data-signature-close aria-label="Close">×</button><h2 id="signature-upload-title">Leave your mark.</h2><p>Make your name in <a href="${escape(settings.creatorUrl)}" target="_blank" rel="noopener noreferrer">TextStudio ↗</a>, then export a Transparent PNG.</p><form id="signature-upload-form"><label>Your name<input id="signature-name" name="name" maxlength="80" required autocomplete="name"></label><label>Signature image<input id="signature-file" name="image" type="file" accept="image/png,.png" required></label><div id="signature-preview-wrap" class="signature-preview" hidden><img id="signature-preview" alt="Your prepared signature"></div><p id="signature-upload-status" role="status"></p>${base ? '<button id="signature-send" type="submit" disabled>Send for approval ↗</button><p class="signature-small">Your name and signature will be public if approved.</p>' : `<p>Attach your transparent PNG and name to an email to <a id="signature-email" href="${escape(emailURL(''))}">${escape(settings.email)}</a>.</p><a id="signature-download" class="signature-download" download="makerspace-signature.png">Download prepared PNG ↓</a><button id="signature-send" type="submit" disabled hidden></button>`}</form></dialog>
      <dialog id="signature-admin-dialog" class="signature-dialog signature-admin-dialog" aria-labelledby="signature-admin-title"><button class="signature-dialog-close" data-signature-close aria-label="Close">×</button><h2 id="signature-admin-title">The signing desk.</h2><p id="signature-session-ended" hidden>Your session ended. Close the desk and open the capture ball above Vol. 02 to sign in again.</p><div id="signature-admin-panel" hidden><div class="signature-admin-tools"><button id="signature-admin-refresh">Refresh</button><button id="signature-logout">Sign out</button></div><div id="signature-admin-list"></div></div><p id="signature-admin-status" role="status"></p></dialog>`);
    $('signature-file').addEventListener('change', fileChanged);
    $('signature-name').addEventListener('input', () => { if ($('signature-email')) $('signature-email').href = emailURL($('signature-name').value.trim()); });
    $('signature-upload-form').addEventListener('submit', submit);
    $('signature-admin-refresh').addEventListener('click', showAdmin);
    $('signature-logout').addEventListener('click', async () => {
      try { await api('/admin/logout', { auth: true, method: 'POST' }); token = ''; editing = ''; syncEditing(); repaint(); await showAdmin(); }
      catch (error) { message('signature-admin-status', error.message); }
    });
    $('signature-upload-dialog').addEventListener('close', clearPreview);
    $('signature-admin-dialog').addEventListener('close', () => { adminGeneration++; releaseAdminImages(); });
    document.addEventListener('click', event => {
      const target = event.target;
      if (target.closest('[data-signature-close]')) target.closest('dialog').close();
      if (target.closest('[data-signature-upload]')) { clearPreview(); $('signature-upload-form').reset(); message('signature-upload-status', ''); $('signature-upload-dialog').showModal(); }
      const review = target.closest('[data-review-action]'); if (review) reviewAction(review);
      if (target.closest('[data-signature-fit]')) savePlacement(true);
      if (target.closest('[data-signature-done]') && !saving) { editing = ''; syncEditing(); repaint(); showAdmin(); }
    });
    document.addEventListener('input', event => {
      if (!event.target.matches('[data-signature-size]') || saving) return;
      const row = current(); if (!row) return;
      row.width = Number(event.target.value); clampPosition(row); paintPosition(row);
    });
    document.addEventListener('change', event => {
      const row = current(); if (!row || saving) return;
      if (event.target.matches('[data-signature-size]')) savePlacement();
      if (event.target.matches('[data-signature-page]')) { row.page = event.target.value; clampPosition(row); repaint(); savePlacement(); }
    });
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.row.x = drag.x + (event.clientX - drag.startX) / drag.rect.width * 100;
      drag.row.y = drag.y + (event.clientY - drag.startY) / drag.rect.height * 100;
      clampPosition(drag.row); paintPosition(drag.row);
    });
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
    document.addEventListener('keydown', event => {
      if (!editing || saving || !event.target.closest('[data-signature-id]') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const row = current(); if (!row) return;
      const step = event.shiftKey ? 3 : 1;
      row.x += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      row.y += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      clampPosition(row); paintPosition(row); savePlacement();
    });
    window.addEventListener('focus', refresh);
    setInterval(() => { if (available() && !document.hidden && !editing) refresh(); }, 30000);
    refresh();
  }
  window.MAKERSPACE_SIGNATURES = { init, noteHTML, toolbarHTML, authenticateAdmin, completeBattleLogin, discardBattleLogin, hasAdminSession: () => Boolean(token), openAdmin: showAdmin, isEditing: id => Boolean(token && editing === id), interacting: () => Boolean(editing && available?.() || $('signature-upload-dialog')?.open || $('signature-admin-dialog')?.open) };
})();
