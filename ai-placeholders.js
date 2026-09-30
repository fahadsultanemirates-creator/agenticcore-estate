/* ============================================
   AgenticCore Estate — AI assistance widgets
   ------------------------------------------------
     1. Property Copilot panel (floating button) — live.
        Find:    real search via /api/copilot (copilot.js)
        List:    sell.html?assist=1 (drafts a listing for review)
        Improve: your listings' quality scores (dashboard)
     2. Listing Quality widget — live, deterministic
        (listing-quality.js); no AI decides the number.
     3. Growth Score / Document assistance — planned,
        clearly labelled "Coming soon". Document assistance
        will never be presented as legal verification.
   The file name is kept so every page's script tag keeps working.
   ============================================ */

function acLoadOnce(tag, attr, url) {
  if (document.querySelector(tag + '[' + attr + '="' + url + '"]')) return Promise.resolve();
  return new Promise(function (ok) {
    const el = document.createElement(tag);
    if (tag === 'link') { el.rel = 'stylesheet'; el.href = url; ok(); }
    else { el.src = url; el.onload = ok; el.onerror = ok; }
    document.head.appendChild(el);
  });
}

function acMountPropertyAdvisor() {
  if (document.getElementById('acAdvisorFab')) return;
  acLoadOnce('link', 'href', 'product2.css');
  const ready = typeof AcCopilot !== 'undefined' ? Promise.resolve() : acLoadOnce('script', 'src', 'copilot.js');

  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<button class="ai-chat-fab" id="acAdvisorFab" type="button" aria-controls="acAdvisorPanel" aria-expanded="false" aria-label="AgenticCore Property Copilot">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>' +
    '</button>' +
    '<div class="cpp-panel" id="acAdvisorPanel" role="dialog" aria-modal="false" aria-labelledby="cppTitle">' +
      '<div class="cpp-top"><h4 id="cppTitle">✦ <span data-i18n="cpp_title"></span></h4>' +
        '<button type="button" class="cpp-close" id="cppClose" aria-label="Close">×</button></div>' +
      '<div class="cpp-tabs" role="tablist">' +
        '<button type="button" role="tab" aria-selected="true" class="active" data-cpp="find" data-i18n="cpp_find"></button>' +
        '<button type="button" role="tab" aria-selected="false" data-cpp="list" data-i18n="cpp_list"></button>' +
        '<button type="button" role="tab" aria-selected="false" data-cpp="improve" data-i18n="cpp_improve"></button>' +
      '</div>' +
      '<div data-cpp-pane="find">' +
        '<p data-i18n="cpp_find_sub"></p>' +
        '<form id="cppFindForm"><label class="sr-only" for="cppFindInput" data-i18n="cpp_find"></label>' +
          '<textarea id="cppFindInput" maxlength="600" data-i18n-ph="h2_ask_ph"></textarea>' +
          '<button type="submit" class="btn btn-primary btn-sm btn-block" style="margin-top:0.5rem;" data-i18n="h2_ask_btn"></button></form>' +
        '<div id="cppFindOut" aria-live="polite"></div>' +
      '</div>' +
      '<div data-cpp-pane="list" hidden>' +
        '<p data-i18n="cpp_list_sub"></p>' +
        '<a class="btn btn-primary btn-sm btn-block" href="sell.html?assist=1" data-i18n="cpp_list_go"></a>' +
        '<a class="btn btn-secondary btn-sm btn-block" style="margin-top:0.5rem;" href="sell.html" data-i18n="cpp_list_form"></a>' +
      '</div>' +
      '<div data-cpp-pane="improve" hidden>' +
        '<p data-i18n="cpp_improve_sub"></p>' +
        '<a class="btn btn-primary btn-sm btn-block" href="dashboard.html" id="cppImproveLink" data-i18n="cpp_improve_go"></a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);

  const fab = document.getElementById('acAdvisorFab');
  document.body.classList.add('has-cpp');
  document.addEventListener('focusin', function (e) {
    const t = e.target;
    const typing = t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && !t.closest('#acAdvisorPanel');
    document.body.classList.toggle('cpp-typing', Boolean(typing));
  });
  document.addEventListener('focusout', function () { document.body.classList.remove('cpp-typing'); });
  const panel = document.getElementById('acAdvisorPanel');
  function setOpen(open) {
    panel.classList.toggle('open', open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeout(function () { const t = panel.querySelector('[data-cpp-pane]:not([hidden]) textarea, [data-cpp-pane]:not([hidden]) a'); if (t) t.focus(); }, 50);
    else fab.focus();
  }
  fab.addEventListener('click', function () { setOpen(!panel.classList.contains('open')); });
  document.getElementById('cppClose').addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false); });
  panel.querySelectorAll('[data-cpp]').forEach(function (b) {
    b.addEventListener('click', function () {
      const k = b.getAttribute('data-cpp');
      panel.querySelectorAll('[data-cpp]').forEach(function (x) { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      panel.querySelectorAll('[data-cpp-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-cpp-pane') !== k; });
    });
  });

  // Agencies and developers manage listings from their own dashboards.
  if (typeof AcDB !== 'undefined' && AcDB.currentUser) {
    AcDB.currentUser().then(function (u) {
      const link = document.getElementById('cppImproveLink');
      if (u && u.role === 'agency') link.href = 'agency-dashboard.html';
      else if (u && u.role === 'developer') link.href = 'developer-dashboard.html';
    }).catch(function () {});
  }

  ready.then(function () {
    const form = document.getElementById('cppFindForm');
    const input = document.getElementById('cppFindInput');
    if (typeof AcCopilot === 'undefined') {
      // Service script unavailable: fall back to the normal search.
      form.addEventListener('submit', function (e) { e.preventDefault(); window.location.href = 'buy.html?q=' + encodeURIComponent(input.value.trim()); });
      return;
    }
    AcCopilot.bindFind(form, input, document.getElementById('cppFindOut'));
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  });

  if (typeof acInitLanguage === 'function') acInitLanguage();
}

// ---------- Listing Quality (deterministic) ----------
function acQualityClass(s) { return s >= 80 ? 'strong' : s < 50 ? 'weak' : ''; }

function acQualityT(key, fallback) { return typeof acT === 'function' ? acT(key) : fallback; }

function acListingQualityWidget(listing, opts) {
  opts = opts || {};
  if (typeof AcListingQuality === 'undefined') return '';
  const q = AcListingQuality.score(listing, opts);
  const factors = q.factors.map(function (f) {
    return '<li><span>' + acEsc(f.label) + '</span><span class="lq-bar" aria-hidden="true"><i style="width:' + Math.round(100 * f.points / f.max) + '%"></i></span><b>' + f.points + '/' + f.max + '</b></li>';
  }).join('');
  const tips = q.tips.slice(0, opts.maxTips || 4).map(function (t) { return '<li>' + acEsc(t) + '</li>'; }).join('');
  const band = acQualityT(q.score >= 80 ? 'lq_band_strong' : q.score >= 50 ? 'lq_band_good' : 'lq_band_weak', q.band);
  return '<div class="lq"' + (opts.id ? ' id="' + opts.id + '"' : '') + '>' +
    '<div class="lq-head"><div class="lq-ring ' + acQualityClass(q.score) + '" style="--p:' + q.score + '" role="img" aria-label="' + q.score + ' / 100"><span>' + q.score + '</span></div>' +
      '<div><h4>' + acEsc(acQualityT('lq_title', 'Listing quality')) + '</h4><div class="lq-band">' + acEsc(band) + ' · ' + q.score + '/100</div></div></div>' +
    (opts.compact ? '' : '<ul class="lq-factors">' + factors + '</ul>') +
    (tips ? '<p style="font-size:0.85rem;font-weight:600;margin-top:0.4rem;">' + acEsc(acQualityT('lq_next', 'Improve it next')) + '</p><ol class="lq-tips">' + tips + '</ol>'
          : '<p class="lq-band">' + acEsc(acQualityT('lq_all_done', 'Nothing important is missing.')) + '</p>') +
    (opts.actions || '') +
    '<p class="lq-note">' + acEsc(acQualityT('lq_note', 'A complete listing helps buyers decide; it does not guarantee enquiries or a sale.')) + '</p>' +
  '</div>';
}

function acQualityPillHTML(listing) {
  if (typeof AcListingQuality === 'undefined') return '—';
  const s = AcListingQuality.score(listing).score;
  return '<a class="lq-pill ' + acQualityClass(s) + '" href="listing.html?id=' + encodeURIComponent(listing.id) + '#quality" title="' + acEsc(acQualityT('lq_title', 'Listing quality')) + '">' + s + '</a>';
}

// ---------- Planned (not live) ----------
function acGrowthScoreWidget(score) {
  score = (typeof score === 'number') ? score : null;
  return (
    '<div class="ai-widget">' +
      '<span class="badge badge-gold" data-i18n="coming_soon"></span>' +
      '<h4>◆ <span data-i18n="ai_growth_title"></span></h4>' +
      '<p data-i18n="ai_growth_desc"></p>' +
      '<div class="ai-gauge">' + (score !== null ? score + '/100' : '—') + '</div>' +
    '</div>'
  );
}

function acDocCheckWidget() {
  return (
    '<div class="ai-widget">' +
      '<span class="badge badge-gold" data-i18n="coming_soon"></span>' +
      '<h4>◆ <span data-i18n="ai_doccheck_title"></span></h4>' +
      '<p data-i18n="ai_doccheck_desc"></p>' +
    '</div>'
  );
}
