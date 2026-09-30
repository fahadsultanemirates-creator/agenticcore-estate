// Deterministic property-request parser.
// Turns "I have 4 crore and want a recently built 10 marla house around DHA
// or Bahria Rawalpindi with at least 4 bedrooms" into structured criteria.
// Always runs (no AI needed); an AI model may later fill gaps, but it can
// only ADD missing fields — it never overrides what the text states.

import { norm, COMMERCIAL_TYPES, formatPKR } from './util.mjs';

const UNIT_MULT = {
  crore: 1e7, cr: 1e7, crores: 1e7, karor: 1e7, karod: 1e7,
  lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, lkh: 1e5, l: 1e5,
  million: 1e6, mn: 1e6, m: 1e6,
  thousand: 1e3, k: 1e3, hazar: 1e3, hazaar: 1e3
};

// Societies / localities that people type in Islamabad & Rawalpindi.
// Matching is token-based against listing.area, so "DHA" matches
// "DHA Phase 2" and "Bahria Phase 7" matches "Bahria Town Phase 7".
const SOCIETIES = [
  ['dha', ['dha', 'defence', 'defense']], ['bahria', ['bahria']], ['gulberg', ['gulberg']], ['pwd', ['pwd']],
  ['cbr', ['cbr']], ['askari', ['askari']], ['top city', ['top city']], ['capital smart city', ['smart city']],
  ['blue world', ['blue world']], ['park view', ['park view']], ['multi gardens', ['multi garden', 'mpchs']],
  ['soan garden', ['soan garden']], ['naval anchorage', ['naval anchorage']], ['media town', ['media town']],
  ['gulraiz', ['gulraiz']], ['chaklala', ['chaklala']], ['saddar', ['saddar']], ['satellite town', ['satellite town']],
  ['adiala', ['adiala']], ['airport housing', ['airport housing']], ['jinnah garden', ['jinnah garden']],
  ['ghauri town', ['ghauri']], ['korang town', ['korang']], ['bani gala', ['bani gala', 'banigala']],
  ['faisal town', ['faisal town']], ['eighteen', ['eighteen']], ['rawat', ['rawat']], ['westridge', ['westridge']],
  ['wapda town', ['wapda']], ['police foundation', ['police foundation']], ['mumtaz city', ['mumtaz city']]
];

const TYPE_WORDS = [
  [/\b(upper portion|upper floor)\b/, ['upper_portion']],
  [/\b(lower portion|ground portion|ground floor)\b/, ['lower_portion']],
  [/\bfarm ?house\b/, ['farm_house']],
  [/\b(flat|flats|apartment|apartments|appartment|studio)\b/, ['flat']],
  [/\b(commercial plot)\b/, ['commercial_plot']],
  [/\b(agricultural|agri land|zameen for farming)\b/, ['agricultural_land']],
  [/\b(residential plot|plot|plots)\b/, ['residential_plot']],
  [/\b(shop|shops|dukaan|dukan)\b/, ['shop']],
  [/\b(office|offices)\b/, ['office']],
  [/\b(warehouse|factory|godown)\b/, ['warehouse']],
  [/\b(building|plaza)\b/, ['building']],
  [/\b(room|rooms for rent|hostel)\b/, ['room']],
  [/\b(house|houses|home|ghar|bungalow|villa|double unit|single unit|double storey|single storey)\b/, ['house']],
  [/\bcommercial (property|space|unit)\b/, COMMERCIAL_TYPES]
];

const PREFERENCES = [
  ['new construction', /\b(brand new|newly built|new(ly)? constructed|new construction|recently built|new build|naya)\b/, ['brand new', 'newly built', 'new construction', 'recently built', 'new house', 'newly constructed']],
  ['corner', /\bcorner\b/, ['corner']],
  ['park facing', /\bpark facing|facing park\b/, ['park facing', 'facing park']],
  ['furnished', /\b(fully furnished|furnished)\b/, ['furnished']],
  ['near schools', /\b(near|close to|walking distance).{0,12}schools?\b/, ['school']],
  ['main boulevard', /\b(main )?boulevard\b/, ['boulevard']],
  ['gas available', /\bgas\b/, ['gas']],
  ['possession', /\b(possession|ready to move|move in ready)\b/, ['possession', 'ready to move']],
  ['investment', /\binvest(ment|or)?\b/, []]
];

function toNumber(str) { return Number(String(str).replace(/,/g, '')); }

function parseMoney(text) {
  // "between 2 and 3 crore" / "2-3 crore"
  const range = text.match(/(?:between\s+)?(\d+(?:\.\d+)?)\s*(?:-|to|and)\s*(\d+(?:\.\d+)?)\s*(crores?|cr|karor|lacs?|lakhs?|million|k|thousand)\b/);
  if (range && !/\b(bed|bath|marla|kanal)/.test(text.slice(range.index, range.index + range[0].length + 8))) {
    const mult = UNIT_MULT[range[3]] || 1;
    return { min: toNumber(range[1]) * mult, max: toNumber(range[2]) * mult };
  }
  const re = /(?:(under|below|less than|max(?:imum)?|up ?to|upto|within|budget(?: of| is)?|have|i have|demand|around|about|approx(?:imately)?|above|over|more than|min(?:imum)?|at least|from)\s+)?(?:rs\.?|pkr|rupees)?\s*(\d+(?:[.,]\d+)*)\s*(crores?|cr|karor|karod|lacs?|lakhs?|lkh|million|mn|thousand|hazaa?r|k)\b/g;
  let m; const found = [];
  while ((m = re.exec(text))) found.push({ word: m[1] || '', value: toNumber(m[2]) * (UNIT_MULT[m[3]] || 1) });
  // plain rupee amounts: "rs 33000000", "budget 5000000"
  const plain = /(?:(under|below|max|up ?to|upto|budget|around|above|over|min)\s+)?(?:rs\.?|pkr)\s*(\d[\d,]{4,})\b/g;
  while ((m = plain.exec(text))) found.push({ word: m[1] || '', value: toNumber(m[2]) });
  if (!found.length) return {};
  const f = found[0];
  if (/above|over|more than|min|at least|from/.test(f.word)) return { min: f.value };
  if (/around|about|approx/.test(f.word)) return { min: Math.round(f.value * 0.85), max: Math.round(f.value * 1.15) };
  return { max: f.value };
}

function parseSize(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(marla|marlay|kanal|kanals|sq\.?\s?ft|sqft|square feet|sq\.?\s?yd|sqyd|square yards?|yards?|gaz)\b/);
  if (!m) return /\bkanal\b/.test(text) ? { value: 1, unit: 'kanal' } : null;
  const u = m[2];
  const unit = /kanal/.test(u) ? 'kanal' : /ft|feet/.test(u) ? 'sqft' : /yd|yard|gaz/.test(u) ? 'sqyd' : 'marla';
  return { value: Number(m[1]), unit: unit };
}

function parseCount(text, words) {
  const re = new RegExp('(at least|minimum|min|atleast|more than|\\+)?\\s*(\\d{1,2})\\s*(\\+)?\\s*(?:' + words + ')\\b');
  const m = text.match(re);
  if (!m) return null;
  return { n: Number(m[2]), atLeast: Boolean(m[1] || m[3]) };
}

function parseLocations(text, areaNames) {
  const locs = [];
  const seen = new Set();
  const add = (label, tokens) => {
    const k = label.toLowerCase();
    // skip if already covered, e.g. "Gulberg" when "Gulberg Greens" matched
    if (seen.has(k) || locs.some((l) => l.tokens.some((t) => t.includes(norm(tokens[0]))))) return;
    seen.add(k); locs.push({ label, tokens });
  };

  // Exact area names from the database first (longest first).
  (areaNames || []).slice().sort((a, b) => b.length - a.length).forEach(function (name) {
    const n = norm(name);
    if (n.length >= 4 && text.includes(n)) add(name, [n]);
  });

  SOCIETIES.forEach(function ([label, aliases]) {
    aliases.forEach(function (alias) {
      const idx = text.indexOf(alias);
      if (idx < 0) return;
      // "bahria phase 7", "dha phase 2", "bahria town phase 8"
      const after = text.slice(idx, idx + alias.length + 20);
      const phase = after.match(/phase\s*(\d{1,2}[a-z]?)/);
      const tokens = [label === 'dha' ? 'dha' : alias];
      if (phase) tokens.push('phase ' + phase[1]);
      const pretty = label.length <= 4 ? label.toUpperCase() : label.replace(/\b\w/g, (c) => c.toUpperCase());
      add(pretty + (phase ? ' Phase ' + phase[1] : ''), tokens);
    });
  });

  // Islamabad sectors: G-13, F-7/2, E 11, I-8, B-17, D-12
  const sec = /\b([b-i])\s?-?\s?(\d{1,2})(?:\s?\/\s?(\d))?\b(?!\s*(?:marla|kanal|bed|bath|crore|lac|lakh|k\b))/g;
  let m;
  while ((m = sec.exec(text))) {
    const code = m[1] + '-' + m[2] + (m[3] ? '/' + m[3] : '');
    add(code.toUpperCase(), [m[1] + ' ' + m[2] + (m[3] ? '/' + m[3] : ''), code]);
  }
  return locs;
}

// Main entry. areaNames: optional list of known area names from the DB.
export function parseCriteria(input, areaNames) {
  const raw = String(input || '').slice(0, 600);
  const text = ' ' + norm(raw).replace(/(\d),(\d)/g, '$1$2') + ' ';
  const c = { purpose: null, city: null, property_types: [], locations: [], price_min: null, price_max: null,
    size: null, beds_min: null, beds_exact: null, baths_min: null, preferences: [], keywords: [] };

  if (/\b(rent|rental|kiraya|kiraye|kiraay|for lease|lease|per month|monthly|\/ ?month|pm)\b/.test(text)) c.purpose = 'rent';
  else if (/\b(buy|purchase|sale|for sale|sell|khareed|kharidna|invest)/.test(text)) c.purpose = 'buy';

  if (/\b(islamabad|isb|isl)\b/.test(text)) c.city = 'Islamabad';
  if (/\b(rawalpindi|pindi|rwp)\b/.test(text)) c.city = c.city ? null : 'Rawalpindi'; // both named: no city filter

  for (const [re, types] of TYPE_WORDS) {
    if (re.test(text)) { types.forEach((t) => { if (c.property_types.indexOf(t) < 0) c.property_types.push(t); }); }
  }
  // "commercial property" beats a stray "plot"/"house" match
  if (/\bcommercial (property|space|unit)\b/.test(text)) c.property_types = COMMERCIAL_TYPES.slice();
  // "upper portion" also matched "house"? keep the more specific one
  if (c.property_types.some((t) => ['upper_portion', 'lower_portion', 'farm_house'].includes(t))) c.property_types = c.property_types.filter((t) => t !== 'house');
  if (c.property_types.includes('commercial_plot')) c.property_types = c.property_types.filter((t) => t !== 'residential_plot');

  const money = parseMoney(text);
  if (money.min) c.price_min = money.min;
  if (money.max) c.price_max = money.max;
  if (!c.purpose && c.price_max && c.price_max <= 1000000 && /\b(k|thousand|hazaa?r)\b/.test(text)) c.purpose = 'rent';

  c.size = parseSize(text);
  const beds = parseCount(text, 'bed(?:room)?s?|bd|bhk|kamr[ae]y?|rooms?');
  if (beds) { c.beds_min = beds.n; if (!beds.atLeast) c.beds_exact = beds.n; }
  const baths = parseCount(text, 'bath(?:room)?s?|washrooms?');
  if (baths) c.baths_min = baths.n;

  c.locations = parseLocations(text, areaNames);
  PREFERENCES.forEach(function ([label, re, words]) {
    if (re.test(text)) { c.preferences.push(label); c.keywords.push.apply(c.keywords, words); }
  });
  return c;
}

// How many useful facts were found — used to decide on a follow-up question.
export function criteriaStrength(c) {
  return ['purpose', 'city'].filter((k) => c[k]).length + (c.property_types.length ? 1 : 0) + (c.locations.length ? 1 : 0) +
    (c.price_max || c.price_min ? 1 : 0) + (c.size ? 1 : 0) + (c.beds_min ? 1 : 0);
}

export function followUpQuestion(c) {
  if (criteriaStrength(c) >= 2) return null;
  const missing = [];
  if (!c.purpose) missing.push('are you looking to buy or rent');
  if (!c.property_types.length) missing.push('what type of property (house, flat, plot, shop…)');
  if (!c.city && !c.locations.length) missing.push('which area of Islamabad or Rawalpindi');
  if (!c.price_max) missing.push('roughly what budget');
  return missing.length ? 'To narrow this down: ' + missing.slice(0, 3).join(', ') + '?' : null;
}

// Human-readable summary of what was understood.
export function describeCriteria(c, labels) {
  const parts = [];
  if (c.size) parts.push(c.size.value + ' ' + c.size.unit);
  if (c.property_types.length) parts.push(c.property_types.map((t) => labels[t] || t).join(' / '));
  else parts.push('property');
  if (c.purpose) parts.push(c.purpose === 'rent' ? 'for rent' : 'to buy');
  if (c.locations.length) parts.push('in ' + c.locations.map((l) => l.label).join(' or '));
  if (c.city) parts.push((c.locations.length ? ', ' : 'in ') + c.city);
  if (c.beds_min) parts.push('· ' + (c.beds_exact ? c.beds_exact : 'at least ' + c.beds_min) + ' bedrooms');
  if (c.price_max && c.price_min) parts.push('· ' + formatPKR(c.price_min) + ' to ' + formatPKR(c.price_max));
  else if (c.price_max) parts.push('· up to ' + formatPKR(c.price_max));
  else if (c.price_min) parts.push('· from ' + formatPKR(c.price_min));
  return parts.join(' ').replace(' ,', ',');
}
