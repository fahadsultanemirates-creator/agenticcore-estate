// AgenticCore Dealer AI — the feed's pure logic: understanding what people
// type (English / Urdu / Roman Urdu), sizes in marla, matching listings to
// buyer requests, and the text cards the bot sends.
// No network, no database: everything here is unit-tested directly.

import { parseCriteria } from '../criteria.mjs';
import { extractFacts, ASK_SELLER } from '../listing-draft.mjs';
import { toSearchText } from '../assistant-service.mjs';
import { PROPERTY_TYPES, toMarla, formatPKR, formatSize, norm } from '../util.mjs';

export const FEED_TYPES = ['house', 'flat', 'upper_portion', 'lower_portion', 'residential_plot', 'commercial_plot', 'shop', 'office',
  'building', 'warehouse', 'farm_house', 'room', 'agricultural_land'];
export const BUILT = ['house', 'flat', 'upper_portion', 'lower_portion', 'room', 'farm_house'];
export const LISTING_DAYS = 30;
export const REQUEST_HOURS = 24;
export const KEEP_DAYS = 7;

// ---------- text ----------
// Spoken / Urdu forms the shared parsers don't know yet.
const SECTOR_LETTER = [[/ایف/g, 'F'], [/جی/g, 'G'], [/آئی/g, 'I'], [/ای/g, 'E'], [/ڈی(?!\s*ایچ)/g, 'D'], [/بی/g, 'B'], [/ایچ/g, 'H']];
export function normaliseText(text) {
  let t = String(text || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  // Islamabad sectors in Urdu letters: "جی 13" / "جی-13" → G-13
  SECTOR_LETTER.forEach(([re, l]) => {
    t = t.replace(new RegExp(re.source + '\\s*-?\\s*(\\d{1,2})(?:\\s*/\\s*(\\d))?', 'g'), (m, n, s) => ' ' + l + '-' + n + (s ? '/' + s : '') + ' ');
  });
  // fractions people say instead of digits
  t = t.replace(/ساڑھے\s*(\d+)/g, (m, n) => ' ' + n + '.5 ').replace(/سوا\s*(\d+)/g, (m, n) => ' ' + n + '.25 ')
    .replace(/ڈھائی/g, ' 2.5 ').replace(/ڈیڑھ/g, ' 1.5 ');
  t = t.replace(/\b(?:sa+rhe|sa+de|saa?dhe)\s+(\d+)\b/gi, (m, n) => n + '.5').replace(/\bsawa\s+(\d+)\b/gi, (m, n) => n + '.25')
    .replace(/\b(?:dhai|dhaai|arhai|adhai)\b/gi, '2.5').replace(/\b(?:dedh|derh|dairh)\b/gi, '1.5');
  t = t.replace(/چاہیے|چاہئے|درکار/g, ' need ').replace(/دستیاب|برائے فروخت/g, ' for sale ');
  return toSearchText(t);
}

const SEARCH_WORDS = /\b(need|needed|want|wanted|looking|require|required|chahiye|chahie|chahye|chaiye|darkar|dhoond|dhund|talash|search|find|budget|under|tak|within|max|upto|up to|koi hai|milega|mil sakta)\b|\?/i;
const OFFER_WORDS = /\b(for sale|for rent|available|demand|sell|selling|bechna|bechni|farokht|dastiyab|kiraye (ke liye|par|pe) (dena|diya|available|khali)|on rent|to let|owner|post|listing|offer|possession)\b/i;
// 'listing' | 'search' | null (ask)
export function guessIntent(text) {
  const t = normaliseText(text);
  const s = SEARCH_WORDS.test(t), o = OFFER_WORDS.test(t);
  if (s && !o) return 'search';
  if (o && !s) return 'listing';
  return null;
}

// ---------- sizes / money / phones ----------
export function parseSize(text) {
  const c = parseCriteria(' ' + normaliseText(text) + ' ');
  if (c.size && c.size.value > 0) return { value: c.size.value, unit: c.size.unit };
  const m = String(text).match(/(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|square feet|feet|ft|sq\.?\s*yd|sqyd|square yards?|gaz)/i);
  if (m) return { value: Number(m[1]), unit: /yd|yard|gaz/i.test(m[2]) ? 'sqyd' : 'sqft' };
  return null;
}
// "2.4 crore", "85 lakh", "60 hazar", "60000", "ask seller" → number | 'ask' | null
export function parsePrice(text) {
  const raw = String(text || '');
  if (ASK_SELLER.test(raw) || /\b(ask|call)\b/i.test(raw) || /پوچھ/.test(raw)) return 'ask';
  const c = parseCriteria(' ' + normaliseText(raw) + ' demand ');
  const v = c.price_max || c.price_min;
  if (v > 0) return v;
  const plain = raw.replace(/[,\s]/g, '').match(/^(?:rs\.?|pkr)?(\d{4,12})$/i);
  return plain ? Number(plain[1]) : null;
}
export function parseCount(text) {
  const m = normaliseText(text).match(/\d{1,2}/);
  return m ? Number(m[0]) : null;
}
// Same rules as public.ac_norm_phone(): one standard form, +<country><number>.
export function normPhone(p) {
  let d = String(p || '').trim().replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, '');
  if (!d || d === '+') return null;
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('+')) return '+' + d.slice(1).replace(/^0+/, '');
  if (/^0\d{9,10}$/.test(d)) return '+92' + d.slice(1);
  if (/^3\d{9}$/.test(d)) return '+92' + d;
  if (/^92\d{9,10}$/.test(d)) return '+' + d;
  return '+' + d;
}

// City typed by a person → a city from the database list (or null).
export function matchCity(text, cities) {
  const t = norm(normaliseText(text));
  if (!t) return null;
  const list = (cities || []).slice().sort((a, b) => b.length - a.length);
  const exact = list.find((c) => norm(c) === t);
  if (exact) return exact;
  const parts = (c) => norm(c).split(/[ /()]+/).filter((w) => w.length >= 3 && !['gali', 'town', 'city', 'ajk'].includes(w));
  return list.find((c) => t.includes(norm(c))) || list.find((c) => parts(c).some((w) => t === w || (w.length >= 4 && t.includes(w)))) ||
    (/\b(isb|islamabad)\b/.test(t) && list.includes('Islamabad') ? 'Islamabad' : null) ||
    (/\b(pindi|rwp)\b/.test(t) && list.includes('Rawalpindi') ? 'Rawalpindi' : null) ||
    (/\b(lhr)\b/.test(t) && list.includes('Lahore') ? 'Lahore' : null) ||
    (/\b(khi)\b/.test(t) && list.includes('Karachi') ? 'Karachi' : null) || null;
}

// ---------- listing text → draft ----------
export function draftFromText(text, areaNames, cities) {
  const f = extractFacts(normaliseText(text), areaNames || []);
  const d = {};
  if (f.purpose) d.purpose = f.purpose === 'rent' ? 'rent' : 'sale';
  if (f.property_type && FEED_TYPES.includes(f.property_type)) d.property_type = f.property_type;
  const city = f.city && matchCity(f.city, cities);
  if (city) d.city = city;
  if (f.area) d.area = String(f.area).slice(0, 120);
  // keep the sub-sector people typed: "G-13/2", not just "G-13"
  const sub = normaliseText(text).match(/\b([b-i])\s?-?\s?(\d{1,2})\s?\/\s?(\d)\b/i);
  if (sub && d.area && norm(d.area) === norm(sub[1] + '-' + sub[2])) d.area = sub[1].toUpperCase() + '-' + sub[2] + '/' + sub[3];
  if (f.size_value) { d.size_value = f.size_value; d.size_unit = f.size_unit || 'marla'; }
  if (f.price_ask) d.price_ask = true;
  else if (f.price) d.price = f.price;
  if (f.beds) d.beds = f.beds;
  if (f.baths) d.baths = f.baths;
  return d;
}

// The next thing to ask for a listing draft (null = ready for the summary).
export function nextListingStep(d) {
  if (!d.purpose) return 'purpose';
  if (!d.property_type) return 'type';
  if (!d.city) return 'city';
  if (!d.area) return 'area';
  if (!d.size_value && !d.size_skipped) return 'size';
  if (d.price == null && !d.price_ask) return 'price';
  if (BUILT.includes(d.property_type)) {
    if (d.beds == null && !d.beds_skipped) return 'beds';
    if (d.baths == null && !d.baths_skipped) return 'baths';
  }
  if (d.address === undefined) return 'address';
  if (d.notes === undefined) return 'notes';
  return null;
}

// Draft → feed_listings row (without ids / ref).
export function listingRow(d) {
  return {
    purpose: d.purpose, property_type: d.property_type, city: d.city, area: d.area,
    address: d.address || null,
    size_value: d.size_value || null, size_unit: d.size_value ? (d.size_unit || 'marla') : null,
    size_marla: d.size_value ? Math.round(toMarla(d.size_value, d.size_unit || 'marla') * 100) / 100 : null,
    price: d.price_ask ? null : (d.price || null),
    beds: d.beds == null ? null : d.beds, baths: d.baths == null ? null : d.baths,
    notes: d.notes || null
  };
}

// No phone numbers, links or e-mails in public text: contact goes through the reveal.
export function hasContactInfo(s) {
  return /(\+?92|0)\s?3\d{2}[\s-]?\d{7}\b|\+\d[\d\s-]{8,}\d|https?:\/\/|www\.|[\w.+-]+@[\w-]+\.[\w.]+|wa\.me|whatsapp\s*:?\s*\d/i.test(String(s || ''));
}

// ---------- buyer query → request ----------
export function parseQuery(text, areaNames, cities) {
  const t = normaliseText(text);
  const c = parseCriteria(t, areaNames || []);
  const city = matchCity(c.city || c.implied_city || '', cities) || c.city || c.implied_city || null;
  const sz = c.size ? toMarla(c.size.value, c.size.unit) : null;
  return {
    purpose: c.purpose === 'rent' ? 'rent' : (c.purpose === 'buy' ? 'sale' : null),
    property_types: c.property_types.filter((x) => FEED_TYPES.includes(x)),
    city,
    // each area = its tokens joined by '|', all must appear in the listing's area
    areas: c.locations.map((l) => l.tokens.join('|')).slice(0, 5),
    area_labels: c.locations.map((l) => l.label).slice(0, 5),
    price_min: c.price_min || null,
    price_max: c.price_max || null,
    size_marla: sz ? Math.round(sz * 100) / 100 : null,
    beds_min: c.beds_min || null
  };
}
export function queryUsable(q) { return Boolean(q.city || q.areas.length); }

function hasToken(hay, token) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|\\s)' + esc + '(?=$|[\\s/])').test(hay);
}
export function areaMatches(listingArea, areas) {
  if (!areas || !areas.length) return true;
  const hay = norm(normaliseText(listingArea));
  return areas.some((group) => String(group).split('|').every((tok) => hasToken(hay, norm(tok))));
}

// Does a listing fit a request? Missing listing facts don't rule it out
// (an "ask the seller" price, no bedroom count) — wrong ones do.
export function matches(l, r) {
  if (r.purpose && l.purpose !== r.purpose) return false;
  if (r.property_types && r.property_types.length && !r.property_types.includes(l.property_type)) return false;
  if (r.city && norm(l.city) !== norm(r.city)) return false;
  if (!areaMatches(l.area, r.areas)) return false;
  if (l.price != null) {
    if (r.price_max && Number(l.price) > Number(r.price_max)) return false;
    if (r.price_min && Number(l.price) < Number(r.price_min)) return false;
  }
  if (r.size_marla && l.size_marla) {
    const a = Number(l.size_marla), b = Number(r.size_marla);
    if (Math.abs(a - b) > b * 0.1 + 0.01) return false;
  }
  if (r.beds_min && l.beds != null && Number(l.beds) < Number(r.beds_min)) return false;
  return true;
}
// Best first: complete facts, then newest.
export function rank(listings) {
  const score = (l) => (l.price != null ? 1 : 0) + (l.size_marla ? 1 : 0);
  return listings.slice().sort((a, b) => score(b) - score(a) || String(b.created_at).localeCompare(String(a.created_at)));
}

// ---------- refs ----------
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRef(prefix, rand) {
  const r = rand || Math.random;
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(r() * ALPHA.length)];
  return prefix + '-' + s;
}

// ---------- cards ----------
const TYPE_UR = { house: 'گھر', flat: 'فلیٹ', upper_portion: 'اپر پورشن', lower_portion: 'لوئر پورشن', residential_plot: 'رہائشی پلاٹ',
  commercial_plot: 'کمرشل پلاٹ', shop: 'دکان', office: 'دفتر', building: 'بلڈنگ', warehouse: 'گودام', farm_house: 'فارم ہاؤس', room: 'کمرہ',
  agricultural_land: 'زرعی زمین' };
export function typeLabel(type, lang) {
  if (lang === 'ur') return TYPE_UR[type] || type;
  return PROPERTY_TYPES[type] || type;
}
function dateLabel(iso, lang) {
  const d = new Date(iso || Date.now());
  return d.toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });
}
export function priceLabel(l, lang) {
  if (l.price == null) return lang === 'ur' ? 'قیمت: مالک سے پوچھیں' : (lang === 'ro' ? 'Qeemat: seller se poochein' : 'Price: ask the seller');
  return formatPKR(l.price) + (l.purpose === 'rent' ? (lang === 'ur' ? ' ماہانہ' : '/month') : '');
}
export const UNVERIFIED = {
  en: '⚠️ User-submitted, not verified.',
  ur: '⚠️ صارف کی دی ہوئی معلومات، تصدیق شدہ نہیں۔',
  ro: '⚠️ User ki di hui maloomat, verified nahi.'
};
export function card(l, lang, opts) {
  lang = lang || 'en';
  const purpose = l.purpose === 'rent'
    ? (lang === 'ur' ? 'کرائے کے لیے' : (lang === 'ro' ? 'kiraye ke liye' : 'for rent'))
    : (lang === 'ur' ? 'برائے فروخت' : (lang === 'ro' ? 'baraye farokht' : 'for sale'));
  const lines = ['🏠 ' + (l.ref ? l.ref + ' · ' : '') + typeLabel(l.property_type, lang) + ' ' + purpose, '📍 ' + l.area + ', ' + l.city];
  const facts = [];
  if (l.size_value) facts.push('📐 ' + formatSize(l.size_value, l.size_unit));
  if (l.beds != null) facts.push('🛏 ' + l.beds);
  if (l.baths != null) facts.push('🛁 ' + l.baths);
  if (facts.length) lines.push(facts.join(' · '));
  lines.push('💰 ' + priceLabel(l, lang));
  if (l.notes) lines.push('📝 ' + l.notes);
  const by = l.poster_role === 'dealer' ? (lang === 'ur' ? 'ڈیلر' : 'dealer') : (l.poster_role === 'owner' ? (lang === 'ur' ? 'مالک' : 'owner') : '');
  lines.push('🗓 ' + dateLabel(l.created_at, lang) + (by ? ' · ' + by : ''));
  if (!opts || !opts.own) lines.push(UNVERIFIED[lang] || UNVERIFIED.en);
  return lines.join('\n');
}
// What the bot understood from a buyer's words.
export function describeQuery(q, lang) {
  const p = [];
  if (q.size_marla) p.push(formatSize(q.size_marla, 'marla'));
  p.push(q.property_types.length ? q.property_types.map((x) => typeLabel(x, lang)).join(' / ') : (lang === 'ur' ? 'پراپرٹی' : 'property'));
  if (q.purpose) p.push(q.purpose === 'rent' ? (lang === 'ur' ? 'کرائے پر' : (lang === 'ro' ? 'kiraye par' : 'for rent')) : (lang === 'ur' ? 'خریدنے کے لیے' : (lang === 'ro' ? 'khareedne ke liye' : 'to buy')));
  const where = (q.area_labels || []).join(' / ');
  if (where || q.city) p.push('· ' + [where, q.city].filter(Boolean).join(', '));
  if (q.beds_min) p.push('· ' + q.beds_min + '+ 🛏');
  if (q.price_max) p.push('· ' + (lang === 'ur' ? 'زیادہ سے زیادہ ' : (lang === 'ro' ? 'zyada se zyada ' : 'up to ')) + formatPKR(q.price_max));
  else if (q.price_min) p.push('· ' + (lang === 'ur' ? 'کم از کم ' : (lang === 'ro' ? 'kam az kam ' : 'from ')) + formatPKR(q.price_min));
  return p.join(' ');
}
// Request row → the query shape matches() takes.
export function requestQuery(r) {
  return { purpose: r.purpose, property_types: r.property_types || [], city: r.city, areas: r.areas || [], price_min: r.price_min,
    price_max: r.price_max, size_marla: r.size_marla, beds_min: r.beds_min };
}
