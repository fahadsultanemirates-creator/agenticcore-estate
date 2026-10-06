// AgenticCore Dealer AI — scheduled work (every 10 minutes):
//  * keep the bot's webhook registered;
//  * 24-hour requests at their deadline: results recap, or an honest
//    "no match yet" with Keep 7 days / Change search / Close;
//  * requests nobody answered for 3 days → expired;
//  * entries: a reminder 2 days before the 30 days end, then expired.

import { t } from './strings.mjs';
import { buttons, webhookSecret, dealerToken } from '../telegram/tg-api.mjs';
import { choiceButtons } from './bot.mjs';

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const dateText = (v, lang) => new Date(v).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });

export const DEALER_COMMANDS = [
  { command: 'start', description: 'Menu' },
  { command: 'post', description: 'Post a property (sale / rent)' },
  { command: 'search', description: 'Search entries' },
  { command: 'mine', description: 'My entries' },
  { command: 'requests', description: 'My requests' },
  { command: 'language', description: 'English / اردو / Roman Urdu' },
  { command: 'help', description: 'Help' },
  { command: 'cancel', description: 'Stop the current step' }
];

export async function ensureDealerWebhook(tg, siteUrl) {
  const want = siteUrl + '/api/dealer';
  const info = await tg.call('getWebhookInfo', {});
  if (info && info.url === want) { await tg.call('setMyCommands', { commands: DEALER_COMMANDS }).catch(() => null); return { changed: false }; }
  await tg.call('setWebhook', { url: want, secret_token: webhookSecret(dealerToken()), allowed_updates: ['message', 'callback_query'], max_connections: 20 });
  await tg.call('setMyCommands', { commands: DEALER_COMMANDS }).catch(() => null);
  return { changed: true };
}

export async function runDealerJobs({ tg, store, now }) {
  const at = now || Date.now();
  const out = { deadlines: 0, expired_requests: 0, reminders: 0, expired_entries: 0 };
  const accountsFor = async (rows) => new Map(((await store.accountsByIds([...new Set(rows.map((r) => r.account_id))])) || []).map((a) => [a.id, a]));
  const tell = (acc, text, extra) => (acc && acc.status === 'active' ? tg.send(acc.chat_id, text, extra).catch(() => null) : null);

  // 1. requests at their deadline
  const due = (await store.dueRequests(at)) || [];
  const dueAcc = await accountsFor(due);
  for (const r of due) {
    const acc = dueAcc.get(r.account_id), L = (acc && acc.lang) || 'en';
    const n = await store.matchCount(r.id);
    const first = new Date(r.deadline_at).getTime() - new Date(r.created_at).getTime() <= 25 * 3600000;
    const key = !first ? 'week_over' : (n > 0 ? 'deadline_found' : 'deadline_none');
    await store.updateRequest(r.id, { status: 'waiting_choice', active_until: iso(at + 3 * DAY) });
    await tell(acc, t(L, key, { ref: r.ref, q: r.query.slice(0, 80), n }), choiceButtons(L, r.id));
    out.deadlines++;
  }
  // 2. no answer for 3 days
  for (const r of (await store.staleWaiting(at)) || []) { await store.updateRequest(r.id, { status: 'expired' }); out.expired_requests++; }

  // 3. entries ending within 2 days
  const soon = (await store.expiringSoon(at, 2 * DAY)) || [];
  const soonAcc = await accountsFor(soon);
  for (const l of soon) {
    const acc = soonAcc.get(l.account_id), L = (acc && acc.lang) || 'en';
    await store.setListing(l.id, { expiry_notified_at: iso(at) });
    await tell(acc, t(L, 'expiry_soon', { ref: l.ref, d: dateText(l.expires_at, L) }), buttons([[[t(L, 'btn_renew'), 'mg:renew:' + l.id]]]));
    out.reminders++;
  }
  // 4. entries past 30 days
  const gone = (await store.expiredNow(at)) || [];
  const goneAcc = await accountsFor(gone);
  for (const l of gone) {
    const acc = goneAcc.get(l.account_id), L = (acc && acc.lang) || 'en';
    await store.setListing(l.id, { status: 'expired' });
    await tell(acc, t(L, 'expired_now', { ref: l.ref }), buttons([[[t(L, 'btn_renew'), 'mg:renew:' + l.id], [t(L, 'btn_remove'), 'mg:rm:' + l.id]]]));
    out.expired_entries++;
  }
  await store.cleanSeen(at).catch(() => null);
  return out;
}
