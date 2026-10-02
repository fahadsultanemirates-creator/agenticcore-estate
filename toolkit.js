// AgenticCore Estate — Free Listing Toolkit (toolkit.html?id=<listing id>)
// Everything here is generated in the browser from the listing's own fields
// (no cost per use). The only paid step — AI wording suggestions — goes
// through /api/copilot, which enforces the per-user daily allowance.

// Which tools a user may use for a listing. Kept in one place so credits or
// package rules can be added later without touching the page.
function acToolkitEligibility(listing, user) {
  const owner = Boolean(user && listing && (user.id === listing.owner_id || user.role === 'admin'));
  return {
    owner: owner,
    freeTools: owner,        // cards, QR, captions, quality report: always free for the owner
    aiWording: owner         // metered server-side (AI_DAILY_LIMIT per user per day)
  };
}


(async function () {
  const root = document.getElementById('toolkitRoot');
  if (!root) return;
  const user = await requireAuth(null);
  if (!user) return;
  const id = new URLSearchParams(window.location.search).get('id');
  const listing = id ? await AcDB.getListing(id) : null;
  const can = acToolkitEligibility(listing, user);
  if (!listing || !can.owner) {
    root.innerHTML = '<div class="panel">' + acEsc(acT('tk_not_yours')) + ' <a href="my.html#properties" style="color:var(--accent-gold-bright);">' + acEsc(acT('tk_my_listings')) + ' →</a></div>';
    return;
  }
  document.title = acT('tk_eyebrow') + ' — ' + listing.title;
  const url = AcShareCards.listingUrl(listing);
  // Branding: the agency or professional profile this listing is linked to.
  // listings.agency_id / professional_id can only point at the owner's own
  // profiles or an agency they are an active member of (0018 triggers).
  const safeImg = function (u) { u = String(u || ''); return /^https:\/\/[^\s"'<>]+$/i.test(u) || /^images\/samples\/[a-z0-9._/-]+$/.test(u) ? u : null; };
  const brandOptions = [];
  if (listing.agency) brandOptions.push({ name: listing.agency.name, logo: safeImg(listing.agency.logo_url) });
  if (listing.professional) brandOptions.push({ name: listing.professional.display_name, logo: safeImg(listing.professional.avatar_url) });
  let brand = brandOptions[0] || null;
  let caps = AcShareCards.captions(listing, { brand: brand });
  const canConfirm = Object.prototype.hasOwnProperty.call(listing, 'last_confirmed_at'); // column from migration 0014

  function confirmedText() {
    if (!listing.last_confirmed_at) return acT('tk_confirm_never');
    return acT('tk_confirm_last') + ' ' + new Date(listing.last_confirmed_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  root.innerHTML =
    '<div class="panel tk-head">' +
      '<div><p class="tk-kicker">' + acEsc(listing.type === 'rent' ? acT('search_rent') : acT('search_buy')) + ' · ' + acEsc(listing.area) + ', ' + acEsc(listing.city) + '</p>' +
      '<h2 class="tk-title">' + acEsc(listing.title) + '</h2>' +
      '<p class="listing-price">' + acFormatPKR(listing.price) + '</p></div>' +
      '<div class="tk-head-actions"><a class="btn btn-secondary btn-sm" href="listing.html?id=' + encodeURIComponent(listing.id) + '">' + acEsc(acT('tk_view')) + '</a>' +
      '<a class="btn btn-secondary btn-sm" href="sell.html?edit=' + encodeURIComponent(listing.id) + '">' + acEsc(acT('lq_edit')) + '</a></div>' +
    '</div>' +

    '<div class="tk-grid">' +
      '<div class="tk-main">' +
        '<section class="panel tk-sec" aria-labelledby="tkCards"><h3 id="tkCards">' + acEsc(acT('tk_cards_h')) + '</h3>' +
          '<p class="tk-note">' + acEsc(acT('tk_cards_sub')) + '</p>' +
          '<div class="tk-formats" role="tablist">' + Object.keys(AcShareCards.FORMATS).map(function (k, i) {
            return '<button type="button" role="tab" class="' + (i === 0 ? 'active' : '') + '" aria-selected="' + (i === 0) + '" data-format="' + k + '">' + acEsc(acT('tk_fmt_' + k)) + '</button>';
          }).join('') + '</div>' +
          (brandOptions.length ? '<p class="tk-brand"><label for="tkBrand">' + acEsc(acT('tk_brand_label')) + '</label> <select id="tkBrand">' +
            brandOptions.map(function (b, i) { return '<option value="' + i + '">' + acEsc(b.name) + '</option>'; }).join('') +
            '<option value="-1">' + acEsc(acT('tk_brand_none')) + '</option></select></p>' : '<p class="tk-note">' + acEsc(acT('tk_brand_link_hint')) + '</p>') +
          '<div class="tk-canvas"><canvas id="tkCanvas" role="img" aria-label="Share card preview"></canvas></div>' +
          '<div class="lq-actions"><button type="button" class="btn btn-primary btn-sm" id="tkDownload">' + acEsc(acT('tk_download')) + '</button>' +
          (navigator.share ? '<button type="button" class="btn btn-secondary btn-sm" id="tkShareImg">' + acEsc(acT('tk_share')) + '</button>' : '') + '</div>' +
          '<p class="tk-note" id="tkCardMsg" aria-live="polite"></p>' +
        '</section>' +

        '<section class="panel tk-sec" aria-labelledby="tkCaps"><h3 id="tkCaps">' + acEsc(acT('tk_caps_h')) + '</h3>' +
          '<label class="tk-label" for="tkCapEn">English</label><textarea id="tkCapEn" class="tk-cap" readonly rows="6"></textarea>' +
          '<div class="lq-actions"><button type="button" class="btn btn-secondary btn-sm" data-copy="tkCapEn">' + acEsc(acT('tk_copy')) + '</button>' +
          '<a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" id="tkWaEn" href="https://wa.me/?text=' + encodeURIComponent(caps.en) + '">WhatsApp</a></div>' +
          '<label class="tk-label" for="tkCapRu">Roman Urdu</label><textarea id="tkCapRu" class="tk-cap" readonly rows="6"></textarea>' +
          '<div class="lq-actions"><button type="button" class="btn btn-secondary btn-sm" data-copy="tkCapRu">' + acEsc(acT('tk_copy')) + '</button>' +
          '<a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" id="tkWaRu" href="https://wa.me/?text=' + encodeURIComponent(caps.roman) + '">WhatsApp</a></div>' +
          '<label class="tk-label" for="tkLink">' + acEsc(acT('tk_link')) + '</label><input id="tkLink" class="tk-cap" readonly value="' + acEsc(url) + '">' +
          '<div class="lq-actions"><button type="button" class="btn btn-secondary btn-sm" data-copy="tkLink">' + acEsc(acT('tk_copy')) + '</button></div>' +
        '</section>' +

        '<section class="panel tk-sec" aria-labelledby="tkSheet"><h3 id="tkSheet">' + acEsc(acT('tk_sheet_h')) + '</h3>' +
          '<p class="tk-note">' + acEsc(acT('tk_sheet_sub')) + '</p>' +
          '<a class="btn btn-secondary btn-sm" href="sheet.html?id=' + encodeURIComponent(listing.id) + '" target="_blank" rel="noopener" data-track="toolkit_export" data-action="sheet">' + acEsc(acT('tk_sheet_btn')) + '</a>' +
        '</section>' +

        '<section class="panel tk-sec" aria-labelledby="tkAi"><h3 id="tkAi">✦ ' + acEsc(acT('tk_ai_h')) + '</h3>' +
          '<p class="tk-note">' + acEsc(acT('tk_ai_sub')) + '</p>' +
          '<button type="button" class="btn btn-primary btn-sm" id="tkAiBtn">' + acEsc(acT('tk_ai_btn')) + '</button>' +
          '<div class="assist-out" id="tkAiOut" aria-live="polite"></div>' +
        '</section>' +
      '</div>' +

      '<aside class="tk-side">' +
        acListingQualityWidget(listing, { maxTips: 5 }) +
        (canConfirm ? '<section class="panel tk-sec"><h3>' + acEsc(acT('tk_confirm_h')) + '</h3><p class="tk-note">' + acEsc(acT('tk_confirm_sub')) + '</p>' +
          '<p id="tkConfirmed" class="tk-note">' + acEsc(confirmedText()) + '</p>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="tkConfirm">' + acEsc(acT('tk_confirm_btn')) + '</button></section>' : '') +
        '<section class="panel tk-sec"><h3>' + acEsc(acT('tk_photos_h')) + '</h3><ol class="lq-tips">' +
          ['tk_ph1', 'tk_ph2', 'tk_ph3', 'tk_ph4', 'tk_ph5', 'tk_ph6'].map(function (k) { return '<li>' + acEsc(acT(k)) + '</li>'; }).join('') + '</ol></section>' +
        '<section class="panel tk-sec tk-pk"><h3>' + acEsc(acT('tk_pk_h')) + '</h3><p class="tk-note">' + acEsc(acT('tk_pk_sub')) + '</p>' +
          '<ul class="tk-pk-list">' + ['tk_pk1', 'tk_pk2', 'tk_pk3', 'tk_pk4'].map(function (k) { return '<li>' + acEsc(acT(k)) + '</li>'; }).join('') + '</ul>' +
          '<a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" href="' + acPkUrl('promote', 'property', listing.id, '') + '" data-track="promote_property_click" data-intent="promote" data-entity="property">' + acEsc(acT('tk_pk_btn')) + ' ↗</a></section>' +
      '</aside>' +
    '</div>';

  function setCaptions() {
    caps = AcShareCards.captions(listing, { brand: brand });
    document.getElementById('tkCapEn').value = caps.en;
    document.getElementById('tkCapRu').value = caps.roman;
    document.getElementById('tkWaEn').href = 'https://wa.me/?text=' + encodeURIComponent(caps.en);
    document.getElementById('tkWaRu').href = 'https://wa.me/?text=' + encodeURIComponent(caps.roman);
  }
  setCaptions();
  ['tkWaEn', 'tkWaRu'].forEach(function (idx) {
    document.getElementById(idx).addEventListener('click', function () { acTrack('toolkit_export', { format: idx === 'tkWaEn' ? 'caption_en' : 'caption_roman', channel: 'whatsapp' }); });
  });
  const brandSel = document.getElementById('tkBrand');
  if (brandSel) brandSel.addEventListener('change', function () {
    brand = brandSel.value === '-1' ? null : brandOptions[Number(brandSel.value)];
    setCaptions();
    drawCard();
  });

  // ---- share cards ----
  const canvas = document.getElementById('tkCanvas');
  const msg = document.getElementById('tkCardMsg');
  let format = 'whatsapp';
  async function drawCard() {
    msg.textContent = '';
    await AcShareCards.draw(canvas, listing, format, { brand: brand });
  }
  root.querySelectorAll('[data-format]').forEach(function (b) {
    b.addEventListener('click', function () {
      format = b.getAttribute('data-format');
      root.querySelectorAll('[data-format]').forEach(function (x) { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      drawCard();
    });
  });
  function cardBlob() {
    return new Promise(function (ok) {
      try { canvas.toBlob(function (b) { ok(b); }, 'image/png'); } catch (e) { ok(null); }
    });
  }
  const fileName = function () { return 'agenticcore-' + format + '-' + String(listing.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.png'; };
  document.getElementById('tkDownload').addEventListener('click', async function () {
    const blob = await cardBlob();
    if (!blob) { msg.textContent = acT('tk_download_fail'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    acTrack('toolkit_export', { format: format, channel: 'download' });
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  const shareBtn = document.getElementById('tkShareImg');
  if (shareBtn) shareBtn.addEventListener('click', async function () {
    const blob = await cardBlob();
    const file = blob ? new File([blob], fileName(), { type: 'image/png' }) : null;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: caps.en });
      else await navigator.share({ title: listing.title, text: caps.en, url: url });
      acTrack('toolkit_export', { format: format, channel: 'native' });
    } catch (e) { /* user cancelled */ }
  });
  drawCard();

  // ---- copy buttons ----
  root.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', async function () {
      const el = document.getElementById(b.getAttribute('data-copy'));
      try { await navigator.clipboard.writeText(el.value); } catch (e) { el.select(); document.execCommand('copy'); }
      const t = b.textContent; b.textContent = acT('tk_copied'); setTimeout(function () { b.textContent = t; }, 1500);
    });
  });

  // ---- confirm still available (migration 0014) ----
  const confirmBtn = document.getElementById('tkConfirm');
  if (confirmBtn) confirmBtn.addEventListener('click', async function () {
    confirmBtn.disabled = true;
    const { data, error } = await supabaseClient.rpc('confirm_listing_available', { p_listing: listing.id });
    confirmBtn.disabled = false;
    if (error) { document.getElementById('tkConfirmed').textContent = acT('tk_confirm_fail'); return; }
    listing.last_confirmed_at = data;
    document.getElementById('tkConfirmed').textContent = confirmedText();
  });

  // ---- AI wording suggestions (metered) ----
  const aiOut = document.getElementById('tkAiOut');
  document.getElementById('tkAiBtn').addEventListener('click', async function () {
    const btn = this;
    btn.disabled = true;
    aiOut.innerHTML = '<p role="status">' + acEsc(acT('sell_assist_working')) + '</p>';
    const res = await AcCopilot.call({ action: 'improve', listing_id: listing.id, with_ai: true }, true);
    btn.disabled = false;
    if (res.error) { aiOut.innerHTML = '<p>' + acEsc(res.error) + '</p>'; return; }
    const w = res.wording;
    if (!w) { aiOut.innerHTML = '<p>' + acEsc(acT('tk_ai_off')) + '</p>'; return; }
    aiOut.innerHTML =
      '<div><h5>' + acEsc(acT('tk_ai_title')) + '</h5><div class="assist-draft" id="tkAiTitle"></div></div>' +
      '<div><h5>' + acEsc(acT('tk_ai_desc')) + '</h5><div class="assist-draft" id="tkAiDesc"></div></div>' +
      ((w.notes || []).length ? '<div><h5>' + acEsc(acT('tk_ai_notes')) + '</h5><ul>' + w.notes.map(function (n) { return '<li>' + acEsc(n) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<p class="tk-note">' + acEsc(acT('tk_ai_review')) + '</p>' +
      '<div class="lq-actions"><a class="btn btn-secondary btn-sm" href="sell.html?edit=' + encodeURIComponent(listing.id) + '">' + acEsc(acT('lq_edit')) + '</a></div>';
    document.getElementById('tkAiTitle').textContent = w.title;
    document.getElementById('tkAiDesc').textContent = w.description;
  });
})();
