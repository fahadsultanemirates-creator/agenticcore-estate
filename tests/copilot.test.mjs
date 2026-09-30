// Run: node --test tests/*.test.mjs
// Exercises the Copilot service with a mocked Supabase (and mocked AI
// provider) so no network or keys are needed.
import test from 'node:test';
import assert from 'node:assert/strict';

const LISTINGS = [
  { id: '11111111-1111-1111-1111-111111111111', owner_id: 'o1', title: 'House No. 15-D, Abu Bakr Block — 7 Marla Double Unit', type: 'buy', property_type: 'house', city: 'Rawalpindi', area: 'Bahria Town Phase 8 - Abu Bakar Block', price: 33000000, beds: 5, baths: 6, size_marla: 7, size_unit: 'marla', description: 'Brand new double unit near park and mosque.', photos: ['https://x/1.jpg', 'https://x/2.jpg'], verified: false, created_at: '2026-09-24T00:00:00Z' },
  { id: '11111111-1111-1111-1111-111111111112', owner_id: 'o1', title: 'House No. 15-D, Abu Bakr Block — 7 Marla Double Unit', type: 'buy', property_type: 'house', city: 'Rawalpindi', area: 'Bahria Town Phase 8 - Abu Bakar Block', price: 33000000, beds: 5, baths: 6, size_marla: 7, size_unit: 'marla', description: 'dup', photos: [], verified: false, created_at: '2026-09-23T00:00:00Z' },
  { id: '22222222-2222-2222-2222-222222222222', owner_id: 'o2', title: '10 Marla House DHA Phase 2', type: 'buy', property_type: 'house', city: 'Islamabad', area: 'DHA Phase 2', price: 48000000, beds: 4, baths: 5, size_marla: 10, size_unit: 'marla', description: 'Newly built, corner.', photos: [], verified: true, created_at: '2026-09-25T00:00:00Z' },
  { id: '33333333-3333-3333-3333-333333333333', owner_id: 'o3', title: '2 Bed Apartment G-13', type: 'rent', property_type: 'flat', city: 'Islamabad', area: 'G-13', price: 75000, beds: 2, baths: 2, size_marla: 950, size_unit: 'sqft', description: '', photos: [], verified: false, created_at: '2026-09-26T00:00:00Z' }
];

let aiReply = null;
globalThis.fetch = async (url, opts) => {
  url = String(url);
  const ok = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data });
  if (url.includes('/rest/v1/areas')) return ok([{ name: 'DHA Phase 2' }, { name: 'G-13' }, { name: 'Bahria Town Phase 8 - Abu Bakar Block' }]);
  if (url.includes('/rest/v1/listings')) {
    const q = new URL(url).searchParams;
    let rows = LISTINGS.slice();
    if (q.get('type')) rows = rows.filter((r) => 'eq.' + r.type === q.get('type'));
    if (q.get('city')) rows = rows.filter((r) => 'eq.' + r.city === q.get('city'));
    if (q.get('id')) rows = rows.filter((r) => 'eq.' + r.id === q.get('id'));
    return ok(rows);
  }
  if (url.includes('api.openai.com')) return ok({ choices: [{ message: { content: JSON.stringify(aiReply) } }] });
  throw new Error('unexpected fetch ' + url);
};

const svc = await import('../services/copilot-service.mjs');
const draftMod = await import('../services/listing-draft.mjs');

test('find: budget/size/beds/location explained from real rows, duplicates removed', async () => {
  const r = await svc.findProperty('I have 4 crore and want a recently built 10 marla house around DHA or Bahria Rawalpindi with at least 4 bedrooms');
  assert.equal(r.matches.length, 0);                 // nothing matches everything
  assert.equal(r.closest.length, 1);                  // city filter = Rawalpindi, duplicate collapsed
  assert.ok(r.closest[0].differences.some((d) => d.includes('7 Marla')));
  assert.ok(r.closest[0].reasons.some((d) => d.includes('Bahria')));
});

test('find: exact match with reasons', async () => {
  const r = await svc.findProperty('10 marla house in DHA under 5 crore');
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].title, '10 Marla House DHA Phase 2');
  assert.ok(r.matches[0].reasons.some((x) => x.includes('within your Rs 5 crore budget')));
});

test('find: rent flat by beds', async () => {
  const r = await svc.findProperty('2 bed apartment in Islamabad for rent');
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].price_text, 'Rs 75,000 / month');
});

test('find: vague request asks a follow-up and invents nothing', async () => {
  const r = await svc.findProperty('something nice');
  assert.ok(r.follow_up);
  for (const m of r.matches.concat(r.closest)) assert.ok(LISTINGS.some((l) => l.id === m.id));
});

test('draft: deterministic facts + missing checklist without AI', async () => {
  const r = await svc.assistListing('10 marla house Bahria Phase 7, 5 bed, new construction, demand 5.2 crore');
  assert.equal(r.facts.property_type, 'house');
  assert.equal(r.facts.price, 52000000);
  assert.equal(r.facts.size_value, 10);
  assert.equal(r.facts.beds, 5);
  assert.ok(r.missing.some((m) => m.field === 'city'));
  assert.ok(r.missing.some((m) => m.field === 'baths'));
  assert.equal(r.ai_used, null);
  assert.match(r.draft.title, /10 Marla House for Sale in Bahria Phase 7/);
});

test('draft: AI text with an invented number is rejected', async () => {
  process.env.OPENAI_API_KEY = 'test'; process.env.AI_PROVIDER = 'openai';
  aiReply = { title: '10 Marla House, 6 Bedrooms', description: 'Lovely.', bullets: [], keywords: [] }; // 6 was never said
  let r = await svc.assistListing('10 marla house Bahria Phase 7, 5 bed, demand 5.2 crore');
  assert.equal(r.ai_used, null);
  aiReply = { title: '10 Marla 5 Bed House in Bahria Phase 7', description: 'Asking 5.2 crore.', bullets: ['5 bedrooms'], keywords: ['bahria'] };
  r = await svc.assistListing('10 marla house Bahria Phase 7, 5 bed, demand 5.2 crore');
  assert.equal(r.ai_used, 'openai');
  delete process.env.OPENAI_API_KEY; delete process.env.AI_PROVIDER;
});

test('improve: only the owner, deterministic score', async () => {
  const denied = await svc.improveListing(LISTINGS[0].id, 'someone-else', 't', false);
  assert.equal(denied.status, 403);
  const r = await svc.improveListing(LISTINGS[0].id, 'o1', 't', false);
  assert.ok(r.quality.score > 0 && r.quality.score <= 100);
  assert.ok(r.quality.tips.length > 0);
});

test('PII never reaches the model', async () => {
  const { redactPII } = await import('../services/util.mjs');
  const out = redactPII('call 0300-1234567 or +92 300 1234567, cnic 37405-1234567-1, a@b.com');
  assert.ok(!/1234567|a@b\.com/.test(out));
});
