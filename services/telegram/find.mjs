// Phase 3 — finding property in Telegram ("I want a house in Bahria Town
// Phase 3"). OFF until BOT_PROPERTY_SEARCH=on is set in Netlify: the access
// process (who may search, any fee) is still to be agreed, so the gate lives
// in one place — searchAccess() — and is easy to change.
//
// When on: AgenticCore account required (not paused), daily limit, genuine
// listings only (Copilot's deterministic search), and enquiries go through
// send_enquiry() as the person (all its rules: no samples, rate limits).

import { t } from './strings.mjs';
import { buttons } from './tg-api.mjs';
import { formatPKR } from '../util.mjs';
import { isLaunched } from '../places.mjs';

export const FIND_LIMITS = { searchesPerDay: 15, enquiriesPerDay: 10 };
export function searchEnabled() { return String(process.env.BOT_PROPERTY_SEARCH || '').trim().toLowerCase() === 'on'; }

// Buyer/renter wording plus a property word; listing words ("sell", "rent out") are excluded.
const WANT = /\b(want|need|looking for|find|search|show me|buy|chahiye|chahie|dhoond\w*|talaash|khareed\w*|kiraye? par chahiye|rent a|for rent)\b|چاہیے|تلاش|خریدنا|ڈھونڈ/i;
const THING = /\b(house|home|flat|apartment|plot|portion|room|shop|office|villa|ghar|makan|marla|kanal)\b|گھر|مکان|فلیٹ|پلاٹ|مرلہ|کنال|دکان/i;
const SELLING = /\b(sell|selling|bechna|bechni|farokht|rent out|kiraye? (par|pe) (dena|deni)|list (my|a))\b|بیچنا|فروخت/i;
export function looksLikeSearch(text) { return WANT.test(text) && THING.test(text) && !SELLING.test(text); }

// The single access rule for Phase 3 (extend here: paid plan, verified buyers…).
export async function searchAccess(ctx) {
  if (!searchEnabled()) return { ok: false, key: 'find_off' };
  if (!(await ctx.requireActive())) return { ok: false, handled: true };
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  if ((await ctx.deps.store.countActivity(ctx.account.id, 'property_search', since)) >= FIND_LIMITS.searchesPerDay) return { ok: false, key: 'find_limit' };
  return { ok: true };
}

export async function findProperty(ctx, text) {
  const access = await searchAccess(ctx);
  if (!access.ok) { if (!access.handled) await ctx.say(access.key, {}, buttons([[['agenticcore.estate', ctx.deps.siteUrl + '/properties.html']]])); return; }
  const res = (await ctx.deps.find(text)) || {};
  const rows = ((res.matches && res.matches.length ? res.matches : res.closest) || []).slice(0, 5);
  await ctx.log('property_search', { q: String(text).slice(0, 120), results: rows.length }, null);
  if (!rows.length) return ctx.say('find_none');
  await ctx.say('find_results', { n: rows.length });
  for (const l of rows) {
    const line = l.title + '\n' + (l.price_text || formatPKR(l.price)) + ' · ' + [l.area, l.city].filter(Boolean).join(', ') +
      ((l.differences || []).length ? '\n(' + l.differences.slice(0, 2).join('; ') + ')' : '') + '\n' + ctx.deps.siteUrl + '/listing.html?id=' + l.id;
    await ctx.raw(line, buttons([[[t('btn_enquire', ctx.lang), 'q:' + l.id]]]));
  }
}

export async function startEnquiry(ctx, listingId) {
  if (!searchEnabled() || !(await ctx.requireActive())) return;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  if ((await ctx.deps.store.countActivity(ctx.account.id, 'enquiry_sent', since)) >= FIND_LIMITS.enquiriesPerDay) return ctx.say('find_limit');
  const rows = await ctx.deps.store.rest('listings?id=eq.' + listingId + '&is_sample=eq.false&moderation_status=eq.active&select=id,title,city');
  if (!rows || !rows[0] || (rows[0].city && !isLaunched(rows[0].city))) return ctx.say('find_none');
  ctx.session.state = { rl: ctx.session.state.rl, flow: 'enquiry', listing: listingId, title: rows[0].title };
  return ctx.say('enquire_ask', { title: rows[0].title });
}

export async function sendEnquiry(ctx, text) {
  const s = ctx.session.state;
  ctx.session.state = { rl: s.rl };
  const msg = String(text || '').trim().slice(0, 2000);
  if (msg.length < 2) return ctx.say('pk_failed', { reason: 'empty message' });
  try { await ctx.deps.store.rpc('send_enquiry_as', { p_sender: ctx.account.id, p_type: 'listing', p_id: s.listing, p_message: msg }); }
  catch (e) { return ctx.say('pk_failed', { reason: String(e.message || 'error').slice(0, 200) }); }
  await ctx.log('enquiry_sent', { listing: s.listing }, 'Enquiry sent from Telegram by AC-' + ctx.account.member_no + ' on "' + s.title + '".');
  return ctx.say('enquiry_sent');
}
