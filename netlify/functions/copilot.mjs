// POST /api/copilot — AgenticCore Property Copilot HTTP endpoint.
// Body: { action: 'find' | 'draft' | 'improve' | 'status', text?, listing_id?, with_ai? }
// 'find' is public; 'draft' and 'improve' need a Supabase access token in
// the Authorization header and are metered per user per day.

import { findProperty, assistListing, improveListing } from '../../services/copilot-service.mjs';
import { getUserFromToken, aiUsageToday, recordAiUsage } from '../../services/supabase.mjs';
import { aiAvailable, pickProvider } from '../../services/ai.mjs';

const DAILY_AI_LIMIT = Number(process.env.AI_DAILY_LIMIT || 15);
const hits = new Map(); // best-effort per-instance limiter: key -> [timestamps]

function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default async function handler(req, context) {
  if (req.method === 'GET') return json(200, { ok: true, ai: aiAvailable('parse') || aiAvailable('draft') });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 4000) return json(413, { error: 'Request too large.' });
    body = JSON.parse(raw || '{}');
  } catch (e) { return json(400, { error: 'Invalid request.' }); }
  const action = body.action;

  try {
    if (action === 'find') {
      if (limited('find:' + ip, 30, 10 * 60 * 1000)) return json(429, { error: 'Too many searches — please wait a few minutes.' });
      const out = await findProperty(body.text);
      return json(out.error ? 400 : 200, out);
    }

    if (action === 'draft' || action === 'improve') {
      const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const user = await getUserFromToken(token);
      if (!user) return json(401, { error: 'Please log in to use the listing assistant.' });
      if (limited('ai:' + user.id, 10, 10 * 60 * 1000) || limited('ai-ip:' + ip, 20, 10 * 60 * 1000)) {
        return json(429, { error: 'You have used the assistant a lot in the last few minutes — please try again shortly.' });
      }
      const wantsAI = action === 'draft' ? aiAvailable('draft') : (body.with_ai && aiAvailable('improve'));
      if (wantsAI) {
        const used = await aiUsageToday(token);
        if (used !== null && used >= DAILY_AI_LIMIT) {
          return json(429, { error: 'You have reached today\'s free AI limit (' + DAILY_AI_LIMIT + '). The listing form and quality score still work; AI help resets tomorrow.' });
        }
      }
      const out = action === 'draft'
        ? await assistListing(body.text)
        : await improveListing(body.listing_id, user.id, token, Boolean(wantsAI));
      if (out.error) return json(out.status || 400, { error: out.error });
      const provider = out.ai_used || (out.wording && out.wording.provider) || null;
      if (provider) await recordAiUsage(token, user.id, action, provider);
      return json(200, out);
    }

    if (action === 'status') return json(200, { ai: Boolean(pickProvider('draft') || pickProvider('parse')), daily_limit: DAILY_AI_LIMIT });
    return json(400, { error: 'Unknown action.' });
  } catch (e) {
    console.error('[copilot]', action, e && e.message);
    return json(502, { error: 'AgenticCore could not complete that right now. Normal search and the listing form still work.' });
  }
}

export const config = { path: '/api/copilot' };
