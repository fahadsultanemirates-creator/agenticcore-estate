// Phase 2 — AgenticCore Pakistan orders in Telegram (the "Pakistan agent").
//
// Client: describe a need → pick a service (prices from pk_catalog_lines) →
// quantity → brief, photos/logo, optionally one of their Estate listings →
// review → "Place order". The order is a normal pk_tasks row (ACPK-…), so it
// shows on the AgenticCore Pakistan dashboard exactly like a website order.
//
// Owner (OWNER_TELEGRAM_ID) approves twice:
//   1. start — picks who does the work: Grok image, Grok video, Grok agent
//      (work inbox API) or the team (/deliver) — or declines;
//   2. delivery — every draft (from Grok, the agent or the team) comes to the
//      owner first; only "Deliver" sends files to the client.
// The client then approves, or asks for changes (2 free rounds), which goes
// back to the owner to start again.

import { t } from './strings.mjs';
import { buttons } from './tg-api.mjs';
import { formatPKR } from '../util.mjs';

export const PK_DASHBOARD = 'https://agenticcorepk.com/dashboard.html';
export const WORKERS = { grok_image: 'Grok image', grok_video: 'Grok video', grok_agent: 'Grok agent', team: 'Team (you)' };
const LIMIT_FILES = 8;
const FILE_MAX = 20 * 1024 * 1024;   // the most a Telegram bot can download

// ---------- catalogue matching ----------
const SYNONYMS = [
  [/whats ?app|واٹس ?ایپ/i, 'whatsapp'], [/\bcards?\b|کارڈ/i, 'card'], [/\bposts?\b|پوسٹ/i, 'post'], [/flyers?|فلائر|پمفلٹ/i, 'flyer'],
  [/\breels?\b|ریل/i, 'reel video'], [/videos?|ویڈیو/i, 'video'], [/logo|لوگو/i, 'logo'], [/brochure|بروشر/i, 'brochure'],
  [/website|web ?site|ویب ?سائٹ/i, 'website'], [/landing|لینڈنگ/i, 'landing page'], [/photos?|tasveer|تصویر/i, 'photo'],
  [/\bads?\b|advert\w*|ishtihar|اشتہار/i, 'ads'], [/brand\w*|برانڈ/i, 'brand'], [/social|سوشل/i, 'social media'],
  [/google|گوگل/i, 'google business'], [/launch|لانچ/i, 'launch'], [/payment plan|qist|قسط/i, 'payment plan'],
  [/\bai\b|automation|chatbot|bot\b/i, 'ai automation'], [/project|پروجیکٹ/i, 'project'], [/agency|ایجنسی/i, 'agency']
];
const STOP = new Set(['i', 'a', 'an', 'the', 'for', 'my', 'me', 'need', 'want', 'of', 'to', 'and', 'please', 'mujhe', 'chahiye', 'ke', 'ki', 'ka', 'liye', 'apni', 'apna', 'mere', 'meri', 'ek', 'do', 'one']);

export function matchServices(query, lines) {
  let q = String(query || '').toLowerCase();
  SYNONYMS.forEach(([re, w]) => { if (re.test(q)) q += ' ' + w; });
  const num = q.match(/\b(?:s|service\s*)?#?(\d{1,2})\b/);
  const words = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  const oneOff = lines.filter((l) => l.model !== 'monthly');
  const scored = oneOff.map((l) => {
    const name = l.service_name.toLowerCase();
    let score = 0;
    words.forEach((w) => { if (name.includes(w)) score += w.length > 3 ? 2 : 1; });
    if (num && Number(num[1]) === l.service_no && /\b(s|service)\s*#?\d/.test(q)) score += 10;
    if (/^property /.test(name) && /property|ghar|house|plot|flat/.test(q)) score += 0.5;
    return { l, score };
  }).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score || a.l.service_no - b.l.service_no);
  const seen = new Set();
  return scored.map((x) => x.l).filter((l) => (seen.has(l.line_id) ? false : seen.add(l.line_id))).slice(0, 5);
}
export function priceText(l, qty) {
  const each = (l.is_from ? 'from ' : '') + formatPKR(l.price) + (l.unit ? ' ' + l.unit : '');
  return qty && qty > 1 ? each + ' × ' + qty + ' = ' + (l.is_from ? 'from ' : '') + formatPKR(l.price * qty) : each;
}
export function daysText(d) { return d === 0 ? 'same day (orders confirmed before 6pm PKT)' : d == null ? 'scheduled with you' : 'about ' + d + ' day' + (d === 1 ? '' : 's'); }
const lineButton = (l) => [['S' + l.service_no + ' · ' + l.service_name.slice(0, 40) + ' — ' + (l.is_from ? 'from ' : '') + formatPKR(l.price), 'o:s:' + l.line_id]];

// ---------- client side ----------
export async function pkMenu(ctx) {
  return ctx.say('pk_intro', {}, buttons([[[t('btn_pk_order', ctx.lang), 'o:start']], [[t('btn_pk_orders', ctx.lang), 'm:orders']],
    [[t('btn_pk_all', ctx.lang), 'https://agenticcorepk.com/services.html']]]));
}

export async function startOrder(ctx, firstText) {
  if (!(await ctx.requireActive())) return;
  ctx.session.state = { rl: ctx.session.state.rl, flow: 'order', step: 'what', order: { notes: [], files: [] } };
  if (firstText && firstText.trim().length > 3) return orderText(ctx, firstText);
  return ctx.say('pk_what');
}

async function offerMatches(ctx, text) {
  const lines = await ctx.deps.store.catalogue();
  const found = matchServices(text, lines);
  if (found.length) return ctx.say('pk_matches', {}, buttons(found.map(lineButton)));
  const popular = lines.filter((l) => [1, 2, 3, 4, 7].includes(l.service_no) && l.model !== 'monthly').slice(0, 5);
  return ctx.say('pk_nomatch', {}, buttons(popular.map(lineButton).concat([[[t('btn_pk_all', ctx.lang), 'https://agenticcorepk.com/services.html']]])));
}

export async function orderText(ctx, text) {
  const s = ctx.session.state, o = s.order;
  if (s.step === 'what') return offerMatches(ctx, text);
  if (s.step === 'qty') {
    const n = Number(String(text).replace(/[^\d]/g, ''));
    if (!(n >= 1 && n <= 20)) return ctx.say('pk_qty_bad');
    o.qty = n;
    return askBrief(ctx);
  }
  if (s.step === 'brief' || s.step === 'review') {
    if (/^(done|ho gaya|ho gya|bas|ہو گیا|بس)$/i.test(text.trim())) return toOrderReview(ctx);
    o.notes = (o.notes || []).concat(text.slice(0, 800)).slice(-10);
    if (s.step === 'review') return toOrderReview(ctx);
    return ctx.say('pk_note_got', {}, buttons([[[t('btn_done_photos', ctx.lang), 'o:done']]]));
  }
}

async function chooseLine(ctx, lineId) {
  const s = ctx.session.state;
  if (s.flow !== 'order') return;
  const line = (await ctx.deps.store.catalogue()).find((l) => l.line_id === lineId);
  if (!line) return ctx.say('pk_what');
  s.order.line = { line_id: line.line_id, service_no: line.service_no, name: line.service_name, price: line.price, unit: line.unit, days: line.days, is_from: line.is_from };
  if (line.unit && /^per\b/i.test(line.unit)) {
    s.step = 'qty';
    return ctx.say('pk_qty', { service: 'S' + line.service_no + ' ' + line.service_name, price: priceText(line) },
      buttons([[['1', 'o:q:1'], ['2', 'o:q:2'], ['3', 'o:q:3'], ['5', 'o:q:5']]]));
  }
  s.order.qty = 1;
  return askBrief(ctx);
}

async function askBrief(ctx) {
  const s = ctx.session.state;
  s.step = 'brief';
  await ctx.say('pk_brief', {}, buttons([[[t('btn_done_photos', ctx.lang), 'o:done']]]));
  const own = (await ctx.deps.store.ownListings(ctx.account.id)).filter((l) => l.moderation_status !== 'hidden').slice(0, 4);
  if (own.length) return ctx.say('pk_pick_listing', {}, buttons(own.map((l) => [[l.title.slice(0, 48), 'o:l:' + l.id]])));
}

// Photos and documents for the brief go to the client's own folder in the
// private pk-attachments bucket and are registered on the task once it exists.
export async function orderFile(ctx, msg) {
  const s = ctx.session.state, o = s.order;
  if (!(s.step === 'brief' || s.step === 'review')) return ctx.say('pk_brief');
  if ((o.files || []).length >= LIMIT_FILES) return ctx.say('photo_max', {}, buttons([[[t('btn_done_photos', ctx.lang), 'o:done']]]));
  let fileId, name, type, size = 0;
  const vid = msg.video || msg.video_note || msg.animation;
  if (msg.photo) { const big = msg.photo.slice().sort((a, b) => (a.width * a.height) - (b.width * b.height)).pop(); fileId = big.file_id; name = 'photo.jpg'; type = 'image/jpeg'; size = big.file_size || 0; }
  else if (vid) { fileId = vid.file_id; type = vid.mime_type || 'video/mp4'; name = String(vid.file_name || 'video.' + (/quicktime/.test(type) ? 'mov' : 'mp4')).replace(/[^\w.\- ]/g, '').slice(0, 80); size = vid.file_size || 0; }
  else if (msg.document) { fileId = msg.document.file_id; name = String(msg.document.file_name || 'file').replace(/[^\w.\- ]/g, '').slice(0, 80) || 'file'; type = msg.document.mime_type || 'application/octet-stream'; size = msg.document.file_size || 0; }
  if (!fileId) return;
  if (size > FILE_MAX) return ctx.say('pk_file_big', { mb: Math.ceil(size / 1048576) }, buttons([[[t('btn_done_photos', ctx.lang), 'o:done']]]));
  const n = (o.files || []).length + 1;
  const path = ctx.account.id + '/tg-' + Date.now() + '/' + n + '-' + name.replace(/\s+/g, '_');
  let f;
  try { f = await ctx.deps.tg.download(fileId, FILE_MAX); }
  catch (e) { return ctx.say('pk_file_big', { mb: size ? Math.ceil(size / 1048576) : '20+' }, buttons([[[t('btn_done_photos', ctx.lang), 'o:done']]])); }
  await ctx.deps.store.uploadObject('pk-attachments', path, f.bytes, type);
  o.files = (o.files || []).concat({ path, name });
  return ctx.say('pk_file_got', { n }, buttons([[[t('btn_done_photos', ctx.lang), 'o:done']]]));
}

function orderSummary(o, listingTitle) {
  const l = o.line;
  return ['S' + l.service_no + ' · ' + l.name, 'Quantity: ' + (o.qty || 1), 'Price: ' + priceText({ price: l.price, unit: l.unit, is_from: l.is_from }, o.qty),
    'Delivery: ' + daysText(l.days), listingTitle ? 'Listing: ' + listingTitle : null,
    (o.notes || []).length ? 'Brief: ' + o.notes.join(' / ').slice(0, 600) : null, 'Files: ' + (o.files || []).length].filter(Boolean).join('\n');
}

async function toOrderReview(ctx) {
  const s = ctx.session.state, o = s.order;
  if (!o.line) return ctx.say('pk_what');
  if (!(o.notes || []).length && !(o.files || []).length && !o.listing) return ctx.say('pk_need_brief');
  s.step = 'review';
  return ctx.say('pk_review', { summary: orderSummary(o, o.listingTitle) },
    buttons([[[t('btn_pk_place', ctx.lang), 'o:place']], [[t('btn_change', ctx.lang), 'o:edit'], [t('btn_cancel', ctx.lang), 'l:cancel']]]));
}

async function placeOrder(ctx) {
  const s = ctx.session.state, o = s.order;
  if (!(await ctx.requireActive())) return;
  const details = { brief: (o.notes || []).join('\n').slice(0, 3000), via: 'telegram' };
  if (o.listing) details.estate_listing_id = o.listing;
  let rows;
  try {
    rows = await ctx.deps.store.rpc('pk_tg_place_order', { p_client: ctx.account.id, p_items: [{ line_id: o.line.line_id, quantity: o.qty || 1, details }] });
  } catch (e) { return ctx.say('pk_failed', { reason: cleanErr(e) }); }
  const task = rows && rows[0];
  if (!task) return ctx.say('error');
  for (const f of o.files || []) {
    await ctx.deps.store.rpc('pk_tg_client', { p_client: ctx.account.id, p_action: 'attach', p_task: task.task_id, p_path: f.path, p_name: f.name }).catch(() => null);
  }
  await ctx.deps.store.pkEnableTelegram(ctx.account.id).catch(() => null);
  ctx.session.state = { rl: s.rl };
  await ctx.log('pk_order_placed', { task: task.public_id, line: o.line.line_id, qty: o.qty || 1 });
  const dash = ctx.signInButton ? await ctx.signInButton('pk') : null;      // signs them straight in (no password needed)
  await ctx.say('pk_placed', { id: task.public_id, url: PK_DASHBOARD }, dash ? buttons([[dash]]) : undefined);
  await alertNewOrder(ctx.deps, task.task_id, ctx.account);
}

function cleanErr(e) { return String((e && e.message) || 'error').replace(/^.*?:\s*/, '').slice(0, 200); }

// Owner alert with the start choices (also used after a change request).
export async function alertNewOrder(deps, taskId, account, heading) {
  if (!deps.ownerId) return;
  const task = await deps.store.pkTask(taskId);
  if (!task) return;
  const files = await deps.store.pkAttachments(task.id);
  const links = [];
  for (const f of files.slice(0, 8)) { const u = await deps.store.signedUrl('pk-attachments', f.path, 7 * 86400).catch(() => null); if (u) links.push(u); }
  const who = account ? 'AC-' + account.member_no + ' (' + account.full_name + ')' : 'client';
  const text = (heading || '🧾 New order') + ' ' + task.public_id + ' from ' + who + '\n' +
    task.title + ' × ' + task.quantity + ' — ' + formatPKR(task.amount) + '\n' +
    (task.details && task.details.brief ? 'Brief: ' + String(task.details.brief).slice(0, 700) + '\n' : '') +
    (task.details && task.details.estate_listing_id ? 'Estate listing: ' + 'https://agenticcore.estate/listing.html?id=' + task.details.estate_listing_id + '\n' : '') +
    (links.length ? 'Files (7-day links):\n' + links.join('\n') + '\n' : '') + '\nWho should do it?';
  await deps.tg.send(deps.ownerId, text, buttons(workerRows(task))).catch(() => null);
}

// Who can do an order. The team (you, the Grok bot, Claude) comes first and
// fits every order; the Grok image/video APIs are offered only for the small
// visual items they can draft (cards, posts, flyers, reels), never for
// websites, brochures, PDFs, presentations or logos.
const NOT_FOR_API = /website|web ?site|landing|brochure|pdf|presentation|deck|logo|brand|google|seo|automation|chatbot|\bbot\b|plan|copy|content|ads?\b|campaign|management|system|script|progress|presenter/i;
export function workerChoices(title) {
  const t = String(title || '');
  const out = ['team'];
  if (!NOT_FOR_API.test(t) && /card|post|flyer|story|banner|poster|thumbnail|cover|graphic|creative|image/i.test(t)) out.push('grok_image');
  if (!NOT_FOR_API.test(t) && /reel|video|walk-?through|animation/i.test(t)) out.push('grok_video');
  out.push('grok_agent');
  return out;
}
export function workerRows(task) {
  const ws = workerChoices(task.title);
  const label = { team: '▶ Team (me) — recommended', grok_image: '▶ Grok image', grok_video: '▶ Grok video', grok_agent: '▶ Grok agent' };
  const rows = [[[label.team, 'w:' + task.id + ':team']]];
  const rest = ws.filter((w) => w !== 'team').map((w) => [label[w], 'w:' + task.id + ':' + w]);
  for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2));
  rows.push([['✖ Decline', 'x:' + task.id]]);
  return rows;
}

export async function myOrders(ctx) {
  if (!ctx.account) return ctx.requireActive();
  const rows = await ctx.deps.store.pkClientTasks(ctx.account.id);
  if (!rows.length) return ctx.say('pk_orders_none', {}, buttons([[[t('btn_pk_order', ctx.lang), 'o:start']]]));
  const lines = rows.map((r) => r.public_id + ' · ' + r.title + (r.quantity > 1 ? ' × ' + r.quantity : '') + ' — ' + r.status.replace(/_/g, ' ') +
    (r.due_at && !['delivered', 'cancelled'].includes(r.status) ? ' (due ' + new Date(r.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' }) + ')' : ''));
  const dash = ctx.signInButton ? await ctx.signInButton('pk') : null;
  return ctx.raw(t('pk_orders_title', ctx.lang) + '\n\n' + lines.join('\n') + '\n\n' + PK_DASHBOARD, dash ? buttons([[dash]]) : undefined);
}

// ---------- owner actions ----------
async function ownerStart(ctx, taskId, worker) {
  const st = ctx.deps.store;
  const task = await st.pkTask(taskId);
  if (!task || ['delivered', 'cancelled'].includes(task.status)) return ctx.raw('That order is already closed.');
  if (['received', 'waiting_on_you'].includes(task.status)) await st.rpc('pk_admin_set_status', { p_task: task.id, p_status: 'confirmed', p_note: 'Confirmed by the team' });
  if (task.status !== 'in_progress') await st.rpc('pk_admin_set_status', { p_task: task.id, p_status: 'in_progress', p_note: 'Work started' });
  await st.pkPatchTask(task.id, { assigned_to: worker });
  const brief = [task.title + (task.quantity > 1 ? ' × ' + task.quantity : ''), task.details && task.details.brief].filter(Boolean).join('\n');
  const job = await st.jobCreate({ task_id: task.id, worker, status: worker.startsWith('grok_') && worker !== 'grok_agent' ? 'queued' : 'running', brief });
  await ctx.log('pk_order_started', { task: task.public_id, worker }, null);
  await flushClientNotes(ctx.deps, task.client_id);
  const how = {
    grok_image: 'Grok image drafts arrive here within about 10 minutes for your approval.',
    grok_video: 'Grok video is rendering; the draft arrives here for your approval (usually 10–20 minutes).',
    grok_agent: 'Waiting in the work inbox (/api/work) for the Grok agent. Its result comes here for your approval.',
    team: 'When the work is ready (made by you, the Grok bot or Claude), tap "Upload finished work" below — or send /deliver ' + task.public_id + ' — then send the files (photos, PDFs, videos or links). You check them once more before the client gets them.'
  }[worker];
  return ctx.raw('▶ ' + task.public_id + ' confirmed and started — ' + WORKERS[worker] + '.\n' + how + '\nJob ' + job.id.slice(0, 8),
    worker === 'team' ? buttons([[['📤 Upload finished work', 'dv:s:' + task.id]]]) : undefined);
}

async function ownerDecline(ctx, taskId) {
  const task = await ctx.deps.store.pkTask(taskId);
  if (!task || ['delivered', 'cancelled'].includes(task.status)) return ctx.raw('That order is already closed.');
  await ctx.deps.store.rpc('pk_admin_set_status', { p_task: task.id, p_status: 'cancelled', p_note: 'Declined by the team. Please message us if you have questions.' });
  await flushClientNotes(ctx.deps, task.client_id);
  await ctx.log('pk_order_declined', { task: task.public_id }, null);
  return ctx.raw('✖ ' + task.public_id + ' declined. The client was told.');
}

// Owner approves a draft → files become deliverables and go to the client.
export async function deliverJob(deps, jobId) {
  const st = deps.store;
  const job = await st.jobGet(jobId);
  if (!job || job.status !== 'awaiting_approval') return 'That draft is not waiting for approval.';
  const task = await st.pkTask(job.task_id);
  const outs = job.outputs || [];
  if (!outs.length) return 'That draft has no files.';
  for (let i = 0; i < outs.length; i++) {
    await st.rpc('pk_admin_add_deliverable', { p_task: task.id, p_kind: outs[i].kind || 'file', p_path: outs[i].path || null, p_url: outs[i].url || null,
      p_label: outs[i].label || (task.title + ' ' + (i + 1)), p_mark_ready: i === outs.length - 1 });
  }
  await st.jobUpdate(job.id, { status: 'approved' });
  const chat = await st.chatFor(task.client_id);
  if (chat) {
    const L = await langOf(st, chat);
    await deps.tg.send(chat, t('pk_delivery', L, { id: task.public_id, n: outs.length })).catch(() => null);
    for (const o of outs) await sendFile(deps, chat, o, task.public_id);
    await deps.tg.send(chat, task.public_id + ' — ' + task.title, buttons([[[t('btn_pk_approve', L), 'ca:' + task.id], [t('btn_pk_changes', L), 'cc:' + task.id]]])).catch(() => null);
  }
  await flushClientNotes(deps, task.client_id, ['status_ready_for_review']);
  return '✅ ' + task.public_id + ' delivered to the client (' + outs.length + ' file' + (outs.length > 1 ? 's' : '') + ').';
}

export async function sendFile(deps, chat, o, caption) {
  const url = o.path ? await deps.store.signedUrl('pk-deliverables', o.path, 7 * 86400).catch(() => null) : o.url;
  if (!url) return;
  const send = o.kind === 'image' ? deps.tg.sendPhoto : o.kind === 'video' ? deps.tg.sendVideo : o.kind === 'link' ? null : deps.tg.sendDocument;
  if (send) await send(chat, url, caption).catch(() => deps.tg.send(chat, (caption ? caption + ': ' : '') + url).catch(() => null));
  else await deps.tg.send(chat, (caption ? caption + ': ' : '') + url).catch(() => null);
}

async function langOf(store, chat) {
  const rows = await store.rest('tg_sessions?chat_id=eq.' + Number(chat) + '&select=lang').catch(() => []);
  return (rows && rows[0] && rows[0].lang) || 'en';
}

// Sends the dashboard notifications queued for Telegram (pk_notify) right away.
export async function flushClientNotes(deps, clientId, skipKinds) {
  const st = deps.store;
  const rows = await st.rest('pk_notifications?channel=eq.telegram&status=eq.queued' + (clientId ? '&client_id=eq.' + clientId : '') + '&select=id,client_id,kind,body&order=id.asc&limit=50').catch(() => []);
  let sent = 0;
  for (const n of rows || []) {
    const chat = await st.chatFor(n.client_id);
    const skip = (skipKinds || []).includes(n.kind);
    if (chat && !skip) await deps.tg.send(chat, '🔔 ' + n.body).catch(() => null);
    await st.rest('pk_notifications?id=eq.' + n.id, { method: 'PATCH', body: { status: chat ? 'sent' : 'failed' }, headers: { Prefer: 'return=minimal' } }).catch(() => null);
    if (chat && !skip) sent++;
  }
  return sent;
}

// Owner delivers by hand: /deliver ACPK-0001, then files or links, then Done.
export async function ownerDeliverStart(ctx, publicId, taskId) {
  const task = taskId ? await ctx.deps.store.pkTask(taskId) : await ctx.deps.store.pkTaskByPublicId(String(publicId || '').toUpperCase());
  if (!task) return ctx.raw('No order ' + publicId + '. Use the ACPK number, e.g. /deliver ACPK-0042');
  if (['delivered', 'cancelled'].includes(task.status)) return ctx.raw(task.public_id + ' is already ' + task.status + '.');
  ctx.session.state = { rl: ctx.session.state.rl, flow: 'deliver', task: task.id, publicId: task.public_id, client: task.client_id, outputs: [] };
  return ctx.raw('Send the files for ' + task.public_id + ' (' + task.title + ') — photos, documents, videos or https links. Tap Done when finished.', buttons([[['Done', 'dv:done']], [['Cancel', 'l:cancel']]]));
}

export async function ownerDeliverInput(ctx, msg, text) {
  const s = ctx.session.state;
  let kind, fileId, name, type, url;
  if (msg && msg.photo) { const big = msg.photo.slice().sort((a, b) => (a.width * a.height) - (b.width * b.height)).pop(); fileId = big.file_id; kind = 'image'; name = 'image.jpg'; type = 'image/jpeg'; }
  else if (msg && msg.video) { fileId = msg.video.file_id; kind = 'video'; name = 'video.mp4'; type = msg.video.mime_type || 'video/mp4'; }
  else if (msg && msg.document) { fileId = msg.document.file_id; type = msg.document.mime_type || 'application/octet-stream'; kind = /^image\//.test(type) ? 'image' : /pdf/.test(type) ? 'pdf' : /^video\//.test(type) ? 'video' : 'file'; name = String(msg.document.file_name || 'file').replace(/[^\w.\- ]/g, '').slice(0, 80) || 'file'; }
  else if (text && /^https:\/\/\S+$/.test(text.trim())) { url = text.trim(); kind = 'link'; }
  else if (text && /^(done)$/i.test(text.trim())) return ownerDeliverDone(ctx);
  else return ctx.raw('Send a photo, document, video or an https link — or tap Done.');
  if (fileId) {
    let f;
    try { f = await ctx.deps.tg.download(fileId, 20 * 1024 * 1024); }
    catch (e) { return ctx.raw('That file is over 20 MB, the most Telegram lets the bot receive. Send it as a Google Drive / Dropbox / YouTube https link instead — the client gets the link.', buttons([[['Done', 'dv:done']]])); }
    const path = s.client + '/' + s.publicId + '/' + Date.now() + '-' + name.replace(/\s+/g, '_');
    await ctx.deps.store.uploadObject('pk-deliverables', path, f.bytes, type);
    s.outputs.push({ path, kind, label: name });
  } else s.outputs.push({ url, kind: 'link', label: 'Link' });
  return ctx.raw('Added (' + s.outputs.length + '). More, or tap Done.', buttons([[['Done', 'dv:done']]]));
}

async function ownerDeliverDone(ctx) {
  const s = ctx.session.state;
  if (!(s.outputs || []).length) return ctx.raw('Nothing added yet.');
  const job = await ctx.deps.store.jobCreate({ task_id: s.task, worker: 'team', status: 'awaiting_approval', outputs: s.outputs, brief: 'Delivered by the team' });
  ctx.session.state = { rl: s.rl };
  const r = await deliverJob(ctx.deps, job.id);
  await ctx.log('pk_delivered', { task: s.publicId, files: s.outputs.length, by: 'team' }, null);
  return ctx.raw(r);
}

// Owner messages the client about an order: /msg ACPK-0042 text
export async function ownerMessage(ctx, publicId, text) {
  const st = ctx.deps.store;
  const task = await st.pkTaskByPublicId(String(publicId || '').toUpperCase());
  if (!task || !text) return ctx.raw('Use: /msg ACPK-0042 your message');
  await st.rest('pk_messages', { method: 'POST', body: { task_id: task.id, from_team: true, via: 'telegram', body: text.slice(0, 4000) }, headers: { Prefer: 'return=minimal' } });
  const chat = await st.chatFor(task.client_id);
  if (chat) await ctx.deps.tg.send(chat, t('pk_team_message', await langOf(st, chat), { id: task.public_id, text })).catch(() => null);
  return ctx.raw(chat ? 'Sent to the client in Telegram and on the dashboard.' : 'Saved on the dashboard (the client has no Telegram connected).');
}

export async function ownerJobs(ctx) {
  const jobs = await ctx.deps.store.jobsWhere('status=in.(queued,running,awaiting_approval)');
  if (!jobs.length) return ctx.raw('No open work.');
  const lines = [];
  for (const j of jobs) { const task = await ctx.deps.store.pkTask(j.task_id); lines.push((task ? task.public_id : '?') + ' · ' + WORKERS[j.worker] + ' · ' + j.status.replace(/_/g, ' ') + ' · job ' + j.id.slice(0, 8)); }
  return ctx.raw('Open work:\n' + lines.join('\n'));
}

// ---------- client delivery responses ----------
async function clientApprove(ctx, taskId, msgId) {
  try { await ctx.deps.store.rpc('pk_tg_client', { p_client: ctx.account.id, p_action: 'approve', p_task: taskId }); }
  catch (e) { return ctx.say('pk_failed', { reason: cleanErr(e) }); }
  const task = await ctx.deps.store.pkTask(taskId);
  await ctx.deps.tg.removeButtons(ctx.chatId, msgId);
  await ctx.log('pk_delivery_approved', { task: task.public_id }, '✅ ' + task.public_id + ' approved by the client.');
  return ctx.say('pk_approved', { id: task.public_id });
}

// A marked-up photo, video or PDF sent while asking for changes: kept with
// the change request (one file), then the client types what to change.
async function clientChangesFile(ctx, msg) {
  const s = ctx.session.state;
  const vid = msg.video || msg.video_note || msg.animation;
  const big = msg.photo ? msg.photo.slice().sort((a, b) => (a.width * a.height) - (b.width * b.height)).pop() : null;
  const src = big || vid || msg.document;
  if (!src) return;
  if ((src.file_size || 0) > FILE_MAX) return ctx.say('pk_file_big', { mb: Math.ceil(src.file_size / 1048576) });
  const type = big ? 'image/jpeg' : src.mime_type || (vid ? 'video/mp4' : 'application/octet-stream');
  const name = String(src.file_name || (big ? 'markup.jpg' : vid ? 'markup.mp4' : 'markup')).replace(/[^\w.\- ]/g, '').slice(0, 80);
  let f;
  try { f = await ctx.deps.tg.download(src.file_id, FILE_MAX); } catch (e) { return ctx.say('pk_file_big', { mb: '20+' }); }
  const path = ctx.account.id + '/tg-changes-' + Date.now() + '/' + name.replace(/\s+/g, '_');
  await ctx.deps.store.uploadObject('pk-attachments', path, f.bytes, type);
  s.changeFile = path;
  return ctx.say('pk_changes_file');
}

async function clientChangesNote(ctx, text) {
  const s = ctx.session.state;
  let r;
  try { r = await ctx.deps.store.rpc('pk_tg_client', { p_client: ctx.account.id, p_action: 'changes', p_task: s.task, p_note: text.slice(0, 2000), p_path: s.changeFile || null }); }
  catch (e) { ctx.session.state = { rl: s.rl }; return ctx.say('pk_failed', { reason: cleanErr(e) }); }
  ctx.session.state = { rl: s.rl };
  const task = await ctx.deps.store.pkTask(s.task);
  const fileUrl = s.changeFile ? await ctx.deps.store.signedUrl('pk-attachments', s.changeFile, 7 * 86400).catch(() => null) : null;
  await ctx.log('pk_changes_requested', { task: task.public_id, round: r && r.round });
  await ctx.say('pk_changes_sent', { id: task.public_id, round: (r && r.round) || task.revisions_used });
  return alertNewOrder(ctx.deps, task.id, ctx.account, '✏️ Changes requested (round ' + task.revisions_used + ' of 2) — "' + text.slice(0, 300) + '"' + (fileUrl ? '\nTheir marked-up file (7-day link): ' + fileUrl + '\n' : ' ') + '—');
}

// ---------- routing ----------
// Returns true when the callback belonged to Phase 2.
export async function onPkCallback(ctx, data, msgId) {
  const s = ctx.session.state;
  let m;
  if (data === 'o:start') { await startOrder(ctx); return true; }
  if (data === 'm:orders') { await myOrders(ctx); return true; }
  if ((m = data.match(/^o:s:([\w-]{1,40})$/))) { await chooseLine(ctx, m[1]); return true; }
  if ((m = data.match(/^o:q:(\d{1,2})$/)) && s.flow === 'order') { s.order.qty = Number(m[1]); await askBrief(ctx); return true; }
  if ((m = data.match(/^o:l:([0-9a-f-]{36})$/)) && s.flow === 'order') {
    const own = await ctx.deps.store.ownListings(ctx.account.id);
    const l = own.find((x) => x.id === m[1]);
    if (l) { s.order.listing = l.id; s.order.listingTitle = l.title; await ctx.say('pk_listing_set', { title: l.title }); }
    return true;
  }
  if (data === 'o:done' && s.flow === 'order') { await toOrderReview(ctx); return true; }
  if (data === 'o:edit' && s.flow === 'order') { s.step = 'review'; await ctx.say('what_change'); return true; }
  if (data === 'o:place' && s.flow === 'order' && s.step === 'review') { await ctx.deps.tg.removeButtons(ctx.chatId, msgId); await placeOrder(ctx); return true; }
  // never silent: an order not at its review step is shown again to confirm; a finished/expired one says so
  if (data === 'o:place' && s.flow === 'order') { await ctx.deps.tg.removeButtons(ctx.chatId, msgId); await toOrderReview(ctx); return true; }
  if (data === 'o:place' || data === 'o:done' || data === 'o:edit' || /^o:[ql]:/.test(data)) {
    await ctx.deps.tg.removeButtons(ctx.chatId, msgId);
    await ctx.say('pk_order_closed', {}, buttons([[[t('btn_pk_order', ctx.lang), 'o:start']], [[t('btn_pk_orders', ctx.lang), 'm:orders']]]));
    return true;
  }
  if ((m = data.match(/^ca:([0-9a-f-]{36})$/))) { if (await ctx.requireActive()) await clientApprove(ctx, m[1], msgId); return true; }
  if ((m = data.match(/^cc:([0-9a-f-]{36})$/))) {
    if (!(await ctx.requireActive())) return true;
    const task = await ctx.deps.store.pkTask(m[1]);
    if (!task || task.client_id !== ctx.account.id) return true;
    ctx.session.state = { rl: s.rl, flow: 'changes', task: task.id };
    await ctx.say('pk_changes_ask', { id: task.public_id });
    return true;
  }
  // owner only from here
  if (/^(w|x|d|r|j|dv):/.test(data)) {
    if (!ctx.isOwner()) return true;
    if ((m = data.match(/^w:([0-9a-f-]{36}):(grok_image|grok_video|grok_agent|team)$/))) { await ctx.deps.tg.removeButtons(ctx.chatId, msgId); await ownerStart(ctx, m[1], m[2]); return true; }
    if ((m = data.match(/^x:([0-9a-f-]{36})$/))) { await ctx.deps.tg.removeButtons(ctx.chatId, msgId); await ownerDecline(ctx, m[1]); return true; }
    if ((m = data.match(/^d:([0-9a-f-]{36})$/))) { await ctx.deps.tg.removeButtons(ctx.chatId, msgId); await ctx.raw(await deliverJob(ctx.deps, m[1])); return true; }
    if ((m = data.match(/^r:([0-9a-f-]{36})$/))) {
      const job = await ctx.deps.store.jobGet(m[1]);
      if (job && job.status === 'awaiting_approval') {
        await ctx.deps.tg.removeButtons(ctx.chatId, msgId);
        await ctx.deps.store.jobUpdate(job.id, { status: 'rejected', note: 'Redo requested' });
        const again = await ctx.deps.store.jobCreate({ task_id: job.task_id, worker: job.worker, status: ['grok_image', 'grok_video'].includes(job.worker) ? 'queued' : 'running', brief: job.brief, note: 'Redo of ' + job.id.slice(0, 8) });
        await ctx.raw('🔁 Redo queued (' + WORKERS[job.worker] + ', job ' + again.id.slice(0, 8) + ').');
      }
      return true;
    }
    if ((m = data.match(/^j:([0-9a-f-]{36})$/))) {
      const job = await ctx.deps.store.jobGet(m[1]);
      if (job && job.status === 'awaiting_approval') {
        await ctx.deps.tg.removeButtons(ctx.chatId, msgId);
        await ctx.deps.store.jobUpdate(job.id, { status: 'rejected' });
        const task = await ctx.deps.store.pkTask(job.task_id);
        await ctx.raw('✖ Draft rejected. ' + (task ? task.public_id : '') + ' stays in progress — start another worker from the order alert, or /deliver ' + (task ? task.public_id : '') + ' yourself.');
      }
      return true;
    }
    if (data === 'dv:done' && s.flow === 'deliver') { await ownerDeliverDone(ctx); return true; }
    if ((m = data.match(/^dv:s:([0-9a-f-]{36})$/))) { await ownerDeliverStart(ctx, null, m[1]); return true; }
    return true;
  }
  return false;
}

// Text/file input while a Phase 2 flow is open. Returns true when handled.
export async function onPkInput(ctx, msg, text) {
  const s = ctx.session.state;
  if (s.flow === 'order') {
    if (msg && (msg.photo || msg.document || msg.video || msg.video_note || msg.animation)) { await orderFile(ctx, msg); return true; }
    if (text) { await orderText(ctx, text); return true; }
    return true;
  }
  if (s.flow === 'changes' && text) { await clientChangesNote(ctx, text); return true; }
  if (s.flow === 'changes' && msg && (msg.photo || msg.document || msg.video || msg.video_note || msg.animation)) { await clientChangesFile(ctx, msg); return true; }
  if (s.flow === 'deliver' && ctx.isOwner()) { await ownerDeliverInput(ctx, msg, text); return true; }
  return false;
}
