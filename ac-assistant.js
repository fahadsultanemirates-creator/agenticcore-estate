/* AgenticCore assistants — panel (shared by agenticcore.estate and agenticcorepk.com).
   Two assistants in one panel:
     guide — AgenticCore AI Assistant: explains both sites, routes people.
     amaan — Amaan, AgenticCore Property Assistant: finds genuine listings, starts a listing.
   Everything from the server is rendered as text (textContent) — never as HTML.
   Buttons come from a fixed key list mapped to URLs here, so a reply cannot
   inject a link. The conversation lives in this tab only (sessionStorage). */
(function () {
  if (window.AcAssistant) return;

  var ESTATE = 'https://agenticcore.estate/';
  var PK = 'https://agenticcorepk.com/';
  var STORE = 'aca_v1';
  var cfg = null, panel = null, state = null, busy = false;

  // ---------- text ----------
  var T = {
    en: {
      title: 'How can AgenticCore help?', close: 'Close assistant', tab_guide: 'AgenticCore AI', tab_amaan: 'Amaan · Property',
      sub_guide: 'AgenticCore AI Assistant — an AI, not a person.', sub_amaan: 'Amaan, AgenticCore Property Assistant — an AI, not a human agent.',
      ph_guide: 'Ask anything about AgenticCore…', ph_amaan: 'e.g. 10 marla house, Rawalpindi', send: 'Send', input: 'Your message',
      human: 'Talk to a person:', wa: 'WhatsApp', email: 'Email', note: 'AI can make mistakes — check details on the listing page and with the owner.',
      thinking: 'Thinking…', err: 'I couldn\'t reach the assistant just now. Please try again, or talk to our team.', slow: 'Too many messages in a short time — please wait a few minutes.',
      reset: 'New chat', results: 'Listings', differs: 'Differs:', mine_note: 'Your conversation stays in this browser tab.',
      q: { about: 'What is AgenticCore?', amaan_find: 'Find a property with Amaan', amaan_list: 'List a property with Amaan', professional: 'Professional profile', agency: 'Agency profile', builder: 'Builders & developers', project: 'Publish a project', pk_service: 'Marketing & websites', contact: 'Talk to the team' }
    },
    ur: {
      title: 'AgenticCore آپ کی کیا مدد کرے؟', close: 'اسسٹنٹ بند کریں', tab_guide: 'AgenticCore AI', tab_amaan: 'امان · پراپرٹی',
      sub_guide: 'AgenticCore AI اسسٹنٹ — یہ AI ہے، انسان نہیں۔', sub_amaan: 'امان، AgenticCore پراپرٹی اسسٹنٹ — یہ AI ہے، انسانی ایجنٹ نہیں۔',
      ph_guide: 'AgenticCore کے بارے میں کچھ بھی پوچھیں…', ph_amaan: 'مثلاً راولپنڈی میں 10 مرلہ گھر', send: 'بھیجیں', input: 'آپ کا پیغام',
      human: 'کسی انسان سے بات کریں:', wa: 'واٹس ایپ', email: 'ای میل', note: 'AI سے غلطی ہو سکتی ہے — تفصیلات لسٹنگ پیج اور مالک سے ضرور تصدیق کریں۔',
      thinking: 'سوچ رہا ہوں…', err: 'ابھی اسسٹنٹ سے رابطہ نہیں ہو سکا۔ دوبارہ کوشش کریں یا ہماری ٹیم سے بات کریں۔', slow: 'کم وقت میں بہت زیادہ پیغامات — براہ کرم چند منٹ انتظار کریں۔',
      reset: 'نئی گفتگو', results: 'لسٹنگز', differs: 'فرق:', mine_note: 'آپ کی گفتگو صرف اسی براؤزر ٹیب میں رہتی ہے۔',
      q: { about: 'AgenticCore کیا ہے؟', amaan_find: 'امان کے ساتھ پراپرٹی ڈھونڈیں', amaan_list: 'امان کے ساتھ پراپرٹی لسٹ کریں', professional: 'پروفیشنل پروفائل', agency: 'ایجنسی پروفائل', builder: 'بلڈرز اور ڈویلپرز', project: 'پروجیکٹ شائع کریں', pk_service: 'مارکیٹنگ اور ویب سائٹ', contact: 'ٹیم سے بات کریں' }
    }
  };
  var ACTION_LABEL = {
    en: { amaan_find: 'Find with Amaan', amaan_list: 'List with Amaan', ask_guide: 'Ask AgenticCore AI', estate_home: 'AgenticCore Estate', estate_properties: 'Browse properties', estate_buy: 'Buy', estate_rent: 'Rent',
      estate_projects: 'Projects', estate_professionals: 'Professionals', estate_agencies: 'Agencies', estate_builders: 'Builders & developers', estate_list: 'Continue to the listing form', estate_pricing: 'Launch & pricing',
      estate_dashboard: 'My dashboard', estate_signup: 'Create an account', join_professional: 'Create a professional profile', join_agency: 'Add your agency', join_builder: 'Create a company profile', join_developer: 'Apply to publish projects',
      pk_home: 'AgenticCore Pakistan', pk_services: 'PK services', pk_branding: 'Branding', pk_print: 'Flyers & print', pk_websites: 'Websites', pk_video: 'Video', pk_social: 'Social media', pk_campaigns: 'Campaigns', pk_leads: 'AI & automation', pk_local: 'Google Business Profile',
      pk_logo: 'Logo & brand identity', pk_agent_branding: 'Agent branding kit', pk_brochure: 'Brochures', pk_website: 'Agency & developer websites', pk_landing: 'Landing pages', pk_photos: 'Photo enhancement', pk_launch: 'Project launch campaign',
      contact_whatsapp: 'WhatsApp our team', contact_email: 'Email our team', whatsapp_channel: 'Follow our WhatsApp Channel' },
    ur: { amaan_find: 'امان سے ڈھونڈیں', amaan_list: 'امان سے لسٹ کریں', ask_guide: 'AgenticCore AI سے پوچھیں', estate_home: 'AgenticCore Estate', estate_properties: 'پراپرٹیز دیکھیں', estate_buy: 'خریدیں', estate_rent: 'کرائے پر',
      estate_projects: 'پروجیکٹس', estate_professionals: 'پروفیشنلز', estate_agencies: 'ایجنسیاں', estate_builders: 'بلڈرز اور ڈویلپرز', estate_list: 'لسٹنگ فارم پر جائیں', estate_pricing: 'لانچ اور قیمتیں',
      estate_dashboard: 'میرا ڈیش بورڈ', estate_signup: 'اکاؤنٹ بنائیں', join_professional: 'پروفیشنل پروفائل بنائیں', join_agency: 'اپنی ایجنسی شامل کریں', join_builder: 'کمپنی پروفائل بنائیں', join_developer: 'پروجیکٹس شائع کرنے کی درخواست',
      pk_home: 'AgenticCore Pakistan', pk_services: 'PK سروسز', pk_branding: 'برانڈنگ', pk_print: 'فلائرز اور پرنٹ', pk_websites: 'ویب سائٹس', pk_video: 'ویڈیو', pk_social: 'سوشل میڈیا', pk_campaigns: 'کیمپینز', pk_leads: 'AI اور آٹومیشن', pk_local: 'گوگل بزنس پروفائل',
      pk_logo: 'لوگو اور برانڈ', pk_agent_branding: 'ایجنٹ برانڈنگ کٹ', pk_brochure: 'بروشر', pk_website: 'ایجنسی اور ڈویلپر ویب سائٹ', pk_landing: 'لینڈنگ پیجز', pk_photos: 'تصاویر بہتر بنانا', pk_launch: 'پروجیکٹ لانچ کیمپین',
      contact_whatsapp: 'ٹیم سے واٹس ایپ پر بات', contact_email: 'ٹیم کو ای میل', whatsapp_channel: 'واٹس ایپ چینل فالو کریں' }
  };
  function ui() { return document.documentElement.lang === 'ur' ? 'ur' : 'en'; }
  function t(k) { return T[ui()][k]; }

  // ---------- contact (central config of each site) ----------
  function contact() {
    // site settings are top-level consts (not window properties) — read them directly
    if (cfg.site === 'pk' && typeof PK_CONFIG !== 'undefined') {
      var ch = (PK_CONFIG.social || []).filter(function (s) { return s.key === 'whatsapp_channel'; })[0];
      return { wa: PK_CONFIG.whatsappNumber, msg: 'Hello AgenticCore Pakistan, I would like to discuss a service.', email: PK_CONFIG.email, channel: ch && ch.url };
    }
    if (typeof AC_CONTACT !== 'undefined') {
      var c = AC_CONTACT.social.filter(function (s) { return s.key === 'whatsapp_channel'; })[0];
      return { wa: AC_CONTACT.whatsapp, msg: AC_CONTACT.whatsappMessage, email: AC_CONTACT.email, channel: c && c.url };
    }
    return {};
  }

  // ---------- action keys → URLs (the only links an assistant can produce) ----------
  var EST = { estate_home: ['', 'browse'], estate_properties: ['properties.html', 'browse'], estate_buy: ['buy.html', 'browse'], estate_rent: ['rent.html', 'browse'],
    estate_projects: ['projects.html', 'browse'], estate_professionals: ['professionals.html', 'browse'], estate_agencies: ['agencies.html', 'browse'], estate_builders: ['builders.html', 'browse'],
    estate_list: ['sell.html', 'list'], estate_pricing: ['pricing.html', 'browse'], estate_dashboard: ['my.html', 'view'], estate_signup: ['signup.html', 'list'],
    join_professional: ['signup.html', 'profile', 'professional'], join_agency: ['signup.html', 'agency', 'agency'], join_builder: ['signup.html', 'builder', 'builder'], join_developer: ['signup.html', 'project', 'developer'] };
  // AgenticCore Pakistan Catalogue V2 service numbers and section anchors
  var PKP = { pk_home: '', pk_services: 'services.html', pk_branding: 'services.html#service-14', pk_print: 'services.html#service-3', pk_websites: 'services.html#service-16',
    pk_video: 'services.html#service-7', pk_social: 'services.html#property-marketing', pk_campaigns: 'services.html#service-21', pk_leads: 'services.html#ai-automation', pk_local: 'services.html#service-18',
    pk_logo: 'services.html#service-14', pk_agent_branding: 'services.html#service-13', pk_brochure: 'services.html#service-27', pk_website: 'services.html#service-16',
    pk_landing: 'services.html#service-12', pk_photos: 'services.html#service-4', pk_launch: 'services.html#service-40' };
  function hrefFor(key) {
    var c = contact();
    if (key === 'contact_whatsapp') return c.wa ? 'https://wa.me/' + c.wa + '?text=' + encodeURIComponent(c.msg) : null;
    if (key === 'contact_email') return c.email ? 'mailto:' + c.email + '?subject=' + encodeURIComponent(cfg.site === 'pk' ? 'AgenticCore Pakistan enquiry' : 'AgenticCore Estate enquiry') : null;
    if (key === 'whatsapp_channel') return c.channel || null;
    if (EST[key]) {
      var e = EST[key], path = e[0];
      if (cfg.site === 'estate') return (path || 'index.html') + (e[2] ? '?intent=' + e[2] : '');
      // PK → Estate: allow-listed context only (docs/ECOSYSTEM_CONTRACT.md)
      return ESTATE + path + '?from=pk&intent=' + e[1];
    }
    if (Object.prototype.hasOwnProperty.call(PKP, key)) {
      var p = PKP[key];
      if (cfg.site === 'pk') return p || 'index.html';
      var hash = p.indexOf('#') >= 0 ? p.slice(p.indexOf('#')) : '';
      return PK + p.replace(/#.*$/, '') + '?from=estate&intent=services' + hash;
    }
    return null;
  }
  function external(href) { return /^(https?:|mailto:)/.test(href) && href.indexOf(cfg.site === 'pk' ? PK : ESTATE) !== 0; }

  // ---------- state ----------
  function fresh() { return { bot: 'guide', convs: { guide: { messages: [], lang: null }, amaan: { messages: [], lang: null, mode: null, asked: null, notes: [] } } }; }
  function loadState() {
    try { var s = JSON.parse(sessionStorage.getItem(STORE) || 'null'); if (s && s.convs && s.convs.guide && s.convs.amaan) return s; } catch (e) { /* private mode */ }
    return fresh();
  }
  function save() { try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  function track(ev, props) {
    try {
      if (cfg.site === 'pk' && typeof pkTrack === 'function') pkTrack(ev, 'assistant', props || null);
      else if (typeof acTrack === 'function') acTrack(ev, props || {});
    } catch (e) { /* analytics never breaks the panel */ }
  }

  // ---------- DOM helpers ----------
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function build() {
    panel = el('div', 'aca-panel');
    panel.id = 'acaPanel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'acaTitle');
    panel.hidden = true;
    panel.innerHTML =
      '<div class="aca-head"><h2 id="acaTitle" class="aca-title"></h2>' +
        '<button type="button" class="aca-reset" id="acaReset"></button>' +
        '<button type="button" class="aca-close" id="acaClose"><span aria-hidden="true">×</span></button></div>' +
      '<div class="aca-tabs" role="tablist"><button type="button" role="tab" id="acaTabGuide" data-bot="guide"></button><button type="button" role="tab" id="acaTabAmaan" data-bot="amaan"></button></div>' +
      '<p class="aca-sub" id="acaSub"></p>' +
      '<div class="aca-log" id="acaLog" role="log" aria-live="polite" aria-relevant="additions" tabindex="0"></div>' +
      '<div class="aca-quick" id="acaQuick"></div>' +
      '<form class="aca-form" id="acaForm" novalidate><label for="acaInput" class="aca-sr" id="acaInputLabel"></label>' +
        '<textarea id="acaInput" rows="1" maxlength="600" autocomplete="off"></textarea>' +
        '<button type="submit" class="aca-send" id="acaSend"></button></form>' +
      '<div class="aca-foot"><span id="acaHuman"></span> <a id="acaWa" target="_blank" rel="noopener noreferrer"></a> <a id="acaMail"></a>' +
        '<p class="aca-note" id="acaNote"></p></div>';
    document.body.appendChild(panel);
    panel.querySelector('#acaClose').addEventListener('click', close);
    panel.querySelector('#acaReset').addEventListener('click', function () { state.convs[state.bot] = fresh().convs[state.bot]; save(); render(); greet(); });
    panel.querySelectorAll('[role="tab"]').forEach(function (b) { b.addEventListener('click', function () { switchBot(b.getAttribute('data-bot')); }); });
    panel.querySelector('#acaForm').addEventListener('submit', function (e) { e.preventDefault(); var i = panel.querySelector('#acaInput'); var v = i.value.trim(); if (v) { i.value = ''; send(v, null); } });
    panel.querySelector('#acaInput').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); panel.querySelector('#acaForm').requestSubmit(); } });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    panel.querySelector('#acaWa').addEventListener('click', function () { track('assistant_handoff_whatsapp', { bot: state.bot }); });
    panel.querySelector('#acaMail').addEventListener('click', function () { track('assistant_handoff_email', { bot: state.bot }); });
    new MutationObserver(function () { if (!panel.hidden) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  function chrome() {
    panel.setAttribute('dir', ui() === 'ur' ? 'rtl' : 'ltr');
    panel.querySelector('#acaTitle').textContent = t('title');
    panel.querySelector('#acaClose').setAttribute('aria-label', t('close'));
    var reset = panel.querySelector('#acaReset'); reset.textContent = t('reset');
    var tg = panel.querySelector('#acaTabGuide'), ta = panel.querySelector('#acaTabAmaan');
    tg.textContent = t('tab_guide'); ta.textContent = t('tab_amaan');
    tg.setAttribute('aria-selected', state.bot === 'guide' ? 'true' : 'false'); ta.setAttribute('aria-selected', state.bot === 'amaan' ? 'true' : 'false');
    tg.tabIndex = state.bot === 'guide' ? 0 : -1; ta.tabIndex = state.bot === 'amaan' ? 0 : -1;
    panel.querySelector('#acaSub').textContent = t(state.bot === 'amaan' ? 'sub_amaan' : 'sub_guide');
    var input = panel.querySelector('#acaInput'); input.placeholder = t(state.bot === 'amaan' ? 'ph_amaan' : 'ph_guide');
    panel.querySelector('#acaInputLabel').textContent = t('input');
    panel.querySelector('#acaSend').textContent = t('send');
    panel.querySelector('#acaHuman').textContent = t('human');
    var wa = panel.querySelector('#acaWa'), mail = panel.querySelector('#acaMail');
    var hw = hrefFor('contact_whatsapp'), hm = hrefFor('contact_email');
    wa.hidden = !hw; if (hw) { wa.href = hw; wa.textContent = t('wa'); }
    mail.hidden = !hm; if (hm) { mail.href = hm; mail.textContent = t('email'); }
    panel.querySelector('#acaNote').textContent = t('note') + ' ' + t('mine_note');
  }

  function bubble(m) {
    var wrap = el('div', 'aca-msg aca-' + m.role);
    var b = el('div', 'aca-bubble'); b.textContent = m.text;
    if (m.role === 'assistant' && m.lang === 'ur') b.setAttribute('dir', 'rtl'); else if (m.role === 'assistant') b.setAttribute('dir', 'ltr');
    if (m.role === 'user') b.setAttribute('dir', 'auto');
    wrap.appendChild(b);
    if (m.listings && m.listings.length) wrap.appendChild(cards(m.listings));
    if (m.actions && m.actions.length) {
      var row = el('div', 'aca-actions');
      m.actions.forEach(function (k) { var n = actionEl(k, m); if (n) row.appendChild(n); });
      if (row.childNodes.length) wrap.appendChild(row);
    }
    return wrap;
  }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function cards(list) {
    var box = el('div', 'aca-cards'); box.setAttribute('aria-label', t('results'));
    list.slice(0, 6).forEach(function (x) {
      if (!UUID.test(String(x.id || ''))) return;
      var a = el('a', 'aca-card');
      a.href = (cfg.site === 'estate' ? '' : ESTATE) + 'listing.html?id=' + encodeURIComponent(x.id) + (cfg.site === 'pk' ? '&from=pk&intent=view' : '');
      a.appendChild(el('strong', null, x.title || ''));
      a.appendChild(el('span', 'aca-card-price', [x.price_text, x.size_text].filter(Boolean).join(' · ')));
      a.appendChild(el('span', 'aca-card-where', [x.area, x.city].filter(Boolean).join(', ') + (x.beds ? ' · ' + x.beds + ' bed' : '')));
      if (x.differences && x.differences.length) a.appendChild(el('span', 'aca-card-diff', t('differs') + ' ' + x.differences.join('; ')));
      a.addEventListener('click', function () { track('assistant_action', { bot: 'amaan', action: 'open_listing' }); });
      box.appendChild(a);
    });
    return box;
  }
  function actionEl(key, m) {
    if (key === 'amaan_find' || key === 'amaan_list' || key === 'ask_guide') {
      var b = el('button', 'aca-act', ACTION_LABEL[ui()][key]); b.type = 'button';
      b.addEventListener('click', function () { track('assistant_action', { bot: state.bot, action: key }); if (key === 'ask_guide') switchBot('guide'); else { switchBot('amaan', true); send(null, key); } });
      return b;
    }
    var href = hrefFor(key);
    if (!href) return null;
    var a = el('a', 'aca-act', ACTION_LABEL[ui()][key] || key);
    a.href = href;
    if (external(href) && href.indexOf('mailto:') !== 0) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.addEventListener('click', function (e) {
      track(key === 'contact_whatsapp' ? 'assistant_handoff_whatsapp' : key === 'contact_email' ? 'assistant_handoff_email' : 'assistant_action', { bot: state.bot, action: key });
      // Amaan's listing notes go to the listing form through this browser only (never the URL).
      if (key === 'estate_list' && m && m.ready && cfg.site === 'estate') {
        e.preventDefault();
        try { localStorage.setItem('ac_amaan_listing', JSON.stringify({ notes: state.convs.amaan.notes.slice(-8), at: Date.now() })); } catch (err) { /* form still opens */ }
        track('amaan_list_review', { bot: 'amaan' });
        location.href = 'sell.html?assist=1&amaan=1';
      }
    });
    return a;
  }
  function quick() {
    var q = panel.querySelector('#acaQuick'); q.innerHTML = '';
    var conv = state.convs[state.bot];
    if (conv.messages.some(function (m) { return m.role === 'user'; })) return;
    var keys = state.bot === 'amaan' ? ['amaan_find', 'amaan_list', 'contact'] : ['about', 'amaan_find', 'amaan_list', 'professional', 'agency', 'builder', 'project', 'pk_service', 'contact'];
    keys.forEach(function (k) {
      var b = el('button', 'aca-chip', T[ui()].q[k]); b.type = 'button';
      b.addEventListener('click', function () {
        track('assistant_action', { bot: state.bot, action: k });
        if (k === 'amaan_find' || k === 'amaan_list') { switchBot('amaan', true); send(null, k); } else send(null, k);
      });
      q.appendChild(b);
    });
  }
  function render() {
    chrome();
    var log = panel.querySelector('#acaLog'); log.innerHTML = '';
    state.convs[state.bot].messages.forEach(function (m) { log.appendChild(bubble(m)); });
    quick();
    log.scrollTop = log.scrollHeight;
  }

  // ---------- conversation ----------
  function greet() {
    var conv = state.convs[state.bot];
    if (conv.messages.length) return;
    send(null, null, true);
  }
  // noGreet: a quick action follows immediately, so don't send a greeting first
  function switchBot(bot, noGreet) {
    state.bot = bot === 'amaan' ? 'amaan' : 'guide'; save(); render(); if (!noGreet) greet();
    panel.querySelector(state.bot === 'amaan' ? '#acaTabAmaan' : '#acaTabGuide').focus();
  }
  function send(text, quickKey, silent) {
    if (busy) return;
    var bot = state.bot, conv = state.convs[bot];
    if (text) { conv.messages.push({ role: 'user', text: text.slice(0, 600) }); track('assistant_question', { bot: bot, lang: ui() }); }
    if (quickKey === 'amaan_find') track('amaan_find_started', { bot: 'amaan' });
    if (quickKey === 'amaan_list') track('amaan_list_started', { bot: 'amaan' });
    save(); render();
    var log = panel.querySelector('#acaLog');
    var wait = el('div', 'aca-msg aca-assistant aca-wait'); wait.appendChild(el('div', 'aca-bubble', t('thinking'))); log.appendChild(wait); log.scrollTop = log.scrollHeight;
    busy = true; panel.querySelector('#acaSend').disabled = true;
    var body = { bot: bot, site: cfg.site, ui_lang: ui(), lang: conv.lang, quick: quickKey || null,
      messages: conv.messages.slice(-10).map(function (m) { return { role: m.role, text: m.text }; }) };
    if (bot === 'amaan') { body.mode = quickKey === 'amaan_find' ? 'find' : quickKey === 'amaan_list' ? 'list' : conv.mode; body.asked = conv.asked; body.notes = quickKey === 'amaan_list' ? [] : conv.notes; }
    var ctrl = new AbortController(); var timer = setTimeout(function () { ctrl.abort(); }, 25000);
    fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal, credentials: 'omit' })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (res.status !== 200 || typeof d.reply !== 'string') throw new Error(res.status === 429 ? 'slow' : 'err');
        conv.lang = d.lang || conv.lang;
        if (bot === 'amaan') {
          conv.mode = d.mode || null; conv.asked = d.asked || null;
          if (Array.isArray(d.notes)) conv.notes = d.notes.slice(-8);
          if (d.result) track('amaan_find_result', { bot: 'amaan', result: d.result });
        }
        conv.messages.push({ role: 'assistant', text: d.reply, lang: d.lang, actions: Array.isArray(d.actions) ? d.actions.slice(0, 4) : [], listings: Array.isArray(d.listings) ? d.listings.slice(0, 6) : [], ready: Boolean(d.ready) });
      })
      .catch(function (e) {
        conv.messages.push({ role: 'assistant', text: t(e && e.message === 'slow' ? 'slow' : 'err'), lang: ui(), actions: ['contact_whatsapp', 'contact_email'] });
      })
      .then(function () {
        clearTimeout(timer); busy = false; panel.querySelector('#acaSend').disabled = false;
        if (conv.messages.length > 30) conv.messages = conv.messages.slice(-30);
        save(); if (state.bot === bot) render();
        if (!silent) panel.querySelector('#acaInput').focus();
      });
  }

  // ---------- open / close ----------
  var lastFocus = null;
  function open(opts) {
    cfg = cfg || opts;
    state = state || loadState();
    if (!panel) build();
    lastFocus = document.activeElement;
    if (opts && opts.bot) state.bot = opts.bot;
    panel.hidden = false;
    var fab = document.getElementById('acaFab'); if (fab) fab.setAttribute('aria-expanded', 'true');
    document.body.classList.add('aca-open');
    render();
    track('assistant_opened', { bot: state.bot });
    if (opts && opts.quick) send(null, opts.quick); else greet();
    panel.querySelector('#acaInput').focus();
  }
  function close() {
    if (!panel) return;
    panel.hidden = true;
    document.body.classList.remove('aca-open');
    var fab = document.getElementById('acaFab'); if (fab) fab.setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.AcAssistant = { open: open, close: close, i18n: { T: T, ACTION_LABEL: ACTION_LABEL } };
})();
