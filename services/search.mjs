// Rank REAL listings against parsed criteria and explain every match.
// The explanations are computed from the database row itself — no model is
// involved — so a recommendation can never describe a fact that isn't there.

import { toMarla, formatPKR, formatSize, norm, PROPERTY_TYPES } from './util.mjs';

function locationHit(listing, locations) {
  if (!locations.length) return null;
  const area = norm(listing.area + ' ' + listing.city + ' ' + listing.title);
  for (const loc of locations) {
    if (loc.tokens.some((t) => tokensIn(area, t))) return loc;
  }
  return false;
}
function tokensIn(hay, token) {
  // every word of the token must appear ("bahria" + "phase 7")
  return norm(token).split(' ').every((w) => hay.includes(w));
}

function checkListing(l, c) {
  const checks = [];
  const add = (ok, good, bad, weight) => checks.push({ ok, text: ok ? good : bad, weight: weight || 1 });

  if (c.locations.length) {
    const hit = locationHit(l, c.locations);
    add(Boolean(hit), 'In ' + l.area + ', ' + l.city + (hit ? ' — matches "' + hit.label + '"' : ''),
      'In ' + l.area + ', ' + l.city + ' — not in ' + c.locations.map((x) => x.label).join(' or '), 3);
  }
  if (c.price_max && Number(l.price) > 0) {
    const over = l.price - c.price_max;
    add(over <= 0, formatPKR(l.price) + ' — within your ' + formatPKR(c.price_max) + ' budget',
      formatPKR(l.price) + ' — ' + formatPKR(over) + ' above your ' + formatPKR(c.price_max) + ' budget', 3);
  }
  if (c.price_min && Number(l.price) > 0) {
    add(l.price >= c.price_min, formatPKR(l.price) + ' — above your ' + formatPKR(c.price_min) + ' minimum',
      formatPKR(l.price) + ' — below the ' + formatPKR(c.price_min) + ' you mentioned', 1);
  }
  if (c.size) {
    const want = toMarla(c.size.value, c.size.unit);
    const have = toMarla(l.size_marla, l.size_unit);
    const ok = have && want && Math.abs(have - want) / want <= 0.12;
    add(Boolean(ok), formatSize(l.size_marla, l.size_unit) + ' — the size you asked for',
      (have ? formatSize(l.size_marla, l.size_unit) : 'Size not given') + ' — you asked for ' + formatSize(c.size.value, c.size.unit), 2);
  }
  if (c.beds_min) {
    const b = Number(l.beds) || 0;
    const ok = c.beds_exact ? b === c.beds_exact : b >= c.beds_min;
    add(ok, b + ' bedrooms' + (c.beds_exact ? '' : ' — at least ' + c.beds_min + ' as you wanted'),
      (b ? b + ' bedrooms' : 'Bedrooms not given') + ' — you wanted ' + (c.beds_exact || 'at least ' + c.beds_min), 2);
  }
  if (c.baths_min) {
    const b = Number(l.baths) || 0;
    add(b >= c.baths_min, b + ' bathrooms', (b ? b + ' bathrooms' : 'Bathrooms not given') + ' — you wanted at least ' + c.baths_min, 1);
  }
  if (c.keywords.length) {
    const text = norm(l.title + ' ' + (l.description || ''));
    c.preferences.filter((p) => p !== 'investment').forEach(function (pref) {
      const words = { 'new construction': ['brand new', 'newly built', 'new construction', 'recently built', 'newly constructed', 'new house'],
        'near schools': ['school'], 'park facing': ['park facing', 'facing park'], 'main boulevard': ['boulevard'],
        'gas available': ['gas'], 'possession': ['possession', 'ready to move'] }[pref] || [pref];
      const hit = words.some((w) => text.includes(w));
      // Preferences are soft: the listing text may simply not say.
      checks.push({ ok: hit, soft: true, weight: 0.5, text: hit ? 'Listing mentions "' + pref + '"' : 'Listing doesn\'t mention "' + pref + '" — worth asking the seller' });
    });
  }
  return checks;
}

function publicCard(l, checks) {
  return {
    id: l.id,
    url: 'listing.html?id=' + encodeURIComponent(l.id),
    title: l.title,
    purpose: l.type,
    property_type: PROPERTY_TYPES[l.property_type] || l.property_type,
    city: l.city, area: l.area,
    price: Number(l.price) || null, price_text: Number(l.price) > 0 ? formatPKR(l.price) + (l.type === 'rent' ? ' / month' : '') : 'Price: ask the seller',
    size_text: formatSize(l.size_marla, l.size_unit),
    beds: l.beds || null, baths: l.baths || null,
    photo: (l.photos && l.photos[0]) || null,
    verified: Boolean(l.verified),
    reasons: checks.filter((x) => x.ok).map((x) => x.text),
    differences: checks.filter((x) => !x.ok).map((x) => x.text)
  };
}

// Same owner + same title + same price = the same property posted twice.
function dedupe(rows) {
  const seen = new Set();
  return rows.filter(function (l) {
    const k = [l.owner_id, norm(l.title), Number(l.price), norm(l.area)].join('|');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

export function rankListings(rows, c, opts) {
  opts = opts || {};
  const limit = opts.limit || 5;
  // Hard filters: purpose, city and property type are never "close enough".
  let pool = dedupe(rows).filter(function (l) {
    if (c.purpose && l.type !== c.purpose) return false;
    if (c.city && l.city !== c.city) return false;
    if (c.property_types.length && c.property_types.indexOf(l.property_type) < 0) return false;
    return true;
  });
  const scored = pool.map(function (l) {
    const checks = checkListing(l, c);
    const hardFails = checks.filter((x) => !x.ok && !x.soft);
    const penalty = hardFails.reduce((s, x) => s + x.weight, 0);
    const bonus = checks.filter((x) => x.ok).reduce((s, x) => s + x.weight, 0);
    return { l, checks, exact: hardFails.length === 0, penalty, bonus };
  });
  const exact = scored.filter((s) => s.exact).sort((a, b) => b.bonus - a.bonus || new Date(b.l.created_at) - new Date(a.l.created_at));
  const closest = scored.filter((s) => !s.exact).sort((a, b) => a.penalty - b.penalty || b.bonus - a.bonus);
  return {
    total_considered: pool.length,
    matches: exact.slice(0, limit).map((s) => publicCard(s.l, s.checks)),
    closest: exact.length ? [] : closest.slice(0, 3).map((s) => publicCard(s.l, s.checks))
  };
}
