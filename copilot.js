/* ============================================
   AgenticCore Estate — Property Copilot (browser client)
   Talks only to AgenticCore's own endpoint (/api/copilot); no AI keys
   ever reach the browser. Every listing shown comes from the database,
   with reasons computed from the listing itself. If the service is down,
   the normal search is offered instead — nothing depends on AI.
   ============================================ */

const AcCopilot = (function () {
  const ENDPOINT = '/api/copilot';

  async function call(body, needsAuth) {
    const headers = { 'Content-Type': 'application/json' };
    if (needsAuth && typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      if (data && data.session) headers.Authorization = 'Bearer ' + data.session.access_token;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 25000);
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) return { error: data.error || 'AgenticCore could not complete that right now.', status: res.status };
      return data;
    } catch (e) {
      return { error: 'AgenticCore is not reachable right now.', offline: true };
    } finally { clearTimeout(timer); }
  }

  // Map understood criteria to the conventional buy/rent page filters.
  function normalSearchUrl(c, text) {
    const p = new URLSearchParams();
    if (c && c.city) p.set('city', c.city);
    if (c && c.price_max) p.set('maxPrice', c.price_max);
    if (c && c.property_types && c.property_types.length === 1) p.set('propertyType', c.property_types[0]);
    const loc = c && c.locations && c.locations[0];
    if (loc) p.set('q', loc.label);
    else if (!c && text) p.set('q', text);
    return ((c && c.purpose === 'rent') ? 'rent.html' : 'buy.html') + (p.toString() ? '?' + p.toString() : '');
  }

  function cardHTML(m, kind) {
    const thumb = m.photo ? '<img src="' + acSafeUrl(m.photo) + '" alt="" loading="lazy">' : AC_HOUSE_ICON;
    const reasons = (m.reasons || []).map(function (r) { return '<li class="ok">' + acEsc(r) + '</li>'; }).join('');
    const diffs = (m.differences || []).map(function (r) { return '<li class="diff">' + acEsc(r) + '</li>'; }).join('');
    return '<a class="cp-card" href="' + acEsc(m.url) + '">' +
      '<div class="cp-thumb">' + thumb + (m.verified ? '<span class="listing-badge verified">✓</span>' : '') + '</div>' +
      '<div class="cp-body">' +
        '<div class="listing-price">' + acEsc(m.price_text) + '</div>' +
        '<div class="listing-title">' + acEsc(m.title) + '</div>' +
        '<div class="listing-location">' + acEsc(m.property_type) + ' · ' + acEsc(m.area) + ', ' + acEsc(m.city) + (m.size_text ? ' · ' + acEsc(m.size_text) : '') + '</div>' +
        '<ul class="cp-why" aria-label="' + (kind === 'closest' ? 'How it compares' : 'Why it matches') + '">' + reasons + diffs + '</ul>' +
      '</div></a>';
  }

  function renderFind(el, data, text) {
    if (data.error) {
      el.innerHTML = '<div class="cp-result"><p class="cp-msg">' + acEsc(data.error) + '</p>' +
        '<a class="btn btn-secondary btn-sm" href="' + acEsc(normalSearchUrl(null, text)) + '">' + acEsc(acT('cp_use_normal')) + '</a></div>';
      return;
    }
    let html = '<div class="cp-result">';
    if (data.understood) html += '<p class="cp-understood"><span>' + acEsc(acT('cp_understood')) + '</span> ' + acEsc(data.understood) + '</p>';
    html += '<p class="cp-msg">' + acEsc(data.message || '') + '</p>';
    if (data.follow_up) html += '<p class="cp-follow">💬 ' + acEsc(data.follow_up) + '</p>';
    if (data.matches && data.matches.length) html += '<div class="cp-grid">' + data.matches.map(function (m) { return cardHTML(m, 'match'); }).join('') + '</div>';
    else if (data.closest && data.closest.length) html += '<div class="cp-grid">' + data.closest.map(function (m) { return cardHTML(m, 'closest'); }).join('') + '</div>';
    html += '<div class="cp-actions"><a class="btn btn-secondary btn-sm" href="' + acEsc(normalSearchUrl(data.criteria, text)) + '">' + acEsc(acT('cp_open_normal')) + '</a>' +
      '<span class="cp-note">' + acEsc(acT('cp_real_only')) + '</span></div></div>';
    el.innerHTML = html;
  }

  // Wire a search box (input/textarea + form) to render results into `out`.
  function bindFind(form, input, out) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      out.innerHTML = '<div class="cp-result cp-loading" role="status">' + acEsc(acT('cp_searching')) + '</div>';
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const data = await call({ action: 'find', text: text });
      if (btn) btn.disabled = false;
      renderFind(out, data, text);
    });
  }

  return { call: call, bindFind: bindFind, renderFind: renderFind, normalSearchUrl: normalSearchUrl };
})();

// Translation helper usable before/after i18n.js loads.
function acT(key) {
  const lang = (function () { try { return localStorage.getItem('acLang') === 'ur' ? 'ur' : 'en'; } catch (e) { return 'en'; } })();
  const d = (typeof AC_I18N !== 'undefined') ? AC_I18N[lang] : null;
  return (d && d[key]) || (typeof AC_I18N !== 'undefined' && AC_I18N.en[key]) || key;
}
