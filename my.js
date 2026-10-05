/* ============================================
   AgenticCore Estate — one dashboard for every account (Marketplace V2)
   my.html#overview | #properties | #projects | #professional | #agency
          | #company | #enquiries | #promotion | #referrals | #account
   Modules appear for what the account manages (or its signup intent);
   any account can add a professional, agency or builder profile.
   ============================================ */

// same rule as public.mv2_valid_phone() in 0018
const AC_PHONE_RE = /^\+?[0-9][0-9 ()-]{6,19}$/;
// the AgenticCore Telegram bot (accounts and listings in Telegram)
const AC_TG_BOT = 'AgenticcoreEstatebot';
const AC_MODULES = ['overview', 'properties', 'projects', 'professional', 'agency', 'company', 'enquiries', 'promotion', 'referrals', 'account'];

(function () {
  const root = document.getElementById('myRoot');
  if (!root) return;
  const main = document.getElementById('myMain');
  const nav = document.getElementById('myNav');
  let user = null, ov = null, cities = [];

  const t = acT;
  const esc = acEsc;
  function msg(el, text, ok) { el.textContent = text || ''; el.className = 'my-msg' + (ok ? ' ok' : text ? ' err' : ''); }

  function visible() {
    const role = user.role;
    return {
      overview: true, properties: true, enquiries: true, promotion: true, referrals: true, account: true,
      // capabilities, not the signup role, decide what an account can do; the role only
      // pre-opens the module the person signed up for
      projects: role === 'developer' || ov.capability !== 'none' || ov.projects.length > 0,
      professional: role === 'professional' || ov.professionals.length > 0,
      agency: role === 'agency' || ov.agencies.length > 0,
      company: role === 'builder' || ov.companies.length > 0
    };
  }

  function renderNav(active) {
    const v = visible();
    if (AC_MODULES.indexOf(active) >= 0) v[active] = true;   // opened from "add a profile"
    nav.innerHTML = AC_MODULES.filter(function (m) { return v[m]; }).map(function (m) {
      const badge = m === 'enquiries' && ov.newEnquiries ? ' <span class="my-count">' + ov.newEnquiries + '</span>' : '';
      return '<li><a href="#' + m + '"' + (m === active ? ' class="active" aria-current="page"' : '') + '>' + esc(t('my_nav_' + m)) + badge + '</a></li>';
    }).join('') + '<li><a href="index.html">' + esc(t('my_back_site')) + '</a></li><li><a href="#" id="myLogout">' + esc(t('nav_logout')) + '</a></li>';
    document.getElementById('myLogout').addEventListener('click', async function (e) { e.preventDefault(); await AcDB.logOut(); location.href = 'index.html'; });
  }

  // ---------- generic profile form ----------
  function checks(name, opts, values) {
    return '<div class="my-checks">' + opts.map(function (o) {
      return '<label><input type="checkbox" name="' + name + '" value="' + esc(o[0]) + '"' + ((values || []).indexOf(o[0]) >= 0 ? ' checked' : '') + '> ' + esc(o[1]) + '</label>';
    }).join('') + '</div>';
  }
  function field(f, v) {
    const id = 'mf_' + f.k, label = '<label for="' + id + '">' + esc(t(f.l || 'my_f_' + f.k)) + (f.req ? ' *' : '') + '</label>';
    const hint = f.h ? '<span class="my-hint">' + esc(t(f.h)) + '</span>' : '';
    const val = v[f.k];
    let input = '';
    if (f.type === 'textarea') input = '<textarea id="' + id + '" name="' + f.k + '" rows="' + (f.rows || 3) + '" maxlength="' + (f.max || 3000) + '">' + esc(val || '') + '</textarea>';
    else if (f.type === 'checks') return '<fieldset class="my-field"><legend>' + esc(t(f.l || 'my_f_' + f.k)) + '</legend>' + checks(f.k, f.opts(), val) + hint + '</fieldset>';
    else if (f.type === 'tags') input = '<input id="' + id + '" name="' + f.k + '" type="text" value="' + esc((val || []).join(', ')) + '" data-tags="1">';
    else if (f.type === 'bool') return '<div class="my-field"><label class="my-bool"><input type="checkbox" name="' + f.k + '" data-bool="1"' + (val ? ' checked' : '') + '> ' + esc(t(f.l || 'my_f_' + f.k)) + '</label>' + hint + '</div>';
    else if (f.type === 'select') input = '<select id="' + id + '" name="' + f.k + '">' + f.opts().map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    else if (f.type === 'image') input = (acMediaUrl(val) ? '<img class="my-thumb" src="' + acMediaUrl(val) + '" alt="">' : '') + '<input id="' + id + '" type="file" accept="image/jpeg,image/png,image/webp" data-image="' + f.k + '">';
    else input = '<input id="' + id + '" name="' + f.k + '" type="' + (f.type || 'text') + '"' + (f.type === 'number' ? ' min="0" inputmode="numeric"' : '') +
      (f.type === 'tel' ? ' inputmode="tel" autocomplete="off" placeholder="+92 51 1234567"' : '') +
      (f.type === 'url' ? ' placeholder="https://"' : '') + ' maxlength="' + (f.max || 300) + '" value="' + esc(val == null ? '' : val) + '"' + (f.req ? ' required' : '') + '>';
    return '<div class="my-field' + (f.wide ? ' wide' : '') + '">' + label + input + hint + '</div>';
  }
  const cityOpts = function () { return cities.map(function (c) { return [c, (typeof acCityLabel === 'function' ? acCityLabel(c, acUiLang()) : c)]; }); };
  const segOpts = function () { return [['residential', t('mk_seg_residential')], ['commercial', t('mk_seg_commercial')]]; };
  const purpOpts = function () { return [['sale', t('mk_purpose_sale')], ['rent', t('mk_purpose_rent')]]; };
  const typeOpts = function () { return AC_PROPERTY_TYPES.map(function (p) { return [p.value, acPropertyTypeLabel(p.value)]; }); };
  const svcOpts = function () { return ['residential_construction', 'commercial_construction', 'grey_structure', 'turnkey', 'renovation', 'architecture_design', 'interiors', 'project_development', 'other'].map(function (s) { return [s, acServiceText(s)]; }); };
  const LINKS = [{ k: 'website_url', type: 'url' }, { k: 'facebook_url', type: 'url' }, { k: 'instagram_url', type: 'url' }, { k: 'youtube_url', type: 'url' }];
  const FIELDS = {
    professional: [
      { k: 'display_name', req: true, max: 120 }, { k: 'avatar_url', type: 'image', h: 'my_h_avatar' },
      { k: 'avatar_kind', type: 'select', opts: function () { return [['photo', t('my_av_photo')], ['avatar', t('my_av_avatar')], ['logo', t('my_av_logo')], ['none', t('my_av_none')]]; } },
      { k: 'headline', max: 160, h: 'my_h_headline', wide: true },
      { k: 'intro', type: 'textarea', l: 'mk_q_what', wide: true, h: 'my_h_intro' }, { k: 'why_contact', type: 'textarea', l: 'mk_q_why', max: 1500, wide: true },
      { k: 'how_i_work', type: 'textarea', l: 'mk_q_how', max: 1500, wide: true },
      { k: 'cities', type: 'checks', opts: cityOpts }, { k: 'areas_served', type: 'tags', h: 'my_h_tags' },
      { k: 'segments', type: 'checks', opts: segOpts }, { k: 'purposes', type: 'checks', opts: purpOpts },
      { k: 'property_types', type: 'checks', opts: typeOpts, wide: true },
      { k: 'services', type: 'tags', h: 'my_h_tags' }, { k: 'languages', type: 'tags', h: 'my_h_tags' },
      { k: 'overseas_clients', type: 'bool' }, { k: 'years_experience', type: 'number', h: 'my_h_selfrep' },
      { k: 'commission_info', l: 'mk_q_commission', max: 500, h: 'my_h_optional', wide: true }, { k: 'special_offer', l: 'mk_q_offer', max: 500, h: 'my_h_optional', wide: true },
      { k: 'deal_history', type: 'textarea', l: 'mk_q_history', max: 1500, h: 'my_h_selfrep', wide: true }
    ].concat(LINKS),
    agency: [
      { k: 'name', req: true, max: 120 }, { k: 'logo_url', type: 'image' }, { k: 'cover_url', type: 'image', h: 'my_h_optional' },
      { k: 'description', type: 'textarea', l: 'mk_about', wide: true }, { k: 'office_address', max: 300, wide: true },
      { k: 'city', type: 'select', opts: function () { return [['', '—']].concat(cityOpts()); } }, { k: 'cities', type: 'checks', opts: cityOpts },
      { k: 'areas_served', type: 'tags', h: 'my_h_tags' }, { k: 'services', type: 'tags', h: 'my_h_tags' },
      { k: 'segments', type: 'checks', opts: segOpts }, { k: 'purposes', type: 'checks', opts: purpOpts }
    ].concat(LINKS),
    company: [
      { k: 'name', req: true, max: 120 }, { k: 'logo_url', type: 'image' },
      { k: 'description', type: 'textarea', l: 'mk_about', wide: true },
      { k: 'services', type: 'checks', opts: svcOpts, wide: true }, { k: 'cities', type: 'checks', opts: cityOpts },
      { k: 'areas_served', type: 'tags', h: 'my_h_tags' }, { k: 'years_experience', type: 'number', h: 'my_h_companyprov' },
      { k: 'completed_projects', type: 'textarea', l: 'mk_completed', max: 2000, wide: true },
      { k: 'current_projects', type: 'textarea', l: 'mk_current', max: 2000, wide: true },
      { k: 'payment_terms', type: 'textarea', l: 'mk_payment_terms', max: 1500, wide: true }
    ].concat(LINKS)
  };

  const PHONE = { k: 'public_phone', type: 'tel', l: 'my_f_public_phone', h: 'my_h_public_phone', max: 24 };
  Object.keys(FIELDS).forEach(function (k) { FIELDS[k].splice(1, 0, PHONE); });

  function readForm(form, kind) {
    const v = {};
    FIELDS[kind].forEach(function (f) {
      if (f.type === 'image') return;
      if (f.type === 'checks') { v[f.k] = Array.from(form.querySelectorAll('input[name="' + f.k + '"]:checked')).map(function (i) { return i.value; }); return; }
      const el = form.querySelector('[name="' + f.k + '"]');
      if (!el) return;
      if (f.type === 'bool') v[f.k] = el.checked;
      else if (f.type === 'tags') v[f.k] = el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 20);
      else if (f.type === 'number') v[f.k] = el.value === '' ? null : Number(el.value);
      else v[f.k] = el.value.trim() || null;
    });
    return v;
  }

  function profileForm(kind, entity) {
    const values = Object.assign({}, entity || {}, { public_phone: entity ? (ov.phones[kind + ':' + entity.id] || '') : '' });
    return '<form class="my-form" id="myForm" novalidate><div class="my-grid">' + FIELDS[kind].map(function (f) { return field(f, values); }).join('') + '</div>' +
      '<div class="my-actions"><button type="submit" class="btn btn-primary">' + esc(t(entity ? 'my_save' : 'my_create')) + '</button>' +
      (entity ? '<a class="btn btn-secondary" href="' + ({ professional: 'professional.html', agency: 'agency.html', company: 'builder.html' }[kind]) + '?id=' + encodeURIComponent(entity.id) + '">' + esc(t('my_view_public')) + '</a>' : '') +
      '</div><p class="my-msg" role="status"></p></form>';
  }

  function wireProfileForm(kind, entity) {
    const form = document.getElementById('myForm');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const status = form.querySelector('.my-msg');
      const v = readForm(form, kind);
      const nameKey = kind === 'professional' ? 'display_name' : 'name';
      if (!v[nameKey] || v[nameKey].length < 2) { msg(status, t('my_err_name')); return; }
      const badUrl = ['website_url', 'facebook_url', 'instagram_url', 'youtube_url'].find(function (k) { return v[k] && !/^https:\/\/\S+$/.test(v[k]); });
      if (badUrl) { msg(status, t('my_err_url')); return; }
      const phone = v.public_phone; delete v.public_phone;
      if (phone && !AC_PHONE_RE.test(phone)) { msg(status, t('my_err_phone')); return; }
      form.querySelector('button[type="submit"]').disabled = true;
      msg(status, t('my_saving'), true);
      for (const inp of form.querySelectorAll('input[data-image]')) {
        if (inp.files && inp.files[0]) {
          const up = await AcMine.uploadImage(user.id, inp.files[0], kind + '-' + inp.getAttribute('data-image').replace('_url', ''));
          if (up.error) { msg(status, up.error); form.querySelector('button[type="submit"]').disabled = false; return; }
          v[inp.getAttribute('data-image')] = up.url;
        }
      }
      const res = await AcMine.saveEntity(kind, entity && entity.id, user.id, v);
      if (!res.error && (phone || '') !== ((entity && ov.phones[kind + ':' + entity.id]) || '')) {
        const ph = await AcMine.setEntityPhone(kind, res.entity.id, phone);
        if (ph.error) res.error = ph.error;
      }
      form.querySelector('button[type="submit"]').disabled = false;
      if (res.error) { msg(status, res.error); return; }
      ov = await AcMine.overview(user.id);
      history.replaceState(null, '', '#' + kind + '?id=' + encodeURIComponent(res.entity.id));
      route(null, t('my_saved'));
    });
  }

  // ---------- modules ----------
  function header(title, sub) {
    return '<div class="dash-header"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p class="my-sub">' + esc(sub) + '</p>' : '') + '</div></div>';
  }
  // 30% early benefit: the database decides (my_early_status); this only explains it.
  function earlyHTML() {
    const e = ov.early || { status: 'none' };
    const d = function (x) { return x ? new Date(x).toLocaleDateString() : ''; };
    const fine = '<p class="mk-fine">' + esc(t('my_early_rule')) + '</p><p class="mk-fine">' + esc(t('mk_launch3_fine')) + '</p>';
    if (e.status === 'qualified') return '<div class="panel my-early ok"><h3>' + esc(t('my_early_yes_h')) + '</h3><p>' + esc(t('my_early_yes').replace('{date}', d(e.qualified_at))) + '</p>' + fine + '</div>';
    if (e.status === 'pending') return '<div class="panel my-early"><h3>' + esc(t('mk_launch3t')) + '</h3><p>' + esc(t('my_early_pending').replace('{date}', d(e.qualifies_on))) + '</p>' + fine + '</div>';
    if (e.status === 'revoked') return '<div class="panel my-early"><h3>' + esc(t('mk_launch3t')) + '</h3><p>' + esc(t('my_early_revoked')) + '</p></div>';
    if (e.status === 'closed') return '<div class="panel my-early"><h3>' + esc(t('mk_launch3t')) + '</h3><p>' + esc(t('my_early_closed')) + '</p></div>';
    return '<div class="panel my-early"><h3>' + esc(t('mk_launch3t')) + '</h3><p>' + esc(t('my_early_no')) + '</p>' + fine + '</div>';
  }

  const R = {};
  R.overview = function (flash) {
    const v = visible();
    const tiles = [
      ['properties', ov.listingCount], ['projects', ov.projects.length], ['professional', ov.professionals.length],
      ['agency', ov.agencies.length], ['company', ov.companies.length], ['enquiries', ov.newEnquiries]
    ].filter(function (x) { return v[x[0]]; });
    main.innerHTML = header(t('my_welcome').replace('{name}', user.full_name), t('my_overview_sub')) + (flash ? '<p class="my-flash">' + esc(flash) + '</p>' : '') +
      '<div class="stat-grid">' + tiles.map(function (x) { return '<a class="stat-card my-stat" href="#' + x[0] + '"><span class="stat-label">' + esc(t('my_nav_' + x[0])) + '</span><div class="stat-value">' + x[1] + '</div></a>'; }).join('') + '</div>' +
      '<div id="myNext"></div>' + earlyHTML() +
      '<div class="panel"><h3>' + esc(t('my_add_h')) + '</h3><p class="my-sub">' + esc(t('my_add_sub')) + '</p><div class="my-add">' +
        '<a class="btn btn-secondary btn-sm" href="sell.html">' + esc(t('mk_cta_properties')) + '</a>' +
        (ov.professionals.length ? '' : '<a class="btn btn-secondary btn-sm" href="#professional">' + esc(t('mk_cta_professionals')) + '</a>') +
        (ov.agencies.length ? '' : '<a class="btn btn-secondary btn-sm" href="#agency">' + esc(t('mk_cta_agencies')) + '</a>') +
        (ov.companies.length ? '' : '<a class="btn btn-secondary btn-sm" href="#company">' + esc(t('mk_cta_builders')) + '</a>') +
        '<a class="btn btn-secondary btn-sm" href="#projects">' + esc(t('mk_cta_projects')) + '</a>' +
      '</div></div>' + '<div class="panel">' + acEcosystemHTML('compact') + '</div>';
    renderNextActions();
  };

  // ---------- next best actions (rule-based, at most 4) ----------
  // Ordered by usefulness; each rule looks only at the account's own data.
  // Profile completeness: the essentials a visitor needs to decide whether to get
  // in touch. Only reports what is missing — never fills anything in.
  const has = function (v) { return Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim().length > 0; };
  const COMPLETE = {
    professional: [['my_f_display_name', function (e) { return has(e.display_name); }], ['my_f_avatar_url', function (e) { return has(e.avatar_url); }],
      ['my_f_headline', function (e) { return has(e.headline); }], ['pc_areas', function (e) { return has(e.cities) || has(e.areas_served); }],
      ['my_f_services', function (e) { return has(e.services); }], ['my_f_languages', function (e) { return has(e.languages); }],
      ['pc_intro', function (e) { return String(e.intro || '').trim().length >= 40; }], ['my_f_public_phone', function (e, ph) { return has(ph); }]],
    agency: [['my_f_name', function (e) { return has(e.name); }], ['my_f_logo_url', function (e) { return has(e.logo_url); }],
      ['pc_about', function (e) { return String(e.description || '').trim().length >= 40; }], ['pc_areas', function (e) { return has(e.city) || has(e.cities) || has(e.areas_served); }],
      ['my_f_services', function (e) { return has(e.services); }], ['my_f_public_phone', function (e, ph) { return has(ph); }]],
    company: [['my_f_name', function (e) { return has(e.name); }], ['my_f_logo_url', function (e) { return has(e.logo_url); }],
      ['pc_about', function (e) { return String(e.description || '').trim().length >= 40; }], ['my_f_services', function (e) { return has(e.services); }],
      ['pc_areas', function (e) { return has(e.cities) || has(e.areas_served); }], ['my_f_public_phone', function (e, ph) { return has(ph); }]]
  };
  function completenessHTML(kind, entity) {
    if (!entity || !COMPLETE[kind]) return '';
    const ph = ov.phones[kind + ':' + entity.id];
    const missing = COMPLETE[kind].filter(function (c) { return !c[1](entity, ph); }).map(function (c) { return t(c[0]); });
    const total = COMPLETE[kind].length, done = total - missing.length;
    return '<div class="my-complete' + (missing.length ? '' : ' done') + '"><p><strong>' + esc(t('pc_score').replace('{done}', done).replace('{total}', total)) + '</strong> ' +
      (missing.length ? esc(t('pc_missing')) + ' ' + esc(missing.join(', ')) : esc(t('pc_all_done'))) + '</p>' +
      '<progress max="' + total + '" value="' + done + '" aria-label="' + esc(t('pc_score').replace('{done}', done).replace('{total}', total)) + '"></progress></div>';
  }
  // incomplete = an essential other than the public number is missing (that has its own action)
  function incomplete(kind, e) { return COMPLETE[kind].some(function (c) { return c[0] !== 'my_f_public_phone' && !c[1](e); }); }
  // Rule-based, owner-only. Every rule that applies is collected with a priority,
  // then the four most important are shown:
  // 1 safety/moderation · 2 unanswered enquiries · 3 missing public contact ·
  // 4 incomplete profile · 5 weak listing · 6 confirm availability · 7 share ·
  // 8 related marketplace profile · 9 promote with AgenticCore Pakistan · 10 more content
  async function nextActions() {
    const out = [];
    const add = function (prio, key, vars, href, btnKey, opts) {
      let text = t(key);
      Object.keys(vars || {}).forEach(function (k) { text = text.replace('{' + k + '}', vars[k]); });
      out.push({ prio: prio, text: text, href: href, btn: t(btnKey), action: key, external: opts && opts.external });
    };
    const listings = ov.listingCount ? await AcDB.getListingsByOwner(user.id) : [];
    const pro = ov.professionals[0], ag = ov.agencies[0], co = ov.companies[0];
    const hasPresence = listings.length || pro || ag || co || ov.projects.length;
    if (ov.newEnquiries) add(2, 'na_enquiries', { n: ov.newEnquiries }, '#enquiries', 'na_btn_open');
    if (!hasPresence) {
      const first = { professional: ['na_first_professional', '#professional'], agency: ['na_first_agency', '#agency'],
        builder: ['na_first_builder', '#company'], developer: ['na_first_project', '#projects'] }[user.role] || ['na_first_property', 'sell.html'];
      add(4, first[0], {}, first[1], 'na_btn_start');
      return out.sort(function (a, b) { return a.prio - b.prio; }).slice(0, 4);
    }
    // 1 — something of yours is hidden by moderation
    const hidden = [[pro, '#professional'], [ag, '#agency'], [co, '#company']]
      .concat(ov.projects.map(function (p) { return [p, '#projects']; }), listings.map(function (l) { return [l, '#properties']; }))
      .filter(function (h) { return h[0] && h[0].moderation_status === 'hidden'; })[0];
    if (hidden) add(1, 'na_hidden', { name: hidden[0].title || hidden[0].name || hidden[0].display_name || '' }, hidden[1], 'na_btn_open');
    if (listings.length) {
      // 3 — buyers cannot call: no account number and no linked profile number
      const callable = listings.some(function (l) { return l.contact_phone || (l.professional_id && ov.phones['professional:' + l.professional_id]) || (l.agency_id && ov.phones['agency:' + l.agency_id]); });
      if (!user.public_phone && !callable) add(3, 'na_phone_account', {}, '#account', 'na_btn_edit');
      if (window.AcListingQuality) {
        const weakest = listings.map(function (l) { return { l: l, q: AcListingQuality.score(l).score }; }).sort(function (a, b) { return a.q - b.q; })[0];
        if (weakest.q < 80) add(5, 'na_improve_listing', { title: weakest.l.title, score: weakest.q }, 'listing.html?id=' + encodeURIComponent(weakest.l.id) + '#quality', 'na_btn_improve');
      }
      const stale = typeof acIsFresh === 'function' ? listings.filter(function (l) { return Object.prototype.hasOwnProperty.call(l, 'last_confirmed_at') && !acIsFresh(l); })[0] : null;
      if (stale) add(6, 'na_confirm', { title: stale.title }, 'toolkit.html?id=' + encodeURIComponent(stale.id), 'na_btn_confirm');
      const newest = listings[0];
      add(7, 'na_share_listing', { title: newest.title }, 'toolkit.html?id=' + encodeURIComponent(newest.id), 'na_btn_toolkit');
      add(9, 'na_promote_listing', { title: newest.title }, acPkUrl('promote', 'property', newest.id, ''), 'na_btn_pk', { external: true });
    }
    if (pro) {
      if (!ov.phones['professional:' + pro.id]) add(3, 'na_phone', { name: pro.display_name }, '#professional', 'na_btn_edit');
      if (incomplete('professional', pro)) add(4, 'na_complete_professional', {}, '#professional', 'na_btn_edit');
      else add(7, 'na_share_profile', { name: pro.display_name }, 'professional.html?id=' + encodeURIComponent(pro.id), 'na_btn_view');
    }
    if (ag) {
      if (!ov.phones['agency:' + ag.id]) add(3, 'na_phone', { name: ag.name }, '#agency', 'na_btn_edit');
      if (incomplete('agency', ag)) add(4, 'na_complete_agency', { name: ag.name }, '#agency', 'na_btn_edit');
      else add(8, 'na_team', { name: ag.name }, '#agency', 'na_btn_open');
    }
    if (co) {
      if (!ov.phones['company:' + co.id]) add(3, 'na_phone', { name: co.name }, '#company', 'na_btn_edit');
      if (incomplete('company', co)) add(4, 'na_complete_company', { name: co.name }, '#company', 'na_btn_edit');
      const rates = await AcMine.rates(co.id);
      if (!rates.length) add(4, 'na_rates', { name: co.name }, '#company', 'na_btn_edit');
      if (ov.capability === 'none' || ov.capability === 'rejected') add(10, 'na_apply_projects', {}, 'developer-apply.html', 'na_btn_apply');
    }
    // 8 — the profile that matches the account type, if it is still missing
    const related = { professional: [!pro, 'na_first_professional', '#professional'], agency: [!ag, 'na_first_agency', '#agency'],
      builder: [!co, 'na_first_builder', '#company'] }[user.role];
    if (related && related[0]) add(8, related[1], {}, related[2], 'na_btn_start');
    if (ov.capability === 'approved') {
      if (!ov.projects.length) add(10, 'na_add_project', {}, 'post-project.html', 'na_btn_start');
      else add(9, 'na_promote_project', { title: ov.projects[0].title }, acPkPathwayUrl(AC_PK_PATHWAYS.project[0], 'project', ov.projects[0].id), 'na_btn_pk', { external: true });
    }
    // stable sort: equal priorities keep the order above
    return out.map(function (a, i) { a.i = i; return a; }).sort(function (a, b) { return a.prio - b.prio || a.i - b.i; }).slice(0, 4);
  }
  async function renderNextActions() {
    const slot = document.getElementById('myNext');
    if (!slot) return;
    const items = await nextActions();
    if (!items.length || !document.body.contains(slot)) return;
    slot.innerHTML = '<div class="panel my-next"><h3>' + esc(t('na_h')) + '</h3><ul class="my-next-list">' + items.map(function (a) {
      return '<li><span>' + esc(a.text) + '</span><a class="btn btn-secondary btn-sm" href="' + esc(a.href) + '"' + (a.external ? ' rel="noopener"' : '') +
        ' data-track="next_action_click" data-action="' + esc(a.action) + '">' + esc(a.btn) + '</a></li>';
    }).join('') + '</ul></div>';
  }

  R.properties = function () {
    main.innerHTML = header(t('my_nav_properties'), t('my_props_sub')) +
      '<p><a class="btn btn-primary btn-sm" href="sell.html">+ ' + esc(t('mk_cta_properties')) + '</a></p>' +
      '<div class="panel" style="overflow-x:auto"><table class="data-table"><thead><tr><th>' + esc(t('my_th_title')) + '</th><th>' + esc(t('my_th_type')) + '</th><th>' + esc(t('my_th_price')) + '</th><th>' + esc(t('my_th_status')) + '</th><th>' + esc(t('my_th_quality')) + '</th><th></th></tr></thead><tbody id="myListings"></tbody></table></div>';
    acWireMyListings(document.getElementById('myListings'), user.id);
  };

  R.projects = async function () {
    // Any account can apply; only an approved project-publisher capability can add projects.
    if (ov.capability !== 'approved') {
      const st = ov.capability;   // none / pending / rejected / revoked
      const canApply = st === 'none' || st === 'rejected';
      main.innerHTML = header(t('my_nav_projects'), '') + '<div class="panel"><p>' + esc(t('my_proj_cap_' + st)) + '</p>' +
        (canApply ? '<a class="btn btn-primary btn-sm" href="developer-apply.html">' + esc(t('mk_apply_projects')) + '</a>' : '') +
        (st === 'pending' ? '<a class="btn btn-secondary btn-sm" href="developer-pending.html">' + esc(t('my_proj_status')) + '</a>' : '') +
        '</div>' + (ov.projects.length ? '<div class="panel"><h3>' + esc(t('my_proj_existing')) + '</h3><ul class="my-list">' + ov.projects.map(function (p) {
          return '<li><a href="project.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.title) + '</a></li>'; }).join('') + '</ul></div>' : '');
      return;
    }
    const reps = await Promise.all(ov.projects.map(function (p) { return AcMine.representationsForProject(p.id); }));
    main.innerHTML = header(t('my_nav_projects'), t('my_proj_sub')) +
      '<p><a class="btn btn-primary btn-sm" href="post-project.html">+ ' + esc(t('mk_cta_projects')) + '</a></p>' +
      (ov.projects.length ? ov.projects.map(function (p, i) {
        return '<div class="panel my-item"><div class="my-item-head"><h3>' + esc(p.title) + '</h3><span class="mk-chip">' + esc(acProjectStatusText(p.status)) + '</span>' + (p.moderation_status === 'hidden' ? '<span class="badge badge-pending">' + esc(t('my_hidden')) + '</span>' : '') + '</div>' +
          '<p class="my-sub">' + esc(p.area) + ', ' + esc(p.city) + '</p>' +
          '<p class="my-row-actions"><a class="btn btn-secondary btn-sm" href="project.html?id=' + encodeURIComponent(p.id) + '">' + esc(t('my_view_public')) + '</a> <a class="btn btn-secondary btn-sm" href="post-project.html?edit=' + encodeURIComponent(p.id) + '">' + esc(t('my_edit')) + '</a></p>' +
          '<h4>' + esc(t('mk_represented_by')) + '</h4><p class="my-sub">' + esc(t('my_rep_explain')) + '</p><ul class="my-list">' + (reps[i].map(function (r) { return '<li>' + esc(r.agency ? r.agency.name : '') + ' — ' + esc(t('my_st_' + r.status)) + '</li>'; }).join('') || '<li class="my-sub">' + esc(t('my_none')) + '</li>') + '</ul>' +
          '<form class="my-inline" data-rep="' + esc(p.id) + '"><input type="search" placeholder="' + esc(t('my_search_agency')) + '" aria-label="' + esc(t('my_search_agency')) + '"><div class="my-results"></div></form></div>';
      }).join('') : '<div class="panel"><p class="my-sub">' + esc(t('mk_empty_projects')) + '</p></div>');
    main.querySelectorAll('form[data-rep]').forEach(function (f) {
      wireSearch(f, AcMine.searchAgencies, function (a) { return a.name + (a.city ? ' · ' + a.city : ''); }, async function (a) {
        const r = await AcMine.requestRepresentation(f.getAttribute('data-rep'), a.id);
        if (r.error) alert(r.error); else route('projects', t('my_request_sent'));
      });
    });
  };

  function wireSearch(form, search, label, pick) {
    const input = form.querySelector('input'), box = form.querySelector('.my-results');
    let timer = null;
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(async function () {
        const rows = await search(input.value);
        box.innerHTML = rows.map(function (r, i) { return '<button type="button" class="btn btn-secondary btn-sm" data-i="' + i + '">' + esc(label(r)) + ' +</button>'; }).join('') ||
          (input.value.trim().length >= 2 ? '<span class="my-sub">' + esc(t('my_no_results')) + '</span>' : '');
        box.querySelectorAll('[data-i]').forEach(function (b) { b.addEventListener('click', function () { pick(rows[Number(b.getAttribute('data-i'))]); }); });
      }, 300);
    });
  }

  async function entityModule(kind, flash) {
    const list = { professional: ov.professionals, agency: ov.agencies, company: ov.companies }[kind];
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const wantsNew = params.get('new') && list.length < ov.limits[kind];
    const entity = wantsNew ? null : (list.find(function (e) { return e.id === params.get('id'); }) || list[0] || null);
    let extra = '';
    if (entity && kind === 'professional') {
      const mem = await AcMine.membershipsForProfessional(entity.id);
      extra = '<div class="panel"><h3>' + esc(t('my_agency_link_h')) + '</h3><p class="my-sub">' + esc(t('my_agency_link_sub')) + '</p><ul class="my-list">' +
        (mem.map(function (m) {
          const acts = m.status === 'pending' && m.requested_by === 'agency'
            ? '<button class="btn btn-primary btn-sm" data-mem="' + esc(m.id) + '" data-d="active">' + esc(t('my_accept')) + '</button> <button class="btn btn-secondary btn-sm" data-mem="' + esc(m.id) + '" data-d="declined">' + esc(t('my_decline')) + '</button>'
            : '<button class="btn btn-secondary btn-sm" data-mem="' + esc(m.id) + '" data-d="removed">' + esc(t(m.status === 'active' ? 'my_leave' : 'my_cancel')) + '</button>';
          return '<li><span>' + esc(m.agency ? m.agency.name : '') + ' — ' + esc(t('my_st_' + m.status)) + '</span> ' + acts + '</li>';
        }).join('') || '<li class="my-sub">' + esc(t('my_none')) + '</li>') + '</ul>' +
        '<form class="my-inline" id="myJoin"><input type="search" placeholder="' + esc(t('my_search_agency')) + '" aria-label="' + esc(t('my_search_agency')) + '"><div class="my-results"></div></form></div>';
    }
    if (entity && kind === 'agency') {
      const [team, reps] = await Promise.all([AcMine.membershipsForAgency(entity.id), AcMine.representationsForAgency(entity.id)]);
      extra = '<div class="panel"><h3>' + esc(t('mk_team')) + '</h3><p class="my-sub">' + esc(t('my_team_sub')) + '</p><ul class="my-list">' +
        (team.map(function (m) {
          const acts = m.status === 'pending' && m.requested_by === 'professional'
            ? '<button class="btn btn-primary btn-sm" data-mem="' + esc(m.id) + '" data-d="active">' + esc(t('my_accept')) + '</button> <button class="btn btn-secondary btn-sm" data-mem="' + esc(m.id) + '" data-d="declined">' + esc(t('my_decline')) + '</button>'
            : '<button class="btn btn-secondary btn-sm" data-mem="' + esc(m.id) + '" data-d="removed">' + esc(t('my_remove')) + '</button>';
          return '<li><span>' + esc(m.professional ? m.professional.display_name : '') + ' — ' + esc(t('my_st_' + m.status)) + '</span> ' + acts + '</li>';
        }).join('') || '<li class="my-sub">' + esc(t('my_none')) + '</li>') + '</ul>' +
        '<form class="my-inline" id="myInvite"><input type="search" placeholder="' + esc(t('my_search_professional')) + '" aria-label="' + esc(t('my_search_professional')) + '"><div class="my-results"></div></form></div>' +
        '<div class="panel"><h3>' + esc(t('mk_projects_represented')) + '</h3><ul class="my-list">' +
        (reps.map(function (r) {
          const acts = r.status === 'pending' ? '<button class="btn btn-primary btn-sm" data-rep-id="' + esc(r.id) + '" data-d="active">' + esc(t('my_accept')) + '</button> <button class="btn btn-secondary btn-sm" data-rep-id="' + esc(r.id) + '" data-d="declined">' + esc(t('my_decline')) + '</button>'
            : '<button class="btn btn-secondary btn-sm" data-rep-id="' + esc(r.id) + '" data-d="removed">' + esc(t('my_remove')) + '</button>';
          return '<li><span>' + esc(r.project ? r.project.title : '') + ' — ' + esc(t('my_st_' + r.status)) + '</span> ' + acts + '</li>';
        }).join('') || '<li class="my-sub">' + esc(t('my_none')) + '</li>') + '</ul></div>';
    }
    if (entity && kind === 'company') {
      const rates = await AcMine.rates(entity.id);
      extra = '<div class="panel"><h3>' + esc(t('mk_rates_h')) + '</h3><p class="my-sub">' + esc(t('mk_rates_disclaimer')) + '</p><ul class="my-list">' +
        (rates.map(function (r) {
          return '<li><span>' + esc(acServiceText(r.service)) + ': Rs ' + esc(r.rate_min || '') + (r.rate_max ? '–' + esc(r.rate_max) : '') + ' ' + esc(acUnitText(r.unit)) + ' · ' + esc(t('mk_rate_updated')) + ' ' + esc(r.updated_on) + '</span> <button class="btn btn-secondary btn-sm" data-rate="' + esc(r.id) + '">' + esc(t('my_remove')) + '</button></li>';
        }).join('') || '<li class="my-sub">' + esc(t('my_none')) + '</li>') + '</ul>' +
        '<form class="my-form" id="myRate" novalidate><div class="my-grid">' +
          '<div class="my-field"><label for="rs">' + esc(t('mk_f_service')) + '</label><select id="rs">' + ['grey_structure', 'turnkey', 'renovation', 'commercial_construction', 'architecture_design', 'interiors', 'other'].map(function (s) { return '<option value="' + s + '">' + esc(acServiceText(s)) + '</option>'; }).join('') + '</select></div>' +
          '<div class="my-field"><label for="ru">' + esc(t('my_f_unit')) + '</label><select id="ru">' + ['per_sqft', 'per_marla', 'per_kanal', 'lump_sum'].map(function (u) { return '<option value="' + u + '">' + esc(acUnitText(u)) + '</option>'; }).join('') + '</select></div>' +
          '<div class="my-field"><label for="rmin">' + esc(t('my_f_rate_min')) + '</label><input id="rmin" type="number" min="1" inputmode="numeric"></div>' +
          '<div class="my-field"><label for="rmax">' + esc(t('my_f_rate_max')) + '</label><input id="rmax" type="number" min="1" inputmode="numeric"></div>' +
          '<div class="my-field wide"><label for="rinc">' + esc(t('mk_rate_includes')) + '</label><input id="rinc" type="text" maxlength="1000"></div>' +
          '<div class="my-field"><label for="rdate">' + esc(t('mk_rate_updated')) + '</label><input id="rdate" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
        '</div><button type="submit" class="btn btn-secondary btn-sm">' + esc(t('my_add_rate')) + '</button><p class="my-msg" role="status"></p></form></div>';
    }
    const others = list.length > 1 ? '<p class="my-sub">' + list.map(function (e) { return '<a href="#' + kind + '?id=' + encodeURIComponent(e.id) + '">' + esc(e.display_name || e.name) + '</a>'; }).join(' · ') + '</p>' : '';
    main.innerHTML = header(t('my_nav_' + kind), t('my_' + kind + '_sub')) + (flash ? '<p class="my-flash">' + esc(flash) + '</p>' : '') + others +
      (entity && entity.moderation_status === 'hidden' ? '<p class="badge badge-pending">' + esc(t('my_hidden_note')) + '</p>' : '') +
      completenessHTML(kind, entity) +
      '<div class="panel">' + profileForm(kind, entity) + '</div>' + extra +
      (entity && list.length < ov.limits[kind] ? '<p><a class="my-link" href="#' + kind + '?new=1">+ ' + esc(t('my_add_another')) + '</a></p>'
        : entity ? '<p class="my-sub">' + esc(t(kind === 'professional' ? 'my_limit_professional' : 'my_limit_business').replace('{n}', ov.limits[kind])) + '</p>' : '');
    wireProfileForm(kind, entity);
    main.querySelectorAll('[data-mem]').forEach(function (b) {
      b.addEventListener('click', async function () { b.disabled = true; const r = await AcMine.decideMembership(b.getAttribute('data-mem'), b.getAttribute('data-d')); if (r.error) alert(r.error); route(kind); });
    });
    main.querySelectorAll('[data-rep-id]').forEach(function (b) {
      b.addEventListener('click', async function () { b.disabled = true; const r = await AcMine.decideRepresentation(b.getAttribute('data-rep-id'), b.getAttribute('data-d')); if (r.error) alert(r.error); route(kind); });
    });
    main.querySelectorAll('[data-rate]').forEach(function (b) {
      b.addEventListener('click', async function () { b.disabled = true; const r = await AcMine.deleteRate(b.getAttribute('data-rate')); if (r.error) alert(r.error); route(kind); });
    });
    const join = document.getElementById('myJoin');
    if (join) wireSearch(join, AcMine.searchAgencies, function (a) { return a.name + (a.city ? ' · ' + a.city : ''); }, async function (a) {
      const r = await AcMine.requestMembership(entity.id, a.id); if (r.error) alert(r.error); else route(kind, t('my_request_sent'));
    });
    const invite = document.getElementById('myInvite');
    if (invite) wireSearch(invite, AcMine.searchProfessionals, function (p) { return p.display_name + (p.headline ? ' · ' + p.headline : ''); }, async function (p) {
      const r = await AcMine.requestMembership(p.id, entity.id); if (r.error) alert(r.error); else route(kind, t('my_request_sent'));
    });
    const rateForm = document.getElementById('myRate');
    if (rateForm) rateForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const status = rateForm.querySelector('.my-msg');
      const rmin = Number(document.getElementById('rmin').value) || null, rmax = Number(document.getElementById('rmax').value) || null;
      if (!rmin && !rmax) { msg(status, t('my_err_rate')); return; }
      const r = await AcMine.addRate(entity.id, { service: document.getElementById('rs').value, unit: document.getElementById('ru').value, rate_min: rmin, rate_max: rmax,
        includes: document.getElementById('rinc').value.trim(), updated_on: document.getElementById('rdate').value });
      if (r.error) msg(status, r.error); else route(kind, t('my_saved'));
    });
  }
  R.professional = function (f) { return entityModule('professional', f); };
  R.agency = function (f) { return entityModule('agency', f); };
  R.company = function (f) { return entityModule('company', f); };

  R.enquiries = async function () {
    const [inbox, sent] = await Promise.all([AcMine.enquiries(user.id, 'received'), AcMine.enquiries(user.id, 'sent')]);
    const PAGE = { listing: 'listing.html', project: 'project.html', professional: 'professional.html', agency: 'agency.html', company: 'builder.html' };
    function item(e, mine) {
      const title = esc(e.target_title || '');
      const link = PAGE[e.target_type] && e.target_id ? '<a href="' + PAGE[e.target_type] + '?id=' + encodeURIComponent(e.target_id) + '">' + title + '</a>' : title;
      const status = mine ? '' : ' <span class="my-enq-status s-' + esc(e.status) + '">' + esc(t('my_enq_s_' + e.status)) + '</span>';
      return '<li class="my-enq' + (e.status === 'new' && !mine ? ' new' : '') + '"><div><strong>' + link + '</strong>' + status + ' <span class="my-sub">· ' + esc(t('my_cat_' + e.target_type)) + ' · ' + new Date(e.created_at).toLocaleString() + '</span></div>' +
        (mine ? '' : '<div class="my-sub">' + esc(e.sender_name || '') + (e.sender_phone ? ' · <a href="tel:' + esc(e.sender_phone) + '">' + esc(e.sender_phone) + '</a>' : '') + '</div>') +
        '<p class="mk-pre">' + esc(e.message) + '</p>' +
        (mine ? '' : '<p>' + (e.status === 'new' ? '<button class="btn btn-secondary btn-sm" data-enq="' + esc(e.id) + '" data-s="read">' + esc(t('my_mark_read')) + '</button> ' : '') + '<button class="btn btn-secondary btn-sm" data-enq="' + esc(e.id) + '" data-s="archived">' + esc(t('my_archive')) + '</button></p>') + '</li>';
    }
    main.innerHTML = header(t('my_nav_enquiries'), t('my_enq_sub')) +
      '<div class="panel"><h3>' + esc(t('my_enq_received')) + '</h3><ul class="my-list">' + (inbox.map(function (e) { return item(e, false); }).join('') || '<li class="my-sub">' + esc(t('my_none')) + '</li>') + '</ul></div>' +
      '<div class="panel"><h3>' + esc(t('my_enq_sent')) + '</h3><ul class="my-list">' + (sent.map(function (e) { return item(e, true); }).join('') || '<li class="my-sub">' + esc(t('my_none')) + '</li>') + '</ul></div>';
    main.querySelectorAll('[data-enq]').forEach(function (b) {
      b.addEventListener('click', async function () { b.disabled = true; await AcMine.setEnquiryStatus(b.getAttribute('data-enq'), b.getAttribute('data-s')); ov = await AcMine.overview(user.id); route('enquiries'); });
    });
  };

  R.promotion = async function () {
    const listings = await AcDB.getListingsByOwner(user.id);
    const ent = [];
    ov.projects.forEach(function (p) { ent.push(['project', p.id, p.title]); });
    ov.professionals.forEach(function (p) { ent.push(['professional', p.id, p.display_name]); });
    ov.agencies.forEach(function (a) { ent.push(['agency', a.id, a.name]); });
    ov.companies.forEach(function (c) { ent.push(['builder', c.id, c.name]); });
    main.innerHTML = header(t('my_nav_promotion'), t('my_promo_sub')) +
      '<div class="panel"><h3>' + esc(t('my_promo_listings')) + '</h3><p class="my-sub">' + esc(t('my_promo_listings_sub')) + '</p><ul class="my-list">' +
        (listings.map(function (l) {
          return '<li><span>' + esc(l.title) + '</span> <a class="btn btn-primary btn-sm" rel="noopener" href="' + acPkUrl('promote', 'property', l.id, '') + '" data-track="promote_property_click" data-intent="promote" data-entity="property">' + esc(t('mk_promote_pk')) + '</a> <a class="btn btn-secondary btn-sm" href="toolkit.html?id=' + encodeURIComponent(l.id) + '">' + esc(t('lq_toolkit')) + '</a></li>';
        }).join('') || '<li class="my-sub">' + esc(t('mk_empty_properties')) + ' <a href="sell.html">' + esc(t('mk_cta_properties')) + '</a></li>') + '</ul></div>' +
      ent.map(function (e) {
        return '<div class="my-promo-entity"><h3 class="my-promo-name">' + esc(e[2]) + ' <small>' + esc(t('eco_type_' + e[0])) + '</small></h3>' + acPkPathwaysHTML(e[0], e[1]) + '</div>';
      }).join('') +
      (ent.length ? '' : '<div class="panel"><h3>' + esc(t('my_promo_profiles')) + '</h3><p class="my-sub">' + esc(t('my_promo_profiles_sub')) + '</p><a class="btn btn-secondary btn-sm" rel="noopener" href="' + acPkUrl('services', null, null, 'services.html') + '" data-track="estate_to_pk_click" data-intent="services">' + esc(t('h2_eco_pk_cta')) + '</a></div>') +
      '<p class="mk-fine">' + esc(t('mk_eco_fine')) + '</p>';
  };

  R.referrals = function () {
    const link = location.origin + '/signup.html?ref=' + encodeURIComponent(user.referral_code || '');
    main.innerHTML = header(t('my_nav_referrals'), '') + '<div class="panel"><p>' + esc(t('my_ref_sub')) + '</p><p class="my-sub">' + esc(t('my_ref_code')) + ': <strong>' + esc(user.referral_code) + '</strong> · ' + esc(t('my_points')) + ': <strong>' + esc(user.points) + '</strong></p>' +
      '<p class="my-inline"><input type="text" readonly value="' + esc(link) + '" aria-label="' + esc(t('my_ref_link')) + '" style="min-width:0;flex:1"> <button type="button" class="btn btn-secondary btn-sm" id="myRefCopy">' + esc(t('share_copy')) + '</button></p>' +
      '<a class="btn btn-primary btn-sm" href="referral-dashboard.html">' + esc(t('my_ref_open')) + '</a></div>';
    document.getElementById('myRefCopy').addEventListener('click', async function (e) {
      try { await navigator.clipboard.writeText(link); e.target.textContent = t('share_copied'); } catch (err) { /* select manually */ }
    });
  };
  R.account = function () {
    const needsPassword = user.created_via === 'telegram' && !user.password_set_at;
    main.innerHTML = header(t('my_nav_account'), '') +
      (needsPassword ? '<div class="panel"><h3>' + esc(t('pw_set_h')) + '</h3><p class="my-sub">' + esc(t('pw_set_sub')) + '</p><a class="btn btn-primary btn-sm" href="set-password.html">' + esc(t('pw_set_btn')) + '</a></div>' : '') +
      '<div class="panel"><dl class="mk-facts">' +
      (user.member_no ? '<div class="mk-fact"><dt>' + esc(t('my_f_member')) + '</dt><dd><strong>AC-' + esc(user.member_no) + '</strong></dd></div>' : '') +
      '<div class="mk-fact"><dt>' + esc(t('my_f_name')) + '</dt><dd>' + esc(user.full_name) + '</dd></div>' +
      '<div class="mk-fact"><dt>' + esc(t('my_f_email')) + '</dt><dd>' + esc(user.email || '') + '</dd></div>' +
      '<div class="mk-fact"><dt>' + esc(t('my_f_phone')) + '</dt><dd>' + esc(/^[0-9a-f-]{36}$/.test(user.phone) ? '—' : user.phone) + ' <span class="my-hint">' + esc(t('my_h_login_phone')) + '</span></dd></div>' +
      '<div class="mk-fact"><dt>' + esc(t('my_f_intent')) + '</dt><dd>' + esc(t('my_role_' + user.role)) + '</dd></div>' +
      '</dl><p class="my-sub">' + esc(t('my_account_note')) + '</p></div>' +
      '<div class="panel"><h3>' + esc(t('my_pub_phone_h')) + '</h3><p class="my-sub">' + esc(t('my_pub_phone_sub')) + '</p>' +
        '<form class="my-inline" id="myPubPhone" novalidate><label for="myPubPhoneIn" class="sr-only">' + esc(t('my_f_public_phone')) + '</label>' +
        '<input id="myPubPhoneIn" type="tel" inputmode="tel" autocomplete="off" maxlength="24" placeholder="+92 3XX XXXXXXX" value="' + esc(user.public_phone || '') + '">' +
        '<button type="submit" class="btn btn-secondary btn-sm">' + esc(t('my_save')) + '</button><p class="my-msg" role="status"></p></form></div>' +
      '<div class="panel" id="myTg" hidden><h3>' + esc(t('tg_h')) + '</h3><p class="my-sub">' + esc(t('tg_sub')) + '</p><div id="myTgBody"></div><p class="my-msg" role="status" id="myTgMsg"></p></div>' + earlyHTML();
    renderTelegram();
    document.getElementById('myPubPhone').addEventListener('submit', async function (e) {
      e.preventDefault();
      const status = e.target.querySelector('.my-msg');
      const v = document.getElementById('myPubPhoneIn').value.trim();
      if (v && !AC_PHONE_RE.test(v)) { msg(status, t('my_err_phone')); return; }
      const r = await AcMine.setProfilePhone(user.id, v);
      if (r.error) { msg(status, r.error); return; }
      user.public_phone = v || null;
      msg(status, t('my_saved'), true);
    });
  };

  // Telegram: connect with a one-time code (the bot never asks for a password)
  async function renderTelegram() {
    const box = document.getElementById('myTg');
    if (!box) return;
    const r = await supabaseClient.rpc('my_telegram_link');
    if (r.error) return;                       // bot not set up yet: keep the panel hidden
    box.hidden = false;
    const body = document.getElementById('myTgBody');
    const link = (r.data || [])[0];
    if (link) {
      body.innerHTML = '<p>' + esc(t('tg_connected')) + (link.tg_username ? ' (@' + esc(link.tg_username) + ')' : '') + '</p>' +
        '<p class="my-inline"><a class="btn btn-primary btn-sm" href="https://t.me/' + AC_TG_BOT + '" target="_blank" rel="noopener">' + esc(t('tg_open')) + '</a> ' +
        '<button type="button" class="btn btn-secondary btn-sm" id="myTgUnlink">' + esc(t('tg_unlink')) + '</button></p>';
      document.getElementById('myTgUnlink').addEventListener('click', async function () {
        const u = await supabaseClient.rpc('unlink_telegram');
        if (u.error) { msg(document.getElementById('myTgMsg'), t('tg_err')); return; }
        renderTelegram();
      });
    } else {
      body.innerHTML = '<button type="button" class="btn btn-primary btn-sm" id="myTgConnect">' + esc(t('tg_connect')) + '</button>';
      document.getElementById('myTgConnect').addEventListener('click', async function (e) {
        e.target.disabled = true;
        const tok = await supabaseClient.rpc('create_telegram_link_token');
        if (tok.error || !tok.data) { e.target.disabled = false; msg(document.getElementById('myTgMsg'), t('tg_err')); return; }
        if (typeof acTrack === 'function') acTrack('contact_click', { channel: 'telegram_connect' });
        location.href = 'https://t.me/' + AC_TG_BOT + '?start=link_' + encodeURIComponent(tok.data);
      });
    }
  }

  async function route(forced, flash) {
    let m = forced || (location.hash.replace('#', '').split('?')[0] || 'overview');
    if (AC_MODULES.indexOf(m) < 0) m = 'overview';
    if (forced && location.hash.split('?')[0] !== '#' + forced) history.replaceState(null, '', '#' + forced);
    renderNav(m);
    main.innerHTML = '<div class="mk-loading">' + esc(t('mk_loading')) + '</div>';
    await R[m](flash);
    main.focus({ preventScroll: true });
  }

  (async function () {
    user = await requireAuth();
    if (!user) return;
    if (user.role === 'admin' && !location.hash) { location.replace('admin-dashboard.html'); return; }
    [ov, cities] = await Promise.all([AcMine.overview(user.id), AcDB.getActiveCities()]);
    // signup intent → straight to the matching module the first time
    const intent = new URLSearchParams(location.search).get('welcome');
    if (intent && !location.hash) history.replaceState(null, '', location.pathname + '#' + ({ professional: 'professional', agency: 'agency', builder: 'company' }[intent] || 'overview'));
    window.addEventListener('hashchange', function () { route(); });
    window.acOnLanguageChange = function () { route(); };
    route();
  })();
})();
