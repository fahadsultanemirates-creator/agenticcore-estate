// AI-assisted listing: rough text → structured, reviewable draft.
// Nothing here publishes anything. The draft fills the normal sell form and
// the owner edits/confirms it before it goes live.

import { parseCriteria } from './criteria.mjs';
import { PROPERTY_TYPES, UNIT_LABEL, formatPKR, redactPII, norm } from './util.mjs';
import { completeJSON } from './ai.mjs';

const BUILT = ['house', 'flat', 'upper_portion', 'lower_portion', 'room', 'farm_house'];
// The owner doesn't want a price shown: buyers ask the seller.
export const ASK_SELLER = /\b(ask (the )?(seller|owner)|price on (request|call|demand)|call for (the )?price|demand on call|price (on|at) call|no price|don'?t (show|mention) (the )?price|not (show|mention) (the )?price|qeem?at (call|rabta|raabta) par|price call par|demand call par|price (nahi|nahin) (batani|dikhani|likhni)|qeem?at (nahi|nahin) (batani|dikhani|likhni))\b|قیمت (کال|رابطہ)|مالک سے (پوچھ|قیمت)|قیمت (نہیں|نہ) (بتا|دکھا|لکھ)/i;

// Facts the owner actually stated. Only these may appear in generated text.
export function extractFacts(text, areaNames) {
  const c = parseCriteria(text, areaNames);
  const facts = {
    purpose: c.purpose === 'rent' ? 'rent' : (c.purpose === 'buy' || /demand|sale|sell|for sale/i.test(text) ? 'buy' : null),
    property_type: c.property_types.length === 1 ? c.property_types[0] : (c.property_types.includes('house') ? 'house' : null),
    // the named city, else the city the area belongs to ("G-10" → Islamabad)
    city: c.city || c.implied_city || null,
    city_options: !c.city && c.implied_cities ? c.implied_cities.slice() : null,
    area: null,
    price: c.price_max || c.price_min || null,
    price_ask: false,
    size_value: c.size ? c.size.value : null,
    size_unit: c.size ? c.size.unit : null,
    beds: c.beds_min || null,
    baths: c.baths_min || null,
    features: c.preferences.filter((p) => p !== 'investment')
  };
  if (!facts.price && ASK_SELLER.test(text)) facts.price_ask = true;
  // "area: …" = the owner's own answer to the area question (newest first wins)
  const said = String(text).match(/\barea:\s*([^.\n]{2,80})/i);
  // Prefer a known area name from the database; else the society label.
  const exact = c.locations.find((l) => areaNames && areaNames.some((a) => norm(a) === l.tokens[0]));
  if (exact) facts.area = areaNames.find((a) => norm(a) === exact.tokens[0]);
  else if (c.locations.length) facts.area = c.locations[0].label;
  if (said && !(c.locations.length && norm(said[1]).includes(norm(c.locations[0].label)))) {
    // keep the owner's words; a city named at the end goes to the city field
    const words = said[1].trim();
    const city = c.city && new RegExp('\\s*,?\\s*' + c.city + '$', 'i');
    facts.area = city ? words.replace(city, '').trim() || words : words;
  }
  return facts;
}

export function missingChecklist(f) {
  const m = [];
  if (!f.purpose) m.push({ field: 'purpose', label: 'For sale or for rent?' });
  if (!f.property_type) m.push({ field: 'property_type', label: 'Property type (house, flat, plot, shop…)' });
  if (!f.city) m.push({ field: 'city', label: 'City (Islamabad, Rawalpindi, Lahore, Karachi, Sialkot or Faisalabad)' });
  if (!f.area) m.push({ field: 'area', label: 'Exact area — society, phase, block or sector' });
  if (!f.price && !f.price_ask) m.push({ field: 'price', label: f.purpose === 'rent' ? 'Monthly rent' : 'Demand price' });
  if (!f.size_value) m.push({ field: 'size', label: 'Size (marla, kanal or sq ft)' });
  if (BUILT.includes(f.property_type)) {
    if (!f.beds) m.push({ field: 'beds', label: 'Number of bedrooms' });
    if (!f.baths) m.push({ field: 'baths', label: 'Number of bathrooms' });
  }
  m.push({ field: 'photos', label: 'Photos — front elevation first, then living areas, kitchen, bedrooms, washrooms' });
  if (!f.features.includes('possession')) m.push({ field: 'possession', label: 'Possession / transfer status' });
  return m;
}

export function templateDraft(f) {
  const typeLabel = PROPERTY_TYPES[f.property_type] || 'Property';
  const size = f.size_value ? f.size_value + ' ' + (UNIT_LABEL[f.size_unit] || 'Marla') + ' ' : '';
  // "DHA Phase 6 Lahore" already names the city: no ", Lahore" after it
  const areaHasCity = f.area && f.city && new RegExp('\\b' + String(f.city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(f.area);
  const where = (areaHasCity ? [f.area] : [f.area, f.city]).filter(Boolean).join(', ');
  const title = (size + typeLabel + (f.purpose === 'rent' ? ' for Rent' : f.purpose === 'buy' ? ' for Sale' : '') + (where ? ' in ' + where : '')).trim();
  const bullets = [];
  if (f.size_value) bullets.push(size.trim() + ' ' + typeLabel.toLowerCase());
  if (f.beds) bullets.push(f.beds + ' bedrooms');
  if (f.baths) bullets.push(f.baths + ' bathrooms');
  f.features.forEach((x) => bullets.push(x.charAt(0).toUpperCase() + x.slice(1)));
  if (f.price) bullets.push((f.purpose === 'rent' ? 'Rent: ' : 'Demand: ') + formatPKR(f.price) + (f.purpose === 'rent' ? ' per month' : ''));
  else if (f.price_ask) bullets.push((f.purpose === 'rent' ? 'Rent' : 'Price') + ': ask the seller');
  const description = [
    (size + typeLabel.toLowerCase()).trim().replace(/^./, (x) => x.toUpperCase()) + (where ? ' in ' + where : '') + (f.purpose === 'rent' ? ', available for rent.' : f.purpose === 'buy' ? ', available for sale.' : '.'),
    bullets.length ? 'Key details: ' + bullets.join('; ') + '.' : ''
  ].filter(Boolean).join('\n\n');
  const keywords = [typeLabel, f.area, f.city, f.size_value ? size.trim() : null, f.purpose === 'rent' ? 'for rent' : 'for sale'].filter(Boolean);
  return { title, description, bullets, keywords, photo_order: ['Front elevation', 'Drawing / living room', 'Kitchen', 'Master bedroom', 'Other bedrooms', 'Washrooms', 'Street / surroundings'] };
}

// Every number in generated text must already exist in the owner's text or
// facts — a cheap, strict guard against invented sizes, prices or counts.
function numbersIn(s) { return (String(s).replace(/(\d),(\d)/g, '$1$2').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
export function onlyKnownNumbers(generated, sourceText, facts) {
  const allowed = new Set(numbersIn(sourceText).concat(Object.values(facts).filter((v) => typeof v === 'number')));
  if (facts.price) { allowed.add(+(facts.price / 1e7).toFixed(2)); allowed.add(+(facts.price / 1e5).toFixed(2)); allowed.add(facts.price / 1e7); allowed.add(facts.price / 1e5); }
  return numbersIn(generated).every((n) => allowed.has(n) || n <= 1);
}

const DRAFT_SCHEMA = { title: 'string', description: 'string', bullets: 'string[]', keywords: 'string[]', photo_order: { optional: 'string[]' } };

export async function draftListing(rawText, areaNames) {
  const text = redactPII(String(rawText || '').slice(0, 1500));
  const facts = extractFacts(text, areaNames);
  const missing = missingChecklist(facts);
  let draft = templateDraft(facts);
  let aiUsed = null;

  const ai = await completeJSON({
    task: 'draft', maxTokens: 700,
    schema: DRAFT_SCHEMA,
    system: 'You write Pakistani real-estate listings for AgenticCore Estate (Islamabad, Rawalpindi, Lahore, Karachi, Sialkot & Faisalabad). ' +
      'Use ONLY facts present in the owner notes and the extracted facts. Never invent prices, sizes, room counts, ' +
      'features, approvals, NOC status, ownership or nearby places. If something is unknown, leave it out. ' +
      'Plain, professional English; no superlatives such as "best" or "guaranteed". ' +
      'Return {"title": string (max 90 chars), "description": string (2 short paragraphs), "bullets": string[] (max 8), ' +
      '"keywords": string[] (max 8 search keywords), "photo_order": string[] (suggested photo sequence)}.',
    user: 'Owner notes:\n' + text + '\n\nExtracted facts (JSON):\n' + JSON.stringify(facts)
  });
  if (ai) {
    const d = ai.data;
    const combined = [d.title, d.description].concat(d.bullets).join(' ');
    if (onlyKnownNumbers(combined, text, facts) && d.title.length <= 120) {
      draft = { title: d.title, description: d.description, bullets: d.bullets.slice(0, 8), keywords: d.keywords.slice(0, 8), photo_order: d.photo_order && d.photo_order.length ? d.photo_order.slice(0, 8) : draft.photo_order };
      aiUsed = ai.provider;
    }
  }
  return { facts, missing, draft, ai_used: aiUsed };
}

// Wording suggestions for an existing listing (score stays deterministic).
export async function improveWording(listing) {
  const facts = {
    purpose: listing.type, property_type: listing.property_type, city: listing.city, area: listing.area,
    price: Number(listing.price), size_value: Number(listing.size_marla) || null, size_unit: listing.size_unit,
    beds: listing.beds || null, baths: listing.baths || null, features: []
  };
  const source = listing.title + '\n' + (listing.description || '');
  const ai = await completeJSON({
    task: 'improve', maxTokens: 600, schema: { title: 'string', description: 'string', notes: 'string[]' },
    system: 'You improve the wording of an existing Pakistani property listing. Keep every fact exactly as given; ' +
      'do not add any fact, number, feature, approval or nearby place that is not in the source. ' +
      'Return {"title": string (max 90 chars), "description": string, "notes": string[] (max 4 short tips about information the owner could add)}.',
    user: 'Listing facts (JSON):\n' + JSON.stringify(facts) + '\n\nCurrent title and description:\n' + redactPII(source).slice(0, 2500)
  });
  if (!ai) return null;
  if (!onlyKnownNumbers(ai.data.title + ' ' + ai.data.description, source, facts)) return null;
  return { title: ai.data.title, description: ai.data.description, notes: ai.data.notes, provider: ai.provider };
}
