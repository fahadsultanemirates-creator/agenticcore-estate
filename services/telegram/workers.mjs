// Phase 2 workers, run by the 10-minute timer (telegram-cron):
//   grok_image — xAI image generation: 2 draft options from the brief
//   grok_video — xAI video generation (async: submit, then poll), image-to-video
//                when the client sent a photo
// Every result goes to the owner first (Deliver / Redo / Reject); nothing
// reaches the client without that tap. API shapes follow agenticcore-click's
// grok.ts / grokVideo.ts (api.x.ai/v1/images/generations, /videos/generations,
// /videos/{id}). XAI_API_KEY lives in Netlify only.

import { buttons } from './tg-api.mjs';
import { WORKERS } from './pk-orders.mjs';

const XAI = 'https://api.x.ai/v1';
const key = () => (process.env.XAI_API_KEY || '').trim();
const IMAGE_MODEL = () => process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-2.0';
const VIDEO_MODEL = () => process.env.XAI_VIDEO_MODEL || 'grok-imagine-video-1.5';

export function jobPrompt(task, kind) {
  const brief = String((task.details && task.details.brief) || '').slice(0, 1200);
  const base = 'Professional real estate marketing ' + (kind === 'video' ? 'video' : 'creative') + ' for Pakistan: ' + task.title + '. ' + brief +
    ' Clean modern premium style, accurate and realistic.' +
    ' Use ONLY the words given above (business name, phone, city, details) and spell them exactly as written; add no slogans, taglines, mottos or claims.' +
    ' Do not invent a logo, emblem, monogram or icon mark — show the business name as plain text only.' +
    ' No invented prices, phone numbers, addresses, awards or website names.';
  return base.replace(/\s+/g, ' ').trim().slice(0, 1800);
}

async function xai(fetchImpl, path, body) {
  const res = await fetchImpl(XAI + path, {
    method: body ? 'POST' : 'GET', headers: Object.assign({ Authorization: 'Bearer ' + key() }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) { const e = new Error('xai_' + res.status); e.status = res.status; throw e; }
  return res.json();
}

async function imageOnce(fetchImpl, prompt) {
  const data = await xai(fetchImpl, '/images/generations', { model: IMAGE_MODEL(), prompt, n: 1, response_format: 'b64_json' });
  const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new Error('xai_no_image');
  return Buffer.from(b64, 'base64');
}

export async function ownerReview(deps, job, task, outs, note) {
  if (!deps.ownerId) return;
  await deps.tg.send(deps.ownerId, '🧪 Draft for ' + task.public_id + ' (' + task.title + ') from ' + WORKERS[job.worker] + (note ? ' — ' + note : '') + '. Check it, then choose:').catch(() => null);
  for (const o of outs) {
    const url = o.path ? await deps.store.signedUrl('pk-deliverables', o.path, 3 * 86400).catch(() => null) : o.url;
    if (!url) continue;
    const send = o.kind === 'image' ? deps.tg.sendPhoto : o.kind === 'video' ? deps.tg.sendVideo : deps.tg.sendDocument;
    await send(deps.ownerId, url, o.label).catch(() => deps.tg.send(deps.ownerId, o.label + ': ' + url).catch(() => null));
  }
  await deps.tg.send(deps.ownerId, task.public_id + ' — deliver to the client?', buttons([[['✅ Deliver', 'd:' + job.id], ['🔁 Redo', 'r:' + job.id], ['✖ Reject', 'j:' + job.id]]])).catch(() => null);
}

async function fail(deps, job, task, reason) {
  await deps.store.jobUpdate(job.id, { status: 'failed', note: String(reason).slice(0, 300), attempts: (job.attempts || 0) + 1 });
  if (deps.ownerId) await deps.tg.send(deps.ownerId, '⚠️ ' + WORKERS[job.worker] + ' could not finish ' + (task ? task.public_id : '') + ': ' + reason + '. Start another worker from the order alert, or /deliver it yourself.').catch(() => null);
}

export async function runImageJob(deps, job) {
  const st = deps.store, f = deps.fetch || globalThis.fetch;
  const task = await st.pkTask(job.task_id);
  if (!task) return st.jobUpdate(job.id, { status: 'failed', note: 'task missing' });
  await st.jobUpdate(job.id, { status: 'running', attempts: (job.attempts || 0) + 1 });
  try {
    const prompt = jobPrompt(task, 'image');
    const imgs = await Promise.all([imageOnce(f, prompt), imageOnce(f, prompt)]);
    const outs = [];
    for (let i = 0; i < imgs.length; i++) {
      const path = task.client_id + '/' + task.public_id + '/draft-' + job.id.slice(0, 8) + '-' + (i + 1) + '.jpg';
      await st.uploadObject('pk-deliverables', path, imgs[i], 'image/jpeg');
      outs.push({ path, kind: 'image', label: task.title + ' — option ' + (i + 1) });
    }
    await st.jobUpdate(job.id, { status: 'awaiting_approval', outputs: outs, note: 'AI-generated from the brief (client photos are not used by image generation)' });
    await ownerReview(deps, job, task, outs, 'AI-generated from the brief');
  } catch (e) { await fail(deps, job, task, e.message); }
}

export async function startVideoJob(deps, job) {
  const st = deps.store, f = deps.fetch || globalThis.fetch;
  const task = await st.pkTask(job.task_id);
  if (!task) return st.jobUpdate(job.id, { status: 'failed', note: 'task missing' });
  try {
    const body = { model: VIDEO_MODEL(), prompt: jobPrompt(task, 'video'), duration: 10, aspect_ratio: '9:16', resolution: '720p' };
    const photo = (await st.pkAttachments(task.id)).find((a) => /\.(jpe?g|png|webp)$/i.test(a.path));
    if (photo) { const u = await st.signedUrl('pk-attachments', photo.path, 3600).catch(() => null); if (u) body.image = u; }   // image-to-video from the client's photo
    const data = await xai(f, '/videos/generations', body);
    if (!data || !data.request_id) throw new Error('xai_no_request_id');
    await st.jobUpdate(job.id, { status: 'running', provider_job_id: data.request_id, attempts: (job.attempts || 0) + 1, note: photo ? 'from the client\'s photo' : 'from the brief' });
  } catch (e) { await fail(deps, job, task, e.message); }
}

export async function pollVideoJob(deps, job) {
  const st = deps.store, f = deps.fetch || globalThis.fetch;
  const task = await st.pkTask(job.task_id);
  try {
    const data = await xai(f, '/videos/' + encodeURIComponent(job.provider_job_id));
    if (data.status === 'done' && data.video && data.video.url) {
      const res = await f(data.video.url);
      if (!res.ok) throw new Error('video_download_' + res.status);
      const bytes = Buffer.from(await res.arrayBuffer());
      const path = task.client_id + '/' + task.public_id + '/draft-' + job.id.slice(0, 8) + '.mp4';
      await st.uploadObject('pk-deliverables', path, bytes, 'video/mp4');
      const outs = [{ path, kind: 'video', label: task.title + ' — video' }];
      await st.jobUpdate(job.id, { status: 'awaiting_approval', outputs: outs });
      await ownerReview(deps, job, task, outs, job.note);
    } else if (data.status === 'failed' || data.status === 'expired') {
      await fail(deps, job, task, 'video ' + data.status + (data.error ? ': ' + data.error : ''));
    } else if (Date.now() - new Date(job.updated_at).getTime() > 2 * 3600 * 1000) {
      await fail(deps, job, task, 'video still rendering after 2 hours');
    }
  } catch (e) { if (e.status && e.status !== 429) await fail(deps, job, task, e.message); }
}

// One pass of the queue; kept small so it fits the scheduled function's time limit.
export async function runWorkers(deps) {
  if (!key()) return { skipped: 'no XAI_API_KEY' };
  const st = deps.store;
  const done = { images: 0, videosStarted: 0, videosChecked: 0 };
  for (const job of (await st.jobsWhere('worker=eq.grok_video&status=eq.queued')).slice(0, 2)) { await startVideoJob(deps, job); done.videosStarted++; }
  for (const job of (await st.jobsWhere('worker=eq.grok_video&status=eq.running&provider_job_id=not.is.null')).slice(0, 4)) { await pollVideoJob(deps, job); done.videosChecked++; }
  const img = (await st.jobsWhere('worker=eq.grok_image&status=eq.queued'))[0];
  if (img) { await runImageJob(deps, img); done.images++; }
  return done;
}
