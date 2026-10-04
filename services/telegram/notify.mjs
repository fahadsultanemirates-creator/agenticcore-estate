// Scheduled work for the Telegram bot (runs every 10 minutes):
// - keeps the webhook registered (first run after a deploy registers it)
// - new enquiries → the recipient's Telegram
// - listings hidden by review → the owner's Telegram
// - "Still available?" every 30 days per listing, with a one-tap button
// - password reminders before the 30-day freeze (days 23 and 29)
// Each message goes out once (tg_notifications) and only to people who
// connected Telegram and haven't turned notifications off.

import { t } from './strings.mjs';
import { buttons, webhookSecret } from './tg-api.mjs';

const DAY = 24 * 3600 * 1000;
const COMMANDS = [
  { command: 'menu', description: 'Show the menu' },
  { command: 'list', description: 'List a property' },
  { command: 'mylistings', description: 'My listings' },
  { command: 'login', description: 'One-time website sign-in link' },
  { command: 'order', description: 'Order marketing (AgenticCore Pakistan)' },
  { command: 'orders', description: 'My marketing orders' },
  { command: 'help', description: 'Help' },
  { command: 'cancel', description: 'Stop the current step' }
];

export async function ensureWebhook(tg, siteUrl) {
  const want = siteUrl + '/api/telegram';
  const info = await tg.call('getWebhookInfo', {});
  if (info && info.url === want) return { changed: false };
  await tg.call('setWebhook', { url: want, secret_token: webhookSecret(), allowed_updates: ['message', 'callback_query'], max_connections: 20 });
  await tg.call('setMyCommands', { commands: COMMANDS }).catch(() => null);
  return { changed: true };
}

async function linksFor(store, userIds) {
  if (!userIds.length) return {};
  const rows = await store.rest('telegram_links?user_id=in.(' + userIds.join(',') + ')&notify=eq.true&select=user_id,chat_id');
  const map = {};
  (rows || []).forEach((r) => { map[r.user_id] = r.chat_id; });
  return map;
}
async function langOf(store, chatId) {
  const rows = await store.rest('tg_sessions?chat_id=eq.' + Number(chatId) + '&select=lang').catch(() => []);
  return (rows && rows[0] && rows[0].lang) || 'en';
}

export async function runNotifications({ tg, store, siteUrl, now }) {
  const at = now || Date.now();
  const sent = { enquiries: 0, hidden: 0, available: 0, freeze: 0 };
  const iso = (ms) => encodeURIComponent(new Date(ms).toISOString());

  // 1. new enquiries (last 2 days)
  const enq = await store.rest('enquiries?created_at=gt.' + iso(at - 2 * DAY) + '&select=id,recipient_id,target_title,sender_name,message&order=created_at.asc&limit=100');
  const enqLinks = await linksFor(store, [...new Set((enq || []).map((e) => e.recipient_id))]);
  for (const e of enq || []) {
    const chat = enqLinks[e.recipient_id];
    if (!chat || !(await store.markSent('enquiry', e.id, e.recipient_id))) continue;
    const L = await langOf(store, chat);
    await tg.send(chat, t('enquiry', L, { title: e.target_title || 'your listing', name: e.sender_name || 'a buyer', message: String(e.message).slice(0, 500), url: siteUrl + '/my.html' })).catch(() => null);
    sent.enquiries++;
  }

  // 2. listings hidden by review (changed in the last 2 days)
  const hidden = await store.rest('listings?moderation_status=eq.hidden&is_sample=eq.false&updated_at=gt.' + iso(at - 2 * DAY) + '&select=id,owner_id,title,updated_at&limit=100');
  const hidLinks = await linksFor(store, [...new Set((hidden || []).map((l) => l.owner_id))]);
  for (const l of hidden || []) {
    const chat = hidLinks[l.owner_id];
    if (!chat || !(await store.markSent('hidden', l.id + ':' + l.updated_at, l.owner_id))) continue;
    await tg.send(chat, t('listing_hidden', await langOf(store, chat), { title: l.title })).catch(() => null);
    sent.hidden++;
  }

  // 3. "still available?" — listings not confirmed for 30+ days, once per 30-day period
  const stale = await store.rest('listings?moderation_status=eq.active&is_sample=eq.false&or=(last_confirmed_at.is.null,last_confirmed_at.lt.' + iso(at - 30 * DAY) + ')&created_at=lt.' + iso(at - 30 * DAY) + '&select=id,owner_id,title&limit=200');
  const staleLinks = await linksFor(store, [...new Set((stale || []).map((l) => l.owner_id))]);
  const period = Math.floor(at / (30 * DAY));
  for (const l of stale || []) {
    const chat = staleLinks[l.owner_id];
    if (!chat || !(await store.markSent('available', l.id + ':' + period, l.owner_id))) continue;
    const L = await langOf(store, chat);
    await tg.send(chat, t('avail_ask', L, { title: l.title }), buttons([[[t('btn_still_available', L), 'av:' + l.id]]])).catch(() => null);
    sent.available++;
  }

  // 4. password reminders for Telegram-created accounts (day 23 and day 29)
  const fresh = await store.rest('profiles?created_via=eq.telegram&password_set_at=is.null&created_at=gt.' + iso(at - 30 * DAY) + '&created_at=lt.' + iso(at - 23 * DAY) + '&select=id,member_no,created_at&limit=200');
  const frLinks = await linksFor(store, (fresh || []).map((p) => p.id));
  for (const p of fresh || []) {
    const chat = frLinks[p.id];
    if (!chat) continue;
    const age = (at - new Date(p.created_at).getTime()) / DAY;
    const step = age >= 29 ? 'd29' : 'd23';
    if (!(await store.markSent('freeze', p.id + ':' + step, p.id))) continue;
    const L = await langOf(store, chat);
    await tg.send(chat, t('freeze_warning', L, { days: Math.max(1, Math.ceil(30 - age)) }), buttons([[[t('btn_login', L), 'm:login']]])).catch(() => null);
    sent.freeze++;
  }

  // housekeeping
  await store.rest('tg_seen_updates?seen_at=lt.' + iso(at - 3 * DAY), { method: 'DELETE' }).catch(() => null);
  await store.rest('tg_link_tokens?expires_at=lt.' + iso(at - DAY), { method: 'DELETE' }).catch(() => null);
  return sent;
}

