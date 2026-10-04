// POST /api/assistant — the AgenticCore AI Assistant and Amaan (property assistant).
// Used by agenticcore.estate and agenticcorepk.com (cross-site requests are
// allowed for those two sites only). Body (JSON, max 12 KB):
//   { bot: 'guide'|'amaan', site: 'estate'|'pk', ui_lang, lang, messages: [{role, text}],
//     lang_choice, mode, asked, notes, quick }
// No conversation text is stored or logged. When Claude is unavailable, slow
// or over the daily cap, answers come from the deterministic path.

import { handleTurn } from '../../services/assistant-service.mjs';
import { claudeJSON, claudeAvailable } from '../../services/claude.mjs';
import { findProperty } from '../../services/copilot-service.mjs';
import { getAreaNames, getKnownPlaces } from '../../services/supabase.mjs';
import { refreshPlaces } from '../../services/memory.mjs';
import { getUserFromToken } from '../../services/supabase.mjs';
import { handleHandoff } from '../../services/amaan-handoff.mjs';
import { getCatalog } from '../../services/pk-catalog.mjs';
import { makeStore, storeConfigured } from '../../services/telegram/store.mjs';
import { makeTelegram, botConfigured } from '../../services/telegram/tg-api.mjs';

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
    h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
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
    if (raw.length > 16000) return json(413, { error: 'too_large' }, origin);
    body = JSON.parse(raw || '{}');
  } catch (e) { return json(400, { error: 'bad_request' }, origin); }

  // Amaan → "Send to the AgenticCore team": signed-in people only; files must be in their own folder.
  if (body && body.action === 'handoff') {
    if (limited('handoff:' + ip, 10, 60 * 60 * 1000)) return json(429, { error: 'limit' }, origin);
    if (!storeConfigured() || !botConfigured()) return json(503, { error: 'unavailable' }, origin);
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const user = token ? await getUserFromToken(token) : null;
    if (!user) return json(401, { error: 'sign_in' }, origin);
    try {
      const out = await handleHandoff(body, { userId: user.id, store: makeStore(), tg: makeTelegram(), ownerId: (process.env.OWNER_TELEGRAM_ID || '').trim() });
      return json(out.status, out.body, origin);
    } catch (e) {
      console.error('[assistant] handoff failed:', e && e.message);
      return json(502, { error: 'unavailable' }, origin);
    }
  }

  const allowAI = claudeAvailable() && aiBudgetLeft() && !limited('ai:' + ip, 60, 24 * 60 * 60 * 1000);
  try {
    const [areaNames, , catalog] = await Promise.all([getAreaNames().catch(() => []), refreshPlaces(getKnownPlaces), getCatalog()]);
    const out = await handleTurn(body, {
      allowAI,
      areaNames,
      catalog,
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
