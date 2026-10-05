/* ============================================
   AgenticCore Estate — marketplace UI (Marketplace V2)
   Cards, homepage rows, directories and the shared
   contact / enquiry box for the five categories.
   One visual system, category-specific information.
   All database text goes through acEsc(); media URLs
   through acMediaUrl() (https or bundled samples only).
   ============================================ */

function acMediaUrl(u) {
  u = String(u || '');
  if (/^https:\/\/[^\s"'<>]+$/i.test(u) || /^images\/samples\/[a-z0-9._/-]+$/.test(u)) return acEsc(u);
  return '';
}

function acLang() { try { return localStorage.getItem('acLang') === 'ur' ? 'ur' : 'en'; } catch (e) { return 'en'; } }

// Card image: the small thumbnail if there is one, the full photo otherwise.
function acCardImage(thumbs, photos) {
  return (thumbs && thumbs[0]) || (photos && photos[0]) || '';
}

const AC_ICONS = {
  house: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/></svg>',
  tower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="9" height="18"/><rect x="13" y="9" width="7" height="12"/><path d="M7 7h3M7 11h3M7 15h3M16 13h1M16 17h1"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  agency: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18"/></svg>',
  crane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 21V4l14 3H5M9 4v3M16 7v5M14 12h4v3h-4zM3 21h8"/></svg>'
};

// ---------- badges: each states one fact ----------
function acSampleBadge(kind) {
  return '<span class="mk-sample" title="' + acEsc(acT('mk_sample_note')) + '">' + acEsc(acT(kind === 'profile' ? 'mk_sample_profile' : kind === 'listing' ? 'mk_sample_listing' : 'mk_sample')) + '</span>';
}
function acPromoBadge(item, s) {
  // Only when packages are live (admin setting) and never on samples.
  if (!s || s.paid_placement_active !== true || item.is_sample) return '';
  if (item.placement === 'featured') return '<span class="mk-promo">' + acEsc(acT('mk_featured')) + '</span>';
  return '';
}
function acVerifiedBadge(item) {
  return item.verified && !item.is_sample ? '<span class="mk-verified" title="' + acEsc(acT('mk_verified_tip')) + '">✓ ' + acEsc(acT('mk_verified')) + '</span>' : '';
}
function acChips(list, map, max) {
  return (list || []).slice(0, max || 3).map(function (x) { return '<span class="mk-chip">' + acEsc(map ? map(x) : x) + '</span>'; }).join('');
}

// ---------- labels ----------
function acPurposeLabel(p) { return acT(p === 'rent' ? 'search_rent' : 'search_buy'); }
function acProjectStatusText(s) { return acT({ off_plan: 'mk_status_off_plan', under_construction: 'mk_status_under_construction', ready: 'mk_status_ready' }[s] || 'mk_status_off_plan'); }
function acProjectTypeText(t) { return t ? acT('mk_ptype_' + t) : ''; }
function acServiceText(s) { const k = 'mk_svc_' + s; const v = acT(k); return v === k ? String(s).replace(/_/g, ' ') : v; }
function acSegmentText(s) { return acT('mk_seg_' + s); }
function acPurposeText(s) { return acT(s === 'rent' ? 'mk_purpose_rent' : 'mk_purpose_sale'); }
function acUnitText(u) { return acT('mk_unit_' + u); }
function acTypeLabel(v) { return typeof acPropertyTypeLabel === 'function' ? acPropertyTypeLabel(v) : v; }
function acPriceRange(a, b) {
  if (a && b) return acFormatPKR(a) + ' – ' + acFormatPKR(b);
  if (a) return acT('mk_from') + ' ' + acFormatPKR(a);
  if (b) return acT('mk_up_to') + ' ' + acFormatPKR(b);
  return '';
}
function acSizeRange(a, b, unit) {
  const u = typeof acSizeUnitLabel === 'function' ? acSizeUnitLabel(unit || 'sqft') : (unit || '');
  if (a && b) return a + '–' + b + ' ' + u;
  if (a || b) return (a || b) + ' ' + u;
  return '';
}
function acInitials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
}

// ---------- cards ----------
function acPropertyCard(l, s) {
  const img = acMediaUrl(acCardImage(l.thumbs, l.photos));
  const fresh = !l.is_sample && typeof acIsFresh === 'function' && acIsFresh(l);
  const by = l.agency ? l.agency.name : l.professional ? l.professional.display_name : '';
  const byLogo = l.agency && acMediaUrl(l.agency.logo_url);
  return '<a class="mk-card mk-card-property' + (l.is_sample ? ' is-sample' : '') + '" href="listing.html?id=' + encodeURIComponent(l.id) + '">' +
    '<div class="mk-media">' + (img ? '<img src="' + img + '" alt="" loading="lazy" decoding="async" width="480" height="360">' : '<span class="mk-media-icon">' + AC_ICONS.house + '</span>') +
      '<span class="mk-purpose ' + (l.type === 'rent' ? 'rent' : 'buy') + '">' + acEsc(acPurposeLabel(l.type)) + '</span>' +
      (l.is_sample ? acSampleBadge('listing') : acPromoBadge(l, s)) + '</div>' +
    '<div class="mk-body">' +
      '<div class="mk-price">' + acFormatPKR(l.price) + (l.type === 'rent' && l.price > 0 ? '<span class="period">' + acEsc(acT('listing_month')) + '</span>' : '') + '</div>' +
      '<h3 class="mk-title">' + acEsc(l.title) + '</h3>' +
      '<p class="mk-meta">' + acEsc(acTypeLabel(l.property_type)) + ' · ' + acEsc(l.area) + ', ' + acEsc(l.city) + '</p>' +
      '<p class="mk-specs">' + (l.beds ? '<span>' + l.beds + ' ' + acEsc(acT('listing_beds')) + '</span>' : '') + (l.baths ? '<span>' + l.baths + ' ' + acEsc(acT('listing_baths')) + '</span>' : '') +
        (l.size_marla ? '<span>' + acEsc(l.size_marla) + ' ' + acEsc(typeof acSizeUnitLabel === 'function' ? acSizeUnitLabel(l.size_unit || 'marla') : l.size_unit) + '</span>' : '') + '</p>' +
      (fresh ? '<p class="mk-fresh">● ' + acEsc(acT('badge_fresh')) + '</p>' : '') + acVerifiedBadge(l) +
      (by ? '<p class="mk-by">' + (byLogo ? '<img src="' + byLogo + '" alt="" loading="lazy" width="20" height="20">' : '') + '<span>' + acEsc(by) + '</span></p>' : '') +
    '</div></a>';
}

function acProjectCard(p, s) {
  const img = acMediaUrl(acCardImage(p.thumbs, p.photos));
  return '<a class="mk-card mk-card-project' + (p.is_sample ? ' is-sample' : '') + '" href="project.html?id=' + encodeURIComponent(p.id) + '">' +
    '<div class="mk-media">' + (img ? '<img src="' + img + '" alt="" loading="lazy" decoding="async" width="480" height="360">' : '<span class="mk-media-icon">' + AC_ICONS.tower + '</span>') +
      '<span class="mk-purpose status">' + acEsc(acProjectStatusText(p.status)) + '</span>' +
      (p.is_sample ? acSampleBadge('listing') : acPromoBadge(p, s)) + '</div>' +
    '<div class="mk-body">' +
      '<h3 class="mk-title">' + acEsc(p.title) + '</h3>' +
      '<p class="mk-meta">' + acEsc(p.area) + ', ' + acEsc(p.city) + (p.project_type ? ' · ' + acEsc(acProjectTypeText(p.project_type)) : '') + '</p>' +
      (acPriceRange(p.price_from, p.price_to) ? '<div class="mk-price small">' + acPriceRange(p.price_from, p.price_to) + '</div>' : '') +
      '<p class="mk-chips">' + acChips(p.unit_types, acTypeLabel, 3) + '</p>' + acVerifiedBadge(p) +
      (p.company ? '<p class="mk-by">' + (acMediaUrl(p.company.logo_url) ? '<img src="' + acMediaUrl(p.company.logo_url) + '" alt="" loading="lazy" width="20" height="20">' : '') + '<span>' + acEsc(p.company.name) + '</span></p>' : '') +
    '</div></a>';
}

function acAvatarHTML(url, name, size) {
  const u = acMediaUrl(url);
  return u ? '<img class="mk-avatar" src="' + u + '" alt="" loading="lazy" decoding="async" width="' + (size || 96) + '" height="' + (size || 96) + '">'
    : '<span class="mk-avatar mk-initials" aria-hidden="true">' + acEsc(acInitials(name)) + '</span>';
}

function acProfessionalCard(p, s) {
  return '<a class="mk-card mk-card-person' + (p.is_sample ? ' is-sample' : '') + '" href="professional.html?id=' + encodeURIComponent(p.id) + '">' +
    '<div class="mk-person-top">' + acAvatarHTML(p.avatar_url, p.display_name, 96) + (p.is_sample ? acSampleBadge('profile') : acPromoBadge(p, s)) + '</div>' +
    '<div class="mk-body">' +
      '<h3 class="mk-title">' + acEsc(p.display_name) + '</h3>' +
      (p.headline ? '<p class="mk-meta">' + acEsc(p.headline) + '</p>' : '') +
      '<p class="mk-chips">' + acChips(p.cities, null, 2) + acChips(p.purposes, acPurposeText, 2) + '</p>' + acVerifiedBadge(p) +
      '<span class="mk-cta">' + acEsc(acT('mk_view_profile')) + ' →</span>' +
    '</div></a>';
}

function acLogoBox(url, name, icon) {
  const u = acMediaUrl(url);
  return '<div class="mk-logo">' + (u ? '<img src="' + u + '" alt="" loading="lazy" decoding="async" width="480" height="240">' : '<span class="mk-media-icon">' + icon + '</span>') + '</div>';
}

function acAgencyCard(a, s) {
  return '<a class="mk-card mk-card-org' + (a.is_sample ? ' is-sample' : '') + '" href="agency.html?id=' + encodeURIComponent(a.id) + '">' +
    '<div class="mk-media mk-media-logo">' + acLogoBox(a.logo_url, a.name, AC_ICONS.agency) + (a.is_sample ? acSampleBadge('profile') : acPromoBadge(a, s)) + '</div>' +
    '<div class="mk-body">' +
      '<h3 class="mk-title">' + acEsc(a.name) + '</h3>' +
      '<p class="mk-meta">' + acEsc((a.cities && a.cities.length ? a.cities : [a.city]).filter(Boolean).join(' · ')) + '</p>' +
      '<p class="mk-chips">' + acChips(a.services, null, 3) + '</p>' + acVerifiedBadge(a) +
      '<span class="mk-cta">' + acEsc(acT('mk_view_agency')) + ' →</span>' +
    '</div></a>';
}

function acRateLine(rates) {
  const r = (rates || []).filter(function (x) { return x.rate_min; }).sort(function (a, b) { return a.rate_min - b.rate_min; })[0];
  if (!r) return '';
  return '<p class="mk-rate">' + acEsc(acT('mk_rate_from')) + ' <strong>Rs ' + Number(r.rate_min).toLocaleString('en-PK') + '</strong> ' + acEsc(acUnitText(r.unit)) +
    ' <span>· ' + acEsc(acServiceText(r.service)) + '</span></p>';
}

function acBuilderCard(c, s) {
  return '<a class="mk-card mk-card-org' + (c.is_sample ? ' is-sample' : '') + '" href="builder.html?id=' + encodeURIComponent(c.id) + '">' +
    '<div class="mk-media mk-media-logo">' + acLogoBox(c.logo_url, c.name, AC_ICONS.crane) + (c.is_sample ? acSampleBadge('profile') : acPromoBadge(c, s)) + '</div>' +
    '<div class="mk-body">' +
      '<h3 class="mk-title">' + acEsc(c.name) + '</h3>' +
      '<p class="mk-meta">' + acEsc((c.cities || []).join(' · ')) + '</p>' +
      '<p class="mk-chips">' + acChips(c.services, acServiceText, 3) + '</p>' +
      acRateLine(c.company_rates) + acVerifiedBadge(c) +
      '<span class="mk-cta">' + acEsc(acT('mk_view_company')) + ' →</span>' +
    '</div></a>';
}

const AC_MARKET_CARD = {
  properties: acPropertyCard, projects: acProjectCard, professionals: acProfessionalCard,
  agencies: acAgencyCard, builders: acBuilderCard
};
const AC_MARKET_PAGES = {
  properties: { dir: 'properties.html', create: 'sell.html' },
  // join links: new visitors sign up with the right account type; signed-in
  // accounts are sent straight on to the matching dashboard module
  projects: { dir: 'projects.html', create: 'signup.html?intent=developer' },
  professionals: { dir: 'professionals.html', create: 'signup.html?intent=professional' },
  agencies: { dir: 'agencies.html', create: 'signup.html?intent=agency' },
  builders: { dir: 'builders.html', create: 'signup.html?intent=builder' }
};

// ---------- homepage rows ----------
async function acRenderMarketRow(cat, el, limit) {
  if (!el) return;
  el.setAttribute('aria-busy', 'true');
  const [res, s] = await Promise.all([AcMarket.row(cat, limit || 10), AcMarket.settings()]);
  el.removeAttribute('aria-busy');
  if (!res.items.length) {
    el.innerHTML = '<div class="mk-empty">' + acEsc(acT('mk_empty_' + cat)) + ' <a href="' + AC_MARKET_PAGES[cat].create + '">' + acEsc(acT('mk_cta_' + cat)) + ' →</a></div>';
    return res;
  }
  el.innerHTML = res.items.map(function (it) { return AC_MARKET_CARD[cat](it, s); }).join('');
  return res;
}

// ---------- directories ----------
const AC_DIR_PAGE_SIZE = 12;

function acDirFilterValues(form) {
  const f = {};
  form.querySelectorAll('[name]').forEach(function (el) { if (el.value) f[el.name] = el.value; });
  return f;
}

async function acFillCities(select, cat) {
  if (!select || select.dataset.filled) return;
  // the projects directory also lists the projects-only places
  select.insertAdjacentHTML('beforeend', acPlaceOptionsHTML(await AcDB.getActiveCityRows(cat === 'projects')));
  select.dataset.filled = '1';
  select.setAttribute('data-city-select', '');
}
async function acFillAreas(select, city) {
  if (!select) return;
  const keep = select.value;
  select.innerHTML = '<option value="">' + acEsc(acT('mk_any_area')) + '</option>';
  if (!city) return;
  const areas = await AcDB.getAreasForCity(city);
  select.insertAdjacentHTML('beforeend', acAreaOptions(areas));
  if (keep && (areas.indexOf(keep) >= 0 || (areas.more || []).indexOf(keep) >= 0)) select.value = keep;
}

function acInitMarketDirectory(cat, fixed) {
  fixed = fixed || {};
  const form = document.getElementById('mkFilters');
  const grid = document.getElementById('mkResults');
  const countEl = document.getElementById('mkCount');
  const moreBtn = document.getElementById('mkMore');
  const sampleWrap = document.getElementById('mkSamples');
  if (!form || !grid) return;
  let page = 0, total = 0, loaded = 0, seq = 0;

  const params = new URLSearchParams(location.search);
  (async function () {
    await acFillCities(form.querySelector('[name="city"]'), cat);
    const typeSel = form.querySelector('[name="propertyType"]');
    if (typeSel && typeof acPropertyTypeOptionsHTML === 'function' && !typeSel.dataset.filled) { typeSel.insertAdjacentHTML('beforeend', acPropertyTypeOptionsHTML()); typeSel.dataset.filled = '1'; }
    form.querySelectorAll('[name]').forEach(function (el) { if (params.get(el.name)) el.value = params.get(el.name); });
    const areaSel = form.querySelector('[name="area"]');
    if (areaSel) { await acFillAreas(areaSel, form.querySelector('[name="city"]').value); if (params.get('area')) areaSel.value = params.get('area'); }
    load(true);
  })();

  async function load(reset) {
    const mine = ++seq;
    if (reset) { page = 0; loaded = 0; grid.innerHTML = '<div class="mk-loading">' + acEsc(acT('mk_loading')) + '</div>'; }
    const f = Object.assign(acDirFilterValues(form), fixed);
    const sort = f.sort; delete f.sort;
    const [res, s] = await Promise.all([AcMarket.browse(cat, f, page, AC_DIR_PAGE_SIZE, sort), AcMarket.settings()]);
    if (mine !== seq) return;               // a newer filter change won
    total = res.total;
    const html = res.rows.map(function (it) { return AC_MARKET_CARD[cat](it, s); }).join('');
    if (reset) grid.innerHTML = html; else grid.insertAdjacentHTML('beforeend', html);
    loaded += res.rows.length;
    const filtered = Object.keys(acDirFilterValues(form)).filter(function (k) { return k !== 'sort'; }).length > 0;
    const fCity = acDirFilterValues(form).city;
    const launching = fCity && typeof acCityLaunching === 'function' && acCityLaunching(fCity);
    if (!loaded) grid.innerHTML = '<div class="mk-empty">' + acEsc(launching ? acT('city_launching_note') : acT(filtered ? 'mk_no_match' : 'mk_empty_' + cat)) +
      ' <a href="' + AC_MARKET_PAGES[cat].create + '">' + acEsc(acT('mk_cta_' + cat)) + ' →</a></div>';
    if (countEl) countEl.textContent = total ? acT('mk_count').replace('{n}', total) : '';
    // A thin (but not empty) category invites the next genuine participant.
    // Honest wording only: it never claims a size the directory doesn't have.
    if (reset) {
      let join = document.getElementById('mkJoin');
      const thin = !filtered && total > 0 && total < (Number(s.sample_fill_min) || 0);
      if (thin && !join) { join = document.createElement('p'); join.id = 'mkJoin'; join.className = 'mk-join'; grid.insertAdjacentElement('afterend', join); }
      if (join) {
        join.hidden = !thin;
        if (thin) join.innerHTML = acEsc(acT('mk_join_' + cat)) + ' <a href="' + AC_MARKET_PAGES[cat].create + '">' + acEsc(acT('mk_cta_' + cat)) + ' →</a>';
      }
    }
    if (moreBtn) moreBtn.hidden = loaded >= total;
    // Sample examples sit in their own labelled strip, only while the
    // category is thin and nothing is filtered — never mixed into results.
    if (sampleWrap && reset) {
      const min = Number(s.sample_fill_min) || 0;
      if (!filtered && total < min) {
        const ex = await AcMarket.samples(cat, min);
        sampleWrap.hidden = !ex.length;
        sampleWrap.querySelector('.mk-sample-row').innerHTML = ex.map(function (it) { return AC_MARKET_CARD[cat](it, s); }).join('');
      } else sampleWrap.hidden = true;
    }
    // keep the URL shareable
    const q = new URLSearchParams(acDirFilterValues(form));
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
  }

  let timer = null;
  form.addEventListener('input', function (e) {
    if (e.target.name === 'city') acFillAreas(form.querySelector('[name="area"]'), e.target.value);
    clearTimeout(timer); timer = setTimeout(function () { load(true); }, e.target.tagName === 'INPUT' ? 350 : 0);
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); load(true); });
  form.addEventListener('reset', function () { setTimeout(function () { load(true); }, 0); });
  if (moreBtn) moreBtn.addEventListener('click', function () { page += 1; load(false); });
  window.acOnLanguageChange = function () { load(true); };
}

// ---------- contact / enquiry box (all five categories) ----------
// Samples: disabled with an explanation. Visitors: log in first.
// Signed in: the owner's number (security-definer RPC) + a stored enquiry.
function acContactBoxHTML(type, item) {
  if (item.is_sample) {
    return '<div class="panel mk-contact"><h3>' + acEsc(acT('mk_contact_h')) + '</h3>' +
      '<p class="mk-sample-explain">' + acSampleBadge('') + ' ' + acEsc(acT('mk_sample_contact')) + '</p>' +
      '<button type="button" class="btn btn-secondary btn-block" disabled>' + acEsc(acT('mk_contact_disabled')) + '</button></div>';
  }
  return '<div class="panel mk-contact" id="mkContact"><h3>' + acEsc(acT('mk_contact_h')) + '</h3>' +
    '<div id="mkContactSlot"><button type="button" class="btn btn-primary btn-block" id="mkContactBtn">' + acEsc(acT('mk_contact_show')) + '</button></div>' +
    '<form id="mkEnquiry" class="mk-enquiry" novalidate><label for="mkEnqMsg">' + acEsc(acT('mk_enq_label')) + '</label>' +
      '<textarea id="mkEnqMsg" rows="3" maxlength="2000" required></textarea>' +
      '<label for="mkEnqPhone">' + acEsc(acT('mk_enq_phone')) + '</label><input id="mkEnqPhone" type="tel" autocomplete="tel" placeholder="+92 3XX XXXXXXX">' +
      '<button type="submit" class="btn btn-secondary btn-block">' + acEsc(acT('mk_enq_send')) + '</button><p class="mk-enq-status" role="status"></p></form>' +
    '<p class="mk-fine">' + acEsc(acT('mk_contact_fine')) + '</p></div>';
}

function acWireContactBox(type, item, returnUrl) {
  if (item.is_sample) return;
  const btn = document.getElementById('mkContactBtn');
  const slot = document.getElementById('mkContactSlot');
  const form = document.getElementById('mkEnquiry');
  async function viewerOrLogin() {
    const v = await AcDB.currentUser();
    if (!v) { location.href = 'login.html?next=' + encodeURIComponent(returnUrl); return null; }
    return v;
  }
  if (btn) btn.addEventListener('click', async function () {
    if (!await viewerOrLogin()) return;
    btn.disabled = true;
    const res = type === 'listing' ? await AcDB.getListingContact(item.id) : await AcMarket.contact(type, item.id);
    const c = res.contact;
    if (!c || !c.phone) { btn.disabled = false; slot.insertAdjacentHTML('beforeend', '<p class="mk-fine">' + acEsc(acT('mk_contact_none')) + '</p>'); return; }
    const digits = String(c.phone).replace(/[^0-9]/g, '').replace(/^0/, '92');
    const msg = acT('mk_wa_msg') + ' ' + location.href;
    slot.innerHTML = '<p class="mk-phone">' + acEsc(c.phone) + '</p>' +
      '<a class="btn btn-primary btn-block" href="tel:+' + digits + '">' + acEsc(acT('mk_call')) + '</a>' +
      '<a class="btn btn-secondary btn-block" target="_blank" rel="noopener" href="https://wa.me/' + digits + '?text=' + encodeURIComponent(msg) + '">WhatsApp</a>';
  });
  if (form) form.addEventListener('focusin', function once() {
    form.removeEventListener('focusin', once);
    if (typeof acTrack === 'function') acTrack('enquiry_started', { entity: type });
  });
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const status = form.querySelector('.mk-enq-status');
    const msg = document.getElementById('mkEnqMsg').value.trim();
    if (msg.length < 2) { status.textContent = acT('mk_enq_short'); return; }
    if (!await viewerOrLogin()) return;
    form.querySelector('button').disabled = true;
    const res = await AcMarket.enquire(type, item.id, msg, document.getElementById('mkEnqPhone').value.trim());
    form.querySelector('button').disabled = false;
    status.textContent = res.error ? res.error : acT('mk_enq_sent');
    if (!res.error) { form.reset(); if (typeof acTrack === 'function') acTrack('enquiry_sent', { entity: type }); }
  });
}

function acSampleNoticeHTML() {
  return '<div class="mk-sample-notice" role="note">' + acSampleBadge('') + '<p>' + acEsc(acT('mk_sample_note')) + '</p></div>';
}
