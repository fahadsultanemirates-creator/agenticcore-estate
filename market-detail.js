/* ============================================
   AgenticCore Estate — marketplace detail pages
   project.html · professional.html · agency.html · builder.html
   <body data-entity="project|professional|agency|company">
   ============================================ */

(function () {
  const root = document.getElementById('mkDetail');
  if (!root) return;
  const entity = document.body.getAttribute('data-entity');
  const id = new URLSearchParams(location.search).get('id') || '';
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const loaders = { project: AcMarket.getProject, professional: AcMarket.getProfessional, agency: AcMarket.getAgency, company: AcMarket.getCompany };
  const back = { project: 'projects.html', professional: 'professionals.html', agency: 'agencies.html', company: 'builders.html' };
  let item = null, settings = {}, canonical = '';

  function fact(label, value) {
    return value ? '<div class="mk-fact"><dt>' + acEsc(acT(label)) + '</dt><dd>' + value + '</dd></div>' : '';
  }
  function section(label, text) {
    return text ? '<section class="mk-section"><h2>' + acEsc(acT(label)) + '</h2><p class="mk-pre">' + acEsc(text) + '</p></section>' : '';
  }
  function list(arr, map) { return (arr || []).length ? acEsc(arr.map(map || function (x) { return x; }).join(', ')) : ''; }
  function links(o) {
    const out = [['website_url', 'mk_website'], ['facebook_url', 'Facebook'], ['instagram_url', 'Instagram'], ['youtube_url', 'YouTube']]
      .filter(function (k) { return acMediaUrl(o[k[0]]) && /^https:/.test(o[k[0]]); })
      .map(function (k) { return '<a href="' + acMediaUrl(o[k[0]]) + '" target="_blank" rel="noopener nofollow">' + acEsc(k[1].indexOf('mk_') === 0 ? acT(k[1]) : k[1]) + '</a>'; });
    return out.length ? '<p class="mk-links">' + out.join(' · ') + '</p>' : '';
  }
  function row(title, cat, items) {
    if (!items || !items.length) return '';
    return '<section class="mk-section"><h2>' + acEsc(acT(title)) + '</h2><div class="hscroll-row mk-row">' +
      items.map(function (it) { return AC_MARKET_CARD[cat](it, settings); }).join('') + '</div></section>';
  }
  function badges(o) {
    return '<p class="mk-badges">' + (o.is_sample ? acSampleBadge(entity === 'project' ? 'listing' : 'profile') : '') + acVerifiedBadge(o) + acPromoBadge(o, settings) + '</p>';
  }

  function headerHTML(title, sub, mediaHTML) {
    return '<div class="mk-detail-head">' + mediaHTML + '<div><h1>' + acEsc(title) + '</h1>' + (sub ? '<p class="mk-sub">' + sub + '</p>' : '') + badges(item) + '</div></div>';
  }

  function render() {
    const o = item;
    let main = '', head = '';
    if (entity === 'project') {
      const photo = acMediaUrl((o.photos || [])[0]);
      head = (photo ? '<div class="mk-hero"><img src="' + photo + '" alt="" decoding="async" width="1280" height="853"></div>' : '') +
        headerHTML(o.title, acEsc(o.area) + ', ' + acEsc(o.city), '');
      main = '<dl class="mk-facts">' +
          fact('mk_f_status', acEsc(acProjectStatusText(o.status))) +
          fact('mk_f_type', acEsc(acProjectTypeText(o.project_type))) +
          fact('mk_f_developer', o.company ? '<a href="builder.html?id=' + encodeURIComponent(o.company.id) + '">' + acEsc(o.company.name) + '</a>' : '') +
          fact('mk_f_units', list(o.unit_types, acTypeLabel)) +
          fact('mk_f_price', acPriceRange(o.price_from, o.price_to)) +
          fact('mk_f_size', acEsc(acSizeRange(o.size_from, o.size_to, o.size_unit))) +
          fact('mk_f_payment', acEsc(o.payment_plan || '')) +
          fact('mk_f_possession', acEsc(o.possession_date || '')) +
          fact('mk_f_total_units', o.total_units ? String(o.total_units) : '') +
        '</dl>' +
        section('mk_about', o.description) +
        (o.approvals_info ? '<section class="mk-section"><h2>' + acEsc(acT('mk_approvals')) + '</h2><p class="mk-pre">' + acEsc(o.approvals_info) + '</p><p class="mk-fine">' + acEsc(acT('mk_approvals_fine')) + '</p></section>' : '') +
        ((o.photos || []).length > 1 ? '<section class="mk-section"><h2>' + acEsc(acT('mk_gallery')) + '</h2><div class="mk-gallery">' + o.photos.slice(1).map(function (u) { return acMediaUrl(u) ? '<img src="' + acMediaUrl(u) + '" alt="" loading="lazy">' : ''; }).join('') + '</div></section>' : '') +
        (acMediaUrl(o.brochure_path) ? '<p><a class="btn btn-secondary btn-sm" href="' + acMediaUrl(o.brochure_path) + '" target="_blank" rel="noopener">' + acEsc(acT('mk_brochure')) + '</a></p>' : '') +
        (o.agencies.length ? '<section class="mk-section"><h2>' + acEsc(acT('mk_represented_by')) + '</h2><p class="mk-chips">' + o.agencies.map(function (a) { return '<a class="mk-chip" href="agency.html?id=' + encodeURIComponent(a.id) + '">' + acEsc(a.name) + '</a>'; }).join('') + '</p></section>' : '') +
        row('mk_units_available', 'properties', o.units);
    } else if (entity === 'professional') {
      head = headerHTML(o.display_name, acEsc(o.headline || ''), acAvatarHTML(o.avatar_url, o.display_name, 120));
      main = '<dl class="mk-facts">' +
          fact('mk_f_areas', list(o.areas_served)) + fact('mk_f_cities', list(o.cities)) +
          fact('mk_f_focus', list((o.segments || []).map(acSegmentText).concat((o.purposes || []).map(acPurposeText)))) +
          fact('mk_f_types', list(o.property_types, acTypeLabel)) +
          fact('mk_f_services', list(o.services)) + fact('mk_f_languages', list(o.languages)) +
          fact('mk_f_experience', o.years_experience != null ? acEsc(acT('mk_years').replace('{n}', o.years_experience)) + ' <span class="mk-self">(' + acEsc(acT('mk_self_reported')) + ')</span>' : '') +
          fact('mk_f_overseas', o.overseas_clients ? acEsc(acT('mk_yes')) : '') +
          fact('mk_f_agency', o.agencies.map(function (a) { return '<a href="agency.html?id=' + encodeURIComponent(a.id) + '">' + acEsc(a.name) + '</a>'; }).join(', ')) +
        '</dl>' +
        section('mk_q_what', o.intro) + section('mk_q_why', o.why_contact) + section('mk_q_how', o.how_i_work) +
        section('mk_q_commission', o.commission_info) + section('mk_q_offer', o.special_offer) +
        (o.deal_history ? '<section class="mk-section"><h2>' + acEsc(acT('mk_q_history')) + '</h2><p class="mk-pre">' + acEsc(o.deal_history) + '</p><p class="mk-fine">' + acEsc(acT('mk_self_reported_fine')) + '</p></section>' : '') +
        links(o) + row('mk_active_listings', 'properties', o.listings);
    } else if (entity === 'agency') {
      head = (acMediaUrl(o.cover_url) ? '<div class="mk-hero"><img src="' + acMediaUrl(o.cover_url) + '" alt="" decoding="async"></div>' : '') +
        headerHTML(o.name, acEsc([o.city].concat(o.cities || []).filter(function (c, i, a) { return c && a.indexOf(c) === i; }).join(' · ')),
          '<div class="mk-detail-logo">' + acLogoBox(o.logo_url, o.name, AC_ICONS.agency) + '</div>');
      main = '<dl class="mk-facts">' +
          fact('mk_f_office', acEsc(o.office_address || '')) + fact('mk_f_areas', list(o.areas_served)) +
          fact('mk_f_focus', list((o.segments || []).map(acSegmentText).concat((o.purposes || []).map(acPurposeText)))) +
          fact('mk_f_services', list(o.services)) +
        '</dl>' + section('mk_about', o.description) + links(o) +
        row('mk_team', 'professionals', o.team) + row('mk_active_listings', 'properties', o.listings) + row('mk_projects_represented', 'projects', o.projects);
    } else if (entity === 'company') {
      head = headerHTML(o.name, acEsc((o.cities || []).join(' · ')), '<div class="mk-detail-logo">' + acLogoBox(o.logo_url, o.name, AC_ICONS.crane) + '</div>');
      const rates = (o.company_rates || []).slice().sort(function (a, b) { return (a.rate_min || 0) - (b.rate_min || 0); });
      main = '<dl class="mk-facts">' +
          fact('mk_f_services', list(o.services, acServiceText)) +
          fact('mk_f_experience', o.years_experience != null ? acEsc(acT('mk_years').replace('{n}', o.years_experience)) + ' <span class="mk-self">(' + acEsc(acT('mk_company_provided')) + ')</span>' : '') +
          fact('mk_f_areas', list(o.areas_served)) +
        '</dl>' + section('mk_about', o.description) +
        (rates.length ? '<section class="mk-section"><h2>' + acEsc(acT('mk_rates_h')) + '</h2><div class="mk-rates">' + rates.map(function (r) {
          return '<div class="mk-rate-card"><h3>' + acEsc(acServiceText(r.service)) + '</h3><p class="mk-price small">' +
            (r.rate_min ? 'Rs ' + Number(r.rate_min).toLocaleString('en-PK') : '') + (r.rate_max ? ' – ' + Number(r.rate_max).toLocaleString('en-PK') : '') + ' <span>' + acEsc(acUnitText(r.unit)) + '</span></p>' +
            (r.includes ? '<p>' + acEsc(acT('mk_rate_includes')) + ': ' + acEsc(r.includes) + '</p>' : '') +
            '<p class="mk-fine">' + acEsc(acT('mk_rate_updated')) + ' ' + acEsc(r.updated_on) + (o.is_sample ? ' · ' + acEsc(acT('mk_rate_illustrative')) : '') + '</p></div>';
        }).join('') + '</div><p class="mk-disclaimer">' + acEsc(acT('mk_rates_disclaimer')) + '</p></section>' : '') +
        section('mk_completed', o.completed_projects) + section('mk_current', o.current_projects) + section('mk_payment_terms', o.payment_terms) +
        ((o.portfolio || []).length ? '<section class="mk-section"><h2>' + acEsc(acT('mk_portfolio')) + '</h2><div class="mk-gallery">' + o.portfolio.map(function (u) { return acMediaUrl(u) ? '<img src="' + acMediaUrl(u) + '" alt="" loading="lazy">' : ''; }).join('') + '</div></section>' : '') +
        links(o) + row('mk_projects_by', 'projects', o.projects);
    }
    root.innerHTML = (o.is_sample ? acSampleNoticeHTML() : '') + '<div id="mkOwnerSlot"></div>' + head +
      (o.is_sample ? '' : acShareBarHTML(entity)) +
      '<div class="mk-detail-grid"><div class="mk-detail-main">' + main + '</div><aside>' + acContactBoxHTML(entity, o) + '</aside></div>' +
      '<p class="mk-back"><a href="' + back[entity] + '">← ' + acEsc(acT('mk_back_' + entity)) + '</a></p>';
    acWireContactBox(entity, o, location.pathname.split('/').pop() + location.search);
    if (!o.is_sample) acWireShareBar(root, o.title || o.display_name || o.name, canonical, entity === 'project' ? 'share_project' : 'share_profile');
    renderOwnerTools();
  }

  // Owner-only tools. Ownership comes from the signed-in session compared with
  // the row's owner_id (RLS already scopes what the browser can read); nothing
  // in the URL grants anything.
  const ecoType = { project: 'project', professional: 'professional', agency: 'agency', company: 'builder' }[entity];
  const editHref = { project: function (o) { return 'post-project.html?edit=' + encodeURIComponent(o.id); },
    professional: function () { return 'my.html#professional'; },
    agency: function (o) { return 'my.html#agency?id=' + encodeURIComponent(o.id); },
    company: function (o) { return 'my.html#company?id=' + encodeURIComponent(o.id); } }[entity];
  let viewer = null, ownPhone = null;
  function renderOwnerTools() {
    const slot = document.getElementById('mkOwnerSlot');
    if (!slot || !item || item.is_sample || !viewer || viewer.id !== item.owner_id) { if (slot) slot.innerHTML = ''; return; }
    const phoneHint = entity !== 'project' && !ownPhone
      ? '<p class="mk-fine">' + acEsc(acT('own_no_public_phone')) + ' <a href="' + editHref(item) + '">' + acEsc(acT('own_add_phone')) + '</a></p>' : '';
    slot.innerHTML = '<div class="panel mk-owner-bar"><span>' + acEsc(acT('own_this_is_yours_' + entity)) + '</span>' +
      '<span class="mk-owner-actions"><a class="btn btn-secondary btn-sm" href="' + editHref(item) + '">' + acEsc(acT('own_edit')) + '</a> ' +
      '<a class="btn btn-secondary btn-sm" href="my.html#promotion">' + acEsc(acT('my_nav_promotion')) + '</a></span>' + phoneHint + '</div>' +
      acPkPathwaysHTML(ecoType, item.id);
  }

  (async function () {
    if (!valid) { root.innerHTML = '<div class="mk-empty">' + acEsc(acT('mk_not_found')) + ' <a href="' + back[entity] + '">' + acEsc(acT('mk_back_' + entity)) + '</a></div>'; return; }
    [item, settings] = await Promise.all([loaders[entity](id), AcMarket.settings()]);
    if (!item) { root.innerHTML = '<div class="mk-empty">' + acEsc(acT('mk_not_found')) + ' <a href="' + back[entity] + '">' + acEsc(acT('mk_back_' + entity)) + '</a></div>'; return; }
    canonical = acCanonicalUrl(location.pathname.split('/').pop() || (entity + '.html'), item.id);
    acSetPageMeta({ title: item.title || item.display_name || item.name, url: canonical,
      description: item.description || item.intro || item.headline || '', noindex: item.is_sample,
      image: acMediaUrl((item.photos || [])[0] || item.logo_url || item.avatar_url || '') });
    render();
    window.acOnLanguageChange = render;
    viewer = await AcDB.currentUser();
    if (viewer && viewer.id === item.owner_id && !item.is_sample && entity !== 'project') {
      const ph = await supabaseClient.from('entity_public_phones').select('phone').eq('entity_type', entity).eq('entity_id', item.id).maybeSingle();
      ownPhone = ph.data && ph.data.phone;
    }
    renderOwnerTools();
  })();
})();
