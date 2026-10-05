// Scheduled every 10 minutes: keeps the Dealer AI webhook registered, runs
// the 24-hour request deadlines and the 30-day entry expiry.
// Does nothing until DEALER_BOT_TOKEN is set in Netlify.

import { makeTelegram, dealerToken } from '../../services/telegram/tg-api.mjs';
import { storeConfigured } from '../../services/telegram/store.mjs';
import { makeDealerStore } from '../../services/dealer/store.mjs';
import { ensureDealerWebhook, runDealerJobs } from '../../services/dealer/cron.mjs';

const SITE = 'https://agenticcore.estate';

export default async function handler() {
  if (!dealerToken() || !storeConfigured()) {
    console.warn('[dealer-cron] not configured (DEALER_BOT_TOKEN / SUPABASE_SERVICE_ROLE_KEY)');
    return;
  }
  const tg = makeTelegram(undefined, dealerToken);
  try {
    const w = await ensureDealerWebhook(tg, SITE);
    if (w.changed) console.log('[dealer-cron] webhook registered');
  } catch (e) { console.error('[dealer-cron] webhook check failed:', e && e.message); }
  try {
    console.log('[dealer-cron]', JSON.stringify(await runDealerJobs({ tg, store: makeDealerStore() })));
  } catch (e) { console.error('[dealer-cron] jobs failed:', e && e.message); }
}

export const config = { schedule: '*/10 * * * *' };
