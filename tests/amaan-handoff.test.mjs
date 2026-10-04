// Amaan → "Send to the AgenticCore team": validation, owner alert with files,
// daily limit, member copy, owner /reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHandoff, handleHandoff, replyToRequest, HANDOFF_LIMIT } from '../services/amaan-handoff.mjs';

const U = 'a1b2c3d4-0000-4000-8000-000000000001';
const OTHER = 'ffffffff-0000-4000-8000-000000000009';
function fakes(opts) {
  opts = opts || {};
  const sent = [], files = [], db = { activity: [] };
  const tg = {
    async send(c, t) { sent.push({ c: String(c), t }); }, async sendPhoto(c, u, cap) { files.push({ c: String(c), k: 'photo', u, cap }); },
    async sendVideo(c, u, cap) { files.push({ c: String(c), k: 'video', u, cap }); }, async sendDocument(c, u, cap) { files.push({ c: String(c), k: 'doc', u, cap }); }
  };
  const store = {
    async countActivity() { return opts.count || 0; },
    async profile() { return { id: U, full_name: 'Sara Khan', member_no: 100007 }; },
    async rest(path, o) {
      if (o && o.method === 'POST') { db.activity.push(o.body); return null; }
      if (path.startsWith('activity_log?kind=eq.amaan_request')) { const ref = decodeURIComponent(path.split('ref=eq.')[1].split('&')[0]); return db.activity.filter((a) => a.detail.ref === ref).map((a) => ({ user_id: a.user_id, member_no: a.member_no })); }
      return [];
    },
    async signedUrl(b, p) { return 'https://signed.example/' + b + '/' + p; },
    async chatFor() { return opts.chat === undefined ? 555 : opts.chat; }
  };
  return { tg, store, sent, files, db };
}
const good = () => ({ action: 'handoff', site: 'pk', summary: 'Logo and 2 social posts for my agency in Lahore', note: 'Use blue', messages: [{ role: 'user', text: 'I need a logo' }, { role: 'assistant', text: 'Sure' }],
  files: [{ path: U + '/amaan-1759560000000/1-logo.png', name: 'logo.png', type: 'image/png', size: 1000 }, { path: U + '/amaan-1759560000000/2-tour.mp4', name: 'tour.mp4', type: 'video/mp4', size: 9000 }, { path: U + '/amaan-1759560000000/3-brief.pdf', name: 'brief.pdf', type: 'application/pdf', size: 900 }] });

test('validation: files must be in the person\'s own amaan folder and of an allowed type', () => {
  assert.equal(validateHandoff(good(), U).ok, true);
  const b = good(); b.files[0].path = OTHER + '/amaan-1759560000000/x.png';
  assert.equal(validateHandoff(b, U).error, 'bad_file', 'someone else\'s folder');
  const c = good(); c.files[0].path = U + '/../x.png';
  assert.equal(validateHandoff(c, U).error, 'bad_file');
  const d = good(); d.files[0].type = 'application/x-msdownload';
  assert.equal(validateHandoff(d, U).error, 'bad_file');
  assert.equal(validateHandoff({ summary: '', files: [] }, U).error, 'empty');
});

test('handoff: recorded, owner gets the summary and every file, member gets a copy', async () => {
  const f = fakes();
  const out = await handleHandoff(good(), { userId: U, store: f.store, tg: f.tg, ownerId: '999', now: Date.UTC(2026, 9, 4) });
  assert.equal(out.status, 200);
  assert.match(out.body.ref, /^AR-[A-Z0-9]{4,8}$/);
  assert.equal(f.db.activity[0].kind, 'amaan_request'); assert.equal(f.db.activity[0].channel, 'web');
  const owner = f.sent.find((m) => m.c === '999');
  assert.match(owner.t, /New request AR-.* from Sara Khan \(AC-100007\) via Amaan on agenticcorepk\.com/);
  assert.match(owner.t, /Logo and 2 social posts/); assert.match(owner.t, /Note: Use blue/); assert.match(owner.t, /\/reply AR-/);
  assert.deepEqual(f.files.map((x) => x.k), ['photo', 'video', 'doc']);
  assert.ok(f.files.every((x) => x.u.startsWith('https://signed.example/pk-attachments/' + U + '/amaan-')));
  assert.ok(f.sent.some((m) => m.c === '555' && /reached the AgenticCore team \(3 file/.test(m.t)));
});

test('handoff: daily limit; owner /reply reaches the member', async () => {
  const f = fakes({ count: HANDOFF_LIMIT });
  assert.equal((await handleHandoff(good(), { userId: U, store: f.store, tg: f.tg, ownerId: '999' })).status, 429);
  const g = fakes();
  const out = await handleHandoff(good(), { userId: U, store: g.store, tg: g.tg, ownerId: '999' });
  const r = await replyToRequest({ store: g.store, tg: g.tg }, out.body.ref, 'Your logo drafts are ready tomorrow');
  assert.equal(r.ok, true);
  assert.ok(g.sent.some((m) => m.c === '555' && /Reply from the AgenticCore team about AR-.*\n\nYour logo drafts/.test(m.t)));
  const h = fakes({ chat: null });
  const out2 = await handleHandoff(good(), { userId: U, store: h.store, tg: h.tg, ownerId: '999' });
  assert.equal((await replyToRequest({ store: h.store, tg: h.tg }, out2.body.ref, 'hi')).reason, 'no_telegram');
  assert.equal((await replyToRequest({ store: h.store, tg: h.tg }, 'AR-NOPE00', 'hi')).reason, 'not_found');
});

test('/api/assistant handoff requires a signed-in person', async () => {
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test-token';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';
  const { default: handler } = await import('../netlify/functions/assistant.mjs');
  const res = await handler(new Request('https://agenticcore.estate/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://agenticcorepk.com' }, body: JSON.stringify(good()) }), { ip: '1.2.3.4' });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://agenticcorepk.com');
  const pre = await handler(new Request('https://agenticcore.estate/api/assistant', { method: 'OPTIONS', headers: { Origin: 'https://agenticcorepk.com' } }), {});
  assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
});
