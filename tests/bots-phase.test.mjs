// Bots phase: published prices in every assistant, language choice at the
// start (web + Telegram), Urdu voice replies in Telegram, account help.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
delete process.env.ANTHROPIC_API_KEY;

const cat = await import('../services/pk-catalog.mjs');
const { handleTurn, isPriceQuestion, onlyAllowedNumbers, numbersIn } = await import('../services/assistant-service.mjs');
const { handleUpdate } = await import('../services/telegram/bot.mjs');
const { speakable } = await import('../services/telegram/voice.mjs');
const { default: quality } = await import('../listing-quality.js');

const { cat: C, text: PRICE_TEXT } = cat.bundledCatalog();
const SCREENSHOT_Q = 'I want website and 3d floor plan for 24 story building, how much will it cost';

// ---------- price list ----------
test('price list: built from the PK site data, every service and package, exact wording', () => {
  assert.equal(C.services.length, 74);
  assert.ok(C.packages.length >= 10);
  assert.match(PRICE_TEXT, /#10 3D Floor Plan: Rs 3,499 per 3D floor plan\./);
  assert.match(PRICE_TEXT, /#34 Project \/ Developer Website: From Rs 32,499 for a site of up to 6 pages\. Larger sites are quoted\./);
  assert.match(PRICE_TEXT, /Package 1 Agent Monthly: Rs 7,999 a month, minimum 3 months, no set-up fee/);
});

test('price list: questions find the right services (English, Roman Urdu, Urdu)', () => {
  const names = (q) => cat.matchServices(C, q).map((s) => s.no);
  assert.deepEqual(names(SCREENSHOT_Q).sort((a, b) => a - b), [10, 34]);
  assert.deepEqual(names('ویب سائٹ اور تھری ڈی فلور پلان کی قیمت'), [10, 16]);
  assert.deepEqual(names('logo kitne ka hai'), [14]);
  assert.deepEqual(names('agency website price'), [16]);
  assert.deepEqual(names('whatsapp bot'), [51]);
  assert.deepEqual(names('hello how are you'), []);
});

test('price list: live copy from agenticcorepk.com is used, the bundled copy when it fails', async () => {
  const services = { meta: { notes: [] }, groups: [{ no: 1, type: 'G' }], services: Array.from({ length: 30 }, (_, i) => ({ no: i + 1, group: 1, name: 'Svc ' + (i + 1), brief: '', delivery: '1 day', lines: [{ text: 'Rs 1,234 each.' }] })) };
  const packages = { packages: [1, 2, 3].map((n) => ({ no: n, name: 'P' + n, monthly: 5000, min_months: 1, includes: [] })) };
  const ok = async (url) => ({ ok: true, json: async () => (/services/.test(url) ? services : packages) });
  const live = await cat.getCatalog({ fetchImpl: ok, now: 10 ** 13 });
  assert.equal(live.cat.services.length, 30);
  assert.match(live.text, /Svc 1: Rs 1,234 each\./);
  const bad = await cat.getCatalog({ fetchImpl: async () => { throw new Error('down'); }, now: 10 ** 13 + 16 * 60 * 1000 });
  assert.equal(bad.cat.services.length, 30);                 // keeps the last good copy
});

// ---------- the screenshot question ----------
async function ask(bot, text, extra) {
  return handleTurn(Object.assign({ bot, site: 'pk', messages: [{ role: 'user', text }] }, extra && extra.body), Object.assign({ allowAI: false, find: async () => ({ matches: [], closest: [] }) }, extra && extra.deps));
}

test('Amaan and the guide quote the published prices for a website + 3D floor plan', async () => {
  for (const bot of ['amaan', 'guide']) {
    const r = await ask(bot, SCREENSHOT_Q);
    assert.match(r.reply, /3D Floor Plan: Rs 3,499 per 3D floor plan\./, bot);
    assert.match(r.reply, /From Rs 32,499/, bot);
    assert.doesNotMatch(r.reply, /not sure|can't quote/i, bot);
    assert.ok(r.actions.includes('amaan_order'), bot);
  }
  const ur = await ask('amaan', 'تھری ڈی فلور پلان کتنے کا ہے؟');
  assert.match(ur.reply, /تھری ڈی فلور پلان: Rs 3,499/);
  const pk = await ask('guide', 'packages kitne ke hain?');
  assert.match(pk.reply, /Agent Monthly: Rs 7,999 a month/);
});

test('AI wording: exact published prices pass; a calculated total is refused', async () => {
  const stub = (reply) => async () => ({ ok: true, data: { reply, actions: ['amaan_order'] } });
  const good = await ask('amaan', SCREENSHOT_Q, { deps: { allowAI: true, ai: stub('A 3D floor plan is Rs 3,499 per plan, and a project website is from Rs 32,499 for up to 6 pages. For 24 floors the team confirms the total.') } });
  assert.equal(good.ai, true);
  const bad = await ask('amaan', SCREENSHOT_Q, { deps: { allowAI: true, ai: stub('For 24 floors that is Rs 83,976 in total.') } });
  assert.notEqual(bad.ai, true);
  assert.doesNotMatch(bad.reply, /83,976/);
});

test('Urdu number words count only as whole words ("ساتھ" is not 7)', () => {
  assert.equal(onlyAllowedNumbers('آپ کے ساتھ نوٹ کر لیا', []), true);
  assert.deepEqual(numbersIn('آپ کے ساتھ نوٹ کر لیا'), []);
  assert.deepEqual(numbersIn('یہ سات دن میں، Rs 3,499'), [7, 3499]);
});

test('language picked at the start: "اردو" → Urdu replies even to English text', async () => {
  const r = await handleTurn({ bot: 'guide', site: 'estate', lang_choice: 'ur', messages: [{ role: 'user', text: 'what is agenticcore?' }] }, { allowAI: false });
  assert.equal(r.lang, 'ur');
  assert.match(r.reply, /[؀-ۿ]/);
  const e = await handleTurn({ bot: 'guide', site: 'estate', lang_choice: 'en', messages: [{ role: 'user', text: 'what is agenticcore?' }] }, { allowAI: false });
  assert.equal(e.lang, 'en');
});

test('estate pricing: free during launch, packages from 1 November 2026, 30% early benefit', async () => {
  const r = await handleTurn({ bot: 'guide', site: 'estate', messages: [{ role: 'user', text: 'what are the fees to list on estate?' }] }, { allowAI: false });
  assert.match(r.reply, /free during the launch period/);
  assert.match(r.reply, /1 November 2026/);
  assert.match(r.reply, /30%/);
});

// ---------- Telegram ----------
const ME = 4242;
function fakeTg() {
  const sent = [], voices = [];
  return {
    sent, voices,
    async send(chat, text, extra) { sent.push({ chat, text, extra }); return { message_id: sent.length }; },
    async sendVoice(chat, bytes) { voices.push({ chat, bytes }); return {}; },
    async typing() {}, async recording() {}, async answerCallback() {}, async removeButtons() {},
    async download() { return { bytes: Buffer.from('ogg'), path: 'v.ogg' }; },
    async call() { return true; }
  };
}
function fakeStore() {
  const db = { seen: new Set(), sessions: {} };
  return {
    db,
    async firstSeen(id) { if (db.seen.has(id)) return false; db.seen.add(id); return true; },
    async getSession(chat) { return db.sessions[chat] ? JSON.parse(JSON.stringify(db.sessions[chat])) : null; },
    async saveSession(x) { db.sessions[x.chat_id] = JSON.parse(JSON.stringify(x)); },
    async linkedAccount() { return null; },
    async log() {}, async countActivity() { return 0; }, async rest() { return []; }
  };
}
function deps(tg, spoken) {
  return {
    tg, store: fakeStore(), quality, ownerId: '1', siteUrl: 'https://agenticcore.estate',
    voice: { configured: () => true, transcribe: async () => 'تھری ڈی فلور پلان کتنے کا ہے', synthesize: async (text, lang) => { spoken.push({ text, lang }); return new Uint8Array(2000); } },
    assistant: { handleTurn, areaNames: async () => [], guideDeps: () => ({ allowAI: false, areaNames: [] }), catalog: async () => cat.bundledCatalog() }
  };
}
let uid = 1;
const text = (t) => ({ update_id: uid++, message: { message_id: uid, from: { id: ME, is_bot: false }, chat: { id: ME, type: 'private' }, text: t } });
const voice = () => ({ update_id: uid++, message: { message_id: uid, from: { id: ME, is_bot: false }, chat: { id: ME, type: 'private' }, voice: { file_id: 'v1' } } });
const press = (data) => ({ update_id: uid++, callback_query: { id: 'cb' + uid, data, from: { id: ME }, message: { message_id: 5, chat: { id: ME, type: 'private' } } } });
const btns = (m) => ((m && m.extra && m.extra.reply_markup && m.extra.reply_markup.inline_keyboard) || []).flat().map((b) => b.callback_data || b.url);
async function run(d, ...u) { for (const x of u) await handleUpdate(x, d); }

test('Telegram: /start asks English or Urdu; Urdu replies come with a voice note', async () => {
  const tg = fakeTg(), spoken = [], d = deps(tg, spoken);
  await run(d, text('/start'));
  assert.deepEqual(btns(tg.sent[tg.sent.length - 1]).slice(0, 2), ['lg:en', 'lg:ur']);
  assert.equal(tg.voices.length, 0);                                     // the question itself is not read out
  await run(d, press('lg:ur'));
  assert.match(tg.sent[tg.sent.length - 2].text, /اردو میں بات/);
  assert.equal(tg.voices.length, 1);
  assert.match(spoken[0].text, /[؀-ۿ]/);
  await run(d, text('3D floor plan kitne ka hai?'));                     // picked Urdu → Urdu, with prices
  const r = tg.sent[tg.sent.length - 1];
  assert.match(r.text, /تھری ڈی فلور پلان: Rs 3,499/);
  assert.ok(btns(r).includes('o:start'));
  assert.match(spoken[spoken.length - 1].text, /3,499 روپے/);         // read as rupees
  await run(d, text('/voice'));
  const before = tg.voices.length;
  await run(d, text('packages?'));
  assert.equal(tg.voices.length, before);                               // voice off
});

test('Telegram: English chats get no voice unless they send a voice note', async () => {
  const tg = fakeTg(), spoken = [], d = deps(tg, spoken);
  await run(d, text('/start'), press('lg:en'), text('how much is a 3d floor plan?'));
  assert.match(tg.sent[tg.sent.length - 1].text, /3D Floor Plan: Rs 3,499/);
  assert.equal(tg.voices.length, 0);
  await run(d, voice());                                                // Urdu voice note → Urdu answer, spoken
  assert.ok(tg.voices.length >= 1);
});

test('Telegram: "how do I edit my listing" explains managing the account', async () => {
  const tg = fakeTg(), d = deps(tg, []);
  await run(d, text('/start'), press('lg:en'), text('how do I edit my listing?'));
  assert.match(tg.sent[tg.sent.length - 1].text, /open an account|account/i);
  assert.ok(isPriceQuestion('website kitne ki hai'));
  assert.ok(!isPriceQuestion('10 marla house in G-13 under 3 crore'));
});

test('read aloud: no links, commands or emoji; Rs in Urdu as روپے; capped', () => {
  const s = speakable('📄 Rs 3,499 فی پلان۔ دیکھیں https://agenticcorepk.com/services.html یا /order لکھیں', 'ur');
  assert.doesNotMatch(s, /https|\/order|📄/);
  assert.match(s, /3,499 روپے/);
  assert.ok(speakable('۔ '.repeat(800) + 'x', 'ur').length <= 701);
});
