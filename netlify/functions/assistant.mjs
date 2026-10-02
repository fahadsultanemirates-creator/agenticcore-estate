// POST /api/assistant — the AgenticCore AI Assistant and Amaan (property assistant).
// Used by agenticcore.estate and agenticcorepk.com (cross-site requests are
// allowed for those two sites only). Body (JSON, max 12 KB):
//   { bot: 'guide'|'amaan', site: 'estate'|'pk', ui_lang, lang, messages: [{role, text}],
//     mode, asked, notes, quick }
// No conversation text is stored or logged. When Claude is unavailable, slow
// or over the daily cap, answers come from the deterministic path.

import { handleTurn } from '../../services/assistant-service.mjs';
import { claudeJSON, claudeAvailable } from '../../services/claude.mjs';
import { findProperty } from '../../services/copilot-service.mjs';
import { getAreaNames } from '../../services/supabase.mjs';

const ORIGINS = ['https://agenticcore.estate', 'https://www.agenticcore.estate', 'https://agenticcorepk.com', 'https://www.agenticcorepk.com', 'https://agenticcorepk.netlify.app'];
const hits = new Map();   // best-effort per-instance limiter: key -> [timestamps]
let day = '', aiToday = 0;

function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}
function aiBudgetLeft() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; aiToday = 0; }
  return aiToday < (Number(process.env.ASSISTANT_DAILY_AI_CAP) || 1000);
}

function headers(origin) {
  const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (ORIGINS.indexOf(origin) >= 0) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '600';
    h.Vary = 'Origin';
  }
  return h;
}
function json(status, body, origin) { return new Response(JSON.stringify(body), { status, headers: headers(origin) }); }

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method === 'GET') return json(200, { ok: true, ai: claudeAvailable() }, origin);
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' }, origin);
  // Cross-site calls only from the two AgenticCore sites.
  if (origin && ORIGINS.indexOf(origin) < 0 && origin !== new URL(req.url).origin) return json(403, { error: 'Not allowed.' }, origin);

  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  if (limited('turn:' + ip, 30, 10 * 60 * 1000)) return json(429, { error: 'rate_limited' }, origin);

  let body;
  try {
    const raw = await req.text();
    if (raw.length > 12000) return json(413, { error: 'too_large' }, origin);
    body = JSON.parse(raw || '{}');
  } catch (e) { return json(400, { error: 'bad_request' }, origin); }

  const allowAI = claudeAvailable() && aiBudgetLeft() && !limited('ai:' + ip, 60, 24 * 60 * 60 * 1000);
  try {
    const areaNames = await getAreaNames().catch(() => []);
    const out = await handleTurn(body, {
      allowAI,
      areaNames,
      ai: async (opts) => { aiToday += 1; return claudeJSON(opts); },
      find: (text) => findProperty(text, { ai: false })
    });
    delete out.ai_reason;   // internal
    return json(200, out, origin);
  } catch (e) {
    console.error('[assistant] turn failed:', e && e.name);
    return json(502, { error: 'unavailable' }, origin);
  }
}

export const config = { path: '/api/assistant' };
