// AgenticCore Property Copilot — service layer.
// Pure functions over the lib modules; the HTTP handler (copilot.mjs) and
// future Telegram / WhatsApp / MCP adapters all call these same functions.

import { parseCriteria, criteriaStrength, followUpQuestion, describeCriteria } from './criteria.mjs';
import { rankListings } from './search.mjs';
import { getAreaNames, fetchCandidateListings, fetchListing } from './supabase.mjs';
import { completeJSON, aiAvailable } from './ai.mjs';
import { draftListing, improveWording } from './listing-draft.mjs';
import { PROPERTY_TYPES, norm, redactPII } from './util.mjs';
import quality from '../listing-quality.js';

const TYPE_KEYS = Object.keys(PROPERTY_TYPES);

// The model may only fill gaps the deterministic parser left empty, and any
// location it names must literally appear in the user's text.
async function refineWithAI(text, c) {
  if (!aiAvailable('parse') || criteriaStrength(c) >= 5) return { c, used: null };
  const ai = await completeJSON({
    task: 'parse', maxTokens: 300,
    schema: {
      purpose: { optional: ['buy', 'rent'] }, city: { optional: ['Islamabad', 'Rawalpindi'] },
      property_type: { optional: TYPE_KEYS }, price_min: { optional: 'number' }, price_max: { optional: 'number' },
      size_value: { optional: 'number' }, size_unit: { optional: ['marla', 'kanal', 'sqft', 'sqyd'] },
      beds_min: { optional: 'number' }, locations: { optional: 'string[]' }
    },
    system: 'Extract property search criteria from a Pakistani buyer/tenant message (English, Urdu or Roman Urdu). ' +
      'Prices are in PKR (1 crore = 10,000,000; 1 lac = 100,000). Only extract what the message states; use null for anything not stated. ' +
      'Return {"purpose","city","property_type","price_min","price_max","size_value","size_unit","beds_min","locations"}.',
    user: redactPII(text).slice(0, 600)
  });
  if (!ai) return { c, used: null };
  const d = ai.data; const t = norm(text);
  if (!c.purpose && d.purpose) c.purpose = d.purpose;
  if (!c.city && d.city) c.city = d.city;
  if (!c.property_types.length && d.property_type) c.property_types = [d.property_type];
  if (!c.price_max && d.price_max > 0) c.price_max = d.price_max;
  if (!c.price_min && d.price_min > 0) c.price_min = d.price_min;
  if (!c.size && d.size_value > 0 && d.size_unit) c.size = { value: d.size_value, unit: d.size_unit };
  if (!c.beds_min && d.beds_min > 0 && d.beds_min < 20) c.beds_min = d.beds_min;
  if (!c.locations.length) {
    (d.locations || []).forEach(function (loc) {
      const n = norm(loc);
      if (n && t.includes(n)) c.locations.push({ label: loc, tokens: [n] });
    });
  }
  return { c, used: ai.provider };
}

// Marketplace V2: questions about the other four categories get a link to the
// real, filtered directory — Copilot does not claim to have searched them.
const CATEGORY_WORDS = [
  ['builders', /\b(builders?|developers?|construction (compan(y|ies)|firms?)|construction|contractors?|grey structure|turnkey|thekedar)\b/],
  ['agencies', /\b(agenc(y|ies)|real estate (company|firm))\b/],
  ['professionals', /\b(agents?|property (dealer|consultant|adviser|advisor|professional)s?|dealers?|realtors?|brokers?)\b/],
  ['projects', /\b(projects?|new developments?|housing schemes?|launch(es|ing)?|off[- ]plan)\b/]
];
export function categoryIntent(text, c) {
  const t = String(text || '').toLowerCase();
  const hit = CATEGORY_WORDS.find((x) => x[1].test(t));
  if (!hit) return null;
  const q = new URLSearchParams();
  if (c && c.city) q.set('city', c.city);
  const page = { builders: 'builders.html', agencies: 'agencies.html', professionals: 'professionals.html', projects: 'projects.html' }[hit[0]];
  return { category: hit[0], url: page + (q.toString() ? '?' + q.toString() : '') };
}

export async function findProperty(text) {
  text = String(text || '').trim().slice(0, 600);
  if (text.length < 3) return { error: 'Tell AgenticCore what you are looking for.' };
  const areas = await getAreaNames().catch(() => []);
  let c = parseCriteria(text, areas);
  // Directory questions ("show agencies", "find builders in Rawalpindi") are
  // answered deterministically, before any AI call is spent.
  const early = categoryIntent(text, c);
  if (early && !c.property_types.length) {
    return { understood: '', criteria: c, matches: [], closest: [], considered: 0, ai_used: null, directory: early,
      message: 'AgenticCore Copilot searches property listings. Browse the ' + early.category + ' directory for this — it shows only genuine profiles, with filters.' };
  }
  const refined = await refineWithAI(text, c);
  c = refined.c;

  const directory = categoryIntent(text, c);
  if (directory && !c.property_types.length) {
    return { understood: '', criteria: c, matches: [], closest: [], considered: 0, ai_used: refined.used, directory: directory,
      message: 'AgenticCore Copilot searches property listings. Browse the ' + directory.category + ' directory for this — it shows only genuine profiles, with filters.' };
  }
  if (criteriaStrength(c) === 0) {
    // Nothing concrete to search on: ask, rather than dump every listing as a "match".
    return { understood: '', criteria: c, matches: [], closest: [], considered: 0, ai_used: refined.used,
      follow_up: followUpQuestion(c), message: 'Tell AgenticCore a little more so it can search properly.' };
  }
  const rows = await fetchCandidateListings(c);
  const ranked = rankListings(rows || [], c, { limit: 6 });
  const follow = followUpQuestion(c);
  return {
    understood: describeCriteria(c, PROPERTY_TYPES),
    criteria: c,
    matches: ranked.matches,
    closest: ranked.closest,
    considered: ranked.total_considered,
    follow_up: ranked.matches.length ? null : follow,
    message: ranked.matches.length
      ? ranked.matches.length + ' listing' + (ranked.matches.length > 1 ? 's' : '') + ' on AgenticCore Estate match' + (ranked.matches.length > 1 ? '' : 'es') + ' what you asked for.'
      : ranked.closest.length
        ? 'No listing matches everything yet. Here are the closest real listings, with the differences shown.'
        : 'There are no listings like this on AgenticCore Estate yet. Try widening the area or budget, or check back soon.',
    ai_used: refined.used
  };
}

export async function assistListing(text) {
  text = String(text || '').trim();
  if (text.length < 8) return { error: 'Describe the property in a sentence or two.' };
  const areas = await getAreaNames().catch(() => []);
  return draftListing(text, areas);
}

// Owner-only: deterministic score + optional AI wording suggestions.
export async function improveListing(listingId, userId, token, withAI) {
  const l = await fetchListing(listingId, token);
  if (!l) return { error: 'Listing not found.' };
  if (l.owner_id !== userId) return { error: 'You can only improve your own listings.', status: 403 };
  const report = quality.score(l);
  const wording = withAI ? await improveWording(l) : null;
  return { listing_id: l.id, quality: report, wording };
}
