// AgenticCore Dealer AI — feed logic, bot flows and scheduled jobs, with an
// in-memory store and a fake Telegram.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../services/dealer/feed.mjs';
import { handleUpdate, resetPlaceCache } from '../services/dealer/bot.mjs';
import { runDealerJobs } from '../services/dealer/cron.mjs';
import { t } from '../services/dealer/strings.mjs';
import { searchAll, bestPrice, fromSite, fromPartner, makePartnerSearch } from '../services/dealer/sources.mjs';

const CITIES = ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Murree', 'Galiyat (Nathia Gali / Ayubia)'];
const H = 3600000, DAY = 24 * H;
const OWNER = 999;

// ---------- fakes ----------
function fakeStore() {
  let n = 0;
  const id = () => 'id-' + (++n).toString().padStart(4, '0') + '-0000-0000-000000000000';
  const db = { site: [], accounts: [], listings: [], requests: [], matches: [], reveals: [], reports: [], blocks: [], sessions: {}, seen: new Set() };
  const now = () => Date.now();
  const withRole = (l) => (l ? Object.assign({}, l, { poster_role: (db.accounts.find((a) => a.id === l.account_id) || {}).role }) : null);
  const conflict = () => { const e = new Error('duplicate'); e.status = 409; e.code = '23505'; return e; };
  const s = {
    db,
    async firstSeen(u) { if (db.seen.has(u)) return false; db.seen.add(u); return true; },
    async getSession(c) { return db.sessions[c] || null; },
    async saveSession(c, state, lang) { db.sessions[c] = { state: JSON.parse(JSON.stringify(state || {})), lang }; },
    async accountByTg(u) { return db.accounts.find((a) => a.tg_user_id === u) || null; },
    async accountById(x) { return db.accounts.find((a) => a.id === x) || null; },
    async createAccount(row) {
      if (db.accounts.some((a) => a.phone === row.phone || a.tg_user_id === row.tg_user_id)) throw conflict();
      const a = Object.assign({ id: id(), status: 'active', reveal_limit: null }, row); db.accounts.push(a); return a;
    },
    async updateAccount(x, p) { Object.assign(db.accounts.find((a) => a.id === x), p); },
    async countListingsSince(acc, since) { return db.listings.filter((l) => l.account_id === acc && l.created_at >= since).length; },
    async findDuplicate(acc, r) {
      return db.listings.find((l) => l.account_id === acc && l.status === 'active' && l.purpose === r.purpose && l.property_type === r.property_type &&
        l.city === r.city && l.area.toLowerCase() === r.area.toLowerCase() && l.size_marla === r.size_marla && l.price === r.price) || null;
    },
    async insertListing(row) {
      if (db.listings.some((l) => l.ref === row.ref)) throw conflict();
      const l = Object.assign({ id: id(), status: 'active', created_at: new Date(now()).toISOString(), expiry_notified_at: null }, row);
      db.listings.push(l); return l;
    },
    async listingById(x) { return withRole(db.listings.find((l) => l.id === x)); },
    async updateOwnListing(acc, x, p) { const l = db.listings.find((r) => r.id === x && r.account_id === acc); if (!l) return null; Object.assign(l, p); return l; },
    async myListings(acc) { return db.listings.filter((l) => l.account_id === acc && l.status !== 'removed').slice().reverse().slice(0, 10); },
    async liveListings({ purpose, city, types }, at) {
      return db.listings.filter((l) => l.status === 'active' && new Date(l.expires_at).getTime() > at && (!purpose || l.purpose === purpose) &&
        (!city || l.city === city) && (!types || !types.length || types.includes(l.property_type))).map(withRole);
    },
    async insertRequest(row) { const r = Object.assign({ id: id(), created_at: new Date(now()).toISOString() }, row); db.requests.push(r); return r; },
    async requestById(x) { return db.requests.find((r) => r.id === x) || null; },
    async updateRequest(x, p, acc) { const r = db.requests.find((q) => q.id === x && (!acc || q.account_id === acc)); if (r) Object.assign(r, p); return r || null; },
    async myRequests(acc) { return db.requests.filter((r) => r.account_id === acc && ['open', 'answered', 'waiting_choice'].includes(r.status)); },
    async alertingRequests({ purpose, city }, at) {
      return db.requests.filter((r) => ['open', 'answered'].includes(r.status) && new Date(r.deadline_at).getTime() > at &&
        (!r.purpose || r.purpose === purpose) && (!r.city || r.city === city));
    },
    async dueRequests(at) { return db.requests.filter((r) => ['open', 'answered'].includes(r.status) && new Date(r.deadline_at).getTime() <= at); },
    async staleWaiting(at) { return db.requests.filter((r) => r.status === 'waiting_choice' && new Date(r.active_until).getTime() <= at); },
    async addMatches(req, ids) {
      const fresh = ids.filter((l) => !db.matches.some((m) => m.request_id === req && m.listing_id === l));
      fresh.forEach((l) => db.matches.push({ request_id: req, listing_id: l })); return fresh;
    },
    async siteListings({ purpose, city, types }) {
      return db.site.filter((r) => (!purpose || r.type === (purpose === 'rent' ? 'rent' : 'buy')) && (!city || r.city === city) &&
        (!types || !types.length || types.includes(r.property_type))).map((r) => fromSite(r));
    },
    async matchedIds(req) { return db.matches.filter((m) => m.request_id === req).map((m) => m.listing_id); },
    async toRecheck(at) {
      return db.requests.filter((r) => ['open', 'answered'].includes(r.status) && new Date(r.deadline_at).getTime() > at &&
        (!r.checked_at || new Date(r.checked_at).getTime() < at - H));
    },
    async matchCount(req) { return db.matches.filter((m) => m.request_id === req).length; },
    async revealsToday(v) { return db.reveals.filter((r) => r.viewer_id === v).length; },
    async hasRevealed(v, l) { return db.reveals.some((r) => r.viewer_id === v && r.listing_id === l); },
    async addReveal(v, l) { if (!db.reveals.some((r) => r.viewer_id === v && r.listing_id === l)) db.reveals.push({ viewer_id: v, listing_id: l }); },
    async addReport(rep, l, reason) {
      if (db.reports.some((r) => r.reporter_id === rep && r.listing_id === l)) return false;
      db.reports.push({ reporter_id: rep, listing_id: l, reason });
      // same rule as the feed_after_report trigger
      const row = db.listings.find((x) => x.id === l);
      row.reports = db.reports.filter((r) => r.listing_id === l).length;
      if (row.reports >= 3 && row.status === 'active') row.status = 'hidden';
      return true;
    },
    async addBlock(a, b) { if (!db.blocks.some((x) => x.blocker_id === a && x.blocked_id === b)) db.blocks.push({ blocker_id: a, blocked_id: b }); },
    async blockedWith(a) { return new Set(db.blocks.filter((x) => x.blocker_id === a || x.blocked_id === a).map((x) => (x.blocker_id === a ? x.blocked_id : x.blocker_id))); },
    async expiringSoon(at, within) { return db.listings.filter((l) => l.status === 'active' && !l.expiry_notified_at && new Date(l.expires_at).getTime() <= at + within && new Date(l.expires_at).getTime() > at); },
    async expiredNow(at) { return db.listings.filter((l) => l.status === 'active' && new Date(l.expires_at).getTime() <= at); },
    async setListing(x, p) { Object.assign(db.listings.find((l) => l.id === x), p); },
    async accountsByIds(ids) { return db.accounts.filter((a) => ids.includes(a.id)); },
    async cities() { return CITIES.map((c, i) => ({ name: c, main: i < 4 })); },
    async areaNames() { return ['G-13', 'Bahria Town Phase 7']; },
    async cleanSeen() {},
    async stats() { return { accounts: db.accounts.length, live: db.listings.filter((l) => l.status === 'active').length, open: db.requests.length }; }
  };
  return s;
}
function fakeTg() {
  const sent = [];
  return {
    sent,
    async send(chat, text, extra) { sent.push({ chat, text, extra }); return { message_id: sent.length }; },
    async answerCallback() {}, async removeButtons() {},
    async download() { return { bytes: Buffer.from('x'), path: 'v.ogg' }; },
    async call() { return {}; }
  };
}
function setup(opts) {
  resetPlaceCache();
  const deps = { tg: fakeTg(), store: fakeStore(), ownerId: String(OWNER), partner: (opts && opts.partner) || null, voice: { configured: () => true, transcribe: async () => (opts && opts.heard) || '' } };
  let u = 0;
  const msg = (from, m) => handleUpdate({ update_id: ++u, message: Object.assign({ message_id: u, chat: { id: from, type: 'private' }, from: { id: from } }, m) }, deps);
  const text = (from, s) => msg(from, { text: s });
  const press = (from, data) => handleUpdate({ update_id: ++u, callback_query: { id: 'cb' + u, data, from: { id: from }, message: { message_id: 1, chat: { id: from, type: 'private' } } } }, deps);
  const last = (chat) => deps.tg.sent.filter((m) => String(m.chat) === String(chat)).slice(-1)[0];
  const all = (chat) => deps.tg.sent.filter((m) => String(m.chat) === String(chat));
  const btns = (m) => (m && m.extra && m.extra.reply_markup && m.extra.reply_markup.inline_keyboard ? m.extra.reply_markup.inline_keyboard.flat().map((b) => b.callback_data) : []);
  return { deps, msg, text, press, last, all, btns };
}
async function register(h, user, name, role, lang) {
  await h.text(user, '/start');
  await h.press(user, 'lang:' + (lang || 'en'));
  await h.text(user, name);
  await h.msg(user, { contact: { user_id: user, phone_number: '0300' + String(user).padStart(7, '0') } });
  await h.press(user, 'role:' + role);
}
async function postFull(h, user, text, extra) {
  await h.text(user, text);
  for (let i = 0; i < 10; i++) {
    const m = h.last(user), b = h.btns(m);
    if (b.includes('l:ok')) break;
    if (b.includes('ls:skip')) await h.press(user, 'ls:skip');
    else if (extra && extra.length) await h.text(user, extra.shift());
    else throw new Error('stuck at: ' + m.text);
  }
  await h.press(user, 'l:ok');
}

// ---------- feed logic ----------
test('feed: buyer queries in English, Roman Urdu and Urdu read the same', () => {
  for (const q of ['5 marla house G-13 under 2.5 crore', 'G-13 mein 5 marla ghar chahiye dhai crore tak', 'جی 13 میں 5 مرلہ گھر چاہیے ڈھائی کروڑ تک']) {
    const p = F.parseQuery(q, ['G-13'], CITIES);
    assert.equal(p.city, 'Islamabad', q);
    assert.deepEqual(p.property_types, ['house'], q);
    assert.deepEqual(p.areas, ['g 13'], q);
    assert.equal(p.price_max, 25000000, q);
    assert.equal(p.size_marla, 5, q);
    assert.equal(F.guessIntent(q), 'search', q);
  }
});

test('feed: sizes, prices, phones, cities', () => {
  assert.deepEqual(F.parseSize('1 kanal'), { value: 1, unit: 'kanal' });
  assert.deepEqual(F.parseSize('2250 sq ft'), { value: 2250, unit: 'sqft' });
  assert.equal(F.parsePrice('2.4 crore'), 24000000);
  assert.equal(F.parsePrice('85 lakh'), 8500000);
  assert.equal(F.parsePrice('60 hazar'), 60000);
  assert.equal(F.parsePrice('ask seller'), 'ask');
  assert.equal(F.normPhone('0300-1234567'), '+923001234567');
  assert.equal(F.normPhone('00971501234567'), '+971501234567');
  assert.equal(F.matchCity('isb', CITIES), 'Islamabad');
  assert.equal(F.matchCity('nathia gali', CITIES), 'Galiyat (Nathia Gali / Ayubia)');
  assert.equal(F.matchCity('xyz', CITIES), null);
  assert.equal(F.listingRow({ purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13', size_value: 1, size_unit: 'kanal', price_ask: true }).size_marla, 20);
});

test('feed: matching rules', () => {
  const q = F.parseQuery('5 marla house G-13 under 2.5 crore', [], CITIES);
  const l = { purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13/2', price: 24000000, size_marla: 5, beds: 3 };
  assert.ok(F.matches(l, q));
  assert.ok(F.matches(Object.assign({}, l, { price: null }), q), 'ask-the-seller entries still match');
  assert.ok(!F.matches(Object.assign({}, l, { price: 26000000 }), q), 'over budget');
  assert.ok(!F.matches(Object.assign({}, l, { area: 'G-1' }), q), 'G-1 is not G-13');
  assert.ok(!F.matches(Object.assign({}, l, { size_marla: 10 }), q), 'size');
  assert.ok(!F.matches(Object.assign({}, l, { city: 'Lahore' }), q), 'city');
  assert.ok(F.areaMatches('Bahria Town Phase 7', ['bahria|phase 7']));
  assert.ok(!F.areaMatches('Bahria Town Phase 8', ['bahria|phase 7']));
});

test('feed: cards always say user-submitted, never verified; contact info is kept out of text', () => {
  const c = F.card({ ref: 'DL-ABCDEF', purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13', price: null, created_at: new Date().toISOString() }, 'en');
  assert.match(c, /User-submitted, not verified/);
  assert.match(c, /ask the seller/);
  assert.doesNotMatch(c.replace(/not verified/gi, ''), /verified|guaranteed|approved/i);
  for (const L of ['ur', 'ro']) assert.ok(F.card({ ref: 'X', purpose: 'rent', property_type: 'flat', city: 'Lahore', area: 'DHA', price: 60000 }, L).includes(F.UNVERIFIED[L]));
  assert.ok(F.hasContactInfo('call 0300 1234567'));
  assert.ok(F.hasContactInfo('see www.example.com'));
  assert.ok(!F.hasContactInfo('corner, park facing'));
});

// ---------- flows ----------
test('register: language, name, own phone only, role', async () => {
  const h = setup();
  await h.text(1, '/start');
  assert.deepEqual(h.btns(h.last(1)), ['lang:en', 'lang:ur', 'lang:ro']);
  await h.press(1, 'lang:ro');
  await h.text(1, 'Ali Khan');
  await h.msg(1, { contact: { user_id: 55, phone_number: '03001112233' } });        // someone else's card
  assert.equal(h.last(1).text, t('ro', 'contact_not_own'));
  await h.msg(1, { contact: { user_id: 1, phone_number: '+92 300 1112233' } });
  await h.press(1, 'role:dealer');
  const a = h.deps.store.db.accounts[0];
  assert.equal(a.phone, '+923001112233');
  assert.equal(a.role, 'dealer');
  assert.equal(a.lang, 'ro');
  assert.ok(h.btns(h.last(1)).includes('m:add'));
});

test('listing: free text prefills, missing steps asked, contact info refused, saved for 30 days', async () => {
  const h = setup();
  await register(h, 1, 'Ali', 'dealer');
  await h.text(1, 'House for sale G-13/2 Islamabad 5 marla 3 bed demand 2.4 crore');
  assert.equal(h.last(1).text, t('en', 'q_baths'));
  await h.text(1, '4');
  assert.equal(h.last(1).text, t('en', 'q_address'));
  await h.text(1, 'Street 5, house 12');
  await h.text(1, 'call me 0300 1234567');
  assert.equal(h.last(1).text, t('en', 'no_contact_in_text'));
  await h.text(1, 'corner, park facing');
  const sum = h.last(1);
  assert.match(sum.text, /Rs 2.4 crore/);
  assert.match(sum.text, /Street 5/);
  assert.deepEqual(h.btns(sum), ['l:ok', 'l:edit', 'l:x']);
  // change the price, then post
  await h.press(1, 'l:edit');
  await h.press(1, 'le:price');
  await h.press(1, 'lp:ask');
  assert.match(h.last(1).text, /ask the seller/);
  await h.press(1, 'l:ok');
  const l = h.deps.store.db.listings[0];
  assert.match(l.ref, /^DL-[A-Z2-9]{6}$/);
  assert.equal(l.price, null);
  assert.equal(l.beds, 3);
  assert.equal(l.baths, 4);
  assert.equal(l.size_marla, 5);
  assert.ok(Math.abs(new Date(l.expires_at).getTime() - Date.now() - 30 * DAY) < 60000);
  assert.match(h.last(1).text, new RegExp(l.ref));
  // the same entry again is refused
  await postFull(h, 1, 'House for sale G-13/2 Islamabad 5 marla 3 bed ask seller', ['4']);
  assert.equal(h.deps.store.db.listings.length, 1);
  assert.equal(h.last(1).text, t('en', 'duplicate', { ref: l.ref }));
});

test('listing: step by step with buttons, city typed', async () => {
  const h = setup();
  await register(h, 1, 'Sara', 'owner', 'ur');
  await h.press(1, 'm:add');
  await h.press(1, 'lv:rent');
  await h.press(1, 'lt:flat');
  await h.text(1, 'pindi');
  await h.text(1, 'Bahria Town Phase 7');
  await h.text(1, '1200 sq ft');
  await h.text(1, '65 hazar');
  await h.press(1, 'ln:2');
  await h.press(1, 'ls:skip');
  await h.press(1, 'ls:skip');
  await h.press(1, 'ls:skip');
  await h.press(1, 'l:ok');
  const l = h.deps.store.db.listings[0];
  assert.equal(l.city, 'Rawalpindi');
  assert.equal(l.purpose, 'rent');
  assert.equal(l.price, 65000);
  assert.equal(l.baths, null);
  assert.ok(Math.abs(l.size_marla - 1200 / 225) < 0.01);
  assert.match(h.last(1).text, /پوسٹ ہو گئی/);
});

test('search: matches shown with not-verified label; contact reveal has a daily limit', async () => {
  const h = setup();
  await register(h, 1, 'Ali', 'dealer');
  await postFull(h, 1, 'House for sale G-13/2 Islamabad 5 marla 3 bed demand 2.4 crore', ['4']);
  await postFull(h, 1, 'House for sale G-13/4 Islamabad 5 marla 4 bed demand 2.3 crore', ['5']);
  await register(h, 2, 'Bilal', 'buyer');
  h.deps.store.db.accounts[1].reveal_limit = 1;
  await h.text(2, '5 marla house G-13 under 2.5 crore');
  const cards = h.all(2).filter((m) => h.btns(m).some((b) => b.startsWith('rv:')));
  assert.equal(cards.length, 2);
  cards.forEach((c) => assert.match(c.text, /User-submitted, not verified/));
  assert.ok(!cards.some((c) => /\+92/.test(c.text)), 'no phone before Contact');
  const [id1, id2] = cards.map((c) => h.btns(c)[0].slice(3));
  await h.press(2, 'rv:' + id1);
  assert.match(h.last(2).text, /\+923000000001/);
  assert.match(h.last(2).text, /not verified/);
  assert.deepEqual(h.btns(h.last(2)).map((b) => b.split(':')[0]), ['rp', 'bk']);
  const notice = h.all(1).slice(-1)[0];
  assert.match(notice.text, /Bilal \(buyer\) has taken your number for DL-/, 'poster told');
  assert.ok(!/\+92300000000[2-9]/.test(notice.text), 'the buyer\'s number is not shared');
  await h.press(2, 'rv:' + id1);                                                       // again: free
  assert.equal(h.all(1).slice(-1)[0], notice, 'repeat reveal: no second notice');
  assert.match(h.last(2).text, /\+923000000001/);
  await h.press(2, 'rv:' + id2);
  assert.equal(h.last(2).text, t('en', 'reveal_limit', { n: 1 }));
  // alert me for new matches (7 days): the two shown aren't sent again
  await h.press(2, 'al');
  const r = h.deps.store.db.requests[0];
  assert.equal(r.status, 'answered');
  assert.equal(h.deps.store.db.matches.length, 2);
});

test('24-hour search: no match → promised reply, team told, new entry alerts the buyer, deadline recap', async () => {
  const h = setup();
  await register(h, 2, 'Bilal', 'buyer', 'ro');
  await register(h, OWNER, 'Fahad', 'owner');
  await h.text(2, 'G-13 mein 5 marla ghar chahiye dhai crore tak');
  const r = h.deps.store.db.requests[0];
  assert.equal(r.status, 'open');
  assert.ok(Math.abs(new Date(r.deadline_at).getTime() - Date.now() - 24 * H) < 60000);
  assert.ok(h.last(2).text.startsWith('Abhi match nahi mila. Hum 24 ghante mein aapke liye dhoond kar results bhejenge.'));
  assert.match(h.last(OWNER).text, new RegExp('buyer request ' + r.ref));

  // a dealer posts a fitting entry → the buyer is alerted at once
  await register(h, 1, 'Ali', 'dealer');
  await postFull(h, 1, 'House for sale G-13/1 Islamabad 5 marla 3 bed demand 2.2 crore', ['3']);
  const alert = h.all(2).find((m) => m.text.includes('naya match'));
  assert.ok(alert, 'buyer alerted');
  assert.match(alert.text, /verified nahi/);
  assert.equal(r.status, 'answered');
  assert.match(h.all(1).slice(-1)[0].text, /1 buyer/);
  // a non-fitting entry doesn't alert
  const before = h.all(2).length;
  await postFull(h, 1, 'House for sale G-11 Islamabad 5 marla 3 bed demand 2.2 crore', ['3']);
  assert.equal(h.all(2).length, before);

  // at 24 hours: recap with Keep 7 days / Change / Close
  await runDealerJobs({ tg: h.deps.tg, store: h.deps.store, now: Date.now() + 24 * H + 1000 });
  assert.match(h.last(2).text, /24 ghante ki update/);
  assert.deepEqual(h.btns(h.last(2)).map((b) => b.split(':').slice(0, 2).join(':')), ['rq:keep', 'rq:change', 'rq:close']);
  assert.equal(r.status, 'waiting_choice');
  await h.press(2, 'rq:keep:' + r.id);
  assert.equal(r.status, 'answered');
  assert.ok(new Date(r.deadline_at).getTime() > Date.now() + 6 * DAY);
});

test('24-hour search: still nothing → honest no-match update; unanswered → expired', async () => {
  const h = setup();
  await register(h, 2, 'Bilal', 'buyer');
  await h.text(2, '1 kanal plot DHA phase 2 islamabad under 3 crore');
  const r = h.deps.store.db.requests[0];
  await runDealerJobs({ tg: h.deps.tg, store: h.deps.store, now: Date.now() + 24 * H + 1000 });
  assert.match(h.last(2).text, /honestly, no match yet/);
  await runDealerJobs({ tg: h.deps.tg, store: h.deps.store, now: Date.now() + 5 * DAY });
  assert.equal(r.status, 'expired');
});

test('change search closes the old request and takes a new one', async () => {
  const h = setup();
  await register(h, 2, 'Bilal', 'buyer');
  await h.text(2, '1 kanal plot DHA phase 2 islamabad under 3 crore');
  const r = h.deps.store.db.requests[0];
  await h.press(2, 'rq:change:' + r.id);
  assert.equal(r.status, 'closed');
  await h.text(2, '1 kanal plot DHA phase 2 islamabad under 4 crore');
  assert.equal(h.deps.store.db.requests.length, 2);
});

test('expiry: reminder 2 days before, expired at 30 days, renew brings it back', async () => {
  const h = setup();
  await register(h, 1, 'Ali', 'dealer');
  await postFull(h, 1, 'Shop for rent Blue Area Islamabad 300 sq ft rent 1.5 lakh');
  const l = h.deps.store.db.listings[0];
  await runDealerJobs({ tg: h.deps.tg, store: h.deps.store, now: Date.now() + 29 * DAY });
  assert.match(h.last(1).text, /expires on/);
  await runDealerJobs({ tg: h.deps.tg, store: h.deps.store, now: Date.now() + 29 * DAY + H });
  assert.match(h.last(1).text, /expires on/, 'reminded once only');
  await runDealerJobs({ tg: h.deps.tg, store: h.deps.store, now: Date.now() + 31 * DAY });
  assert.equal(l.status, 'expired');
  assert.ok(h.btns(h.last(1)).includes('mg:renew:' + l.id));
  await h.press(1, 'mg:renew:' + l.id);
  assert.equal(l.status, 'active');
  assert.ok(new Date(l.expires_at).getTime() > Date.now() + 29 * DAY);
});

test('manage: only the owner of an entry can change it; sold entries leave search', async () => {
  const h = setup();
  await register(h, 1, 'Ali', 'dealer');
  await postFull(h, 1, 'House for sale G-13/2 Islamabad 5 marla 3 bed demand 2.4 crore', ['4']);
  const l = h.deps.store.db.listings[0];
  await register(h, 3, 'Other', 'dealer');
  await h.press(3, 'mg:done:' + l.id);
  assert.equal(l.status, 'active');
  await h.press(1, 'm:mine');
  assert.ok(h.btns(h.last(1)).includes('mg:done:' + l.id));
  await h.press(1, 'mg:done:' + l.id);
  assert.equal(l.status, 'sold');
  await register(h, 2, 'Bilal', 'buyer');
  await h.text(2, '5 marla house G-13 under 2.5 crore');
  assert.ok(h.deps.store.db.requests.length === 1, 'no live match → 24h request');
});

test('report: 3 reports hide an entry and the team is told; block hides a poster both ways', async () => {
  const h = setup();
  await register(h, OWNER, 'Fahad', 'owner');
  await register(h, 1, 'Ali', 'dealer');
  await postFull(h, 1, 'House for sale G-13/2 Islamabad 5 marla 3 bed demand 2.4 crore', ['4']);
  const l = h.deps.store.db.listings[0];
  for (const u of [11, 12, 13]) {
    await register(h, u, 'Buyer' + u, 'buyer');
    await h.press(u, 'rp:' + l.id);
    await h.press(u, 'rr:wrong:' + l.id);
  }
  await h.press(11, 'rr:wrong:' + l.id);
  assert.equal(h.last(11).text, t('en', 'already_reported'));
  assert.equal(l.status, 'hidden');
  assert.match(h.last(OWNER).text, /hidden after 3 reports/);

  const h2 = setup();
  await register(h2, 1, 'Ali', 'dealer');
  await postFull(h2, 1, 'House for sale G-13/2 Islamabad 5 marla 3 bed demand 2.4 crore', ['4']);
  const l2 = h2.deps.store.db.listings[0];
  await register(h2, 2, 'Bilal', 'buyer');
  await h2.press(2, 'bk:' + l2.id);
  await h2.text(2, '5 marla house G-13 under 2.5 crore');
  assert.ok(!h2.all(2).some((m) => h2.btns(m).includes('rv:' + l2.id)), 'blocked poster hidden');
  await h2.press(2, 'rv:' + l2.id);
  assert.equal(h2.last(2).text, t('en', 'not_available'));
});

test('text only: photos refused; voice note transcribed and answered in text', async () => {
  const h = setup({ heard: 'G-13 mein 5 marla ghar chahiye 2.5 crore tak' });
  await register(h, 2, 'Bilal', 'buyer', 'ro');
  await h.msg(2, { photo: [{ file_id: 'p' }] });
  assert.equal(h.last(2).text, t('ro', 'no_photos'));
  await h.msg(2, { voice: { file_id: 'v', duration: 4 } });
  assert.ok(h.all(2).some((m) => m.text.startsWith('🎙 Main ne suna')));
  assert.ok(h.deps.tg.sent.every((m) => typeof m.text === 'string'), 'replies are text');
  assert.equal(h.deps.store.db.requests.length, 1);
});

test('duplicate updates are handled once; groups are ignored', async () => {
  const h = setup();
  const up = { update_id: 7, message: { message_id: 1, chat: { id: 5, type: 'private' }, from: { id: 5 }, text: '/start' } };
  await handleUpdate(up, h.deps);
  await handleUpdate(up, h.deps);
  assert.equal(h.all(5).length, 1);
  await handleUpdate({ update_id: 8, message: { message_id: 2, chat: { id: -100, type: 'group' }, from: { id: 5 }, text: '/start' } }, h.deps);
  assert.equal(h.deps.tg.sent.length, 1);
});

test('webhook refuses requests without the secret', async () => {
  process.env.DEALER_BOT_TOKEN = '123:test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
  const { default: handler } = await import('../netlify/functions/dealer.mjs');
  const res = await handler(new Request('https://x/api/dealer', { method: 'POST', body: '{"update_id":1}' }), {});
  assert.equal(res.status, 403);
  delete process.env.DEALER_BOT_TOKEN;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ---------- three sources, best 3 ----------
const siteRow = (o) => Object.assign({ id: 'site-' + Math.random().toString(36).slice(2, 8), type: 'buy', property_type: 'house', city: 'Islamabad',
  area: 'G-13/3', price: 23000000, beds: 3, baths: 3, size_marla: 5, size_unit: 'marla', created_at: new Date().toISOString() }, o);

test('sources: best price per marla first, ask-the-seller last, max 3, one copy per property', async () => {
  const q = F.parseQuery('5 marla house G-13 under 2.5 crore', [], CITIES);
  const feed = [
    { id: 'f1', account_id: 'a', purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13/2', price: 24000000, size_marla: 5, created_at: '2026-10-01' },
    { id: 'f2', account_id: 'a', purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13/1', price: null, size_marla: 5, created_at: '2026-10-02' },
    { id: 'f3', account_id: 'a', purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13/4', price: 22000000, size_marla: 5, created_at: '2026-10-03' }
  ];
  const site = [fromSite(siteRow({ id: 's1', area: 'G-13/4', price: 22000000 })), fromSite(siteRow({ id: 's2', price: 21000000 }))];
  const partner = async () => [fromPartner({ id: 'p1', ref: 'PX-1', purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13', size_value: 5, size_unit: 'marla', price: 20000000, url: 'https://partner.example/p1' }, 'PartnerX')];
  const out = await searchAll(q, { feed: () => feed, site: () => site, partner }, { now: Date.parse('2026-10-06') });
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((l) => l.source + ':' + l.id), ['partner:p1', 'site:s2', 'feed:f3'], 'cheapest first; G-13/4 at 2.2 crore kept once, as the Dealer AI copy');
  const fewer = await searchAll(q, { feed: () => feed.slice(1, 2) }, {});
  assert.equal(fewer[0].id, 'f2', 'ask-the-seller still shown when nothing else');
  assert.equal(bestPrice([{ price: null }, { price: 5, size_marla: 1 }])[0].price, 5);
});

test('sources: a slow, broken or hostile partner never breaks the search', async () => {
  const q = F.parseQuery('5 marla house G-13 under 2.5 crore', [], CITIES);
  const feed = () => [{ id: 'f1', account_id: 'a', purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13', price: 24000000, size_marla: 5 }];
  const broken = async () => { throw new Error('down'); };
  assert.equal((await searchAll(q, { feed, partner: broken, site: () => { throw new Error('db'); } })).length, 1);
  // bad rows are dropped; non-https links removed
  assert.equal(fromPartner({ purpose: 'sale', property_type: 'castle', city: 'Islamabad', area: 'G-13' }), null);
  assert.equal(fromPartner({ purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13', url: 'javascript:alert(1)' }).url, null);
  // HTTP client: secret sent as a header, results capped at 10, errors → []
  let seen = null;
  const fetchOk = async (url, init) => { seen = init; return { ok: true, json: async () => ({ results: Array.from({ length: 15 }, (_, i) => ({ id: 'p' + i, purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13', price: 1e7 })) }) }; };
  const search = makePartnerSearch(fetchOk, { url: 'https://partner.example/search', secret: 's3cret', name: 'PartnerX' });
  const rows = await search(q);
  assert.equal(rows.length, 10);
  assert.equal(seen.headers.Authorization, 'Bearer s3cret');
  assert.ok(!JSON.stringify(JSON.parse(seen.body)).includes('s3cret'));
  assert.deepEqual(await makePartnerSearch(async () => ({ ok: false }), { url: 'https://p', secret: 'x', name: 'P' })(q), []);
  assert.equal(makePartnerSearch(fetchOk, null), null, 'off until configured');
});

test('search: at most 3 results across the bot, the website and a partner, each labelled with its source', async () => {
  const partner = async () => [fromPartner({ id: 'p1', purpose: 'sale', property_type: 'house', city: 'Islamabad', area: 'G-13/2', size_value: 5, size_unit: 'marla', price: 19500000, url: 'https://partner.example/p1' }, 'PartnerX')];
  const h = setup({ partner });
  h.deps.store.db.site.push(siteRow({ id: 's1', price: 21000000 }), siteRow({ id: 's2', price: 30000000 }), siteRow({ id: 's3', city: 'Lahore', area: 'DHA' }));
  await register(h, 1, 'Ali', 'dealer');
  for (const p of ['2.4', '2.3', '2.2']) await postFull(h, 1, 'House for sale G-13/2 Islamabad 5 marla 3 bed demand ' + p + ' crore', ['4']);
  await register(h, 2, 'Bilal', 'buyer');
  await h.text(2, '5 marla house G-13 under 2.5 crore');
  const results = h.all(2).filter((m) => /Source:/.test(m.text));
  assert.equal(results.length, 3);
  assert.match(results[0].text, /Source: PartnerX/);
  assert.equal(results[0].extra.reply_markup.inline_keyboard[0][0].url, 'https://partner.example/p1');
  assert.match(results[1].text, /AgenticCore Estate website/);
  assert.equal(results[1].extra.reply_markup.inline_keyboard[0][0].url, 'https://agenticcore.estate/listing.html?id=s1');
  assert.ok(!/\+92/.test(results[1].text), 'website numbers stay on the website');
  assert.match(results[2].text, /Source: Dealer AI/);
  assert.match(results[2].text, /2.2 crore/);
  assert.ok(h.btns(results[2]).some((b) => b.startsWith('rv:')));
  results.forEach((m) => assert.match(m.text, /not verified/));
});

test('24-hour request: a website listing added later is sent once by the hourly check', async () => {
  const h = setup();
  await register(h, 2, 'Bilal', 'buyer');
  await h.text(2, '5 marla house G-13 under 2.5 crore');
  const r = h.deps.store.db.requests[0];
  assert.equal(r.status, 'open');
  h.deps.store.db.site.push(siteRow({ id: 'late' }));
  await runDealerJobs({ tg: h.deps.tg, store: h.deps.store, now: Date.now() + 2 * H });
  assert.match(h.last(2).text, /New match/);
  assert.match(h.last(2).text, /AgenticCore Estate website/);
  assert.equal(r.status, 'answered');
  assert.deepEqual(r.sent_refs, ['site:late']);
  const count = h.all(2).length;
  await runDealerJobs({ tg: h.deps.tg, store: h.deps.store, now: Date.now() + 4 * H });
  assert.equal(h.all(2).length, count, 'not sent twice');
  await runDealerJobs({ tg: h.deps.tg, store: h.deps.store, now: Date.now() + 25 * H });
  assert.match(h.last(2).text, /we sent you 1 match/);
});

// ---------- fixes after the first live test ----------
test('store: the poster embed names its foreign key (feed_listings ↔ feed_accounts is linked three ways)', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
  const { makeDealerStore, LISTING_COLS } = await import('../services/dealer/store.mjs');
  const urls = [];
  const store = makeDealerStore(async (url) => { urls.push(decodeURIComponent(url)); return { ok: true, status: 200, text: async () => '[]' }; });
  await store.liveListings({ purpose: 'sale', city: 'Islamabad', types: ['house'] }, Date.now());
  await store.listingById('00000000-0000-0000-0000-000000000000');
  await store.myListings('00000000-0000-0000-0000-000000000000');
  assert.match(LISTING_COLS, /feed_accounts!feed_listings_account_id_fkey\(role\)/);
  urls.slice(0, 2).forEach((u) => assert.match(u, /feed_accounts!feed_listings_account_id_fkey\(role\)/));
  urls.forEach((u) => assert.doesNotMatch(u, /[,=]feed_accounts\(role\)/));
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

test('a database error mid-search is never silent: the user hears back, the team gets the error', async () => {
  const h = setup();
  await register(h, OWNER, 'Fahad', 'owner');
  await register(h, 2, 'Bilal', 'buyer');
  h.deps.store.liveListings = async () => { throw new Error('more than one relationship was found'); };
  h.deps.store.myRequests = async () => { throw new Error('more than one relationship was found'); };
  await h.text(2, '5 marla house G-13 under 2.5 crore');
  assert.equal(h.last(2).text, t('en', 'save_failed'));
  assert.match(h.last(OWNER).text, /Dealer AI error: more than one relationship/);
});

test('posting keeps the sub-sector; /name changes the name', async () => {
  const h = setup();
  await register(h, 1, 'Grok Test', 'dealer');
  await postFull(h, 1, 'House for sale G-13/2 Islamabad 5 marla 3 bed demand 2.4 crore', ['4']);
  assert.equal(h.deps.store.db.listings[0].area, 'G-13/2');
  await h.text(1, '/name');
  assert.match(h.last(1).text, /Grok Test/);
  await h.text(1, 'Fahad Sultan');
  assert.equal(h.deps.store.db.accounts[0].name, 'Fahad Sultan');
  assert.equal(h.last(1).text, t('en', 'name_changed', { name: 'Fahad Sultan' }));
});

test('/myid shows the Telegram ID and whether team alerts come here; draft summary has no placeholder ref', async () => {
  const h = setup();
  await register(h, OWNER, 'Fahad', 'owner');
  await h.text(OWNER, '/myid');
  assert.match(h.last(OWNER).text, new RegExp('Telegram ID: ' + OWNER + '\\n.*✅'));
  await register(h, 7, 'Other', 'dealer');
  await h.text(7, '/myid');
  assert.match(h.last(7).text, /Telegram ID: 7\n.*—/);
  await h.text(7, 'Shop for rent Blue Area Islamabad 300 sq ft rent 1.5 lakh');
  await h.press(7, 'ls:skip'); await h.press(7, 'ls:skip');
  assert.match(h.last(7).text, /\n🏠 Shop for rent/);
});
