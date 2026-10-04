/* ============================================
   AgenticCore Estate — ecosystem helpers
   One place for everything that crosses to AgenticCore Pakistan (PK):
   - the cross-site context contract (allow-listed, ids only, never
     personal data, never proof of ownership);
   - the few contextual PK service pathways shown per entity type;
   - the compact/full ecosystem block;
   - share actions (native share → WhatsApp → copy link);
   - a tiny analytics hook (no tracking library, no personal data).
   Loaded on every page before partials.js.
   ============================================ */

// Own escaper: this file loads on pages that don't include db-client.js / listings.js.
function acEcoEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const AC_SITE = 'https://agenticcore.estate/';
const AC_PK_BASE = 'https://agenticcorepk.com/';

// ---------- AgenticCore contact & official channels (one place for both uses) ----------
// The same seven links are wired into AgenticCore Pakistan (js/config.js there).
// WhatsApp CHAT = talk to the AgenticCore team. WhatsApp CHANNEL = follow updates.
// Neither is ever used for marketplace listing/profile contact, which stays owner-to-visitor.
const AC_CONTACT = {
  whatsapp: '18089985226',                 // wa.me number, digits only
  whatsappDisplay: '+1 808 998 5226',
  whatsappMessage: 'Hello AgenticCore Estate, I need help with property.',
  email: 'hello@agenticcore.agency',
  telegram: 'https://t.me/AgenticcoreEstatebot',          // AgenticCore bot: accounts, listings, alerts
  social: [
    { key: 'whatsapp_channel', url: 'https://whatsapp.com/channel/0029Vb8on5ZGpLHWOTLXUT45' },
    { key: 'youtube', url: 'https://www.youtube.com/@AgenticcoreEstate' },
    { key: 'tiktok', url: 'https://www.tiktok.com/@agenticcore.estate' },
    { key: 'facebook', url: 'https://www.facebook.com/profile.php?id=61594880046065' },
    { key: 'instagram', url: 'https://www.instagram.com/agenticcore.estate' }
  ]
};
const AC_SOCIAL_ICONS = {
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.86 9.86 0 0 0 12.04 2zm5.8 14.03c-.25.69-1.43 1.33-1.97 1.38-.5.05-1.13.07-1.83-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.26-.29.57-.36.76-.36h.55c.17 0 .41-.06.64.49.25.59.83 2.02.9 2.17.08.14.12.31.03.5-.1.19-.14.31-.29.48l-.43.5c-.14.14-.29.3-.13.59.17.29.74 1.22 1.59 1.97 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.62-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.64-.14.26.1 1.67.79 1.96.93.29.14.48.22.55.34.07.12.07.69-.18 1.38z"/></svg>',
  whatsapp_channel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 2h-3.4v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.1a6.3 6.3 0 1 0 5.4 6.3V8.6a8.1 8.1 0 0 0 4.7 1.5V6.7A4.7 4.7 0 0 1 16.6 2z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8.5V6.6c0-.9.6-1.1 1-1.1h2.6V1.6L14 1.6c-4 0-4.9 3-4.9 4.9v2H6.4v4h2.7V22H14v-9.5h3.3l.4-4H14z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.6c.3-1.1-.8-2-1.9-1.6L2.6 9.9c-1.1.4-1.1 2 0 2.4l4.7 1.5 1.8 5.7c.3.9 1.5 1.1 2.1.3l2.5-3.2 4.9 3.6c.9.6 2.1.1 2.3-1l3-14.6zM9.6 14.1l-.4 4.1-1.4-4.6 10.9-7.2-9.1 7.7z"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'
};
function acWhatsAppHref(message) {
  return 'https://wa.me/' + AC_CONTACT.whatsapp + '?text=' + encodeURIComponent(message || AC_CONTACT.whatsappMessage);
}
function acMailHref(subject) {
  return 'mailto:' + AC_CONTACT.email + (subject ? '?subject=' + encodeURIComponent(subject) : '');
}
// Footer "Follow AgenticCore" — the five official channels. Labels translate
// with the page (data-i18n / data-i18n-aria).
function acSocialHTML() {
  return '<ul class="ac-social" role="list">' + AC_CONTACT.social.map(function (s) {
    return '<li><a href="' + acEcoEsc(s.url) + '" target="_blank" rel="noopener noreferrer" data-i18n-aria="social_' + s.key + '_aria" aria-label="' + s.key + '" data-track="social_click" data-channel="' + s.key + '">' +
      AC_SOCIAL_ICONS[s.key] + '<span class="ac-social-label" data-i18n="social_' + s.key + '"></span></a></li>';
  }).join('') + '</ul>';
}
// Footer "Contact AgenticCore" — WhatsApp chat with the team, the Telegram bot, business email.
function acContactHTML() {
  return '<ul class="ac-contact" role="list">' +
    '<li><a href="' + acEcoEsc(acWhatsAppHref()) + '" target="_blank" rel="noopener noreferrer" data-i18n-aria="contact_wa_aria" aria-label="WhatsApp" data-track="contact_click" data-channel="whatsapp">' + AC_SOCIAL_ICONS.whatsapp + '<span data-i18n="contact_wa_chat"></span></a></li>' +
    '<li><a href="' + acEcoEsc(AC_CONTACT.telegram) + '?start=estate" target="_blank" rel="noopener noreferrer" aria-label="Telegram" data-track="contact_click" data-channel="telegram">' + AC_SOCIAL_ICONS.telegram + '<span><span data-i18n="contact_telegram">Telegram</span> <span dir="ltr">@AgenticcoreEstatebot</span></span></a></li>' +
    '<li><a href="' + acEcoEsc(acMailHref('AgenticCore Estate enquiry')) + '" data-i18n-aria="contact_email_aria" aria-label="Email" data-track="contact_click" data-channel="email">' + AC_SOCIAL_ICONS.email + '<span dir="ltr">' + acEcoEsc(AC_CONTACT.email) + '</span></a></li>' +
    '</ul>';
}

// ---------- cross-site context contract (docs/ECOSYSTEM_CONTRACT.md) ----------
// Only these values are ever sent or accepted. Anything else is dropped.
const AC_XSITE = {
  sources: ['estate', 'pk'],
  // Estate → PK: what the person wants help with
  outIntents: ['promote', 'brand', 'social', 'project_marketing', 'website', 'creative', 'services'],
  // PK → Estate: what the person came to do
  inIntents: ['browse', 'list', 'profile', 'agency', 'builder', 'project', 'view'],
  entityTypes: ['property', 'project', 'professional', 'agency', 'builder']
};
const AC_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Build a PK link. Carries ids only; PK re-checks ownership after login
// (listing: pk_0003 trigger; other entities: my_marketplace_entity()).
function acPkUrl(intent, entityType, entityId, page) {
  const q = new URLSearchParams();
  q.set('from', 'estate');
  if (AC_XSITE.outIntents.indexOf(intent) >= 0) q.set('intent', intent);
  if (AC_XSITE.entityTypes.indexOf(entityType) >= 0 && AC_UUID_RE.test(String(entityId || ''))) {
    q.set('entity_type', entityType);
    q.set('entity_id', entityId);
    // the original, still-supported property contract
    if (entityType === 'property' && intent === 'promote') q.set('listing', entityId);
  }
  return AC_PK_BASE + (page || '') + '?' + q.toString();
}

// Read an incoming context (PK → Estate). Unknown values are ignored.
function acIncomingContext(search) {
  const p = new URLSearchParams(search == null ? location.search : search);
  const from = p.get('from'), intent = p.get('intent');
  if (AC_XSITE.sources.indexOf(from) < 0 || from === 'estate') return null;
  return {
    from: from,
    intent: AC_XSITE.inIntents.indexOf(intent) >= 0 ? intent : null,
    entityType: AC_XSITE.entityTypes.indexOf(p.get('entity_type')) >= 0 ? p.get('entity_type') : null,
    entityId: AC_UUID_RE.test(p.get('entity_id') || '') ? p.get('entity_id') : null
  };
}

// ---------- contextual PK service pathways ----------
// A few relevant pathways per entity type, never the full catalogue. Each maps
// to a real PK service (services.html#service-<no>) or group (#<group slug>)
// from PK's data/services.json; PK owns the list and its prices, Estate shows
// no prices.
const AC_PK_PATHWAYS = {
  // Service numbers follow the AgenticCore Pakistan Catalogue V2 (data/services.json there);
  // section anchors: property-marketing, project-marketing, ai-automation, specialist.
  // property promotion uses PK's existing pack builder (?listing=, guarded by pk_0003)
  property: [
    { intent: 'promote', key: 'eco_pw_promote_property', page: '' },
    { intent: 'creative', key: 'eco_pw_presentation', page: 'services.html', hash: 'service-4' },        // Property Photo Enhancement
    { intent: 'social', key: 'eco_pw_social', page: 'services.html', hash: 'property-marketing' }       // property marketing section
  ],
  project: [
    { intent: 'project_marketing', key: 'eco_pw_project_marketing', page: 'services.html', hash: 'service-40' }, // Project Launch Campaign
    { intent: 'creative', key: 'eco_pw_brochures', page: 'services.html', hash: 'service-27' },                // Project Brochure
    { intent: 'website', key: 'eco_pw_landing', page: 'services.html', hash: 'service-33' }                    // Project Landing Page
  ],
  professional: [
    { intent: 'brand', key: 'eco_pw_personal_brand', page: 'services.html', hash: 'service-13' },  // Agent Personal Branding Kit
    { intent: 'social', key: 'eco_pw_social', page: 'services.html', hash: 'property-marketing' },
    { intent: 'creative', key: 'eco_pw_material', page: 'services.html', hash: 'service-3' }       // Property Flyer
  ],
  agency: [
    { intent: 'brand', key: 'eco_pw_agency_brand', page: 'services.html', hash: 'service-14' },    // Agency Logo + Brand Kit
    { intent: 'social', key: 'eco_pw_social', page: 'services.html', hash: 'property-marketing' },
    { intent: 'website', key: 'eco_pw_website', page: 'services.html', hash: 'service-16' },       // Agency Website
    { intent: 'promote', key: 'eco_pw_campaigns', page: 'services.html', hash: 'service-21' }      // Paid Ads Management
  ],
  builder: [
    { intent: 'project_marketing', key: 'eco_pw_project_marketing', page: 'services.html', hash: 'service-40' },
    { intent: 'creative', key: 'eco_pw_brochures', page: 'services.html', hash: 'service-27' },
    { intent: 'website', key: 'eco_pw_website', page: 'services.html', hash: 'service-34' }        // Project / Developer Website
  ]
};

function acPkPathwayUrl(pw, entityType, entityId) {
  return acPkUrl(pw.intent, entityType, entityId, pw.page) + (pw.hash ? '#' + pw.hash : '');
}

// Owner-only block on a detail page / dashboard: "Grow this with AgenticCore Pakistan".
function acPkPathwaysHTML(entityType, entityId, skipIntent) {
  const list = (AC_PK_PATHWAYS[entityType] || []).filter(function (pw) { return pw.intent !== skipIntent; });
  if (!list.length) return '';
  return '<div class="panel eco-pathways"><h3>' + acEcoEsc(acT('eco_pw_h')) + '</h3><p class="mk-fine">' + acEcoEsc(acT('eco_pw_sub')) + '</p><ul class="eco-pw-list">' +
    list.map(function (pw) {
      // promotion of a project / property is counted as its own event (a subset of Estate → PK clicks)
      const ev = entityType === 'project' ? 'promote_project_click' : entityType === 'property' && pw.intent === 'promote' ? 'promote_property_click' : 'estate_to_pk_click';
      return '<li><a href="' + acPkPathwayUrl(pw, entityType, entityId) + '" rel="noopener" data-track="' + ev + '" data-intent="' + pw.intent + '" data-entity="' + entityType + '">' +
        acEcoEsc(acT(pw.key)) + ' →</a></li>';
    }).join('') + '</ul><p class="mk-fine">' + acEcoEsc(acT('eco_pk_separate')) + '</p></div>';
}

// ---------- ecosystem block ----------
// compact: one line for footers/dashboards; full: two-column explainer.
function acEcosystemHTML(variant) {
  const pk = '<a href="' + acPkUrl('services', null, null, '') + '" rel="noopener" data-track="estate_to_pk_click" data-intent="services">AgenticCore Pakistan</a>';
  if (variant === 'compact') {
    return '<p class="eco-compact"><span class="eco-badge">' + acEcoEsc(acT('eco_name')) + '</span> ' +
      '<strong>Estate</strong> · ' + acEcoEsc(acT('eco_estate_verbs')) + ' — ' + pk + ' · ' + acEcoEsc(acT('eco_pk_verbs')) + '</p>';
  }
  return '<div class="eco-block"><p class="eco-kicker">' + acEcoEsc(acT('eco_name')) + '</p><div class="eco-cols">' +
    '<div class="eco-col"><h3>AgenticCore Estate</h3><p class="eco-verbs">' + acEcoEsc(acT('eco_estate_verbs')) + '</p><p>' + acEcoEsc(acT('eco_estate_desc')) + '</p></div>' +
    '<div class="eco-col"><h3>AgenticCore Pakistan</h3><p class="eco-verbs">' + acEcoEsc(acT('eco_pk_verbs')) + '</p><p>' + acEcoEsc(acT('eco_pk_desc')) + '</p>' +
      '<p><a class="btn btn-secondary btn-sm" href="' + acPkUrl('services', null, null, 'services.html') + '" rel="noopener" data-track="estate_to_pk_click" data-intent="services">' + acEcoEsc(acT('h2_eco_pk_cta')) + '</a></p></div>' +
    '</div><p class="mk-fine">' + acEcoEsc(acT('eco_pk_separate')) + '</p></div>';
}

// ---------- sharing ----------
// Public pages only (genuine entities). Text is short: title + canonical URL;
// never a phone number or other contact detail.
function acShareBarHTML(kind) {
  return '<div class="ac-share" data-share-kind="' + acEcoEsc(kind) + '"><span class="ac-share-label">' + acEcoEsc(acT('share_h')) + '</span>' +
    (navigator.share ? '<button type="button" class="btn btn-secondary btn-sm" data-share="native">' + acEcoEsc(acT('share_native')) + '</button>' : '') +
    '<a class="btn btn-secondary btn-sm" data-share="whatsapp" target="_blank" rel="noopener" href="#">WhatsApp</a>' +
    '<button type="button" class="btn btn-secondary btn-sm" data-share="copy">' + acEcoEsc(acT('share_copy')) + '</button>' +
    '<span class="ac-share-status" role="status"></span></div>';
}
function acShareText(title, url) { return String(title || '').slice(0, 140) + '\n' + url; }
function acWireShareBar(container, title, url, event) {
  const bar = container && container.querySelector('.ac-share');
  if (!bar) return;
  const text = acShareText(title, url);
  const status = bar.querySelector('.ac-share-status');
  const wa = bar.querySelector('[data-share="whatsapp"]');
  if (wa) {
    wa.href = 'https://wa.me/?text=' + encodeURIComponent(text);
    wa.addEventListener('click', function () { acTrack(event, { channel: 'whatsapp' }); });
  }
  const nat = bar.querySelector('[data-share="native"]');
  if (nat) nat.addEventListener('click', async function () {
    try { await navigator.share({ title: title, text: String(title || ''), url: url }); acTrack(event, { channel: 'native' }); } catch (e) { /* cancelled */ }
  });
  const cp = bar.querySelector('[data-share="copy"]');
  if (cp) cp.addEventListener('click', async function () {
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { ok = false; }
    status.textContent = ok ? acT('share_copied') : url;
    if (ok) acTrack(event, { channel: 'copy' });
  });
}

// Canonical public URL for an entity page.
function acCanonicalUrl(page, id) { return AC_SITE + page + (id ? '?id=' + encodeURIComponent(id) : ''); }

// Per-entity <head> tags for JS-rendered detail pages (search engines render JS).
function acSetPageMeta(o) {
  function meta(attr, name, content) {
    if (!content) return;
    let el = document.head.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }
  if (o.title) document.title = o.title + ' — AgenticCore Estate';
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
  link.href = o.url;
  const desc = String(o.description || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  meta('name', 'description', desc);
  meta('property', 'og:title', o.title);
  meta('property', 'og:description', desc);
  meta('property', 'og:url', o.url);
  meta('property', 'og:type', 'website');
  if (o.image) meta('property', 'og:image', /^https?:/.test(o.image) ? o.image : AC_SITE + o.image.replace(/^\//, ''));
  // sample/demonstration pages are not for search results
  if (o.noindex) meta('name', 'robots', 'noindex');
}

// ---------- analytics hook ----------
// No tracking library. Emits a DOM event (and pushes to window.dataLayer only if
// a tag manager is ever added). Only allow-listed, non-personal fields pass.
const AC_TRACK_EVENTS = ['estate_to_pk_click', 'pk_to_estate_click', 'promote_property_click', 'promote_project_click',
  'share_property', 'share_profile', 'share_project', 'toolkit_export', 'enquiry_started', 'enquiry_sent', 'next_action_click',
  'social_click', 'contact_click',
  'assistant_opened', 'assistant_question', 'assistant_action', 'amaan_find_started', 'amaan_find_result', 'amaan_list_started', 'amaan_list_review',
  'assistant_handoff_whatsapp', 'assistant_handoff_email'];
const AC_TRACK_FIELDS = ['intent', 'entity', 'channel', 'format', 'action', 'page', 'bot', 'lang', 'result'];
function acTrack(event, props) {
  if (AC_TRACK_EVENTS.indexOf(event) < 0) return;
  const clean = { page: (location.pathname.split('/').pop() || 'index.html') };
  Object.keys(props || {}).forEach(function (k) {
    const v = String(props[k]);
    // short labels only — never an id (UUID) or anything phone-like
    if (AC_TRACK_FIELDS.indexOf(k) >= 0 && /^[a-z0-9_:-]{1,40}$/i.test(v) && !AC_UUID_RE.test(v) && !/[0-9]{6,}/.test(v)) clean[k] = v;
  });
  try { window.dispatchEvent(new CustomEvent('ac:track', { detail: { event: event, props: clean } })); } catch (e) { /* old browser */ }
  if (Array.isArray(window.dataLayer)) window.dataLayer.push(Object.assign({ event: event }, clean));
}
// Links can declare data-track="<event>" data-intent/data-entity — one listener for the whole page.
document.addEventListener('click', function (e) {
  const a = e.target && e.target.closest && e.target.closest('[data-track]');
  if (a) acTrack(a.getAttribute('data-track'), { intent: a.getAttribute('data-intent'), entity: a.getAttribute('data-entity'), action: a.getAttribute('data-action'), channel: a.getAttribute('data-channel') });
});

// Arrivals from AgenticCore Pakistan are counted once per page view (no personal data).
document.addEventListener('DOMContentLoaded', function () {
  const ctx = acIncomingContext();
  if (ctx && ctx.from === 'pk') acTrack('pk_to_estate_click', { intent: ctx.intent || 'none' });
});
