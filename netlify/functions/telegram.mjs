// POST /api/telegram — webhook for the AgenticCore Telegram bot.
// Telegram calls this for every message/button press. Requests without the
// secret header (derived from the bot token, set when the webhook is
// registered by telegram-cron) are refused. Replies are sent back through
// the Bot API; this endpoint itself only answers 200 so Telegram doesn't retry.

import { handleUpdate } from '../../services/telegram/bot.mjs';
import { makeTelegram, botConfigured, webhookSecret } from '../../services/telegram/tg-api.mjs';
import { makeStore, storeConfigured } from '../../services/telegram/store.mjs';
import { voiceConfigured, transcribe } from '../../services/telegram/voice.mjs';
import { getCatalog } from '../../services/pk-catalog.mjs';
import { handleTurn } from '../../services/assistant-service.mjs';
import { claudeJSON, claudeAvailable } from '../../services/claude.mjs';
import { getAreaNames } from '../../services/supabase.mjs';
import { findProperty } from '../../services/copilot-service.mjs';
import quality from '../../listing-quality.js';
import { refreshPlaces } from '../../services/memory.mjs';
import crypto from 'node:crypto';

const SITE = 'https://agenticcore.estate';

export function makeDeps(fetchImpl) {
  const store = makeStore(fetchImpl);
  return {
    tg: makeTelegram(fetchImpl),
    store,
    refreshPlaces: () => refreshPlaces(() => store.rpc('kb_known_places')),
    voice: { configured: voiceConfigured, transcribe: (bytes, name) => transcribe(bytes, name, fetchImpl) },
    assistant: {
      handleTurn,
      areaNames: () => getAreaNames().catch(() => []),
      catalog: () => getCatalog({ fetchImpl }),
      guideDeps: () => ({ allowAI: claudeAvailable(), ai: (opts) => claudeJSON(Object.assign({}, opts, { timeoutMs: 6000 })), areaNames: [] })
    },
    quality,
    find: (text) => findProperty(text, { ai: false }),
    ownerId: (process.env.OWNER_TELEGRAM_ID || '').trim(),
    siteUrl: SITE
  };
}

export default async function handler(req, context) {
  if (req.method === 'GET') return Response.json({ ok: true, configured: botConfigured() && storeConfigured() });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!botConfigured() || !storeConfigured()) return new Response('Not configured', { status: 503 });
  const got = Buffer.from(req.headers.get('x-telegram-bot-api-secret-token') || '');
  const want = Buffer.from(webhookSecret());
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return new Response('Forbidden', { status: 403 });

  let update;
  try {
    const raw = await req.text();
    if (raw.length > 200000) return new Response('Too large', { status: 413 });
    update = JSON.parse(raw);
  } catch (e) { return new Response('Bad request', { status: 400 }); }
  if (!update || typeof update.update_id !== 'number') return new Response('ok');

  const work = handleUpdate(update, makeDeps()).catch((e) => console.error('[telegram] handler error:', e && e.message));
  // Answer Telegram straight away and finish the work in the background when
  // the platform supports it; otherwise wait for it.
  if (context && typeof context.waitUntil === 'function') context.waitUntil(work);
  else await work;
  return new Response('ok');
}

export const config = { path: '/api/telegram' };
