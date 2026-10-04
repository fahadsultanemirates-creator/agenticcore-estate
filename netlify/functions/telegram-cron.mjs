// Scheduled every 10 minutes: keeps the Telegram webhook registered and
// sends the bot's reminders and alerts (see services/telegram/notify.mjs).
// Scheduled functions only run on the published production deploy.

import { makeTelegram, botConfigured } from '../../services/telegram/tg-api.mjs';
import { makeStore, storeConfigured } from '../../services/telegram/store.mjs';
import { ensureWebhook, runNotifications } from '../../services/telegram/notify.mjs';
import { runWorkers } from '../../services/telegram/workers.mjs';
import { flushClientNotes } from '../../services/telegram/pk-orders.mjs';

const SITE = 'https://agenticcore.estate';

export default async function handler() {
  if (!botConfigured() || !storeConfigured()) {
    console.warn('[telegram-cron] not configured (TELEGRAM_BOT_TOKEN / SUPABASE_SERVICE_ROLE_KEY)');
    return;
  }
  const tg = makeTelegram();
  const store = makeStore();
  try {
    const w = await ensureWebhook(tg, SITE);
    if (w.changed) console.log('[telegram-cron] webhook registered');
  } catch (e) { console.error('[telegram-cron] webhook check failed:', e && e.message); }
  try {
    const sent = await runNotifications({ tg, store, siteUrl: SITE });
    console.log('[telegram-cron] sent', JSON.stringify(sent));
  } catch (e) { console.error('[telegram-cron] notifications failed:', e && e.message); }
  // Phase 2: dashboard notifications queued for Telegram, then the Grok workers
  const deps = { tg, store, ownerId: (process.env.OWNER_TELEGRAM_ID || '').trim(), siteUrl: SITE };
  try { await flushClientNotes(deps); } catch (e) { console.error('[telegram-cron] order updates failed:', e && e.message); }
  try { console.log('[telegram-cron] workers', JSON.stringify(await runWorkers(deps))); } catch (e) { console.error('[telegram-cron] workers failed:', e && e.message); }
}

export const config = { schedule: '*/10 * * * *' };
