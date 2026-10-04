// Telegram Phase 2 (AgenticCore Pakistan orders, owner approvals, Grok workers,
// work inbox) and Phase 3 (property search + enquiries) — simulated end to end
// with a fake Telegram API, fake xAI and an in-memory store.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.XAI_API_KEY = 'test-xai';
process.env.WORK_API_KEY = 'work-key-0123456789abcdef0123';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.BOT_PROPERTY_SEARCH;

const { handleUpdate } = await import('../services/telegram/bot.mjs');
const { matchServices, priceText, flushClientNotes } = await import('../services/telegram/pk-orders.mjs');
const { runWorkers } = await import('../services/telegram/workers.mjs');
const { handleWork } = await import('../netlify/functions/work.mjs');
const { looksLikeSearch } = await import('../services/telegram/find.mjs');
const { handleTurn } = await import('../services/assistant-service.mjs');
const { default: quality } = await import('../listing-quality.js');

const ME = 777, OWNER = '999', CLIENT = 'c1c1c1c1-0000-4000-8000-000000000001';
const CATALOGUE = [
  { line_id: 'p-wa-card', service_no: 1, service_name: 'Property WhatsApp Card', model: 'dfy', price: 999, unit: 'per property', days: 0, is_from: false },
  { line_id: 'p-social-post', service_no: 2, service_name: 'Property Social Media Post', model: 'dfy', price: 999, unit: 'per property', days: 0, is_from: false },
  { line_id: 'p-flyer', service_no: 3, service_name: 'Property Flyer', model: 'dfy', price: 999, unit: 'per property', days: 0, is_from: false },
  { line_id: '28-dfy', service_no: 4, service_name: 'Property Photo Enhancement', model: 'dfy', price: 1299, unit: 'per up to 10 photos', days: 0, is_from: false },
  { line_id: 'reel-dfy', service_no: 7, service_name: 'Property Promo Reel', model: 'dfy', price: 2999, unit: 'per reel', days: 2, is_from: false },
  { line_id: 'logo-dfy', service_no: 14, service_name: 'Agency Logo + Brand Kit', model: 'dfy', price: 14999, unit: null, days: 5, is_from: false },
  { line_id: 'agent-monthly', service_no: 60, service_name: 'Agent Monthly', model: 'monthly', price: 7999, unit: 'per month', days: null, is_from: false }
];

function fakeTg() {
  const sent = [], files = [];
  return {
    sent, files,
    async send(chat, text, extra) { sent.push({ chat: String(chat), text, extra }); return {}; },
    async sendPhoto(chat, url, caption) { files.push({ chat: String(chat), kind: 'photo', url, caption }); },
    async sendVideo(chat, url, caption) { files.push({ chat: String(chat), kind: 'video', url, caption }); },
    async sendDocument(chat, url, caption) { files.push({ chat: String(chat), kind: 'doc', url, caption }); },
    async typing() {}, async answerCallback() {}, async removeButtons() {},
    async download(id) { return { bytes: Buffer.from('bytes-' + id), path: 'p/' + id }; },
    async call() { return true; }
  };
}
function fakeStore() {
  const db = { seen: new Set(), sessions: {}, activity: [], rpc: [], uploads: [], tasks: [], jobs: [], attachments: [], notes: [], listings: [], settings: {} };
  let n = 0;
  const account = { id: CLIENT, full_name: 'Ali Raza', member_no: 100005, created_via: 'telegram', password_set_at: null, created_at: new Date().toISOString() };
  const s = {
    db,
    async firstSeen(id) { if (db.seen.has(id)) return false; db.seen.add(id); return true; },
    async getSession(c) { return db.sessions[c] ? JSON.parse(JSON.stringify(db.sessions[c])) : null; },
    async saveSession(x) { db.sessions[x.chat_id] = JSON.parse(JSON.stringify(x)); },
    async linkedAccount(tg) { return tg === ME && !db.unlinked ? Object.assign({ chat_id: ME, notify: true }, account) : null; },
    async frozen() { return false; },
    async log(user, kind, detail) { db.activity.push({ user: user && user.id, kind, detail }); },
    async countActivity(id, kind) { return db.activity.filter((a) => a.user === id && a.kind === kind).length; },
    async ownListings(id) { return db.listings.filter((l) => l.owner_id === id); },
    async catalogue() { return CATALOGUE; },
    async rpc(name, body) {
      db.rpc.push({ name, body });
      if (name === 'pk_tg_place_order') {
        assert.equal(body.p_client, CLIENT);
        const it = body.p_items[0], line = CATALOGUE.find((l) => l.line_id === it.line_id);
        const t = { id: crypto.randomUUID(), public_id: 'ACPK-' + String(++n).padStart(4, '0'), client_id: body.p_client, title: line.service_name, quantity: it.quantity, unit_price: line.price, amount: line.price * it.quantity, details: it.details, status: 'waiting_on_you', revisions_used: 0 };
        db.tasks.push(t);
        return [{ task_id: t.id, public_id: t.public_id, invoice_number: 'INV-1' }];
      }
      if (name === 'pk_tg_client') {
        const t = db.tasks.find((x) => x.id === body.p_task);
        if (!t || t.client_id !== body.p_client) throw new Error('Task not found');
        if (body.p_action === 'attach') db.attachments.push({ task_id: t.id, path: body.p_path, name: body.p_name });
        if (body.p_action === 'approve') { if (t.status !== 'ready_for_review') throw new Error('Nothing is waiting for your approval'); t.status = 'delivered'; }
        if (body.p_action === 'changes') { t.revisions_used++; t.status = 'changes_requested'; return { ok: true, round: t.revisions_used }; }
        return { ok: true };
      }
      if (name === 'pk_admin_set_status') {
        const t = db.tasks.find((x) => x.id === body.p_task); t.status = body.p_status;
        db.notes.push({ id: db.notes.length + 1, client_id: t.client_id, kind: 'status_' + body.p_status, body: t.public_id + ' is now: ' + body.p_status.replace(/_/g, ' '), status: 'queued' });
        return t;
      }
      if (name === 'pk_admin_add_deliverable') { const t = db.tasks.find((x) => x.id === body.p_task); if (body.p_mark_ready) t.status = 'ready_for_review'; return {}; }
      if (name === 'send_enquiry_as') { if (body.p_id === 'bad') throw new Error('This item is not available.'); return crypto.randomUUID(); }
      return null;
    },
    async uploadObject(bucket, path) { db.uploads.push(bucket + '/' + path); return path; },
    async signedUrl(bucket, path) { return 'https://signed.example/' + bucket + '/' + path; },
    async pkTask(id) { return db.tasks.find((t) => t.id === id) || null; },
    async pkTaskByPublicId(p) { return db.tasks.find((t) => t.public_id === p) || null; },
    async pkClientTasks(id) { return db.tasks.filter((t) => t.client_id === id); },
    async pkPatchTask(id, patch) { Object.assign(db.tasks.find((t) => t.id === id), patch); },
    async pkAttachments(id) { return db.attachments.filter((a) => a.task_id === id); },
    async pkEnableTelegram(id) { db.settings[id] = { telegram: true }; },
    async jobCreate(row) { const j = Object.assign({ id: crypto.randomUUID(), outputs: [], attempts: 0, updated_at: new Date().toISOString() }, row); db.jobs.push(j); return j; },
    async jobGet(id) { return db.jobs.find((j) => j.id === id) || null; },
    async jobUpdate(id, patch) { const j = db.jobs.find((x) => x.id === id); Object.assign(j, patch, { updated_at: new Date().toISOString() }); return j; },
    async jobsWhere(filter) {
      const f = new URLSearchParams(filter);
      return db.jobs.filter((j) => {
        for (const [k, v] of f) {
          if (v.startsWith('eq.') && j[k] !== v.slice(3)) return false;
          if (v.startsWith('in.(') && !v.slice(4, -1).split(',').includes(j[k])) return false;
          if (v === 'not.is.null' && !j[k]) return false;
        }
        return true;
      });
    },
    async chatFor(id) { return id === CLIENT ? ME : null; },
    async rest(path, opts) {
      if (path.startsWith('tg_sessions')) return [{ lang: 'en' }];
      if (path.startsWith('pk_notifications?channel=eq.telegram')) return db.notes.filter((x) => x.status === 'queued' && (!path.includes('client_id=eq.') || path.includes(x.client_id)));
      if (path.startsWith('pk_notifications?id=eq.')) { const id = Number(path.split('eq.')[1]); db.notes.find((x) => x.id === id).status = opts.body.status; return null; }
      if (path.startsWith('listings?id=eq.')) { const id = path.split('eq.')[1].split('&')[0]; const l = db.listings.find((x) => x.id === id); return l ? [l] : []; }
      if (path.startsWith('pk_messages')) { db.messages = (db.messages || []).concat(opts.body); return null; }
      return [];
    }
  };
  return s;
}
function fakeXai() {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    const ok = (d) => ({ ok: true, status: 200, json: async () => d, arrayBuffer: async () => Buffer.from('mp4'), headers: new Map() });
    if (String(url).endsWith('/images/generations')) return ok({ data: [{ b64_json: Buffer.from('png').toString('base64') }] });
    if (String(url).endsWith('/videos/generations')) return ok({ request_id: 'vid-1' });
    if (String(url).includes('/videos/vid-1')) return ok({ status: 'done', video: { url: 'https://x.ai/v.mp4' } });
    if (String(url) === 'https://x.ai/v.mp4') return ok({});
    return { ok: false, status: 404, json: async () => ({}) };
  };
  f.calls = calls;
  return f;
}
function deps(store, tg, extra) {
  return Object.assign({
    tg, store, quality, ownerId: OWNER, siteUrl: 'https://agenticcore.estate',
    voice: { configured: () => false, transcribe: async () => '' },
    assistant: { handleTurn, areaNames: async () => ['G-13'], guideDeps: () => ({ allowAI: false, areaNames: [] }) },
    find: async () => ({ matches: [{ id: '11111111-1111-4111-8111-111111111111', title: '10 Marla House, G-13', price_text: 'Rs 4 crore', area: 'G-13', city: 'Islamabad' }], closest: [] })
  }, extra || {});
}
let uid = 1;
const text = (t, from) => ({ update_id: uid++, message: { message_id: uid, from: { id: from || ME }, chat: { id: from || ME, type: 'private' }, text: t } });
const press = (data, from) => ({ update_id: uid++, callback_query: { id: 'c' + uid, data, from: { id: from || ME }, message: { message_id: 5, chat: { id: from || ME, type: 'private' } } } });
const photo = (from) => ({ update_id: uid++, message: { message_id: uid, from: { id: from || ME }, chat: { id: from || ME, type: 'private' }, photo: [{ file_id: 'small' + uid, width: 320, height: 240 }, { file_id: 'big' + uid, width: 1280, height: 960 }] } });
const toMe = (tg) => tg.sent.filter((m) => m.chat === String(ME));
const toOwner = (tg) => tg.sent.filter((m) => m.chat === OWNER);
const lastMe = (tg) => (toMe(tg).slice(-1)[0] || {}).text || '';
const btns = (m) => ((m && m.extra && m.extra.reply_markup && m.extra.reply_markup.inline_keyboard) || []).flat().map((b) => b.callback_data || b.url);
async function run(d, ...u) { for (const x of u) await handleUpdate(x, d); }

async function placedOrder() {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  store.db.listings.push({ id: '22222222-2222-4222-8222-222222222222', owner_id: CLIENT, title: '7 Marla House, G-13', moderation_status: 'active' });
  await run(d, text('I need a WhatsApp card for my house'));
  assert.ok(btns(toMe(tg).slice(-1)[0]).includes('o:s:p-wa-card'), 'WhatsApp card offered');
  await run(d, press('o:s:p-wa-card'));
  assert.match(lastMe(tg), /Property WhatsApp Card — Rs 999 per property\.\nHow many\?/);
  await run(d, press('o:q:2'));
  assert.ok(toMe(tg).some((m) => btns(m).includes('o:l:22222222-2222-4222-8222-222222222222')), 'own listings offered');
  await run(d, press('o:l:22222222-2222-4222-8222-222222222222'), text('Show demand 4 crore and my number 0300 1234567'), photo(), press('o:done'));
  return { store, tg, d };
}

test('catalogue matching: English, Roman Urdu and Urdu requests find the right service; monthly plans excluded', () => {
  const ids = (q) => matchServices(q, CATALOGUE).map((l) => l.line_id);
  assert.equal(ids('whatsapp card for my house')[0], 'p-wa-card');
  assert.equal(ids('mujhe ek reel chahiye')[0], 'reel-dfy');
  assert.equal(ids('واٹس ایپ کارڈ')[0], 'p-wa-card');
  assert.equal(ids('logo for my agency')[0], 'logo-dfy');
  assert.ok(!ids('agent monthly plan').includes('agent-monthly'));
  assert.deepEqual(ids('qwerty'), []);
  assert.equal(priceText(CATALOGUE[0], 2), 'Rs 999 per property × 2 = Rs 1,998');
});

test('order in Telegram: service → quantity → brief, listing, photo → review → placed as an ACPK task for this account', async () => {
  const { store, tg, d } = await placedOrder();
  const review = lastMe(tg);
  assert.match(review, /S1 · Property WhatsApp Card\nQuantity: 2\nPrice: Rs 999 per property × 2 = Rs 1,998/);
  assert.match(review, /Listing: 7 Marla House, G-13/);
  assert.match(review, /No payment is taken in Telegram/);
  assert.equal(store.db.tasks.length, 0, 'nothing placed before confirming');
  assert.ok(store.db.uploads[0].startsWith('pk-attachments/' + CLIENT + '/'), 'photo stored in the client\'s own private folder');
  await run(d, press('o:place'));
  const call = store.db.rpc.find((r) => r.name === 'pk_tg_place_order');
  assert.equal(call.body.p_items[0].quantity, 2);
  assert.equal(call.body.p_items[0].details.estate_listing_id, '22222222-2222-4222-8222-222222222222');
  assert.match(call.body.p_items[0].details.brief, /demand 4 crore/);
  assert.equal(store.db.attachments.length, 1);
  assert.equal(store.db.settings[CLIENT].telegram, true, 'order updates switched on for Telegram');
  assert.match(lastMe(tg), /Order ACPK-0001 received ✓/);
  const alert = toOwner(tg).find((m) => /New order ACPK-0001 from AC-100005/.test(m.text));
  assert.ok(alert, 'owner alerted');
  assert.match(alert.text, /Rs 1,998/);
  assert.deepEqual(btns(alert).filter((b) => b.startsWith('w:')).map((b) => b.split(':')[2]), ['grok_image', 'grok_video', 'grok_agent', 'team']);
  assert.ok(btns(alert).some((b) => b.startsWith('x:')));
});

test('owner approval to start; only the owner can press it; Grok image draft → owner → client; client approves', async () => {
  const { store, tg, d } = await placedOrder();
  await run(d, press('o:place'));
  const task = store.db.tasks[0];
  await run(d, press('w:' + task.id + ':grok_image'));            // the client pressing an owner button
  assert.equal(store.db.jobs.length, 0, 'non-owner cannot start work');
  await run(d, press('w:' + task.id + ':grok_image', Number(OWNER)));
  assert.deepEqual(store.db.rpc.filter((r) => r.name === 'pk_admin_set_status').map((r) => r.body.p_status), ['confirmed', 'in_progress']);
  assert.equal(task.assigned_to, 'grok_image');
  assert.equal(store.db.jobs[0].status, 'queued');
  assert.ok(toMe(tg).some((m) => /ACPK-0001 is now: confirmed/.test(m.text)), 'client told straight away');
  const xai = fakeXai();
  const r = await runWorkers(Object.assign({}, d, { fetch: xai }));
  assert.equal(r.images, 1);
  const job = store.db.jobs[0];
  assert.equal(job.status, 'awaiting_approval');
  assert.equal(job.outputs.length, 2);
  assert.ok(job.outputs.every((o) => o.path.startsWith(CLIENT + '/ACPK-0001/draft-')));
  assert.equal(tg.files.filter((f) => f.chat === OWNER && f.kind === 'photo').length, 2, 'owner sees the drafts first');
  assert.equal(tg.files.filter((f) => f.chat === String(ME)).length, 0, 'client sees nothing before approval');
  assert.deepEqual(btns(toOwner(tg).slice(-1)[0]), ['d:' + job.id, 'r:' + job.id, 'j:' + job.id]);
  await run(d, press('d:' + job.id));                              // client cannot deliver
  assert.equal(job.status, 'awaiting_approval');
  await run(d, press('d:' + job.id, Number(OWNER)));
  const adds = store.db.rpc.filter((x) => x.name === 'pk_admin_add_deliverable');
  assert.deepEqual(adds.map((a) => a.body.p_mark_ready), [false, true]);
  assert.equal(task.status, 'ready_for_review');
  assert.equal(tg.files.filter((f) => f.chat === String(ME) && f.kind === 'photo').length, 2, 'client receives the files');
  assert.deepEqual(btns(toMe(tg).slice(-1)[0]), ['ca:' + task.id, 'cc:' + task.id]);
  await run(d, press('ca:' + task.id));
  assert.equal(task.status, 'delivered');
  assert.ok(toOwner(tg).some((m) => /ACPK-0001 approved by the client/.test(m.text)));
});

test('changes requested go back to the owner with the start choices; redo and reject work', async () => {
  const { store, tg, d } = await placedOrder();
  await run(d, press('o:place'));
  const task = store.db.tasks[0];
  await run(d, press('w:' + task.id + ':grok_image', Number(OWNER)));
  await runWorkers(Object.assign({}, d, { fetch: fakeXai() }));
  const job = store.db.jobs[0];
  await run(d, press('r:' + job.id, Number(OWNER)));
  assert.equal(job.status, 'rejected');
  assert.equal(store.db.jobs[1].status, 'queued', 'redo queued');
  await runWorkers(Object.assign({}, d, { fetch: fakeXai() }));
  await run(d, press('d:' + store.db.jobs[1].id, Number(OWNER)));
  await run(d, press('cc:' + task.id), text('Please use a blue background'));
  assert.equal(task.status, 'changes_requested');
  assert.match(lastMe(tg), /change round 1 of 2/);
  const alert = toOwner(tg).find((m) => /Changes requested \(round 1 of 2\) — "Please use a blue background"/.test(m.text));
  assert.ok(alert && btns(alert).some((b) => b.startsWith('w:' + task.id)));
});

test('owner delivers by hand with /deliver; owner messages the client with /msg', async () => {
  const { store, tg, d } = await placedOrder();
  await run(d, press('o:place'));
  const task = store.db.tasks[0];
  await run(d, press('w:' + task.id + ':team', Number(OWNER)));
  assert.match(toOwner(tg).slice(-1)[0].text, /\/deliver ACPK-0001/);
  await run(d, text('/deliver ACPK-0001', Number(OWNER)), photo(Number(OWNER)), text('https://drive.example.com/folder', Number(OWNER)), press('dv:done', Number(OWNER)));
  assert.equal(task.status, 'ready_for_review');
  assert.ok(tg.files.some((f) => f.chat === String(ME) && f.kind === 'photo'));
  assert.ok(toMe(tg).some((m) => /drive\.example\.com/.test(m.text)), 'links delivered as text');
  await run(d, text('/msg ACPK-0001 Your second card is coming tonight', Number(OWNER)));
  assert.ok(toMe(tg).some((m) => /Message from the AgenticCore team about ACPK-0001:\n\nYour second card is coming tonight/.test(m.text)));
  await run(d, text('/deliver ACPK-0001'));                         // not the owner: no delivery flow
  assert.notEqual(store.db.sessions[ME].state.flow, 'deliver');
});

test('Grok video: image-to-video from the client photo, polled, then to the owner', async () => {
  const { store, tg, d } = await placedOrder();
  await run(d, press('o:place'));
  const task = store.db.tasks[0];
  await run(d, press('w:' + task.id + ':grok_video', Number(OWNER)));
  const xai = fakeXai();
  await runWorkers(Object.assign({}, d, { fetch: xai }));
  const submit = xai.calls.find((c) => c.url.endsWith('/videos/generations'));
  assert.ok(submit.body.image && submit.body.image.startsWith('https://signed.example/pk-attachments/'), 'client photo used');
  assert.equal(submit.body.duration, 10);
  assert.equal(store.db.jobs[0].status, 'awaiting_approval', 'submitted and polled in the same pass');
  assert.ok(tg.files.some((f) => f.chat === OWNER && f.kind === 'video'));
});

test('work inbox API: key required, lists agent jobs, delivered files go to the owner for approval', async () => {
  const { store, tg, d } = await placedOrder();
  await run(d, press('o:place'));
  const task = store.db.tasks[0];
  await run(d, press('w:' + task.id + ':grok_agent', Number(OWNER)));
  const wd = { tg, store, ownerId: OWNER };
  const bad = await handleWork(new Request('https://agenticcore.estate/api/work', { headers: { authorization: 'Bearer nope' } }), wd);
  assert.equal(bad.status, 401);
  const H = { authorization: 'Bearer ' + process.env.WORK_API_KEY };
  const list = await (await handleWork(new Request('https://agenticcore.estate/api/work', { headers: H }), wd)).json();
  assert.equal(list.jobs.length, 1);
  assert.equal(list.jobs[0].task, 'ACPK-0001');
  assert.match(list.jobs[0].brief, /demand 4 crore/);
  assert.equal(list.jobs[0].files.length, 1);
  const body = { action: 'deliver', job_id: list.jobs[0].job_id, note: 'two cards', files: [{ name: 'card-1', content_type: 'image/png', content_base64: Buffer.from('png').toString('base64') }] };
  const res = await handleWork(new Request('https://agenticcore.estate/api/work', { method: 'POST', headers: H, body: JSON.stringify(body) }), wd);
  assert.equal(res.status, 200);
  assert.equal(store.db.jobs[0].status, 'awaiting_approval');
  assert.ok(store.db.jobs[0].outputs[0].path.endsWith('card-1.png'));
  assert.ok(toOwner(tg).some((m) => btns(m).includes('d:' + store.db.jobs[0].id)), 'owner approves before the client sees it');
  const again = await handleWork(new Request('https://agenticcore.estate/api/work', { method: 'POST', headers: H, body: JSON.stringify(body) }), wd);
  assert.equal(again.status, 404, 'a job already handed back cannot be delivered twice');
  const bad2 = await handleWork(new Request('https://agenticcore.estate/api/work', { method: 'POST', headers: H, body: JSON.stringify({ action: 'deliver', job_id: crypto.randomUUID(), files: [{ url: 'http://insecure' }] }) }), wd);
  assert.equal(bad2.status, 404);
});

test('ordering needs an account; dashboard updates queued for Telegram are sent and marked', async () => {
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  store.db.unlinked = true;
  await run(d, press('o:start'));
  assert.match(lastMe(tg), /need an AgenticCore account first/);
  store.db.notes.push({ id: 1, client_id: CLIENT, kind: 'message', body: 'New message on ACPK-0009', status: 'queued' });
  const n = await flushClientNotes({ tg, store });
  assert.equal(n, 1);
  assert.equal(store.db.notes[0].status, 'sent');
  assert.ok(toMe(tg).some((m) => /New message on ACPK-0009/.test(m.text)));
});

test('Phase 3: property search is off until BOT_PROPERTY_SEARCH=on; then account-gated with enquiries through send_enquiry', async () => {
  assert.equal(looksLikeSearch('I want a house in Bahria Town Phase 3'), true);
  assert.equal(looksLikeSearch('mujhe G-13 mein 10 marla ghar chahiye'), true);
  assert.equal(looksLikeSearch('I want to sell my house'), false);
  const store = fakeStore(), tg = fakeTg(), d = deps(store, tg);
  await run(d, text('I want a house in G-13 Islamabad'));
  assert.match(lastMe(tg), /coming soon/);
  process.env.BOT_PROPERTY_SEARCH = 'on';
  try {
    await run(d, text('I want a house in G-13 Islamabad'));
    const res = toMe(tg).slice(-1)[0];
    assert.match(res.text, /10 Marla House, G-13\nRs 4 crore · G-13, Islamabad\nhttps:\/\/agenticcore\.estate\/listing\.html\?id=11111111/);
    assert.deepEqual(btns(res), ['q:11111111-1111-4111-8111-111111111111']);
    store.db.listings.push({ id: '11111111-1111-4111-8111-111111111111', owner_id: 'someone', title: '10 Marla House, G-13' });
    await run(d, press('q:11111111-1111-4111-8111-111111111111'), text('Is it still available? I can visit on Sunday.'));
    const call = store.db.rpc.find((r) => r.name === 'send_enquiry_as');
    assert.equal(call.body.p_sender, CLIENT);
    assert.equal(call.body.p_type, 'listing');
    assert.match(lastMe(tg), /enquiry was sent/);
    store.db.unlinked = true;
    await run(d, text('looking for a flat in G-13'));
    assert.match(lastMe(tg), /need an AgenticCore account first/);
  } finally { delete process.env.BOT_PROPERTY_SEARCH; }
});
