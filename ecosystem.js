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
const AC_PK_BASE = 'https://agenticcorepk.netlify.app/';

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
  // property promotion uses PK's existing pack builder (?listing=, guarded by pk_0003)
  property: [
    { intent: 'promote', key: 'eco_pw_promote_property', page: '' },
    { intent: 'creative', key: 'eco_pw_presentation', page: 'services.html', hash: 'service-28' },   // listing photo enhancement
    { intent: 'social', key: 'eco_pw_social', page: 'services.html', hash: 'social-media' }
  ],
  project: [
    { intent: 'project_marketing', key: 'eco_pw_project_marketing', page: 'services.html', hash: 'service-40' }, // project launch campaigns
    { intent: 'creative', key: 'eco_pw_brochures', page: 'services.html', hash: 'service-6' },                 // PDF brochures / booklets
    { intent: 'website', key: 'eco_pw_landing', page: 'services.html', hash: 'service-15' }                     // property/project landing page
  ],
  professional: [
    { intent: 'brand', key: 'eco_pw_personal_brand', page: 'services.html', hash: 'service-3' },  // agent personal branding kit
    { intent: 'social', key: 'eco_pw_social', page: 'services.html', hash: 'social-media' },
    { intent: 'creative', key: 'eco_pw_material', page: 'services.html', hash: 'print-and-sales' }
  ],
  agency: [
    { intent: 'brand', key: 'eco_pw_agency_brand', page: 'services.html', hash: 'service-1' },    // logo and brand identity
    { intent: 'social', key: 'eco_pw_social', page: 'services.html', hash: 'social-media' },
    { intent: 'website', key: 'eco_pw_website', page: 'services.html', hash: 'service-14' },      // agency and developer websites
    { intent: 'promote', key: 'eco_pw_campaigns', page: 'services.html', hash: 'campaigns' }
  ],
  builder: [
    { intent: 'project_marketing', key: 'eco_pw_project_marketing', page: 'services.html', hash: 'service-40' },
    { intent: 'creative', key: 'eco_pw_brochures', page: 'services.html', hash: 'service-6' },
    { intent: 'website', key: 'eco_pw_website', page: 'services.html', hash: 'service-14' }
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
      return '<li><a href="' + acPkPathwayUrl(pw, entityType, entityId) + '" rel="noopener" data-track="estate_to_pk_click" data-intent="' + pw.intent + '" data-entity="' + entityType + '">' +
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
  'share_property', 'share_profile', 'share_project', 'toolkit_export', 'enquiry_started', 'enquiry_sent', 'next_action_click'];
const AC_TRACK_FIELDS = ['intent', 'entity', 'channel', 'format', 'action', 'page'];
function acTrack(event, props) {
  if (AC_TRACK_EVENTS.indexOf(event) < 0) return;
  const clean = { page: (location.pathname.split('/').pop() || 'index.html') };
  Object.keys(props || {}).forEach(function (k) {
    if (AC_TRACK_FIELDS.indexOf(k) >= 0 && /^[a-z0-9_:-]{1,40}$/i.test(String(props[k]))) clean[k] = String(props[k]);
  });
  try { window.dispatchEvent(new CustomEvent('ac:track', { detail: { event: event, props: clean } })); } catch (e) { /* old browser */ }
  if (Array.isArray(window.dataLayer)) window.dataLayer.push(Object.assign({ event: event }, clean));
}
// Links can declare data-track="<event>" data-intent/data-entity — one listener for the whole page.
document.addEventListener('click', function (e) {
  const a = e.target && e.target.closest && e.target.closest('[data-track]');
  if (a) acTrack(a.getAttribute('data-track'), { intent: a.getAttribute('data-intent'), entity: a.getAttribute('data-entity'), action: a.getAttribute('data-action') });
});

// Arrivals from AgenticCore Pakistan are counted once per page view (no personal data).
document.addEventListener('DOMContentLoaded', function () {
  const ctx = acIncomingContext();
  if (ctx && ctx.from === 'pk') acTrack('pk_to_estate_click', { intent: ctx.intent || 'none' });
});
