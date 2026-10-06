// POST /api/dealer — webhook for the AgenticCore Dealer AI Telegram bot
// (a separate bot from Amaan, token in DEALER_BOT_TOKEN). Requests without
// the secret header (derived from that token, set by dealer-cron when it
// registers the webhook) are refused.

import { handleUpdate } from '../../services/dealer/bot.mjs';
import { makeDealerStore } from '../../services/dealer/store.mjs';
import { makeTelegram, dealerToken, webhookSecret } from '../../services/telegram/tg-api.mjs';
import { storeConfigured } from '../../services/telegram/store.mjs';
import { voiceConfigured, transcribe } from '../../services/telegram/voice.mjs';
import { makePartnerSearch } from '../../services/dealer/sources.mjs';
import crypto from 'node:crypto';

export function makeDealerDeps(fetchImpl) {
  const reveals = Number(process.env.DEALER_REVEALS_PER_DAY);
  return {
    tg: makeTelegram(fetchImpl, dealerToken),
    store: makeDealerStore(fetchImpl),
    partner: makePartnerSearch(fetchImpl),   // null until PARTNER_FEED_URL + PARTNER_FEED_SECRET are set
    voice: { configured: voiceConfigured, transcribe: (bytes, name) => transcribe(bytes, name, fetchImpl) },
    // team alerts: DEALER_OWNER_TELEGRAM_ID if set (Dealer AI only), else the main bot's owner
    ownerId: (process.env.DEALER_OWNER_TELEGRAM_ID || process.env.OWNER_TELEGRAM_ID || '').trim(),
    limits: reveals > 0 ? { reveals } : {}
  };
}

export default async function handler(req, context) {
  const ready = Boolean(dealerToken()) && storeConfigured();
  if (req.method === 'GET') return Response.json({ ok: true, configured: ready });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!ready) return new Response('Not configured', { status: 503 });
  const got = Buffer.from(req.headers.get('x-telegram-bot-api-secret-token') || '');
  const want = Buffer.from(webhookSecret(dealerToken()));
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return new Response('Forbidden', { status: 403 });

  let update;
  try {
    const raw = await req.text();
    if (raw.length > 200000) return new Response('Too large', { status: 413 });
    update = JSON.parse(raw);
  } catch (e) { return new Response('Bad request', { status: 400 }); }
  if (!update || typeof update.update_id !== 'number') return new Response('ok');

  const work = handleUpdate(update, makeDealerDeps()).catch((e) => console.error('[dealer] handler error:', e && e.message));
  if (context && typeof context.waitUntil === 'function') context.waitUntil(work);
  else await work;
  return new Response('ok');
}

export const config = { path: '/api/dealer' };
