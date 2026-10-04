/* AgenticCore assistants (shared by agenticcore.estate and agenticcorepk.com).
   Two assistants, two clearly different windows:
     guide — AgenticCore AI: a small light-gold window for quick questions.
     amaan — Amaan: a full-screen chat (property search, listing, marketing
             requests) with file attachments (photos, videos, logos, PDFs) and
             "Send to the AgenticCore team", which forwards the request with its
             files to the team in Telegram (server: /api/assistant, action
             "handoff"; the person must be signed in).
   Everything from the server is rendered as text (textContent) — never as HTML.
   Buttons come from a fixed key list mapped to URLs here, so a reply cannot
   inject a link. The conversation lives in this tab only (sessionStorage).
   Files go to the person's own private folder (pk-attachments/<their id>/…). */
(function () {
  if (window.AcAssistant) return;

  var ESTATE = 'https://agenticcore.estate/';
  var PK = 'https://agenticcorepk.com/';
  var STORE = 'aca_v2';
  var BUCKET = 'pk-attachments';
  var MAX_FILES = 10;
  var cfg = null, guide = null, amaan = null, state = null, busy = false;

  // ---------- text ----------
  var T = {
    en: {
      g_title: 'AgenticCore AI', g_sub: 'Quick answers about AgenticCore — an AI, not a person.', close: 'Close',
      a_title: 'Amaan', a_sub: 'AI property assistant · not a person', back: 'Back to the site',
      ph_guide: 'Ask anything about AgenticCore…', ph_amaan: 'Message Amaan — e.g. 10 marla house, Rawalpindi', send: 'Send', input: 'Your message',
      human: 'Talk to a person:', wa: 'WhatsApp', email: 'Email', note: 'AI can make mistakes — check details on the listing page and with the owner.',
      thinking: 'Thinking…', err: 'I couldn\'t reach the assistant just now. Please try again, or talk to our team.', slow: 'Too many messages in a short time — please wait a few minutes.',
      reset: 'New chat', results: 'Listings', differs: 'Differs:', mine_note: 'Your conversation stays in this browser tab.',
      to_amaan: 'Talk to Amaan — property & marketing', to_amaan_sub: 'Full chat · send photos, videos, logos and documents',
      attach: 'Attach photos, videos or documents', uploading: 'Uploading…', uploaded: 'Added', upload_failed: 'Could not upload', remove: 'Remove',
      too_big: 'is too large (max {mb} MB).', bad_type: 'This file type isn\'t supported. Send photos, videos, PDF or Word files.', too_many: 'Up to 10 files per request.',
      need_login: 'Please sign in to send photos or documents — they are saved privately in your account.', sign_in: 'Sign in',
      files_added: '{n} file(s) added. Tell me what you need, then tap "Send to AgenticCore team".',
      handoff: 'Send to AgenticCore team', h_title: 'Send this to the AgenticCore team', h_summary: 'What you need', h_files: 'Files', h_note: 'Anything else? (optional)',
      h_none: 'No files attached.', h_send: 'Send to the team', h_cancel: 'Cancel', h_sending: 'Sending…',
      h_info: 'The team receives this conversation summary and your files in Telegram and replies to you. Nothing is published.',
      h_done: 'Sent ✓ Reference {ref}. The AgenticCore team has your request{files} and will reply to you here in your account, on Telegram or WhatsApp.',
      h_with_files: ' and {n} file(s)', h_err: 'Could not send right now. Please try again, or WhatsApp our team.', h_limit: 'You\'ve sent several requests today — our team will reply to those first.',
      h_need: 'Tell Amaan a little about what you need first.',
      q: { about: 'What is AgenticCore?', amaan_find: 'Find a property with Amaan', amaan_list: 'List a property with Amaan', professional: 'Professional profile', agency: 'Agency profile', builder: 'Builders & developers', project: 'Publish a project', pk_service: 'Marketing & websites', contact: 'Talk to the team', amaan_order: 'Order marketing with my files' }
    },
    ur: {
      g_title: 'AgenticCore AI', g_sub: 'AgenticCore کے بارے میں فوری جواب — یہ AI ہے، انسان نہیں۔', close: 'بند کریں',
      a_title: 'امان', a_sub: 'AI پراپرٹی اسسٹنٹ · انسان نہیں', back: 'ویب سائٹ پر واپس',
      ph_guide: 'AgenticCore کے بارے میں کچھ بھی پوچھیں…', ph_amaan: 'امان کو لکھیں — مثلاً راولپنڈی میں 10 مرلہ گھر', send: 'بھیجیں', input: 'آپ کا پیغام',
      human: 'کسی انسان سے بات کریں:', wa: 'واٹس ایپ', email: 'ای میل', note: 'AI سے غلطی ہو سکتی ہے — تفصیلات لسٹنگ پیج اور مالک سے ضرور تصدیق کریں۔',
      thinking: 'سوچ رہا ہوں…', err: 'ابھی اسسٹنٹ سے رابطہ نہیں ہو سکا۔ دوبارہ کوشش کریں یا ہماری ٹیم سے بات کریں۔', slow: 'کم وقت میں بہت زیادہ پیغامات — براہ کرم چند منٹ انتظار کریں۔',
      reset: 'نئی گفتگو', results: 'لسٹنگز', differs: 'فرق:', mine_note: 'آپ کی گفتگو صرف اسی براؤزر ٹیب میں رہتی ہے۔',
      to_amaan: 'امان سے بات کریں — پراپرٹی اور مارکیٹنگ', to_amaan_sub: 'مکمل چیٹ · تصاویر، ویڈیو، لوگو اور دستاویزات بھیجیں',
      attach: 'تصاویر، ویڈیو یا دستاویزات لگائیں', uploading: 'اپ لوڈ ہو رہا ہے…', uploaded: 'شامل', upload_failed: 'اپ لوڈ نہیں ہو سکا', remove: 'ہٹائیں',
      too_big: 'بہت بڑی ہے (زیادہ سے زیادہ {mb} MB)۔', bad_type: 'یہ فائل قبول نہیں۔ تصاویر، ویڈیو، PDF یا Word فائل بھیجیں۔', too_many: 'ایک درخواست میں زیادہ سے زیادہ 10 فائلیں۔',
      need_login: 'تصاویر یا دستاویزات بھیجنے کے لیے سائن ان کریں — یہ آپ کے اکاؤنٹ میں محفوظ رہتی ہیں۔', sign_in: 'سائن ان',
      files_added: '{n} فائل شامل ہو گئی۔ بتائیں آپ کو کیا چاہیے، پھر "AgenticCore ٹیم کو بھیجیں" دبائیں۔',
      handoff: 'AgenticCore ٹیم کو بھیجیں', h_title: 'یہ AgenticCore ٹیم کو بھیجیں', h_summary: 'آپ کو کیا چاہیے', h_files: 'فائلیں', h_note: 'کچھ اور؟ (اختیاری)',
      h_none: 'کوئی فائل نہیں لگی۔', h_send: 'ٹیم کو بھیجیں', h_cancel: 'منسوخ', h_sending: 'بھیجا جا رہا ہے…',
      h_info: 'ٹیم کو یہ خلاصہ اور آپ کی فائلیں ٹیلی گرام میں ملیں گی اور وہ آپ کو جواب دیں گے۔ کچھ شائع نہیں ہوتا۔',
      h_done: 'بھیج دیا ✓ حوالہ {ref}۔ AgenticCore ٹیم کو آپ کی درخواست{files} مل گئی ہے، وہ آپ کو اکاؤنٹ، ٹیلی گرام یا واٹس ایپ پر جواب دیں گے۔',
      h_with_files: ' اور {n} فائلیں', h_err: 'ابھی بھیجا نہیں جا سکا۔ دوبارہ کوشش کریں یا ٹیم سے واٹس ایپ پر بات کریں۔', h_limit: 'آپ آج کئی درخواستیں بھیج چکے ہیں — ٹیم پہلے ان کا جواب دے گی۔',
      h_need: 'پہلے امان کو بتائیں کہ آپ کو کیا چاہیے۔',
      q: { about: 'AgenticCore کیا ہے؟', amaan_find: 'امان کے ساتھ پراپرٹی ڈھونڈیں', amaan_list: 'امان کے ساتھ پراپرٹی لسٹ کریں', professional: 'پروفیشنل پروفائل', agency: 'ایجنسی پروفائل', builder: 'بلڈرز اور ڈویلپرز', project: 'پروجیکٹ شائع کریں', pk_service: 'مارکیٹنگ اور ویب سائٹ', contact: 'ٹیم سے بات کریں', amaan_order: 'اپنی فائلوں کے ساتھ مارکیٹنگ آرڈر' }
    }
  };
  var ACTION_LABEL = {
    en: { amaan_find: 'Find with Amaan', amaan_list: 'List with Amaan', ask_guide: 'Ask AgenticCore AI', estate_home: 'AgenticCore Estate', estate_properties: 'Browse properties', estate_buy: 'Buy', estate_rent: 'Rent',
      estate_projects: 'Projects', estate_professionals: 'Professionals', estate_agencies: 'Agencies', estate_builders: 'Builders & developers', estate_list: 'Continue to the listing form', estate_pricing: 'Launch & pricing',
      estate_dashboard: 'My dashboard', estate_signup: 'Create an account', join_professional: 'Create a professional profile', join_agency: 'Add your agency', join_builder: 'Create a company profile', join_developer: 'Apply to publish projects',
      pk_home: 'AgenticCore Pakistan', pk_services: 'PK services', pk_branding: 'Branding', pk_print: 'Flyers & print', pk_websites: 'Websites', pk_video: 'Video', pk_social: 'Social media', pk_campaigns: 'Campaigns', pk_leads: 'AI & automation', pk_local: 'Google Business Profile',
      pk_logo: 'Logo & brand identity', pk_agent_branding: 'Agent branding kit', pk_brochure: 'Brochures', pk_website: 'Agency & developer websites', pk_landing: 'Landing pages', pk_photos: 'Photo enhancement', pk_launch: 'Project launch campaign',
      contact_whatsapp: 'WhatsApp our team', contact_email: 'Email our team', whatsapp_channel: 'Follow our WhatsApp Channel', sign_in: 'Sign in' },
    ur: { amaan_find: 'امان سے ڈھونڈیں', amaan_list: 'امان سے لسٹ کریں', ask_guide: 'AgenticCore AI سے پوچھیں', estate_home: 'AgenticCore Estate', estate_properties: 'پراپرٹیز دیکھیں', estate_buy: 'خریدیں', estate_rent: 'کرائے پر',
      estate_projects: 'پروجیکٹس', estate_professionals: 'پروفیشنلز', estate_agencies: 'ایجنسیاں', estate_builders: 'بلڈرز اور ڈویلپرز', estate_list: 'لسٹنگ فارم پر جائیں', estate_pricing: 'لانچ اور قیمتیں',
      estate_dashboard: 'میرا ڈیش بورڈ', estate_signup: 'اکاؤنٹ بنائیں', join_professional: 'پروفیشنل پروفائل بنائیں', join_agency: 'اپنی ایجنسی شامل کریں', join_builder: 'کمپنی پروفائل بنائیں', join_developer: 'پروجیکٹس شائع کرنے کی درخواست',
      pk_home: 'AgenticCore Pakistan', pk_services: 'PK سروسز', pk_branding: 'برانڈنگ', pk_print: 'فلائرز اور پرنٹ', pk_websites: 'ویب سائٹس', pk_video: 'ویڈیو', pk_social: 'سوشل میڈیا', pk_campaigns: 'کیمپینز', pk_leads: 'AI اور آٹومیشن', pk_local: 'گوگل بزنس پروفائل',
      pk_logo: 'لوگو اور برانڈ', pk_agent_branding: 'ایجنٹ برانڈنگ کٹ', pk_brochure: 'بروشر', pk_website: 'ایجنسی اور ڈویلپر ویب سائٹ', pk_landing: 'لینڈنگ پیجز', pk_photos: 'تصاویر بہتر بنانا', pk_launch: 'پروجیکٹ لانچ کیمپین',
      contact_whatsapp: 'ٹیم سے واٹس ایپ پر بات', contact_email: 'ٹیم کو ای میل', whatsapp_channel: 'واٹس ایپ چینل فالو کریں', sign_in: 'سائن ان' }
  };
  function ui() { return document.documentElement.lang === 'ur' ? 'ur' : 'en'; }
  function t(k) { return T[ui()][k]; }

  // ---------- contact (central config of each site) ----------
  function contact() {
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
  var PKP = { pk_home: '', pk_services: 'services.html', pk_branding: 'services.html#service-14', pk_print: 'services.html#service-3', pk_websites: 'services.html#service-16',
    pk_video: 'services.html#service-7', pk_social: 'services.html#property-marketing', pk_campaigns: 'services.html#service-21', pk_leads: 'services.html#ai-automation', pk_local: 'services.html#service-18',
    pk_logo: 'services.html#service-14', pk_agent_branding: 'services.html#service-13', pk_brochure: 'services.html#service-27', pk_website: 'services.html#service-16',
    pk_landing: 'services.html#service-12', pk_photos: 'services.html#service-4', pk_launch: 'services.html#service-40' };
  function hrefFor(key) {
    var c = contact();
    if (key === 'contact_whatsapp') return c.wa ? 'https://wa.me/' + c.wa + '?text=' + encodeURIComponent(c.msg) : null;
    if (key === 'contact_email') return c.email ? 'mailto:' + c.email + '?subject=' + encodeURIComponent(cfg.site === 'pk' ? 'AgenticCore Pakistan enquiry' : 'AgenticCore Estate enquiry') : null;
    if (key === 'whatsapp_channel') return c.channel || null;
    if (key === 'sign_in') return 'login.html?next=' + encodeURIComponent((location.pathname.split('/').pop() || 'index.html') + location.search);
    if (EST[key]) {
      var e = EST[key], path = e[0];
      if (cfg.site === 'estate') return (path || 'index.html') + (e[2] ? '?intent=' + e[2] : '');
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
  function freshConv(bot) { return bot === 'amaan' ? { messages: [], lang: null, mode: null, asked: null, notes: [], summary: '', files: [] } : { messages: [], lang: null }; }
  function fresh() { return { convs: { guide: freshConv('guide'), amaan: freshConv('amaan') } }; }
  function loadState() {
    try { var s = JSON.parse(sessionStorage.getItem(STORE) || 'null'); if (s && s.convs && s.convs.guide && s.convs.amaan) { s.convs.amaan.files = (s.convs.amaan.files || []).filter(function (f) { return f.path; }); return s; } } catch (e) { /* private mode */ }
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
  function q(view, sel) { return view.root.querySelector(sel); }

  // One builder for both windows; the guide is small, Amaan is full screen.
  function buildView(bot) {
    var root = el('div', bot === 'amaan' ? 'aca-full' : 'aca-panel');
    root.id = bot === 'amaan' ? 'acaAmaan' : 'acaPanel';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', bot === 'amaan' ? 'true' : 'false'); root.setAttribute('aria-labelledby', root.id + 'Title');
    root.hidden = true;
    var head = bot === 'amaan'
      ? '<div class="aca-fhead"><button type="button" class="aca-back" data-x="close"><span aria-hidden="true">‹</span><span class="aca-back-t"></span></button>' +
          '<span class="aca-avatar" aria-hidden="true">A</span><div class="aca-fhead-t"><h2 class="aca-title" id="' + root.id + 'Title"></h2><p class="aca-sub"></p></div>' +
          '<button type="button" class="aca-reset" data-x="reset"></button></div>'
      : '<div class="aca-head"><span class="aca-gdot" aria-hidden="true">✦</span><div class="aca-head-t"><h2 class="aca-title" id="' + root.id + 'Title"></h2><p class="aca-sub"></p></div>' +
          '<button type="button" class="aca-reset" data-x="reset"></button>' +
          '<button type="button" class="aca-close" data-x="close"><span aria-hidden="true">×</span></button></div>' +
        '<button type="button" class="aca-to-amaan" data-x="amaan"><strong></strong><small></small><span aria-hidden="true">›</span></button>';
    var attach = bot === 'amaan'
      ? '<button type="button" class="aca-clip" data-x="attach"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></button>' +
        '<input type="file" class="aca-file" multiple hidden accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf,.doc,.docx">'
      : '';
    root.innerHTML = head +
      '<div class="aca-log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0"></div>' +
      '<div class="aca-quick"></div>' +
      (bot === 'amaan' ? '<div class="aca-tray" hidden></div><div class="aca-handoff-row" hidden><button type="button" class="aca-handoff" data-x="handoff"></button></div>' : '') +
      '<form class="aca-form" novalidate>' + attach + '<label class="aca-sr"></label>' +
        '<textarea rows="1" maxlength="600" autocomplete="off"></textarea>' +
        '<button type="submit" class="aca-send"></button></form>' +
      '<div class="aca-foot"><span class="aca-human"></span> <a class="aca-wa" target="_blank" rel="noopener noreferrer"></a> <a class="aca-mail"></a>' +
        '<p class="aca-note"></p></div>' +
      (bot === 'amaan' ? '<div class="aca-sheet" hidden role="dialog" aria-modal="true"></div>' : '');
    document.body.appendChild(root);
    var view = { bot: bot, root: root };
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b) return;
      var x = b.getAttribute('data-x');
      if (x === 'close') close(bot);
      else if (x === 'reset') { state.convs[bot] = freshConv(bot); save(); render(view); greet(view); }
      else if (x === 'amaan') { track('assistant_action', { bot: 'guide', action: 'open_amaan' }); openAmaan(null); }
      else if (x === 'attach') pickFiles(view);
      else if (x === 'handoff') openSheet(view);
    });
    var form = q(view, '.aca-form'), input = q(view, 'textarea');
    form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value.trim(); if (v) { input.value = ''; send(view, v, null); } });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var sh = q(view, '.aca-sheet'); if (sh && !sh.hidden) closeSheet(view); else close(bot); } });
    q(view, '.aca-wa').addEventListener('click', function () { track('assistant_handoff_whatsapp', { bot: bot }); });
    q(view, '.aca-mail').addEventListener('click', function () { track('assistant_handoff_email', { bot: bot }); });
    if (bot === 'amaan') q(view, '.aca-file').addEventListener('change', function (e) { addFiles(view, Array.prototype.slice.call(e.target.files || [])); e.target.value = ''; });
    new MutationObserver(function () { if (!root.hidden) render(view); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return view;
  }

  function chrome(view) {
    var bot = view.bot, root = view.root;
    root.setAttribute('dir', ui() === 'ur' ? 'rtl' : 'ltr');
    q(view, '.aca-title').textContent = t(bot === 'amaan' ? 'a_title' : 'g_title');
    q(view, '.aca-sub').textContent = t(bot === 'amaan' ? 'a_sub' : 'g_sub');
    q(view, '.aca-reset').textContent = t('reset');
    if (bot === 'amaan') { q(view, '.aca-back-t').textContent = t('back'); q(view, '.aca-back').setAttribute('aria-label', t('back')); q(view, '.aca-clip').setAttribute('aria-label', t('attach')); q(view, '.aca-clip').title = t('attach'); q(view, '.aca-handoff').textContent = '📤 ' + t('handoff'); }
    else { q(view, '.aca-close').setAttribute('aria-label', t('close')); q(view, '.aca-to-amaan strong').textContent = t('to_amaan'); q(view, '.aca-to-amaan small').textContent = t('to_amaan_sub'); }
    q(view, 'textarea').placeholder = t(bot === 'amaan' ? 'ph_amaan' : 'ph_guide');
    q(view, '.aca-sr').textContent = t('input');
    q(view, '.aca-send').textContent = t('send');
    q(view, '.aca-human').textContent = t('human');
    var wa = q(view, '.aca-wa'), mail = q(view, '.aca-mail');
    var hw = hrefFor('contact_whatsapp'), hm = hrefFor('contact_email');
    wa.hidden = !hw; if (hw) { wa.href = hw; wa.textContent = t('wa'); }
    mail.hidden = !hm; if (hm) { mail.href = hm; mail.textContent = t('email'); }
    q(view, '.aca-note').textContent = t('note') + ' ' + t('mine_note');
  }

  function bubble(view, m) {
    var wrap = el('div', 'aca-msg aca-' + m.role + (m.text === '📎' && m.files ? ' aca-files-only' : ''));
    var b = el('div', 'aca-bubble'); b.textContent = m.text;
    if (m.role === 'assistant' && m.lang === 'ur') b.setAttribute('dir', 'rtl'); else if (m.role === 'assistant') b.setAttribute('dir', 'ltr');
    if (m.role === 'user') b.setAttribute('dir', 'auto');
    wrap.appendChild(b);
    if (m.files && m.files.length) {
      var fl = el('div', 'aca-msg-files');
      m.files.forEach(function (f) { fl.appendChild(el('span', 'aca-fchip', icon(f.type) + ' ' + f.name)); });
      wrap.appendChild(fl);
    }
    if (m.listings && m.listings.length) wrap.appendChild(cards(m.listings));
    if (m.actions && m.actions.length) {
      var row = el('div', 'aca-actions');
      m.actions.forEach(function (k) { var n = actionEl(view, k, m); if (n) row.appendChild(n); });
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
  function actionEl(view, key, m) {
    if (key === 'amaan_find' || key === 'amaan_list' || key === 'ask_guide') {
      var b = el('button', 'aca-act', ACTION_LABEL[ui()][key]); b.type = 'button';
      b.addEventListener('click', function () {
        track('assistant_action', { bot: view.bot, action: key });
        if (key === 'ask_guide') { close('amaan'); openGuide(null); } else openAmaan(key);
      });
      return b;
    }
    var href = hrefFor(key);
    if (!href) return null;
    var a = el('a', 'aca-act', ACTION_LABEL[ui()][key] || key);
    a.href = href;
    if (external(href) && href.indexOf('mailto:') !== 0) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.addEventListener('click', function (e) {
      track(key === 'contact_whatsapp' ? 'assistant_handoff_whatsapp' : key === 'contact_email' ? 'assistant_handoff_email' : 'assistant_action', { bot: view.bot, action: key });
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
  function quick(view) {
    var box = q(view, '.aca-quick'); box.innerHTML = '';
    var conv = state.convs[view.bot];
    if (conv.messages.some(function (m) { return m.role === 'user'; })) return;
    var keys = view.bot === 'amaan' ? ['amaan_find', 'amaan_list', 'amaan_order', 'contact'] : ['about', 'professional', 'agency', 'builder', 'project', 'pk_service', 'contact'];
    keys.forEach(function (k) {
      var b = el('button', 'aca-chip', T[ui()].q[k]); b.type = 'button';
      b.addEventListener('click', function () {
        track('assistant_action', { bot: view.bot, action: k });
        if (k === 'amaan_order') { send(view, T[ui()].q.amaan_order, null); pickFiles(view); }
        else if (view.bot === 'amaan') send(view, null, k);
        else send(view, null, k);
      });
      box.appendChild(b);
    });
  }
  function render(view) {
    chrome(view);
    var log = q(view, '.aca-log'); log.innerHTML = '';
    state.convs[view.bot].messages.forEach(function (m) { log.appendChild(bubble(view, m)); });
    quick(view);
    if (view.bot === 'amaan') { tray(view); handoffRow(view); }
    log.scrollTop = log.scrollHeight;
  }

  // ---------- files (Amaan) ----------
  var TYPES = /^(image\/|video\/(mp4|quicktime|webm)$|application\/pdf$|application\/msword$|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$)/;
  function kind(type) { return /^image\//.test(type) ? 'image' : /^video\//.test(type) ? 'video' : 'doc'; }
  function icon(type) { var k = kind(type || ''); return k === 'image' ? '🖼' : k === 'video' ? '🎬' : '📄'; }
  function maxMb(type) { return kind(type) === 'video' ? 45 : 20; }
  function client() { return typeof supabaseClient !== 'undefined' && supabaseClient ? supabaseClient : null; }
  function session() {
    var c = client();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) { return r && r.data && r.data.session; }, function () { return null; });
  }
  function say(view, text, actions) { var conv = state.convs[view.bot]; conv.messages.push({ role: 'assistant', text: text, lang: ui(), actions: actions || [] }); save(); render(view); }
  function pickFiles(view) {
    session().then(function (s) {
      if (!s) { say(view, t('need_login'), ['sign_in']); track('assistant_action', { bot: 'amaan', action: 'attach_login' }); return; }
      q(view, '.aca-file').click();
    });
  }
  function safeName(n) { return String(n || 'file').replace(/[^\w.\-]+/g, '_').replace(/^_+/, '').slice(-80) || 'file'; }
  function addFiles(view, list) {
    var conv = state.convs.amaan;
    if (!list.length) return;
    session().then(function (s) {
      if (!s) { say(view, t('need_login'), ['sign_in']); return; }
      var room = MAX_FILES - conv.files.length;
      if (room <= 0) { say(view, t('too_many')); return; }
      var batch = 'amaan-' + Date.now(), entries = [];
      var jobs = list.slice(0, room).map(function (f, i) {
        if (!TYPES.test(f.type || '')) { say(view, f.name + ': ' + t('bad_type')); return null; }
        if (f.size > maxMb(f.type) * 1024 * 1024) { say(view, f.name + ' ' + t('too_big').replace('{mb}', maxMb(f.type))); return null; }
        var entry = { name: String(f.name).slice(0, 80), type: f.type, size: f.size, path: null, status: 'uploading' };
        conv.files.push(entry); entries.push(entry); tray(view);
        var path = s.user.id + '/' + batch + '/' + (i + 1) + '-' + safeName(f.name);
        return client().storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false }).then(function (r) {
          if (r && r.error) throw r.error;
          entry.path = path; entry.status = 'done';
        }).catch(function () { entry.status = 'failed'; }).then(function () { save(); tray(view); handoffRow(view); });
      }).filter(Boolean);
      if (list.length > room) say(view, t('too_many'));
      Promise.all(jobs).then(function () {
        var added = entries.filter(function (f) { return f.status === 'done'; });
        if (added.length) {
          conv.messages.push({ role: 'user', text: '📎', files: added.map(function (f) { return { name: f.name, type: f.type }; }) });
          conv.messages.push({ role: 'assistant', text: t('files_added').replace('{n}', added.length), lang: ui(), actions: [] });
          track('assistant_action', { bot: 'amaan', action: 'attach', result: String(added.length) });
        }
        conv.files = conv.files.filter(function (f) { return f.status !== 'failed'; });
        save(); render(view);
      });
    });
  }
  function tray(view) {
    var box = q(view, '.aca-tray'), files = state.convs.amaan.files;
    box.hidden = !files.length; box.innerHTML = '';
    files.forEach(function (f, i) {
      var chip = el('span', 'aca-tchip aca-t-' + (f.status || 'done'));
      chip.appendChild(el('span', null, icon(f.type) + ' ' + f.name));
      chip.appendChild(el('small', null, f.status === 'uploading' ? t('uploading') : f.status === 'failed' ? t('upload_failed') : t('uploaded')));
      if (f.status !== 'uploading') {
        var x = el('button', 'aca-tx', '×'); x.type = 'button'; x.setAttribute('aria-label', t('remove') + ' ' + f.name);
        x.addEventListener('click', function () { state.convs.amaan.files.splice(i, 1); save(); tray(view); handoffRow(view); });
        chip.appendChild(x);
      }
      box.appendChild(chip);
    });
  }
  function handoffRow(view) {
    var conv = state.convs.amaan;
    // after a request is sent, the button waits for something new (no double sends)
    var since = conv.messages.slice(conv.sentAt || 0);
    var show = since.some(function (m) { return m.role === 'user'; }) || conv.files.some(function (f) { return f.status === 'done'; });
    q(view, '.aca-handoff-row').hidden = !show;
  }

  // ---------- send to the team (Amaan → owner in Telegram) ----------
  function summaryText() {
    var conv = state.convs.amaan;
    if (conv.summary) return conv.summary;
    return conv.messages.filter(function (m) { return m.role === 'user' && m.text !== '📎'; }).slice(-3).map(function (m) { return m.text; }).join('\n').slice(0, 600);
  }
  function openSheet(view) {
    var sh = q(view, '.aca-sheet'), conv = state.convs.amaan;
    var files = conv.files.filter(function (f) { return f.status === 'done'; });
    sh.innerHTML = '';
    var card = el('form', 'aca-sheet-card'); card.noValidate = true;
    card.appendChild(el('h3', null, t('h_title')));
    card.appendChild(el('p', 'aca-sheet-info', t('h_info')));
    var l1 = el('label', null, t('h_summary')); var sum = el('textarea'); sum.maxLength = 600; sum.rows = 3; sum.value = summaryText(); l1.appendChild(sum); card.appendChild(l1);
    var fh = el('p', 'aca-sheet-label', t('h_files')); card.appendChild(fh);
    var fl = el('div', 'aca-msg-files'); if (!files.length) fl.appendChild(el('span', 'aca-sheet-none', t('h_none')));
    files.forEach(function (f) { fl.appendChild(el('span', 'aca-fchip', icon(f.type) + ' ' + f.name)); }); card.appendChild(fl);
    var l2 = el('label', null, t('h_note')); var note = el('textarea'); note.maxLength = 600; note.rows = 2; l2.appendChild(note); card.appendChild(l2);
    var msg = el('p', 'aca-sheet-msg'); msg.setAttribute('role', 'status'); card.appendChild(msg);
    var row = el('div', 'aca-sheet-row');
    var cancel = el('button', 'aca-sheet-cancel', t('h_cancel')); cancel.type = 'button'; cancel.addEventListener('click', function () { closeSheet(view); });
    var go = el('button', 'aca-send', t('h_send')); go.type = 'submit';
    row.appendChild(cancel); row.appendChild(go); card.appendChild(row);
    card.addEventListener('submit', function (e) {
      e.preventDefault();
      var summary = sum.value.trim();
      if (summary.length < 3 && !files.length) { msg.textContent = t('h_need'); return; }
      go.disabled = true; go.textContent = t('h_sending'); msg.textContent = '';
      session().then(function (s) {
        if (!s) { closeSheet(view); say(view, t('need_login'), ['sign_in']); return; }
        var body = { action: 'handoff', site: cfg.site, lang: ui(), summary: summary.slice(0, 600), note: note.value.trim().slice(0, 600),
          messages: conv.messages.filter(function (m) { return m.text && m.text !== '📎'; }).slice(-12).map(function (m) { return { role: m.role, text: String(m.text).slice(0, 400) }; }),
          files: files.map(function (f) { return { path: f.path, name: f.name, type: f.type, size: f.size }; }) };
        return fetch(cfg.endpoint, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(body) })
          .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d || {} }; }); })
          .then(function (res) {
            if (res.status === 429) throw new Error('limit');
            if (res.status !== 200 || !res.d.ref) throw new Error('err');
            closeSheet(view);
            var done = t('h_done').replace('{ref}', res.d.ref).replace('{files}', files.length ? t('h_with_files').replace('{n}', files.length) : '');
            conv.messages.push({ role: 'assistant', text: done, lang: ui(), actions: cfg.site === 'estate' ? ['estate_dashboard'] : [] });
            conv.files = []; conv.sentAt = conv.messages.length; save(); render(view);
            track('assistant_action', { bot: 'amaan', action: 'handoff_sent', result: String(files.length) });
          });
      }).catch(function (e2) {
        go.disabled = false; go.textContent = t('h_send');
        msg.textContent = t(e2 && e2.message === 'limit' ? 'h_limit' : 'h_err');
      });
    });
    sh.appendChild(card);
    sh.hidden = false;
    sum.focus();
    track('assistant_action', { bot: 'amaan', action: 'handoff_open' });
  }
  function closeSheet(view) { var sh = q(view, '.aca-sheet'); sh.hidden = true; sh.innerHTML = ''; q(view, '.aca-handoff').focus(); }

  // ---------- conversation ----------
  function greet(view) { if (!state.convs[view.bot].messages.length) send(view, null, null, true); }
  function send(view, text, quickKey, silent) {
    if (busy) return;
    var bot = view.bot, conv = state.convs[bot];
    if (text) { conv.messages.push({ role: 'user', text: text.slice(0, 600) }); track('assistant_question', { bot: bot, lang: ui() }); }
    if (quickKey === 'amaan_find') track('amaan_find_started', { bot: 'amaan' });
    if (quickKey === 'amaan_list') track('amaan_list_started', { bot: 'amaan' });
    save(); render(view);
    var log = q(view, '.aca-log');
    var wait = el('div', 'aca-msg aca-assistant aca-wait'); wait.appendChild(el('div', 'aca-bubble', t('thinking'))); log.appendChild(wait); log.scrollTop = log.scrollHeight;
    busy = true; q(view, '.aca-send').disabled = true;
    var body = { bot: bot, site: cfg.site, ui_lang: ui(), lang: conv.lang, quick: quickKey || null,
      messages: conv.messages.filter(function (m) { return m.text && m.text !== '📎'; }).slice(-10).map(function (m) { return { role: m.role, text: m.text }; }) };
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
          if (typeof d.facts_summary === 'string' && d.facts_summary) conv.summary = d.facts_summary.slice(0, 600);
          if (d.result) track('amaan_find_result', { bot: 'amaan', result: d.result });
        }
        conv.messages.push({ role: 'assistant', text: d.reply, lang: d.lang, actions: Array.isArray(d.actions) ? d.actions.slice(0, 4) : [], listings: Array.isArray(d.listings) ? d.listings.slice(0, 6) : [], ready: Boolean(d.ready) });
      })
      .catch(function (e) {
        conv.messages.push({ role: 'assistant', text: t(e && e.message === 'slow' ? 'slow' : 'err'), lang: ui(), actions: ['contact_whatsapp', 'contact_email'] });
      })
      .then(function () {
        clearTimeout(timer); busy = false; q(view, '.aca-send').disabled = false;
        if (conv.messages.length > 40) conv.messages = conv.messages.slice(-40);
        save(); render(view);
        if (!silent) q(view, 'textarea').focus();
      });
  }

  // ---------- open / close ----------
  var lastFocus = null;
  function ensure(opts) { cfg = cfg || opts; state = state || loadState(); }
  function openGuide(quickKey) {
    if (!guide) guide = buildView('guide');
    if (amaan && !amaan.root.hidden) return;
    lastFocus = lastFocus || document.activeElement;
    guide.root.hidden = false;
    var fab = document.getElementById('acaFab'); if (fab) fab.setAttribute('aria-expanded', 'true');
    document.body.classList.add('aca-open');
    render(guide);
    track('assistant_opened', { bot: 'guide' });
    if (quickKey) send(guide, null, quickKey); else greet(guide);
    q(guide, 'textarea').focus();
  }
  function openAmaan(quickKey) {
    if (!amaan) amaan = buildView('amaan');
    if (guide) guide.root.hidden = true;
    lastFocus = lastFocus || document.activeElement;
    amaan.root.hidden = false;
    document.body.classList.add('aca-open', 'aca-full-open');
    render(amaan);
    track('assistant_opened', { bot: 'amaan' });
    if (quickKey === 'amaan_order') { send(amaan, T[ui()].q.amaan_order, null); }
    else if (quickKey) send(amaan, null, quickKey); else greet(amaan);
    q(amaan, 'textarea').focus();
  }
  function open(opts) {
    ensure(opts);
    if (opts && opts.bot === 'amaan') openAmaan(opts.quick || null);
    else openGuide(opts && opts.quick);
  }
  function close(bot) {
    var v = bot === 'amaan' ? amaan : bot === 'guide' ? guide : null;
    [guide, amaan].forEach(function (x) { if (x && (!v || x === v)) x.root.hidden = true; });
    var anyOpen = (guide && !guide.root.hidden) || (amaan && !amaan.root.hidden);
    if (!anyOpen) {
      document.body.classList.remove('aca-open', 'aca-full-open');
      var fab = document.getElementById('acaFab'); if (fab) fab.setAttribute('aria-expanded', 'false');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    } else if (!amaan || amaan.root.hidden) document.body.classList.remove('aca-full-open');
  }
  window.AcAssistant = { open: open, close: close, i18n: { T: T, ACTION_LABEL: ACTION_LABEL } };
})();
