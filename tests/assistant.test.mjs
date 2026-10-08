// Run: node --test tests/*.test.mjs   (needs `npm install` for @anthropic-ai/sdk)
// AgenticCore AI Assistant + Amaan: routing, languages, Amaan find/list, AI
// guards, the Claude request shape, and the /api/assistant endpoint — with a
// stand-in for Claude, so no key or network is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const LISTINGS = [
  { id: '11111111-1111-4111-8111-111111111111', owner_id: 'o1', title: '10 Marla House Bahria Town Phase 7', type: 'buy', property_type: 'house', city: 'Rawalpindi', area: 'Bahria Town Phase 7', price: 38000000, beds: 5, baths: 6, size_marla: 10, size_unit: 'marla', description: '', photos: [], verified: false, is_sample: false, created_at: '2026-09-24T00:00:00Z' },
  { id: '22222222-2222-4222-8222-222222222222', owner_id: 'o2', title: '2 Bed Apartment G-13', type: 'rent', property_type: 'flat', city: 'Islamabad', area: 'G-13', price: 75000, beds: 2, baths: 2, size_marla: 950, size_unit: 'sqft', description: '', photos: [], verified: false, is_sample: false, created_at: '2026-09-26T00:00:00Z' },
  { id: '33333333-3333-4333-8333-333333333333', owner_id: 's', title: 'SAMPLE 1 Kanal House DHA', type: 'buy', property_type: 'house', city: 'Islamabad', area: 'DHA Phase 2', price: 90000000, beds: 6, baths: 7, size_marla: 20, size_unit: 'marla', description: '', photos: [], verified: false, is_sample: true, created_at: '2026-09-20T00:00:00Z' }
];
let listingQueries = [];
globalThis.fetch = async (url) => {
  url = String(url);
  const ok = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data });
  if (url.includes('/rest/v1/areas')) return ok([{ name: 'Bahria Town Phase 7' }, { name: 'G-13' }, { name: 'DHA Phase 2' }]);
  if (url.includes('/rest/v1/listings')) {
    listingQueries.push(url);
    const q = new URL(url).searchParams;
    // the real query filters samples server-side; honour it here
    let rows = LISTINGS.filter((l) => q.get('is_sample') !== 'eq.false' || !l.is_sample);
    if (q.get('type')) rows = rows.filter((r) => 'eq.' + r.type === q.get('type'));
    if (q.get('city')) rows = rows.filter((r) => 'eq.' + r.city === q.get('city'));
    return ok(rows);
  }
  throw new Error('unexpected network call ' + url);
};
delete process.env.ANTHROPIC_API_KEY;

const svc = await import('../services/assistant-service.mjs');
const { findProperty } = await import('../services/copilot-service.mjs');
const claude = await import('../services/claude.mjs');
const AREAS = ['Bahria Town Phase 7', 'G-13', 'DHA Phase 2'];
const det = { allowAI: false, areaNames: AREAS, find: (t) => findProperty(t, { ai: false }) };
const user = (text) => ({ role: 'user', text });

// ---------- language ----------
test('language: English, Urdu script and Roman Urdu; neutral answers keep the conversation language', () => {
  assert.equal(svc.detectLang('What is AgenticCore Estate?'), 'en');
  assert.equal(svc.detectLang('اپنا گھر لسٹ کیسے کروں؟'), 'ur');
  assert.equal(svc.detectLang('Mujhe ghar list karna hai but description nahi likhni aati.'), 'ro');
  assert.equal(svc.detectLang('G-13 mein 2 bed flat hai?'), 'ro');
  assert.equal(svc.detectLang('35 lakh', 'ro'), 'ro');
  assert.equal(svc.detectLang('4', 'ur'), 'ur');
});

test('language switch mid-conversation follows the latest message', async () => {
  const r1 = await svc.handleTurn({ bot: 'guide', messages: [user('What is AgenticCore Estate?')] }, det);
  assert.equal(r1.lang, 'en');
  const r2 = await svc.handleTurn({ bot: 'guide', lang: 'en', messages: [user('What is AgenticCore Estate?'), { role: 'assistant', text: r1.reply }, user('یہ مفت ہے؟ لسٹنگ کیسے کروں')] }, det);
  assert.equal(r2.lang, 'ur');
  assert.match(r2.reply, /[؀-ۿ]/);
  const r3 = await svc.handleTurn({ bot: 'guide', lang: 'ur', messages: [user('Agency profile banane ka kya faida hai?')] }, det);
  assert.equal(r3.lang, 'ro');
  assert.match(r3.reply, /Agency profile free hai/);
});

test('Urdu-script searches become terms the search parser understands', () => {
  assert.equal(svc.toSearchText('اسلام آباد میں تین بیڈ روم فلیٹ ۴ کروڑ تک').replace(/\s*میں\s*/, ' '), 'Islamabad 3 bed flat 4 crore under');
});

// ---------- general assistant ----------
test('general assistant: approved answers and routing', async () => {
  const ask = async (t) => svc.handleTurn({ bot: 'guide', messages: [user(t)] }, det);
  const about = (await ask('What is AgenticCore Estate?')).reply;
  assert.match(about, /serving all of Pakistan/);
  assert.doesNotMatch(about, /6 cities|October|launch in/i);
  assert.deepEqual((await ask('How do I list my property?')).actions.slice(0, 1), ['amaan_list']);
  const pro = await ask('I am a property consultant, how do I get a profile?');
  assert.ok(pro.actions.includes('join_professional'));
  assert.ok((await ask('agency profile')).actions.includes('join_agency'));
  assert.ok((await ask('I run a construction company')).actions.includes('join_builder'));
  const proj = await ask('Can I publish my housing project?');
  assert.match(proj.reply, /reviews and approves/);
  const pk = await ask('Builder ko website aur brochure chahiye.');
  assert.ok(pk.actions.includes('pk_services'));
  assert.match(pk.reply, /Project \/ Developer Website: From Rs 32,499/);   // published PK prices, word for word
  assert.match(pk.reply, /Project Brochure: Rs 9,999/);
  const price = await ask('How much is the premium package?');
  assert.match(price.reply, /Agent Monthly: Rs 7,999 a month/);   // the real packages, never an invented "premium" price
  assert.doesNotMatch(price.reply, /premium/i);
  assert.match((await ask('are you a real person?')).reply, /AI assistant/);
  assert.deepEqual((await ask('G-13 mein 2 bed flat hai?')).actions[0], 'amaan_find');
});

// ---------- Amaan find ----------
test('Amaan find: genuine listings only, samples never returned', async () => {
  listingQueries = [];
  const r = await svc.handleTurn({ bot: 'amaan', messages: [user('house in Bahria under 4 crore')] }, det);
  assert.equal(r.mode, 'find');
  assert.equal(r.result, 'match');
  assert.deepEqual(r.listings.map((l) => l.id), ['11111111-1111-4111-8111-111111111111']);
  assert.ok(listingQueries.every((u) => u.includes('is_sample=eq.false')));
  const isl = await svc.handleTurn({ bot: 'amaan', messages: [user('Islamabad mein 3 bedroom flat chahiye')] }, det);
  assert.ok(!isl.listings.some((l) => /SAMPLE/.test(l.title)));
});

test('Amaan find: Rawalpindi 10 marla, rent, closest-match differences, zero results', async () => {
  const r = await svc.handleTurn({ bot: 'amaan', messages: [user('I need a 10 marla house in Rawalpindi under 4 crore')] }, det);
  assert.equal(r.listings[0].title, '10 Marla House Bahria Town Phase 7');
  const rent = await svc.handleTurn({ bot: 'amaan', messages: [user('2 bed flat for rent in G-13')] }, det);
  assert.equal(rent.listings[0].id, '22222222-2222-4222-8222-222222222222');
  const close = await svc.handleTurn({ bot: 'amaan', messages: [user('10 marla house in Rawalpindi under 3 crore')] }, det);
  assert.equal(close.result, 'closest');
  assert.ok(close.listings[0].differences.length > 0);
  const none = await svc.handleTurn({ bot: 'amaan', messages: [user('2 kanal farm house in Lahore')] }, det);
  assert.ok(['none', 'closest'].includes(none.result));
  if (none.result === 'none') assert.match(none.reply, /no genuine listings/);
});

test('Amaan find: a follow-up budget overrides the earlier one', async () => {
  const msgs = [user('10 marla house in Rawalpindi under 4 crore'), { role: 'assistant', text: 'found' }, user('3 crore tak')];
  const r = await svc.handleTurn({ bot: 'amaan', mode: 'find', messages: msgs }, det);
  assert.equal(r.result, 'closest');   // the 3.8 crore house no longer fits
});

// ---------- Amaan list ----------
test('Amaan list: asks one question at a time and never invents numbers', async () => {
  let st = { bot: 'amaan', messages: [], notes: [], mode: null, asked: null, lang: null };
  const turn = async (text, quick) => {
    if (text) st.messages.push(user(text));
    const r = await svc.handleTurn(Object.assign({}, st, { quick: quick || null }), det);
    st.messages.push({ role: 'assistant', text: r.reply });
    st = Object.assign(st, { notes: r.notes || st.notes, mode: r.mode, asked: r.asked, lang: r.lang });
    return r;
  };
  const a = await turn(null, 'amaan_list');
  assert.equal(a.mode, 'list');
  await turn('Mujhe Bahria Phase 7 mein 10 marla ghar bechna hai');
  assert.equal(st.asked, 'city');            // Bahria Town spans both cities — Amaan asks, never guesses
  await turn('Rawalpindi');
  assert.equal(st.asked, 'price');
  await turn('3.5 crore');
  assert.equal(st.asked, 'beds');
  await turn('5');
  assert.equal(st.asked, 'baths');
  const last = await turn('6');
  assert.equal(last.ready, true);
  assert.equal(last.lang, 'ro');
  assert.deepEqual(last.actions, ['estate_list']);
  assert.match(last.facts_summary, /Rs 3\.5 crore · 5 bed · 6 bath/);
});

test('Amaan list: on AgenticCore Pakistan it sends people to Estate (notes never travel in a URL)', async () => {
  const r = await svc.handleTurn({ bot: 'amaan', site: 'pk', quick: 'amaan_list', messages: [] }, det);
  assert.deepEqual(r.actions, ['estate_list']);
  assert.match(r.reply, /AgenticCore Estate/);
});

// ---------- AI path + guards ----------
const aiReturning = (data, extra) => Object.assign({}, det, { allowAI: true, ai: async () => ({ ok: true, data }) }, extra || {});
test('AI reply is used when it passes every check; unknown actions are dropped', async () => {
  const r = await svc.handleTurn({ bot: 'guide', messages: [user('Tell me about agencies')] }, aiReturning({ reply: 'Agency profiles are free. Want to add yours?', actions: ['join_agency', 'evil_link'] }));
  assert.equal(r.ai, true);
  assert.deepEqual(r.actions, ['join_agency']);
});
test('AI reply with an invented number is rejected for the approved answer', async () => {
  const r = await svc.handleTurn({ bot: 'guide', messages: [user('How much is the premium package?')] }, aiReturning({ reply: 'The premium package costs Rs 25,000 per month.', actions: [] }));
  assert.notEqual(r.ai, true);
  assert.doesNotMatch(r.reply, /25/);
});
test('AI reply links, markdown and phone numbers are stripped; refusal/timeout fall back', async () => {
  const r = await svc.handleTurn({ bot: 'guide', messages: [user('contact')] }, aiReturning({ reply: '**Call** 0300 1234567 or see https://evil.example now', actions: [] }));
  assert.doesNotMatch(r.reply, /evil|\*\*|0300/);
  for (const reason of ['refusal', 'timeout', 'no_key']) {
    const f = await svc.handleTurn({ bot: 'guide', messages: [user('What is AgenticCore Estate?')] }, Object.assign({}, det, { allowAI: true, ai: async () => ({ ok: false, reason }) }));
    assert.match(f.reply, /marketplace/);
  }
});
test('AI may only describe the search results it was given', async () => {
  const r = await svc.handleTurn({ bot: 'amaan', messages: [user('house in Bahria under 4 crore')] },
    aiReturning({ reply: 'I found a 12 marla house for Rs 2.1 crore!', actions: [] }));
  assert.notEqual(r.ai, true);                                     // 12 / 2.1 are not in the data
  const ok = await svc.handleTurn({ bot: 'amaan', messages: [user('house in Bahria under 4 crore')] },
    aiReturning({ reply: 'Ek 10 marla ghar mila hai, Rs 3.8 crore.', actions: ['estate_properties'] }));
  assert.equal(ok.ai, true);
});
test('PII is removed from visitor text before anything else sees it', async () => {
  let seen = null;
  await svc.handleTurn({ bot: 'guide', messages: [user('my number is 0300 1234567, email a@b.com, cnic 35202-1234567-1')] },
    Object.assign({}, det, { allowAI: true, ai: async (o) => { seen = JSON.stringify(o.messages); return { ok: false, reason: 'x' }; } }));
  assert.doesNotMatch(seen, /0300|a@b\.com|35202/);
});

// ---------- Claude request ----------
test('Claude call: model, fallback, structured output, cached system prompt; no key → no call', async () => {
  assert.deepEqual(await claude.claudeJSON({ system: 's', turnContext: 't', messages: [], schema: {} }), { ok: false, reason: 'no_key' });
  let req = null, opts = null;
  claude.setClaudeClient({ beta: { messages: { create: async (r, o) => { req = r; opts = o; return { stop_reason: 'end_turn', model: r.model, content: [{ type: 'text', text: '{"reply":"hi","actions":[]}' }] }; } } } });
  const out = await claude.claudeJSON({ system: 'frozen', turnContext: 'turn', messages: [{ role: 'user', content: 'x' }], schema: { type: 'object' } });
  assert.deepEqual(out.data, { reply: 'hi', actions: [] });
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.fallbacks, 'default');
  assert.deepEqual(req.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.deepEqual(req.system[0].cache_control, { type: 'ephemeral' });
  assert.equal(req.system[1].text, 'turn');
  assert.ok(opts.timeout > 0);
  claude.setClaudeClient({ beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } });
  assert.equal((await claude.claudeJSON({ system: 's', turnContext: 't', messages: [], schema: {} })).reason, 'refusal');
  claude.setClaudeClient({ beta: { messages: { create: async () => { throw new Anthropic.APIConnectionTimeoutError(); } } } });
  assert.equal((await claude.claudeJSON({ system: 's', turnContext: 't', messages: [], schema: {} })).reason, 'timeout');
  claude.setClaudeClient(null);
});

// ---------- endpoint ----------
test('/api/assistant: allowed sites only, size limit, deterministic answer without a key', async () => {
  const { default: handler } = await import('../netlify/functions/assistant.mjs');
  const call = (method, body, origin, ip) => handler(new Request('https://agenticcore.estate/api/assistant', { method, headers: Object.assign({ 'Content-Type': 'application/json' }, origin ? { Origin: origin } : {}), body }), { ip: ip || '1.1.1.1' });
  const pre = await call('OPTIONS', null, 'https://agenticcorepk.com');
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://agenticcorepk.com');
  const evil = await call('POST', '{}', 'https://evil.example');
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  assert.equal((await call('POST', 'x'.repeat(17000), 'https://agenticcore.estate')).status, 413);
  const ok = await call('POST', JSON.stringify({ bot: 'guide', messages: [{ role: 'user', text: 'What is AgenticCore Estate?' }] }), 'https://agenticcore.estate');
  assert.equal(ok.status, 200);
  const d = await ok.json();
  assert.match(d.reply, /marketplace/);
  assert.equal(d.ai_reason, undefined);
  let last;
  for (let i = 0; i < 32; i++) last = await call('POST', JSON.stringify({ bot: 'guide', messages: [] }), 'https://agenticcore.estate', '9.9.9.9');
  assert.equal(last.status, 429);
});

// ---------- secrets never reach the browser ----------
test('no API key or provider call in any browser file', () => {
  const root = new URL('../', import.meta.url);
  const browserFiles = fs.readdirSync(root).filter((f) => /\.(js|html)$/.test(f));
  for (const f of browserFiles) {
    const src = fs.readFileSync(new URL(f, root), 'utf8');
    assert.doesNotMatch(src, /sk-ant-|ANTHROPIC_API_KEY|api\.anthropic\.com|x-api-key/i, f);
  }
});

// ---------- panel text: English and Urdu complete ----------
test('assistant panel: every string and every button key exists in English and Urdu', async () => {
  const { ACTIONS } = await import('../services/assistant-knowledge.mjs');
  const src = fs.readFileSync(new URL('../ac-assistant.js', import.meta.url), 'utf8');
  const vm = await import('node:vm');
  const ctx = { window: {}, document: { documentElement: { lang: 'en' } } };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const { T, ACTION_LABEL } = ctx.window.AcAssistant.i18n;
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(T.ur), keys(T.en));
  assert.deepEqual(keys(T.ur.q), keys(T.en.q));
  for (const a of ACTIONS) { assert.ok(ACTION_LABEL.en[a], 'en ' + a); assert.ok(ACTION_LABEL.ur[a], 'ur ' + a); }
  for (const k of Object.keys(T.en)) if (typeof T.en[k] === 'string') assert.ok(T.ur[k] && /[\u0600-\u06FF]|AI|AgenticCore/.test(T.ur[k]), k);
});

// ---------- links into AgenticCore Pakistan follow its Catalogue V2 numbering ----------
test('Estate → PK service links point at the intended V2 services', () => {
  // Pinned from agenticcorepk.com data/services.json (Catalogue V2). If PK renumbers, update here AND the links.
  const V2 = { 3: 'Property Flyer', 4: 'Property Photo Enhancement', 7: 'Property Promo Reel', 12: 'Single Property Landing Page', 13: 'Agent Personal Branding Kit',
    14: 'Agency Logo + Brand Kit', 16: 'Agency Website', 18: 'Google Business Profile Management', 21: 'Paid Ads Management — One Platform', 27: 'Project Brochure',
    33: 'Project Landing Page', 34: 'Project / Developer Website', 40: 'Project Launch Campaign' };
  const SECTIONS = ['property-marketing', 'project-marketing', 'ai-automation', 'specialist'];
  const src = ['ecosystem.js', 'ac-assistant.js', 'developer-corner.html'].map((f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
  const nums = [...src.matchAll(/service-(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(nums.length > 10);
  for (const n of nums) assert.ok(V2[n], 'service-' + n + ' is not a pinned V2 target');
  for (const m of src.matchAll(/hash: '([a-z-]+)'|services\.html#([a-z-]+)'/g)) { const h = m[1] || m[2]; assert.ok(SECTIONS.includes(h), h); }
});

test('Amaan tells owners to log in or create a free account before the form, in every language', async () => {
  const { AMAAN } = await import('../services/assistant-knowledge.mjs');
  assert.match(AMAAN.list_ready.en, /log in/i); assert.match(AMAAN.list_ready.en, /free account/i);
  assert.match(AMAAN.list_ready.ur, /لاگ ان/); assert.match(AMAAN.list_ready.ur, /مفت اکاؤنٹ/);
  assert.match(AMAAN.list_ready.ro, /log in/i); assert.match(AMAAN.list_ready.ro, /free account/i);
});

test('Amaan counts listings in plain words (no "listing(s)")', async () => {
  const { AMAAN } = await import('../services/assistant-knowledge.mjs');
  for (const l of ['en', 'ur', 'ro']) { assert.doesNotMatch(AMAAN.found[l] + AMAAN.found_one[l], /\(s\)/); }
  assert.match(AMAAN.found_one.en, /1 genuine listing that matches/);
});
