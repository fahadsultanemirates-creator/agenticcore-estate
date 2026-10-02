/* AgenticCore Estate — homepage (Product 2.0) behaviour */
document.addEventListener('DOMContentLoaded', function () {
  const askForm = document.getElementById('panelAsk');
  const askInput = document.getElementById('askInput');
  const askOut = document.getElementById('askResults');
  const normalForm = document.getElementById('panelNormal');
  const tabs = { ask: document.getElementById('tabAsk'), buy: document.getElementById('tabBuy'), rent: document.getElementById('tabRent') };
  let mode = 'ask';

  // ---- search mode tabs (Ask / Buy / Rent) ----
  function setMode(m) {
    mode = m;
    Object.keys(tabs).forEach(function (k) {
      const on = k === m;
      tabs[k].classList.toggle('active', on);
      tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
    });
    askForm.hidden = m !== 'ask';
    normalForm.hidden = m === 'ask';
  }
  Object.keys(tabs).forEach(function (k) { tabs[k].addEventListener('click', function () { setMode(k); }); });

  // ---- Ask AgenticCore ----
  AcCopilot.bindFind(askForm, askInput, askOut);
  askInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askForm.requestSubmit(); }
  });
  document.querySelectorAll('.h2-chip').forEach(function (chip) {
    chip.addEventListener('click', function () { askInput.value = chip.textContent; askForm.requestSubmit(); });
  });
  document.querySelectorAll('[data-ask]').forEach(function (b) {
    b.addEventListener('click', function () {
      setMode('ask');
      askInput.value = b.getAttribute('data-ask');
      document.getElementById('askBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
      askForm.requestSubmit();
    });
  });
  document.querySelectorAll('a[href="#askBox"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault(); setMode('ask');
      document.getElementById('askBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { askInput.focus({ preventScroll: true }); }, 300);
    });
  });

  // ---- conventional search ----
  normalForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const p = new URLSearchParams();
    const kw = document.getElementById('hsKeyword').value.trim();
    const city = document.getElementById('hsCity').value;
    const price = document.getElementById('hsPrice').value;
    if (kw) p.set('q', kw);
    if (city) p.set('city', city);
    if (price) p.set('maxPrice', price);
    p.set('purpose', mode === 'rent' ? 'rent' : 'buy');
    window.location.href = 'properties.html?' + p.toString();
  });

  // ---- marketplace rows, category counts and city discovery ----
  // Rows show genuine items first; labelled samples only top up thin rows.
  // Counts, city totals and popular areas come from marketplace_stats(),
  // which counts genuine, visible content only (never samples).
  const CATS = ['properties', 'projects', 'professionals', 'agencies', 'builders'];
  const ICON = { house: AC_ICONS.house, tower: AC_ICONS.tower, person: AC_ICONS.person, agency: AC_ICONS.agency, crane: AC_ICONS.crane };
  document.querySelectorAll('.mk-cat-ico[data-icon]').forEach(function (el) { el.innerHTML = ICON[el.getAttribute('data-icon')] || ''; });

  async function loadRows() {
    await Promise.all(CATS.map(async function (cat) {
      const res = await acRenderMarketRow(cat, document.getElementById('mkRow_' + cat), 10);
      const note = document.getElementById('mkSampleLine_' + cat);
      if (note) note.hidden = !(res && res.sampleCount);
    }));
  }

  async function loadStats() {
    let st;
    try { st = await AcMarket.stats(); } catch (e) { return; }
    const key = { properties: 'properties', projects: 'projects', professionals: 'professionals', agencies: 'agencies', builders: 'companies' };
    CATS.forEach(function (cat) {
      const el = document.getElementById('mkCount_' + cat);
      const n = Number(st[key[cat]]) || 0;
      if (el) el.textContent = n ? acT('mk_count_short').replace('{n}', n) : acT('mk_explore');
    });
    ['Islamabad', 'Rawalpindi'].forEach(function (city) {
      const n = Number((st.by_city || {})[city]) || 0;
      const el = document.getElementById('count' + city);
      if (el) el.textContent = n ? n + ' ' + (n === 1 ? acT('h2_listing_one') : acT('h2_listing_many')) : acT('h2_be_first');
    });
    document.getElementById('popularAreas').innerHTML = (st.popular_areas || []).map(function (a) {
      return '<a class="h2-area" href="properties.html?city=' + encodeURIComponent(a.city) + '&area=' + encodeURIComponent(a.area) + '">' +
        acEsc(a.area) + ' <span>' + Number(a.n) + '</span></a>';
    }).join('');
  }

  function loadData() { loadRows(); loadStats(); }
  loadData();

  const prevHook = window.acOnLanguageChange;
  window.acOnLanguageChange = function () { loadData(); if (prevHook) prevHook(); };
});
