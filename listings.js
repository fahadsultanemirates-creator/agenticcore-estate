/* ============================================
   AgenticCore Estate — listing card rendering +
   buy/rent search & filter logic
   ============================================ */

const AC_HOUSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/></svg>';

// Listing text is typed by users, so it is always escaped before it goes
// into innerHTML (otherwise a listing title could run script on every visitor).
function acEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Only http(s) URLs (our own storage) are allowed into src attributes.
function acSafeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? acEsc(u) : ''; }

function acFormatPKR(n) {
  n = Number(n) || 0;
  if (n >= 10000000) return '₨ ' + (n / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (n >= 100000) return '₨ ' + (n / 100000).toFixed(2).replace(/\.00$/, '') + ' Lac';
  return '₨ ' + n.toLocaleString('en-PK');
}

function acListingThumbHTML(l) {
  if (l.photos && l.photos.length) {
    return '<img src="' + acSafeUrl(l.photos[0]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;">';
  }
  return AC_HOUSE_ICON;
}

function acListingCardHTML(l) {
  const lang = localStorage.getItem('acLang') === 'ur' ? 'ur' : 'en';
  const dict = AC_I18N[lang];
  const priceSuffix = l.type === 'rent' ? '<span class="period">' + dict.listing_month + '</span>' : '';
  const verifiedBadge = l.verified ? '<span class="listing-badge verified">✓</span>' : '';
  const featuredBadge = l.featured ? '<span class="listing-badge featured">★ Featured Agency</span>' : '';
  const agencyLogoHTML = l.agencyLogo ?
    '<img src="' + acSafeUrl(l.agencyLogo) + '" alt="" class="listing-agency-logo" title="' + acEsc(l.agencyName) + '">' : '';
  return (
    '<a href="listing.html?id=' + encodeURIComponent(l.id) + '" class="listing-card">' +
      '<div class="listing-thumb">' +
        '<span class="listing-badge ' + l.type + '">' + (l.type === 'buy' ? dict.search_buy : dict.search_rent) + '</span>' +
        verifiedBadge + featuredBadge + agencyLogoHTML +
        acListingThumbHTML(l) +
      '</div>' +
      '<div class="listing-body">' +
        '<div class="listing-price">' + acFormatPKR(l.price) + priceSuffix + '</div>' +
        '<div class="listing-title">' + acEsc(l.title) + '</div>' +
        '<div class="listing-location">' + acEsc(acPropertyTypeLabel(l.property_type)) + ' · ' + acEsc(l.area) + ', ' + acEsc(l.city) + '</div>' +
        '<div class="listing-specs">' +
          (l.beds ? '<span>' + l.beds + ' ' + dict.listing_beds + '</span>' : '') +
          (l.baths ? '<span>' + l.baths + ' ' + dict.listing_baths + '</span>' : '') +
          '<span>' + acEsc(l.sizeMarla) + ' ' + acSizeUnitLabel(l.sizeUnit || 'marla') + '</span>' +
        '</div>' +
      '</div>' +
    '</a>'
  );
}

// The same property posted more than once (same owner, title, price and
// area) is shown to buyers once. Owners still see every row in their dashboard.
function acDedupeListings(list) {
  const seen = {};
  return (list || []).filter(function (l) {
    const k = [l.owner_id, String(l.title).trim().toLowerCase(), Number(l.price), String(l.area).trim().toLowerCase()].join('|');
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

function acRenderListings(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;
  list = acDedupeListings(list);
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">No listings match these filters yet.</div>';
    return;
  }
  el.innerHTML = list.map(acListingCardHTML).join('');
}

async function acPopulateCityOptions(selectEl) {
  const cities = await AcDB.getActiveCities();
  cities.forEach(function (c) {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    selectEl.appendChild(opt);
  });
}

function acInitListingPage(fixedType) {
  const grid = document.getElementById('listingGrid');
  if (!grid) return;

  const citySelect = document.getElementById('filterCity');
  const typeSelect = document.getElementById('filterPropertyType');
  const priceInput = document.getElementById('filterMaxPrice');
  const bedsSelect = document.getElementById('filterBeds');
  const qInput = document.getElementById('filterQuery');
  const countEl = document.getElementById('listingCount');

  (async function () {
    if (citySelect) await acPopulateCityOptions(citySelect);
    if (typeSelect) typeSelect.innerHTML = '<option value="">Any property type</option>' + acPropertyTypeOptionsHTML();

    const params = new URLSearchParams(window.location.search);
    if (citySelect && params.get('city')) citySelect.value = params.get('city');
    if (typeSelect && params.get('propertyType')) typeSelect.value = params.get('propertyType');
    if (priceInput && params.get('maxPrice')) priceInput.value = params.get('maxPrice');
    if (qInput && params.get('q')) qInput.value = params.get('q');

    async function apply() {
      const filters = { type: fixedType };
      if (citySelect && citySelect.value) filters.city = citySelect.value;
      if (typeSelect && typeSelect.value) filters.propertyType = typeSelect.value;
      if (priceInput && priceInput.value) filters.maxPrice = priceInput.value;
      if (bedsSelect && bedsSelect.value) filters.beds = bedsSelect.value;
      if (qInput && qInput.value) filters.q = qInput.value;
      const results = acDedupeListings(await AcDB.getListings(filters));
      acRenderListings('listingGrid', results);
      if (countEl) countEl.textContent = results.length + (results.length === 1 ? ' listing' : ' listings');
    }

    [citySelect, typeSelect, priceInput, bedsSelect, qInput].forEach(function (el) {
      if (el) el.addEventListener('input', apply);
    });

    window.acOnLanguageChange = apply;
    apply();
  })();
}

// "My listings" table rows with View / Edit / Delete, shared by the
// individual and agency dashboards.
function acMyListingsRowsHTML(list) {
  if (!list.length) return '<tr><td colspan="6" style="color:var(--text-tertiary);">You haven\'t listed a property yet. <a href="sell.html" style="color:var(--accent-gold-bright);">List one now →</a></td></tr>';
  return list.map(function (l) {
    return '<tr><td>' + acEsc(l.title) + '</td><td>' + (l.type === 'rent' ? 'Rent' : 'Sale') + '</td><td>' + acFormatPKR(l.price) + '</td>' +
      '<td>' + (l.verified ? '<span class="badge badge-emerald">Checked</span>' : '<span class="badge badge-muted">Not checked yet</span>') + '</td>' +
      '<td>' + (typeof acQualityPillHTML === 'function' ? acQualityPillHTML(l) : '—') + '</td>' +
      '<td style="white-space:nowrap;"><a href="listing.html?id=' + encodeURIComponent(l.id) + '" class="btn btn-secondary btn-sm">View</a> ' +
      '<a href="sell.html?edit=' + encodeURIComponent(l.id) + '" class="btn btn-secondary btn-sm">Edit</a> ' +
      '<a href="toolkit.html?id=' + encodeURIComponent(l.id) + '" class="btn btn-secondary btn-sm">Toolkit</a> ' +
      '<button type="button" class="btn btn-secondary btn-sm" data-delete-listing="' + acEsc(l.id) + '" data-title="' + acEsc(l.title) + '">Delete</button></td></tr>';
  }).join('');
}

function acWireMyListings(tbody, userId, onChange) {
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-tertiary);">Loading…</td></tr>';
  AcDB.getListingsByOwner(userId).then(function (list) {
    tbody.innerHTML = acMyListingsRowsHTML(list);
    if (onChange) onChange(list);
  });
  if (tbody.dataset.wired) return;
  tbody.dataset.wired = '1';
  tbody.addEventListener('click', async function (e) {
    const btn = e.target.closest('[data-delete-listing]');
    if (!btn) return;
    if (!confirm('Delete "' + btn.getAttribute('data-title') + '"? This removes it from the site and cannot be undone.')) return;
    btn.disabled = true;
    const res = await AcDB.deleteListing(btn.getAttribute('data-delete-listing'), userId);
    if (res.error) { alert(res.error); btn.disabled = false; return; }
    acWireMyListings(tbody, userId, onChange);
  });
}
