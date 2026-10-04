// AgenticCore Telegram bot (Phase 1) — conversations simulated end to end with
// a fake Telegram API and an in-memory store (no network, no database).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
delete process.env.ANTHROPIC_API_KEY;

const { handleUpdate, normalisePhone, phoneVariants, listingRow } = await import('../services/telegram/bot.mjs');
const { runNotifications, ensureWebhook } = await import('../services/telegram/notify.mjs');
const { webhookSecret } = await import('../services/telegram/tg-api.mjs');
const { handleTurn } = await import('../services/assistant-service.mjs');
const { default: quality } = await import('../listing-quality.js');
const { S } = await import('../services/telegram/strings.mjs');

const ME = 777, OWNER = '999';
const AREAS = ['G-13', 'DHA Phase 2', 'Bahria Town Phase 7'];

function fakeTg() {
  const sent = [], calls = [];
  return {
    sent, calls,
    async send(chat, text, extra) { sent.push({ chat, text, extra }); return { message_id: sent.length }; },
    async typing() {}, async answerCallback() {}, async removeButtons() {},
    async download(fileId) { return { bytes: Buffer.from('img-' + fileId), path: 'p/' + fileId }; },
    async call(method, payload) { calls.push({ method, payload }); if (method === 'getWebhookInfo') return { url: '' }; return true; }
  };
}
function fakeStore(opts) {
  opts = opts || {};
  const db = { seen: new Set(), sessions: {}, links: {}, profiles: {}, activity: [], listings: [], uploads: [], tokens: {}, notes: new Set(), users: [] };
  let nextMember = 100001;
  const s = {
    db,
    async firstSeen(id) { if (db.seen.has(id)) return false; db.seen.add(id); return true; },
    async getSession(chat) { return db.sessions[chat] ? JSON.parse(JSON.stringify(db.sessions[chat])) : null; },
    async saveSession(x) { db.sessions[x.chat_id] = JSON.parse(JSON.stringify(x)); },
    async linkedAccount(tg) {
      const l = Object.values(db.links).find((x) => x.tg === tg);
      return l ? Object.assign({ chat_id: l.chat, notify: true }, db.profiles[l.user]) : null;
    },
    async frozen(id) { return Boolean(db.profiles[id] && db.profiles[id].frozen); },
    async profileByPhone(v) { return Object.values(db.profiles).find((p) => v.includes(p.phone)) || null; },
    async createUser({ email, fullName, phone }) {
      if (db.users.some((u) => u.email === email)) { const e = new Error('A user with this email address has already been registered'); e.code = 'email_exists'; throw e; }
      if (Object.values(db.profiles).some((p) => p.phone === phone)) throw new Error('Database error creating new user');
      const id = crypto.randomUUID();
      db.users.push({ id, email, app_metadata: { created_via: 'telegram' } });
      db.profiles[id] = { id, full_name: fullName, phone, member_no: nextMember++, created_via: 'telegram', password_set_at: null, role: 'seller' };
      return { id };
    },
    async signInLink(email, to) { return 'https://iuwjlvcfnxbfhbkztsel.supabase.co/auth/v1/verify?token=x&redirect_to=' + encodeURIComponent(to); },
    async userEmail(id) { const u = db.users.find((x) => x.id === id); return u && u.email; },
    async link(user, tg, chat) { Object.keys(db.links).forEach((k) => { if (db.links[k].tg === tg) delete db.links[k]; }); db.links[user] = { user, tg, chat }; },
    async useLinkToken(hash) { const t = db.tokens[hash]; if (!t || t.used) return null; t.used = true; return t.user; },
    async log(user, kind, detail) { db.activity.push({ user: user && user.id, kind, detail, at: Date.now() }); },
    async countActivity(id, kind) { return db.activity.filter((a) => a.user === id && a.kind === kind).length; },
    async activeCities() { return ['Islamabad', 'Rawalpindi']; },
    async ownListings(id) { return db.listings.filter((l) => l.owner_id === id); },
    async insertListing(row) {
      if (db.profiles[row.owner_id] && db.profiles[row.owner_id].frozen) throw new Error('This account is frozen because no password was set within 30 days.');
      const l = Object.assign({ id: crypto.randomUUID(), created_at: new Date().toISOString() }, row); db.listings.push(l); return l;
    },
    async updateListing(id, owner, patch) { const l = db.listings.find((x) => x.id === id && x.owner_id === owner); if (!l) return null; Object.assign(l, patch); return l; },
    async uploadPhoto(path) { db.uploads.push(path); return 'https://iuwjlvcfnxbfhbkztsel.supabase.co/storage/v1/object/public/listing-photos/' + path; },
    async markSent(kind, ref) { const k = kind + '|' + ref; if (db.notes.has(k)) return false; db.notes.add(k); return true; },
    async rest(path) { return opts.rest ? opts.rest(path) : []; },
    async rpc(name, body) { (db.rpc = db.rpc || []).push([name, body]); return name === 'kb_decide' ? 'Bismillah Housing Scheme' : null; }
  };
  return s;
}
function deps(store, tg, extra) {
  return Object.assign({
    tg, store, quality, ownerId: OWNER, siteUrl: 'https://agenticcore.estate',
    voice: { configured: () => false, transcribe: async () => '' },
    assistant: { handleTurn, areaNames: async () => AREAS, guideDeps: () => ({ allowAI: false, areaNames: [] }) }
  }, extra || {});
}
let uid = 1;
const text = (t, from) => ({ update_id: uid++, message: { message_id: uid, from: { id: from || ME, is_bot: false, username: 'owner1' }, chat: { id: from || ME, type: 'private' }, text: t } });
const press = (data, from) => ({ update_id: uid++, callback_query: { id: 'cb' + uid, data, from: { id: from || ME }, message: { message_id: 5, chat: { id: from || ME, type: 'private' } } } });
const contact = (phone, userId) => ({ update_id: uid++, message: { message_id: uid, from: { id: ME }, chat: { id: ME, type: 'private' }, contact: { phone_number: phone, user_id: userId } } });
const photo = () => ({ update_id: uid++, message: { message_id: uid, from: { id: ME }, chat: { id: ME, type: 'private' }, photo: [{ file_id: 's' + uid, width: 320, height: 240 }, { file_id: 'm' + uid, width: 800, height: 600 }, { file_id: 'l' + uid, width: 1280, height: 960 }] } });
const last = (tg, chat) => tg.sent.filter((m) => m.chat === (chat || ME)).slice(-1)[0];
const lastText = (tg) => (last(tg) || {}).text || '';
const btnData = (m) => ((m && m.extra && m.extra.reply_markup && m.extra.reply_markup.inline_keyboard) || []).flat().map((b) => b.callback_data || b.url);
async function run(d, ...updates) { for (const u of updates) await handleUpdate(u, d); }

async function signedUp() {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  await run(d, press('m:signup'), contact('+92 300 1234567', ME), text('Ali Raza'), text('ali@example.com'), press('s:yes'));
  return { store, tg, d };
}

test('groups, other bots and repeated updates are ignored', async () => {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  assert.equal((await handleUpdate({ update_id: 1, message: { from: { id: 1 }, chat: { id: -5, type: 'group' }, text: 'hi' } }, d)).ignored, true);
  assert.equal((await handleUpdate({ update_id: 2, message: { from: { id: 1, is_bot: true }, chat: { id: 1, type: 'private' }, text: 'hi' } }, d)).ignored, true);
  const u = text('/start');
  await handleUpdate(u, d);
  assert.equal((await handleUpdate(u, d)).duplicate, true);
  assert.equal(tg.sent.length, 1);
});

test('new person: welcome offers to open an account (EN, Urdu and Roman Urdu)', async () => {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  await run(d, text('/start'));
  assert.ok(btnData(last(tg)).includes('lg:en') && btnData(last(tg)).includes('lg:ur'));   // English or Urdu first
  await run(d, press('lg:en'));
  assert.match(lastText(tg), /open an AgenticCore Estate account/);
  assert.ok(btnData(last(tg)).includes('m:signup'));
  await run(d, text('السلام علیکم'));
  assert.match(lastText(tg), /اکاؤنٹ/);
  await run(d, text('assalam o alaikum mujhe account chahiye'));
  assert.match(lastText(tg), /Aap ka|Assalam|account/i);
});

test('sign-up: own phone via Telegram, name, email, confirm → account, member number, one-time link, owner alert', async () => {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  await run(d, press('m:signup'));
  assert.equal(last(tg).extra.reply_markup.keyboard[0][0].request_contact, true);
  await run(d, contact('+923001234567', 12345));             // someone else's contact
  assert.match(lastText(tg), /your own number/);
  await run(d, contact('923001234567', ME));
  assert.match(lastText(tg), /full name/);
  await run(d, text('A'));
  assert.match(lastText(tg), /full name \(2 to 60/);
  await run(d, text('Ali Raza'), text('not-an-email'));
  assert.match(lastText(tg), /doesn't look like an email/);
  await run(d, text('Ali@Example.com'));
  assert.match(lastText(tg), /Name: Ali Raza\nMobile: 03001234567\nEmail: ali@example\.com/);
  assert.equal(store.db.users.length, 0, 'nothing created before confirming');
  await run(d, press('s:yes'));
  assert.equal(store.db.users.length, 1);
  const p = Object.values(store.db.profiles)[0];
  assert.equal(p.phone, '03001234567');
  assert.equal(p.created_via, 'telegram');
  const ready = tg.sent.find((m) => /member number is AC-100001/.test(m.text));
  assert.ok(ready, 'member number shown');
  assert.match(btnData(ready)[0], /redirect_to=https%3A%2F%2Fagenticcore\.estate%2Fset-password\.html/);
  const alert = tg.sent.find((m) => m.chat === OWNER && /New account AC-100001/.test(m.text));
  assert.ok(alert, 'owner alerted');
  assert.doesNotMatch(alert.text, /1234567/, 'owner alert masks the phone');
  assert.ok(store.db.activity.some((a) => a.kind === 'account_created'));
  assert.ok(btnData(last(tg)).includes('m:list'), 'menu now offers listing');
});

test('sign-up refuses a phone or email that already has an account', async () => {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  store.db.profiles.x = { id: 'x', phone: '03005555555', member_no: 100050 };
  await run(d, press('m:signup'), contact('+92 300 5555555', ME));
  assert.match(lastText(tg), /already uses this number/);
  assert.equal(store.db.users.length, 0);
  store.db.users.push({ id: 'u2', email: 'taken@example.com' });
  await run(d, press('m:signup'), contact('+92 300 6666666', ME), text('Sara Khan'), text('taken@example.com'), press('s:yes'));
  assert.match(lastText(tg), /already uses this email/);
  await run(d, text('sara@example.com'), press('s:yes'));
  assert.ok(tg.sent.some((m) => /member number is AC-/.test(m.text)));
});

test('linking an existing website account with the dashboard code', async () => {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  store.db.profiles.web = { id: 'web', full_name: 'Web User', member_no: 100007, created_via: 'web', password_set_at: '2026-09-01' };
  const token = 'Abcdefghijklmnopqrstuvwxyz012345';
  store.db.tokens[crypto.createHash('sha256').update(token).digest('hex')] = { user: 'web' };
  await run(d, text('/start link_' + token));
  assert.ok(tg.sent.some((m) => /linked to your AgenticCore account AC-100007/.test(m.text)));
  assert.ok(tg.sent.some((m) => m.chat === OWNER && /Telegram connected to account AC-100007/.test(m.text)));
  await run(d, text('/start link_' + token));                 // used once only
  assert.match(lastText(tg), /expired or was already used/);
});

test('listing by chat: details → photos → review → publish with a link; nothing goes live before confirming', async () => {
  const { store, tg, d } = await signedUp();
  await run(d, press('m:list'));
  assert.match(lastText(tg), /Tell me about the property/);
  await run(d, text('10 marla house for sale in G-13 Islamabad'));
  assert.match(lastText(tg), /price/i);
  await run(d, text('4 crore'));
  assert.match(lastText(tg), /bedrooms/i);
  await run(d, text('5'), text('6'));
  assert.match(lastText(tg), /send photos/i);
  await run(d, press('l:done'));
  assert.match(lastText(tg), /at least one photo/);
  await run(d, photo(), photo());
  assert.match(lastText(tg), /Photo 2 received/);
  assert.equal(store.db.uploads.length, 4, 'full size + thumb for each photo');
  assert.ok(store.db.uploads.every((p) => p.startsWith(Object.keys(store.db.profiles)[0] + '/tg/')), 'photos stored in the owner\'s own folder');
  await run(d, press('l:done'));
  const review = lastText(tg);
  assert.match(review, /10 Marla House for Sale in G-13, Islamabad/);
  assert.match(review, /Rs 4 Crore|4 Crore|4 crore/i);
  assert.match(review, /Photos: 2/);
  assert.equal(store.db.listings.length, 0, 'not published before confirmation');
  // change something after the review
  await run(d, press('l:edit'), text('price is 3.8 crore'));
  assert.match(lastText(tg), /3\.8/);
  await run(d, press('l:publish'));
  assert.equal(store.db.listings.length, 1);
  const l = store.db.listings[0];
  assert.equal(l.owner_id, Object.keys(store.db.profiles)[0]);
  assert.equal(l.type, 'buy'); assert.equal(l.property_type, 'house'); assert.equal(l.city, 'Islamabad'); assert.equal(l.area, 'G-13');
  assert.equal(l.price, 38000000); assert.equal(l.beds, 5); assert.equal(l.baths, 6); assert.equal(l.size_marla, 10);
  assert.equal(l.photos.length, 2); assert.equal(l.thumbs.length, 2);
  const pub = tg.sent.find((m) => /Your listing is live/.test(m.text));
  assert.match(pub.text, new RegExp('https://agenticcore\\.estate/listing\\.html\\?id=' + l.id));
  assert.match(pub.text, /Listing quality: \d+\/100/);
  assert.ok(tg.sent.some((m) => m.chat === OWNER && /Listing published by AC-100001/.test(m.text)));
});

test('publish checks: city, duplicate, daily limit, frozen account', async () => {
  const { store, tg, d } = await signedUp();
  const me = Object.values(store.db.profiles)[0];
  async function attempt(desc) {
    await run(d, press('m:list'), text(desc), text('3 bedrooms 3 bathrooms'), photo(), press('l:done'), press('l:publish'));
  }
  const cities = store.activeCities;
  store.activeCities = async () => ['Islamabad'];               // a city switched off by the team
  await attempt('7 marla house for sale in Bahria Town Phase 7 Rawalpindi demand 3 crore');
  assert.match(lastText(tg), /we currently list in Islamabad only/);
  store.activeCities = cities;
  assert.equal(store.db.listings.length, 0);
  await run(d, text('/cancel'));
  await attempt('7 marla house for sale in G-13 Islamabad demand 3 crore');
  assert.equal(store.db.listings.length, 1);
  await attempt('7 marla house for sale in G-13 Islamabad demand 3 crore');
  assert.match(lastText(tg), /already have a listing with the same/);
  await run(d, text('/cancel'));
  for (let i = 0; i < 5; i++) store.db.activity.push({ user: me.id, kind: 'listing_published' });
  await attempt('5 marla house for sale in G-13 Islamabad demand 2 crore');
  assert.match(lastText(tg), /daily limit/);
  await run(d, text('/cancel'));
  store.db.activity = [];
  me.frozen = true;
  await run(d, press('m:list'));
  assert.match(lastText(tg), /paused because no password was set within 30 days/);
  assert.equal(store.db.listings.length, 1);
});

test('people without an account are asked to open one before listing', async () => {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  await run(d, text('I want to sell my house'));
  assert.match(lastText(tg), /need an AgenticCore account first/);
  assert.ok(btnData(last(tg)).includes('m:signup'));
  await run(d, photo());
  assert.match(lastText(tg), /tell me about it first/);
});

test('website sign-in link: right page, limited to 3 an hour', async () => {
  const { store, tg, d } = await signedUp();
  await run(d, text('/login'));
  assert.match(btnData(last(tg))[0], /set-password\.html/);
  Object.values(store.db.profiles)[0].password_set_at = '2026-10-01';
  await run(d, text('/login'));
  assert.match(btnData(last(tg))[0], /my\.html/);
  await run(d, text('/login'), text('/login'));
  assert.match(lastText(tg), /several links recently/);
});

test('voice notes: transcribed with Grok when configured, otherwise a clear message', async () => {
  const store = fakeStore(), tg = fakeTg();
  const voiceMsg = () => ({ update_id: uid++, message: { message_id: uid, from: { id: ME }, chat: { id: ME, type: 'private' }, voice: { file_id: 'v1', duration: 3 } } });
  await run(deps(store, tg), voiceMsg());
  assert.match(lastText(tg), /Voice notes aren't available/);
  const d = deps(store, tg, { voice: { configured: () => true, transcribe: async () => 'mujhe account kholna hai' } });
  await run(d, voiceMsg());
  assert.ok(tg.sent.some((m) => /I heard|Main ne suna/.test(m.text)));
  assert.ok(last(tg).extra && last(tg).extra.reply_markup.keyboard, 'voice request "account kholna" starts sign-up');
});

test('marketing services questions go to the Pakistan agent; flood limit holds', async () => {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  await run(d, text('I need a logo and social media marketing'));
  assert.match(lastText(tg), /AgenticCore Pakistan/);
  assert.ok(btnData(last(tg)).includes('o:start') && btnData(last(tg)).includes('https://agenticcorepk.com/services.html'));
  for (let i = 0; i < 45; i++) await run(d, text('hello'));
  assert.ok(tg.sent.some((m) => /very quickly/.test(m.text)));
});

test('notifications: enquiry, still-available button and freeze reminder go out once each', async () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  const tables = {
    enquiries: [{ id: 'e1', recipient_id: 'u1', target_title: '10 Marla House', sender_name: 'Bilal', message: 'Is it available?' }],
    listings_hidden: [], stale: [{ id: '11111111-1111-1111-1111-111111111111', owner_id: 'u1', title: 'Old Flat' }],
    profiles: [{ id: 'u1', member_no: 100001, created_at: new Date(now - 24 * 86400000).toISOString() }]
  };
  const store = fakeStore({
    rest(path) {
      if (path.startsWith('enquiries')) return tables.enquiries;
      if (path.startsWith('listings?moderation_status=eq.hidden')) return tables.listings_hidden;
      if (path.startsWith('listings?moderation_status=eq.active')) return tables.stale;
      if (path.startsWith('profiles')) return tables.profiles;
      if (path.startsWith('telegram_links')) return [{ user_id: 'u1', chat_id: 55 }];
      if (path.startsWith('tg_sessions')) return [{ lang: 'en' }];
      return [];
    }
  });
  const tg = fakeTg();
  const r1 = await runNotifications({ tg, store, siteUrl: 'https://agenticcore.estate', now });
  assert.deepEqual(r1, { enquiries: 1, hidden: 0, available: 1, freeze: 1 });
  assert.ok(tg.sent.some((m) => /New enquiry on "10 Marla House" from Bilal/.test(m.text)));
  const avail = tg.sent.find((m) => /still available/.test(m.text));
  assert.deepEqual(btnData(avail), ['av:11111111-1111-1111-1111-111111111111']);
  assert.ok(tg.sent.some((m) => /within 6 day/.test(m.text)));
  const r2 = await runNotifications({ tg, store, siteUrl: 'https://agenticcore.estate', now });
  assert.deepEqual(r2, { enquiries: 0, hidden: 0, available: 0, freeze: 0 });
});

test('"Still available" button updates only the person\'s own listing', async () => {
  const { store, tg, d } = await signedUp();
  const me = Object.keys(store.db.profiles)[0];
  store.db.listings.push({ id: '22222222-2222-2222-2222-222222222222', owner_id: 'someone-else', title: 'Not mine' });
  await run(d, press('av:22222222-2222-2222-2222-222222222222'));
  assert.equal(store.db.listings[0].last_confirmed_at, undefined);
  store.db.listings.push({ id: '33333333-3333-3333-3333-333333333333', owner_id: me, title: 'Mine' });
  await run(d, press('av:33333333-3333-3333-3333-333333333333'));
  assert.ok(store.db.listings[1].last_confirmed_at);
  assert.match(lastText(tg), /marked as available/);
});

test('webhook: secret derived from the token; registration sets it with message/button updates only', async () => {
  const tg = fakeTg();
  const r = await ensureWebhook(tg, 'https://agenticcore.estate');
  assert.equal(r.changed, true);
  const set = tg.calls.find((c) => c.method === 'setWebhook');
  assert.equal(set.payload.url, 'https://agenticcore.estate/api/telegram');
  assert.equal(set.payload.secret_token, webhookSecret('test-token'));
  assert.notEqual(set.payload.secret_token, 'test-token');
  assert.deepEqual(set.payload.allowed_updates, ['message', 'callback_query']);
  const { default: handler } = await import('../netlify/functions/telegram.mjs');
  const bad = await handler(new Request('https://agenticcore.estate/api/telegram', { method: 'POST', body: '{}', headers: { 'x-telegram-bot-api-secret-token': 'wrong' } }), {});
  assert.equal(bad.status, 403);
  const get = await handler(new Request('https://agenticcore.estate/api/telegram'), {});
  const body = await get.json();
  assert.deepEqual(Object.keys(body).sort(), ['configured', 'ok'], 'GET reveals no settings');
});

test('helpers: phones, listing rows, and every string in three languages', () => {
  assert.equal(normalisePhone('+92 300 1234567'), '03001234567');
  assert.equal(normalisePhone('923001234567'), '03001234567');
  assert.equal(normalisePhone('+1 808 998 5226'), '+18089985226');
  assert.deepEqual(phoneVariants('03001234567'), ['03001234567', '+923001234567', '923001234567', '00923001234567']);
  const row = listingRow({ purpose: 'rent', property_type: 'flat', city: 'islamabad', area: 'G-13', price: 85000, size_value: 1200, size_unit: 'sqft', beds: 2, baths: 2, features: [] }, 'u1', 'Islamabad');
  assert.equal(row.type, 'rent'); assert.equal(row.size_unit, 'sqft'); assert.equal(row.city, 'Islamabad'); assert.ok(row.last_confirmed_at);
  for (const [k, v] of Object.entries(S)) {
    for (const L of ['en', 'ur', 'ro']) assert.ok(v[L] && v[L].trim(), k + ' missing ' + L);
    const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    assert.equal(vars(v.ur), vars(v.en), k + ' ur placeholders'); assert.equal(vars(v.ro), vars(v.en), k + ' ro placeholders');
  }
});

test('general questions: AI wording capped at 20 answers per chat per day', async () => {
  const store = fakeStore(), tg = fakeTg();
  let aiCalls = 0;
  const d = deps(store, tg, { assistant: { handleTurn, areaNames: async () => AREAS, guideDeps: () => ({ allowAI: true, ai: async () => { aiCalls++; return { ok: false, reason: 'test' }; }, areaNames: [] }) } });
  for (let i = 0; i < 25; i++) await run(d, text('Are the properties verified? Is it safe?'));
  assert.equal(aiCalls, 20);
  assert.match(lastText(tg), /verif|check/i, 'answers still come from the knowledge base after the cap');
});

// ---------- six cities (Lahore, Karachi, Sialkot, Faisalabad from 6 Oct 2026, 00:00 PKT) ----------
const SIX = ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Sialkot', 'Faisalabad'];
const BEFORE = () => new Date('2026-10-05T23:59:00+05:00');
const AFTER = () => new Date('2026-10-06T00:00:00+05:00');
const NEW_CITY_LISTINGS = [
  ['Lahore', '5 marla house for sale in Johar Town Lahore demand 2.5 crore', 'Johar Town'],
  ['Karachi', '240 sq yd house for sale in Clifton Karachi demand 9 crore', 'Clifton'],
  ['Sialkot', '10 marla house for sale in Cantonment Sialkot demand 4 crore', 'Cantonment'],
  ['Faisalabad', '7 marla house for sale in Eden Valley Faisalabad demand 3 crore', 'Eden Valley']
];

test('new cities before 6 October: sign up and list now, launch message once, listing saved (shows from launch day)', async () => {
  for (const [city, desc, area] of NEW_CITY_LISTINGS) {
    const { store, tg, d } = await signedUp();
    d.now = BEFORE; store.activeCities = async () => SIX;
    await run(d, press('m:list'), text(desc));
    const said = tg.sent.filter((m) => m.chat === ME).map((m) => m.text);
    assert.ok(said.includes('Hum 6 October ko ' + city + ' mein launch kar rahe hain. Aap abhi account bana kar property list kar sakte hain, listing launch ke din se show hogi.') ||
      said.includes('We launch in ' + city + ' on 6 October. You can create your account and list your property now; the listing will show from launch day.'), city + ' launch message');
    await run(d, text('3 bedrooms 3 bathrooms'));
    assert.equal(tg.sent.filter((m) => /launch/.test(m.text || '')).length, 1, 'said once only');
    await run(d, photo(), press('l:done'), press('l:publish'));
    assert.equal(store.db.listings.length, 1, city + ' listing saved');
    assert.equal(store.db.listings[0].city, city); assert.equal(store.db.listings[0].area, area);
    assert.match(lastText(tg), new RegExp('saved ✓[\\s\\S]*We launch in ' + city + ' on 6 October'));
  }
});

test('new cities from 6 October 00:00 PKT: exactly like Islamabad and Rawalpindi', async () => {
  const { store, tg, d } = await signedUp();
  d.now = AFTER; store.activeCities = async () => SIX;
  await run(d, press('m:list'), text(NEW_CITY_LISTINGS[0][1]), text('3 bedrooms 3 bathrooms'), photo(), press('l:done'), press('l:publish'));
  assert.ok(!tg.sent.some((m) => /launch/i.test(m.text || '')), 'no launch message');
  assert.match(lastText(tg), /Your listing is live/);
});

test('Amaan knows which city an area is in (G-10 → Islamabad) and asks when an area is in two cities', async () => {
  const { store, tg, d } = await signedUp();
  await run(d, press('m:list'), text('mujhe apna 10 marla ghar bechna hai G-10 mein, demand 6 crore'));
  assert.match(lastText(tg), /G-10, Islamabad/);
  await run(d, text('/cancel'), press('m:list'), text('7 marla house for sale in Bahria Town Phase 7 demand 3 crore'));
  assert.match(lastText(tg), /Bahria Town Phase 7 — is that in Rawalpindi or Islamabad\?/);
  await run(d, text('Rawalpindi'));
  assert.doesNotMatch(lastText(tg), /which city|is that in/i);
});

// ---------- learning memory ----------
import { setLearnedPlaces, findPlace } from '../services/places.mjs';
import { learnDigest, recallLine } from '../services/memory.mjs';

test('memory: the bots learn which city people use; once settled they stop asking', async () => {
  setLearnedPlaces([]);
  assert.equal(findPlace('Bahria Town Phase 7').ambiguous, true);
  setLearnedPlaces([{ city: 'Rawalpindi', area: 'Bahria Town Phase 7', n: 8 }, { city: 'Islamabad', area: 'Bahria Town Phase 7', n: 1 },
    { city: 'Lahore', area: 'Bismillah Housing Scheme', n: 3 }]);
  assert.deepEqual([findPlace('Bahria Town Phase 7').impliedCity, findPlace('Bahria Town Phase 7').ambiguous], ['Rawalpindi', false]);
  assert.equal(findPlace('5 marla in bismillah housing scheme').impliedCity, 'Lahore', 'a learned society');
  setLearnedPlaces([]);
});

test('memory: a city chosen in chat and an unknown area are observations; publishing remembers the member', async () => {
  const { store, tg, d } = await signedUp();
  store.activeCities = async () => SIX; d.now = AFTER;
  await run(d, press('m:list'), text('7 marla house for sale in Bahria Town Phase 7 demand 3 crore'), text('Islamabad'));
  const obs = (store.db.rpc || []).filter(([n]) => n === 'kb_observe').map(([, b]) => [b.p_city, b.p_name, b.p_detail.from]);
  assert.deepEqual(obs[0], ['Islamabad', 'Bahria Town Phase 7', 'city_choice']);
  await run(d, text('/cancel'), press('m:list'), text('5 marla house for sale in Lahore demand 1.5 crore'));
  assert.match(lastText(tg), /Which area exactly/);
  await run(d, text('Bismillah Housing Scheme'));
  assert.ok((store.db.rpc || []).some(([n, b]) => n === 'kb_observe' && b.p_name === 'Bismillah Housing Scheme' && b.p_city === 'Lahore' && b.p_detail.from === 'chat'));
  await run(d, text('3 bedrooms 3 bathrooms'), photo(), press('l:done'), press('l:publish'));
  const mem = (store.db.rpc || []).find(([n]) => n === 'member_remember');
  assert.equal((store.db.rpc || []).filter(([n]) => n === 'kb_observe').length, 2, 'each place observed once per conversation');
  assert.ok(mem && mem[1].p_patch.cities[0] === 'Lahore' && mem[1].p_patch.types[0] === 'house' && mem[1].p_patch.last_intent === 'list');
  assert.ok(!JSON.stringify(mem[1].p_patch).includes('0300'), 'no phone in memory');
});

test('memory: welcome back recalls the last area; owner reviews new places with /learn', async () => {
  const store = fakeStore({ rest: (p) => p.startsWith('member_memory') ? [{ data: { cities: ['Lahore'], areas: ['Johar Town'], types: ['house'] } }]
    : p.startsWith('kb_facts') ? [{ id: 7, kind: 'area', city: 'Lahore', name: 'Bismillah Housing Scheme', detail: {}, status: 'learned', sources: 3 }] : [] });
  const tg = fakeTg(), d = deps(store, tg);
  await run(d, press('m:signup'), contact('+92 300 1234567', ME), text('Ali Raza'), text('ali@example.com'), press('s:yes'), text('/menu'));
  assert.match(lastText(tg), /Last time: House, Johar Town, Lahore/);
  await run(d, text('/learn'));                                  // not the owner
  assert.ok(!tg.sent.some((m) => /Bismillah/.test(m.text)));
  await run(d, text('/learn', Number(OWNER)));
  const item = tg.sent.find((m) => String(m.chat) === String(OWNER) && /Bismillah Housing Scheme — Lahore \(area, 3 people, already in use\)/.test(m.text));
  assert.ok(item);
  assert.deepEqual(btnData(item), ['kb:a:7', 'kb:r:7']);
  await run(d, press('kb:a:7'));                                 // not the owner
  assert.ok(!(store.db.rpc || []).some(([n]) => n === 'kb_decide'));
  await run(d, press('kb:a:7', Number(OWNER)));
  assert.deepEqual((store.db.rpc || []).find(([n]) => n === 'kb_decide')[1], { p_id: 7, p_status: 'approved', p_by: null });
  assert.match(tg.sent.filter((m) => String(m.chat) === String(OWNER)).slice(-1)[0].text, /approved — added to the area list/);
  assert.equal(recallLine(null), '');
});

test('memory: the owner gets one daily nudge at 09:00 PKT when places wait for review', async () => {
  const sent = [];
  const deps2 = { ownerId: OWNER, tg: { send: async (c, t) => sent.push(t) }, store: { rest: async () => [{ id: 1, kind: 'area', city: 'Karachi', name: 'X', sources: 2 }] } };
  assert.equal(await learnDigest(deps2, new Date('2026-10-07T03:05:00Z')), 0, 'not at 08:05 PKT');
  assert.equal(await learnDigest(deps2, new Date('2026-10-07T04:05:00Z')), 1, 'at 09:05 PKT');
  assert.equal(await learnDigest(deps2, new Date('2026-10-07T04:15:00Z')), 0, 'only in the 09:00–09:09 slot');
  assert.deepEqual(sent, ['📚 1 new place(s) to review — send /learn.']);
});
