// AgenticCore Estate — printable property sheet (sheet.html?id=<listing id>)
// For the listing's owner only; uses only the listing's own public fields.
// "Save as PDF" is the browser's own print-to-PDF — no PDF library.
(async function () {
  const root = document.getElementById('sheetRoot');
  const esc = acEscHTML;
  document.getElementById('sheetPrint').addEventListener('click', function () { acTrack('toolkit_export', { format: 'sheet', channel: 'print' }); window.print(); });
  const user = await AcDB.currentUser();
  if (!user) { location.href = 'login.html?next=' + encodeURIComponent('sheet.html' + location.search); return; }
  const id = new URLSearchParams(location.search).get('id') || '';
  const l = /^[0-9a-f-]{36}$/i.test(id) ? await AcDB.getListing(id) : null;
  if (!l || l.is_sample || l.owner_id !== user.id) { root.innerHTML = '<p class="sheet-msg">' + esc(acT('tk_not_yours')) + ' <a href="my.html#properties">' + esc(acT('tk_my_listings')) + '</a></p>'; return; }
  const safe = function (u) { u = String(u || ''); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; };
  const photos = (l.photos || []).map(safe).filter(Boolean).slice(0, 3);
  const url = AcShareCards.listingUrl(l);
  const by = l.agency ? { name: l.agency.name, img: safe(l.agency.logo_url) } : l.professional ? { name: l.professional.display_name, img: safe(l.professional.avatar_url) } : null;
  const unit = acSizeUnitLabel(l.size_unit || 'marla');
  const facts = [
    [acT('sheet_type'), acPropertyTypeLabel(l.property_type)],
    l.size_marla ? [acT('sheet_size'), l.size_marla + ' ' + unit] : null,
    Number(l.beds) > 0 ? [acT('mk_beds'), l.beds] : null,
    Number(l.baths) > 0 ? [acT('mk_baths'), l.baths] : null
  ].filter(Boolean);
  document.title = l.title + ' — ' + acT('sheet_title');
  root.innerHTML =
    '<div class="sh-top"><div class="sh-brand"><img src="images/agenticcore-icon.png" alt="">AgenticCore<span>.estate</span></div>' +
      '<div class="sh-purpose">' + esc(l.type === 'rent' ? 'FOR RENT' : 'FOR SALE') + '</div></div>' +
    '<h1>' + esc(l.title) + '</h1><p class="sh-loc">' + esc(l.area) + ', ' + esc(l.city) + '</p>' +
    '<p class="sh-price">' + esc(acFormatPKR(l.price)) + (l.type === 'rent' && l.price > 0 ? ' / month' : '') + '</p>' +
    (photos.length ? '<div class="sh-photos' + (photos.length === 1 ? ' one' : '') + '">' + photos.map(function (p, i) { return '<img class="' + (i === 0 ? 'main' : 'side') + '" src="' + esc(p) + '" alt="">'; }).join('') + '</div>' : '') +
    '<ul class="sh-facts">' + facts.map(function (f) { return '<li><b>' + esc(f[0]) + '</b>' + esc(String(f[1])) + '</li>'; }).join('') + '</ul>' +
    (l.description ? '<p class="sh-desc">' + esc(String(l.description).slice(0, 1200)) + '</p>' : '') +
    '<div class="sh-foot"><div class="sh-qr" id="sheetQr"></div><div>' +
      (by ? '<div class="sh-by">' + (by.img ? '<img src="' + esc(by.img) + '" alt="">' : '') + '<span>' + esc(acT('sheet_listed_by')) + ' <strong>' + esc(by.name) + '</strong></span></div>' : '') +
      '<div>' + esc(acT('sheet_scan')) + '</div><div class="sh-url">' + esc(url) + '</div>' +
      '<p class="sh-fine">' + esc(acT('sheet_fine')) + '</p></div></div>';
  // QR (same library the share cards use)
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  s.onload = function () { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); document.getElementById('sheetQr').innerHTML = q.createSvgTag(4, 0); };
  document.head.appendChild(s);
})();
