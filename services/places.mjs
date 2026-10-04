// Places: which city an area, sector or society belongs to, and whether a
// city is open yet. Source: data/cities.json (Zameen-style area names), plus
// anything the system has learned and the owner approved (services/memory.mjs
// passes those in as `learned`). Used by Amaan (website + Telegram), the
// listing draft, the copilot search and the assistant.

import data from '../data/cities.json' with { type: 'json' };

export const GAZETTEER = data;
export const CITY_NAMES = data.cities.map((c) => c.name);

const PKT = 'Asia/Karachi';
export function key(s) {
  return String(s || '').toLowerCase().normalize('NFKC')
    .replace(/[‐-―]/g, '-').replace(/\bph(?:ase)?\.?\s*(\d)/g, 'phase $1').replace(/\bsec(?:tor)?\.?\s*/g, '')
    .replace(/[^\p{L}\p{N}\s/-]/gu, ' ').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
}
// "G-10", "g10", "G 10/2" → "G-10"
const SECTOR = /\b([a-i])\s*-?\s*(\d{1,2})(?:\s*\/\s*(\d))?\b/i;
export function sectorOf(text) {
  const m = String(text || '').match(SECTOR);
  if (!m) return null;
  const code = m[1].toUpperCase() + '-' + Number(m[2]);
  return GAZ.byKey.get(key(code)) ? { area: code, sub: m[3] ? code + '/' + m[3] : null } : null;
}

// Bare aliases that would be ordinary words ("New Karachi" → "new"), and
// areas named like ordinary words that only count when typed on their own.
const NOT_BARE = new Set(['new', 'old', 'north', 'south', 'east', 'west', 'the', 'city', 'town', 'road', 'eden']);
const EXACT_ONLY = new Set(['eighteen']);
// One-word names that are also everyday words ("Airport", "Cantt", "Garden"):
// recognised when typed as the place itself, never picked out of a sentence.
const EVERYDAY = new Set(['airport', 'cantt', 'cantonment', 'garden', 'gardens', 'city', 'town', 'colony', 'road', 'avenue', 'park', 'market', 'chowk',
  'bazaar', 'bazar', 'main', 'heights', 'tower', 'towers', 'plaza', 'mall', 'residency', 'villas', 'enclave', 'valley', 'hills', 'model', 'green', 'sector',
  'block', 'phase', 'zone', 'commercial', 'mohalla', 'saddar', 'station', 'university', 'hospital', 'court', 'centre', 'center', 'township', 'cottages',
  'apartments', 'homes', 'housing', 'society', 'scheme', 'extension', 'gate', 'canal', 'lake', 'river', 'village', 'farm', 'farms', 'industrial', 'industrial area']);

function build(learned) {
  const byKey = new Map();   // area key → { names: { city: area name }, cities[] }
  const add = (name, city, alias) => {
    const k = key(alias || name);
    if (!k || !city) return;
    const e = byKey.get(k) || { names: {}, cities: [] };
    if (!e.cities.includes(city)) { e.cities.push(city); e.names[city] = name; }
    byKey.set(k, e);
  };
  // popular areas first, then every other area (more), then phases, blocks
  // and sectors (places) — the first city a name is added under leads
  for (const c of data.cities) for (const a of c.areas.concat(c.more || [], c.places || [])) {
    add(a, c.name);
    // "Abdalians Society - Block B" is typed "Abdalians Society Block B"
    if (/\s-\s/.test(a)) add(a, c.name, a.replace(/\s+-\s+/g, ' '));
    // "DHA Phase 6 Lahore" is also typed just "DHA Phase 6"; "Citi Housing Sialkot" as "Citi Housing"
    const bare = a.replace(new RegExp('\\s+' + c.name + '$', 'i'), '').replace(/\s+city$/i, '');
    if (bare !== a && bare.length > 2 && !NOT_BARE.has(key(bare))) add(a, c.name, bare);
  }
  for (const s of data.shared) for (const c of s.cities) add(s.name, c);
  // learned places (kb_known_places): new names join; for names found in
  // more than one city, the city people actually use most comes first.
  const counts = {};
  for (const l of learned || []) if (l && l.area && l.city) { add(l.area, l.city); counts[key(l.area) + '|' + l.city] = (counts[key(l.area) + '|' + l.city] || 0) + (l.n || 1); }
  for (const [k, e] of byKey) if (e.cities.length > 1 && e.cities.some((c) => counts[k + '|' + c])) {
    e.cities.sort((a, b) => (counts[k + '|' + b] || 0) - (counts[k + '|' + a] || 0));
    // learned well enough to stop asking: 5+ people, and 4× more than the next city
    const top = counts[k + '|' + e.cities[0]] || 0, next = counts[k + '|' + e.cities[1]] || 0;
    e.settled = top >= 5 && top >= 4 * Math.max(next, 1);
  }
  const keys = [...byKey.keys()].filter((k) => !EXACT_ONLY.has(k) && !EVERYDAY.has(k) && k.length >= 4).sort((a, b) => b.length - a.length);
  return { byKey, keys };
}
let GAZ = build();
export function setLearnedPlaces(rows) { GAZ = build(rows); }

export function cityName(text) {
  const t = String(text || '');
  for (const c of data.cities) if (t.includes(c.ur)) return c.name;
  const k = ' ' + key(t) + ' ';
  for (const c of data.cities) for (const a of [c.name].concat(c.aliases)) if (k.includes(' ' + key(a) + ' ')) return c.name;
  return null;
}

// The city an area belongs to. Returns { area, city, cities, ambiguous } or null.
//   placeOf('G-10') → Islamabad · placeOf('Clifton') → Karachi
//   placeOf('Bahria Town Phase 7') → Rawalpindi (also Islamabad; ambiguous)
export function placeOf(areaText, cityHint) {
  const hint = cityHint ? cityName(cityHint) : null;
  const sec = sectorOf(areaText);
  if (sec) return { area: sec.sub || sec.area, city: 'Islamabad', cities: ['Islamabad'], ambiguous: false };
  const k = key(areaText);
  if (!k) return null;
  let e = GAZ.byKey.get(k);
  if (!e) {
    // the longest known area contained in the text ("house in johar town block g")
    const padded = ' ' + k + ' ';
    const hit = GAZ.keys.find((x) => x.length >= 3 && padded.includes(' ' + x + ' ') && !(hint && !GAZ.byKey.get(x).cities.includes(hint) && GAZ.keys.some((y) => y !== x && y.includes(x))));
    if (hit) e = GAZ.byKey.get(hit);
  }
  if (!e) return null;
  const city = hint && e.cities.includes(hint) ? hint : e.cities[0];
  return { area: e.names[city], city, cities: e.cities.slice(), ambiguous: !hint && e.cities.length > 1 && !e.settled };
}

// Everything place-like in a free-text message: the city (stated or implied by
// the area) and the area.
export function findPlace(text) {
  const city = cityName(text);
  const p = placeOf(text, city);
  if (p && city && !p.cities.includes(city)) return { city, area: null, impliedCity: null };
  return { city: city || (p && !p.ambiguous ? p.city : null), area: p ? p.area : null, impliedCity: !city && p ? p.city : null, ambiguous: Boolean(p && p.ambiguous && !city), cities: p ? p.cities : [] };
}

export function areasOf(city) { const c = data.cities.find((x) => x.name === city); return c ? c.areas.slice() : []; }
export function cityInfo(city) { return data.cities.find((x) => x.name === city) || null; }

// Launch: a city with launch_at in the future is "launching" (sign-ups and
// listings saved now, shown from launch day). Pure date check, no switch.
export function launchAt(city) { const c = cityInfo(city); return c && c.launch_at ? new Date(c.launch_at) : null; }
export function isLaunched(city, now = new Date()) { const d = launchAt(city); return !d || now >= d; }
export function launchLabel(city, lang) {
  const d = launchAt(city);
  if (!d) return '';
  const day = d.toLocaleDateString('en-GB', { timeZone: PKT, day: 'numeric', month: 'long' });
  return lang === 'ur' ? day.replace('October', 'اکتوبر') : day;
}
export function launchingCities(now = new Date()) { return CITY_NAMES.filter((c) => !isLaunched(c, now)); }
export function citiesText(lang) {
  const n = lang === 'ur' ? data.cities.map((c) => c.ur) : CITY_NAMES;
  return lang === 'ur' ? n.slice(0, -1).join('، ') + ' اور ' + n[n.length - 1] : n.slice(0, -1).join(', ') + (lang === 'ro' ? ' aur ' : ' & ') + n[n.length - 1];
}
