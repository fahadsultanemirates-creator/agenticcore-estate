// /api/work — the work inbox for orders started with "Grok agent" or "Team".
// For the Grok agent on its own computer, or for long work done in Claude
// Code: list the open jobs, then hand back the finished files. Results never
// go straight to the client — they come to the owner in Telegram first
// (Deliver / Redo / Reject).
//
//   GET  /api/work                                  → open jobs with the brief and 1-day file links
//   POST /api/work { action: "deliver", job_id, note?, files: [{ url } | { name, content_type, content_base64 }] }
//   POST /api/work { action: "fail", job_id, note }
//
// Auth: "Authorization: Bearer <WORK_API_KEY>" (Netlify secret). Without
// WORK_API_KEY the endpoint is off.

import crypto from 'node:crypto';
import { makeTelegram, botConfigured } from '../../services/telegram/tg-api.mjs';
import { makeStore, storeConfigured } from '../../services/telegram/store.mjs';
import { ownerReview } from '../../services/telegram/workers.mjs';

const MAX_FILE = 25 * 1024 * 1024;
const MAX_FILES = 10;
const TYPES = { 'image/jpeg': ['image', 'jpg'], 'image/png': ['image', 'png'], 'image/webp': ['image', 'webp'], 'video/mp4': ['video', 'mp4'], 'application/pdf': ['pdf', 'pdf'], 'application/zip': ['file', 'zip'] };

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function authorised(req) {
  const want = (process.env.WORK_API_KEY || '').trim();
  if (want.length < 24) return false;
  const got = Buffer.from((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  const w = Buffer.from(want);
  return got.length === w.length && crypto.timingSafeEqual(got, w);
}

async function fetchFile(f, fetchImpl) {
  if (f.content_base64) {
    const type = String(f.content_type || '').toLowerCase();
    if (!TYPES[type]) throw new Error('unsupported content_type ' + type);
    const bytes = Buffer.from(String(f.content_base64), 'base64');
    if (!bytes.length || bytes.length > MAX_FILE) throw new Error('file too large or empty');
    return { bytes, type, name: String(f.name || 'file').replace(/[^\w.\-]/g, '_').slice(0, 80) };
  }
  if (!/^https:\/\/\S+$/.test(String(f.url || ''))) throw new Error('files need an https url or content_base64');
  const res = await fetchImpl(f.url, { redirect: 'follow' });
  if (!res.ok) throw new Error('could not download ' + f.url + ' (' + res.status + ')');
  const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!TYPES[type]) return { link: f.url };                      // e.g. a web page or a Drive folder: delivered as a link
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_FILE) throw new Error('file over 25 MB: ' + f.url);
  return { bytes, type, name: String(f.name || f.url.split('/').pop() || 'file').split('?')[0].replace(/[^\w.\-]/g, '_').slice(0, 80) };
}

export async function handleWork(req, deps) {
  if (!authorised(req)) return json(401, { error: 'unauthorised' });
  const st = deps.store;
  if (req.method === 'GET') {
    const jobs = await st.jobsWhere('worker=in.(grok_agent,team)&status=eq.running');
    const out = [];
    for (const j of jobs) {
      const task = await st.pkTask(j.task_id);
      if (!task) continue;
      const files = [];
      for (const a of await st.pkAttachments(task.id)) { const u = await st.signedUrl('pk-attachments', a.path, 86400).catch(() => null); if (u) files.push({ name: a.name, url: u }); }
      out.push({ job_id: j.id, worker: j.worker, task: task.public_id, service: task.title, quantity: task.quantity, status: task.status,
        due_at: task.due_at, brief: (task.details && task.details.brief) || j.brief || '', revisions_used: task.revisions_used,
        estate_listing: task.details && task.details.estate_listing_id ? 'https://agenticcore.estate/listing.html?id=' + task.details.estate_listing_id : null, files });
    }
    return json(200, { jobs: out });
  }
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  let body;
  try { const raw = await req.text(); if (raw.length > 40 * 1024 * 1024) return json(413, { error: 'too large' }); body = JSON.parse(raw); } catch (e) { return json(400, { error: 'bad json' }); }
  if (!/^[0-9a-f-]{36}$/.test(String(body.job_id || ''))) return json(400, { error: 'job_id required' });
  const job = await st.jobGet(body.job_id);
  if (!job || !['grok_agent', 'team'].includes(job.worker) || job.status !== 'running') return json(404, { error: 'no open job with that id' });
  const task = await st.pkTask(job.task_id);

  if (body.action === 'fail') {
    await st.jobUpdate(job.id, { status: 'failed', note: String(body.note || '').slice(0, 500) });
    if (deps.ownerId) await deps.tg.send(deps.ownerId, '⚠️ ' + task.public_id + ': the worker gave up — ' + String(body.note || 'no reason given').slice(0, 300)).catch(() => null);
    return json(200, { ok: true });
  }
  if (body.action !== 'deliver') return json(400, { error: 'action must be deliver or fail' });
  const files = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES) : [];
  if (!files.length) return json(400, { error: 'files required' });
  const outs = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const f = await fetchFile(files[i], deps.fetch || globalThis.fetch);
      if (f.link) { outs.push({ url: f.link, kind: 'link', label: 'Link ' + (i + 1) }); continue; }
      const [kind, ext] = TYPES[f.type];
      const name = /\.\w{2,4}$/.test(f.name) ? f.name : f.name + '.' + ext;
      const path = task.client_id + '/' + task.public_id + '/' + Date.now() + '-' + (i + 1) + '-' + name;
      await st.uploadObject('pk-deliverables', path, f.bytes, f.type);
      outs.push({ path, kind, label: name });
    }
  } catch (e) { return json(400, { error: e.message }); }
  await st.jobUpdate(job.id, { status: 'awaiting_approval', outputs: outs, note: String(body.note || '').slice(0, 500) || null });
  await ownerReview(deps, job, task, outs, body.note ? String(body.note).slice(0, 200) : null);
  return json(200, { ok: true, files: outs.length, status: 'awaiting_owner_approval' });
}

export default async function handler(req) {
  if (!botConfigured() || !storeConfigured()) return json(503, { error: 'not configured' });
  return handleWork(req, { tg: makeTelegram(), store: makeStore(), ownerId: (process.env.OWNER_TELEGRAM_ID || '').trim() });
}

export const config = { path: '/api/work' };
