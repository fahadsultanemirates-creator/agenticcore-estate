// AgenticCore Dealer AI — one search across three sources, best 3 back:
//   1. 'feed'    Dealer AI entries (feed_listings, this project)
//   2. 'site'    AgenticCore Estate website listings (same project, public,
//                live ones only — contact stays on the website, signed-in only)
//   3. 'partner' another framework / Supabase project, through its own
//                search API (PARTNER_FEED_URL + PARTNER_FEED_SECRET); off
//                until both are set. Slow or down → simply left out.
// Every result is normalised to the same shape, matched with the same rules,
// de-duplicated, and ranked by best price.

import { toMarla, norm } from '../util.mjs';
import { isLaunched } from '../places.mjs';
import { FEED_TYPES, matches } from './feed.mjs';

export const SITE_URL = 'https://agenticcore.estate';
export const MAX_RESULTS = 3;
const PARTNER_TIMEOUT_MS = 3000;

const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null));
const UNITS = ['marla', 'kanal', 'sqft', 'sqyd'];
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

// website listing row → common shape
export function fromSite(r, siteUrl) {
  const unit = UNITS.includes(r.size_unit) ? r.size_unit : 'marla';
  return {
    source: 'site', id: r.id, ref: 'Estate', purpose: r.type === 'rent' ? 'rent' : 'sale', property_type: r.property_type,
    city: r.city, area: r.area || '', size_value: num(r.size_marla), size_unit: unit, size_marla: round2(toMarla(r.size_marla, unit)),
    price: num(r.price), beds: r.beds == null ? null : Number(r.beds), baths: r.baths == null ? null : Number(r.baths),
    notes: null, created_at: r.created_at, url: (siteUrl || SITE_URL) + '/listing.html?id=' + r.id
  };
}

// partner API row → common shape (untrusted input: everything checked and capped)
export function fromPartner(r, partnerName) {
  if (!r || typeof r !== 'object') return null;
  const purpose = r.purpose === 'rent' ? 'rent' : (r.purpose === 'sale' || r.purpose === 'buy' ? 'sale' : null);
  const type = FEED_TYPES.includes(r.property_type) ? r.property_type : null;
  const city = str(r.city, 60), area = str(r.area, 120);
  if (!purpose || !type || !city || !area) return null;
  const unit = UNITS.includes(r.size_unit) ? r.size_unit : 'marla';
  const url = typeof r.url === 'string' && /^https:\/\/[^\s]{4,300}$/.test(r.url) ? r.url : null;
  const beds = Number.isInteger(r.beds) && r.beds >= 0 && r.beds <= 50 ? r.beds : null;
  const baths = Number.isInteger(r.baths) && r.baths >= 0 && r.baths <= 50 ? r.baths : null;
  return {
    source: 'partner', id: str(String(r.id || r.ref || ''), 60), ref: str(String(r.ref || ''), 30) || (partnerName || 'Partner'),
    partner: partnerName || 'Partner', purpose, property_type: type, city, area,
    size_value: num(r.size_value), size_unit: unit, size_marla: round2(toMarla(r.size_value, unit)),
    price: num(r.price), beds, baths, notes: null, created_at: typeof r.created_at === 'string' ? r.created_at : null, url
  };
}

// Partner search client. The other project exposes POST <url> and answers
// { results: [...] } in the shape fromPartner() reads (max 10).
export function partnerConfig() {
  const url = (process.env.PARTNER_FEED_URL || '').trim();
  const secret = (process.env.PARTNER_FEED_SECRET || '').trim();
  return url && secret && /^https:\/\//.test(url) ? { url, secret, name: (process.env.PARTNER_FEED_NAME || 'Partner').trim().slice(0, 40) } : null;
}
export function makePartnerSearch(fetchImpl, config) {
  const cfg = config === undefined ? partnerConfig() : config;
  if (!cfg) return null;
  const f = fetchImpl || globalThis.fetch;
  return async function search(q) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PARTNER_TIMEOUT_MS);
    try {
      const res = await f(cfg.url, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.secret },
        body: JSON.stringify({ purpose: q.purpose, property_types: q.property_types, city: q.city, areas: q.area_labels || [],
          price_min: q.price_min, price_max: q.price_max, size_marla: q.size_marla, beds_min: q.beds_min, limit: 10 })
      });
      if (!res.ok) return [];
      const data = await res.json().catch(() => null);
      const rows = data && Array.isArray(data.results) ? data.results.slice(0, 10) : [];
      return rows.map((r) => fromPartner(r, cfg.name)).filter(Boolean);
    } catch (e) { return []; } finally { clearTimeout(timer); }
  };
}

// Same property posted in two places → keep one (Dealer AI first: it has a contact).
function sameKey(l) {
  return [l.purpose, l.property_type, norm(l.city), norm(l.area).replace(/\s+/g, ''), l.size_marla || '', l.price || ''].join('|');
}
// Best price first: price per marla when the size is known, else the price;
// "ask the seller" after priced ones; then newest.
export function bestPrice(list) {
  const unit = (l) => (l.price == null ? Infinity : (l.size_marla ? l.price / l.size_marla : l.price));
  const order = { feed: 0, site: 1, partner: 2 };
  return list.slice().sort((a, b) => {
    const pa = a.price == null ? 1 : 0, pb = b.price == null ? 1 : 0;
    if (pa !== pb) return pa - pb;
    const bySize = a.size_marla && b.size_marla;
    const d = bySize ? unit(a) - unit(b) : (a.price || 0) - (b.price || 0);
    if (d) return d;
    return String(b.created_at || '').localeCompare(String(a.created_at || '')) || order[a.source] - order[b.source];
  });
}

// q: parsed query; sources: { feed: () => rows, site: () => rows, partner: (q) => rows | null }
// exclude(l) → true to drop (own entries, blocked posters). Never throws for one source.
export async function searchAll(q, sources, opts) {
  const o = Object.assign({ max: MAX_RESULTS, exclude: () => false, skip: new Set(), now: Date.now() }, opts || {});
  const [feed, site, partner] = await Promise.all([
    Promise.resolve().then(() => (sources.feed ? sources.feed() : [])).catch(() => []),
    Promise.resolve().then(() => (sources.site ? sources.site() : [])).catch(() => []),
    Promise.resolve().then(() => (sources.partner ? sources.partner(q) : [])).catch(() => [])
  ]);
  const all = []
    .concat((feed || []).map((l) => Object.assign({ source: 'feed' }, l)))
    .concat((site || []).filter((l) => isLaunched(l.city, new Date(o.now))))
    .concat(partner || []);
  // one copy per property: Dealer AI first (it has a contact), then the website, then the partner
  const order = { feed: 0, site: 1, partner: 2 };
  const byKey = new Map();
  for (const l of all.filter((l) => matches(l, q) && !o.exclude(l) && !o.skip.has(resultKey(l)))) {
    const k = sameKey(l), had = byKey.get(k);
    if (!had || order[l.source] < order[had.source]) byKey.set(k, l);
  }
  return bestPrice([...byKey.values()]).slice(0, o.max);
}
// A stable id per result across sources (for "already sent").
export function resultKey(l) { return l.source + ':' + l.id; }
