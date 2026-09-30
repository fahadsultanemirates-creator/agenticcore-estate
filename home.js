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
    window.location.href = (mode === 'rent' ? 'rent.html' : 'buy.html') + (p.toString() ? '?' + p.toString() : '');
  });

  // ---- featured, locations and card preview, all from real listings ----
  async function loadData() {
    let all = [];
    try { all = acDedupeListings(await AcDB.getListings({})); } catch (e) { all = []; }
    const buy = all.filter(function (l) { return l.type === 'buy'; });
    const rent = all.filter(function (l) { return l.type === 'rent'; });

    if (buy.length) acRenderListings('featuredBuyRow', buy.slice(0, 10));
    else document.getElementById('featuredBuyRow').innerHTML = '<div class="h2-empty">' + acEsc(acT('h2_empty_buy')) + ' <a href="sell.html">' + acEsc(acT('h2_cta_list')) + ' →</a></div>';
    const rentWrap = document.getElementById('featuredRentWrap');
    rentWrap.hidden = !rent.length;
    if (rent.length) acRenderListings('featuredRentRow', rent.slice(0, 10));

    ['Islamabad', 'Rawalpindi'].forEach(function (city) {
      const n = all.filter(function (l) { return l.city === city; }).length;
      const el = document.getElementById('count' + city);
      if (el) el.textContent = n ? n + ' ' + (n === 1 ? acT('h2_listing_one') : acT('h2_listing_many')) : acT('h2_be_first');
    });

    // Popular areas = areas that actually have listings, most first.
    const byArea = {};
    all.forEach(function (l) { const k = l.area + '|' + l.city; byArea[k] = (byArea[k] || 0) + 1; });
    const top = Object.keys(byArea).sort(function (a, b) { return byArea[b] - byArea[a]; }).slice(0, 8);
    document.getElementById('popularAreas').innerHTML = top.map(function (k) {
      const parts = k.split('|');
      return '<a class="h2-area" href="buy.html?city=' + encodeURIComponent(parts[1]) + '&q=' + encodeURIComponent(parts[0]) + '">' +
        acEsc(parts[0]) + ' <span>' + byArea[k] + '</span></a>';
    }).join('');

    // Toolkit preview: a real card drawn from the newest listing with a photo.
    const sample = all.find(function (l) { return l.photos && l.photos.length; }) || all[0];
    const holder = document.getElementById('cardPreview');
    if (sample && holder && typeof AcShareCards !== 'undefined') {
      const io = new IntersectionObserver(async function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const canvas = document.createElement('canvas');
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Example WhatsApp card generated from a real listing');
        await AcShareCards.draw(canvas, sample, 'whatsapp');
        holder.innerHTML = '';
        holder.appendChild(canvas);
        const cap = document.createElement('p');
        cap.className = 'h2-fine';
        cap.textContent = acT('h2_tk_preview');
        holder.appendChild(cap);
      }, { rootMargin: '200px' });
      io.observe(holder);
    } else if (holder) {
      holder.hidden = true;
    }
  }
  loadData();

  const prevHook = window.acOnLanguageChange;
  window.acOnLanguageChange = function () { loadData(); if (prevHook) prevHook(); };
});
