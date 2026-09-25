/* ============================================
   AgenticCore Estate — listing card rendering +
   buy/rent search & filter logic
   ============================================ */

const AC_HOUSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/></svg>';

function acFormatPKR(n) {
  n = Number(n) || 0;
  if (n >= 10000000) return '₨ ' + (n / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (n >= 100000) return '₨ ' + (n / 100000).toFixed(2).replace(/\.00$/, '') + ' Lac';
  return '₨ ' + n.toLocaleString('en-PK');
}

function acListingThumbHTML(l) {
  if (l.photos && l.photos.length) {
    return '<img src="' + l.photos[0] + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;">';
  }
  return AC_HOUSE_ICON;
}

function acListingCardHTML(l) {
  const lang = localStorage.getItem('acLang') === 'ur' ? 'ur' : 'en';
  const dict = AC_I18N[lang];
  const priceSuffix = l.type === 'rent' ? '<span class="period">' + dict.listing_month + '</span>' : '';
  const verifiedBadge = l.verified ? '<span class="listing-badge verified">✓</span>' : '';
  const featuredBadge = l.featured ? '<span class="listing-badge featured">★ Featured Agency</span>' : '';
  return (
    '<a href="listing.html?id=' + l.id + '" class="listing-card">' +
      '<div class="listing-thumb">' +
        '<span class="listing-badge ' + l.type + '">' + (l.type === 'buy' ? dict.search_buy : dict.search_rent) + '</span>' +
        verifiedBadge + featuredBadge +
        acListingThumbHTML(l) +
      '</div>' +
      '<div class="listing-body">' +
        '<div class="listing-price">' + acFormatPKR(l.price) + priceSuffix + '</div>' +
        '<div class="listing-title">' + l.title + '</div>' +
        '<div class="listing-location">' + acPropertyTypeLabel(l.property_type) + ' · ' + l.area + ', ' + l.city + '</div>' +
        '<div class="listing-specs">' +
          (l.beds ? '<span>' + l.beds + ' ' + dict.listing_beds + '</span>' : '') +
          (l.baths ? '<span>' + l.baths + ' ' + dict.listing_baths + '</span>' : '') +
          '<span>' + l.sizeMarla + ' ' + acSizeUnitLabel(l.sizeUnit || 'marla') + '</span>' +
        '</div>' +
      '</div>' +
    '</a>'
  );
}

function acRenderListings(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;
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
      const results = await AcDB.getListings(filters);
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
