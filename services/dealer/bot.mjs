// AgenticCore Dealer AI — the Telegram bot (text + voice notes in, text out).
//
// Owners and dealers post digital listings (no photos); buyers type what
// they need. No match → the request waits 24 hours: new entries are matched
// automatically, the AgenticCore team is told so it can source options, and
// at the deadline the buyer gets an honest update.
// Nothing here is shown on the website. Every result says "User-submitted,
// not verified"; contact numbers are shown one at a time, with a daily limit.
//
// deps: { tg, store (dealer store), voice:{configured, transcribe}, ownerId, now(), limits }

import { t } from './strings.mjs';
import { buttons, contactKeyboard, removeKeyboard } from '../telegram/tg-api.mjs';
import { detectLang } from '../assistant-service.mjs';
import { parseCriteria } from '../criteria.mjs';
import {
  FEED_TYPES, BUILT, LISTING_DAYS, REQUEST_HOURS, KEEP_DAYS, normaliseText, guessIntent, parseSize, parsePrice, parseCount, normPhone,
  matchCity, draftFromText, nextListingStep, listingRow, hasContactInfo, parseQuery, queryUsable, matches, makeRef, card, typeLabel,
  describeQuery, requestQuery
} from './feed.mjs';
import { searchAll, resultKey, MAX_RESULTS } from './sources.mjs';

export const DEFAULT_LIMITS = { reveals: 10, listingsPerDay: 20, msgsPer10Min: 30, openRequests: 5, results: 3 };
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const dateText = (v, lang) => new Date(v).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });

// ---------- entry ----------
export async function handleUpdate(update, deps) {
  if (!update || typeof update.update_id !== 'number') return;
  if (!(await deps.store.firstSeen(update.update_id))) return;     // Telegram retries
  const msg = update.message || (update.callback_query && update.callback_query.message);
  const from = update.message ? update.message.from : (update.callback_query && update.callback_query.from);
  if (!msg || !from || !msg.chat || msg.chat.type !== 'private') return;

  const ctx = await loadCtx(msg.chat.id, from, deps);
  try {
    if (update.callback_query) await onCallback(ctx, update.callback_query);
    else await onMessage(ctx, update.message);
  } catch (e) {
    // never leave someone waiting in silence: say sorry, tell the team what broke
    console.error('[dealer] update failed:', e && e.message);
    await ctx.say('save_failed').catch(() => null);
    if (deps.ownerId) await deps.tg.send(deps.ownerId, '⚠️ Dealer AI error: ' + String((e && e.message) || e).slice(0, 200)).catch(() => null);
  } finally {
    await deps.store.saveSession(ctx.chatId, ctx.state, ctx.lang).catch(() => null);
  }
}

async function loadCtx(chatId, from, deps) {
  const [session, account] = await Promise.all([deps.store.getSession(chatId), deps.store.accountByTg(from.id)]);
  const limits = Object.assign({}, DEFAULT_LIMITS, deps.limits || {});
  const ctx = {
    deps, chatId, from, account, limits,
    state: (session && session.state) || {},
    lang: (account && account.lang) || (session && session.lang) || null,
    now: () => (deps.now ? deps.now() : Date.now())
  };
  ctx.L = () => ctx.lang || 'en';
  ctx.say = (key, vars, extra) => deps.tg.send(chatId, t(ctx.L(), key, vars), extra);
  ctx.send = (text, extra) => deps.tg.send(chatId, text, extra);
  ctx.isOwner = Boolean(deps.ownerId) && String(from.id) === String(deps.ownerId);
  return ctx;
}

// ---------- caches (cities / areas change rarely) ----------
let places = { at: 0, cities: [], main: [], areas: [] };
async function placeLists(ctx) {
  if (Date.now() - places.at < 10 * 60 * 1000 && places.cities.length) return places;
  const [cities, areas] = await Promise.all([ctx.deps.store.cities().catch(() => []), ctx.deps.store.areaNames().catch(() => [])]);
  places = { at: Date.now(), cities: cities.map((c) => c.name), main: cities.filter((c) => c.main).map((c) => c.name), areas };
  return places;
}
export function resetPlaceCache() { places = { at: 0, cities: [], main: [], areas: [] }; }

// ---------- messages ----------
function overLimit(ctx) {
  const now = ctx.now();
  const rl = ctx.state.rl && now - ctx.state.rl.at < 10 * 60 * 1000 ? ctx.state.rl : { at: now, n: 0 };
  rl.n += 1;
  ctx.state.rl = rl;
  return rl.n > ctx.limits.msgsPer10Min;
}

async function onMessage(ctx, msg) {
  if (ctx.account && ctx.account.status === 'blocked') return ctx.say('blocked_account');
  if (overLimit(ctx)) {
    if (!ctx.state.rl.warned) { ctx.state.rl.warned = true; return ctx.say('slow_down'); }
    return;
  }
  if (msg.contact) return onContact(ctx, msg.contact);
  if (msg.photo || msg.video || msg.document || msg.animation || msg.video_note) return ctx.say('no_photos');

  let text = typeof msg.text === 'string' ? msg.text.trim() : '';
  if (msg.voice || msg.audio) {
    if (!ctx.deps.voice || !ctx.deps.voice.configured()) return ctx.say('voice_off');
    try {
      const file = await ctx.deps.tg.download((msg.voice || msg.audio).file_id, 10 * 1024 * 1024);
      text = String(await ctx.deps.voice.transcribe(file.bytes, 'voice.ogg') || '').trim();
    } catch (e) { text = ''; }
    if (!text) return ctx.say('voice_fail');
    if (!ctx.lang) ctx.lang = detectLang(text, 'ro');
    await ctx.say('heard', { text: text.slice(0, 300) });
  }
  if (!text) return ctx.say('unknown');
  text = text.slice(0, 1000);

  const cmd = (text.match(/^\/([a-z_]+)/i) || [])[1];
  if (cmd) return onCommand(ctx, cmd.toLowerCase());

  if (!ctx.account) return onRegistrationText(ctx, text);

  const st = ctx.state;
  if (st.step === 'listing' && st.field) return onListingAnswer(ctx, text);
  if (st.step === 's_query') { ctx.state = {}; return doSearch(ctx, text); }
  if (st.step === 'rename') {
    const name = text.replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 80 || /\d{4,}|https?:|@/.test(name)) return ctx.say('bad_name');
    await ctx.deps.store.updateAccount(ctx.account.id, { name });
    ctx.account.name = name;
    ctx.state = {};
    return ctx.say('name_changed', { name });
  }

  // free text: a listing or a search?
  const guess = guessIntent(text);
  if (guess === 'search' || (!guess && ctx.account.role === 'buyer' && !/\b(for sale|demand)\b/i.test(text))) return doSearch(ctx, text);
  if (guess === 'listing' && ctx.account.role !== 'buyer') return startListing(ctx, text);
  ctx.state = { pending: text.slice(0, 600) };
  return ctx.say('which_intent', null, buttons([[[t(ctx.L(), 'btn_add'), 'it:post'], [t(ctx.L(), 'btn_search'), 'it:search']]]));
}

async function onCommand(ctx, cmd) {
  if (cmd === 'start') {
    ctx.state = {};
    if (!ctx.account) return chooseLanguage(ctx);
    return sendMenu(ctx);
  }
  if (cmd === 'language') return chooseLanguage(ctx);
  if (!ctx.account) return chooseLanguage(ctx);
  if (cmd === 'cancel') { ctx.state = {}; await ctx.say('cancelled'); return sendMenu(ctx); }
  if (cmd === 'help') return ctx.say('help', { limit: revealLimit(ctx) });
  if (cmd === 'post' || cmd === 'new') return startListing(ctx);
  if (cmd === 'search') { ctx.state = { step: 's_query' }; return ctx.say('s_start'); }
  if (cmd === 'mine') return showMine(ctx);
  if (cmd === 'name') { ctx.state = { step: 'rename' }; return ctx.say('ask_new_name', { name: ctx.account.name }); }
  if (cmd === 'requests') return showRequests(ctx);
  if (cmd === 'stats' && ctx.isOwner) {
    const s = await ctx.deps.store.stats();
    return ctx.send('Dealer AI\nActive accounts: ' + s.accounts + '\nLive entries: ' + s.live + '\nOpen requests: ' + s.open);
  }
  return sendMenu(ctx);
}

function sendMenu(ctx) {
  const L = ctx.L();
  return ctx.say('menu', null, buttons([
    [[t(L, 'btn_add'), 'm:add'], [t(L, 'btn_search'), 'm:search']],
    [[t(L, 'btn_mine'), 'm:mine'], [t(L, 'btn_reqs'), 'm:reqs']],
    [[t(L, 'btn_help'), 'm:help'], [t(L, 'btn_lang'), 'm:lang']]
  ]));
}
function chooseLanguage(ctx) {
  return ctx.deps.tg.send(ctx.chatId, t(ctx.lang || 'ro', 'choose_lang'), buttons([[['English', 'lang:en'], ['اردو', 'lang:ur'], ['Roman Urdu', 'lang:ro']]]));
}
function revealLimit(ctx) {
  return ctx.account && ctx.account.reveal_limit != null ? ctx.account.reveal_limit : ctx.limits.reveals;
}

// ---------- registration ----------
async function onRegistrationText(ctx, text) {
  const st = ctx.state;
  if (st.step === 'reg_name') {
    const name = text.replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 80 || /\d{4,}|https?:|@/.test(name)) return ctx.say('bad_name');
    ctx.state = { step: 'reg_contact', name };
    return ctx.say('ask_contact', { name }, contactKeyboard(t(ctx.L(), 'contact_btn')));
  }
  if (st.step === 'reg_contact') return ctx.say('ask_contact', { name: st.name }, contactKeyboard(t(ctx.L(), 'contact_btn')));
  if (st.step === 'reg_role') return askRole(ctx);
  if (!ctx.lang) ctx.lang = detectLang(text, 'ro');
  return chooseLanguage(ctx);
}

async function onContact(ctx, contact) {
  if (ctx.account) return sendMenu(ctx);
  if (ctx.state.step !== 'reg_contact') return chooseLanguage(ctx);
  // Telegram fills user_id only when people share their own number with the button
  if (!contact.user_id || Number(contact.user_id) !== Number(ctx.from.id)) {
    return ctx.say('contact_not_own', null, contactKeyboard(t(ctx.L(), 'contact_btn')));
  }
  const phone = normPhone(contact.phone_number);
  if (!phone || phone.length < 8) return ctx.say('contact_not_own', null, contactKeyboard(t(ctx.L(), 'contact_btn')));
  ctx.state = { step: 'reg_role', name: ctx.state.name, phone };
  await ctx.deps.tg.send(ctx.chatId, '✓', removeKeyboard());
  return askRole(ctx);
}
function askRole(ctx) {
  const L = ctx.L();
  return ctx.say('ask_role', null, buttons([[[t(L, 'role_owner'), 'role:owner'], [t(L, 'role_dealer'), 'role:dealer'], [t(L, 'role_buyer'), 'role:buyer']]]));
}
async function finishRegistration(ctx, role) {
  const st = ctx.state;
  if (ctx.account) return sendMenu(ctx);
  if (st.step !== 'reg_role' || !st.phone || !st.name) return chooseLanguage(ctx);
  let acc;
  try {
    acc = await ctx.deps.store.createAccount({ tg_user_id: ctx.from.id, chat_id: ctx.chatId, name: st.name, phone: st.phone, role, lang: ctx.L() });
  } catch (e) {
    if (e && (e.status === 409 || e.code === '23505')) { ctx.state = {}; return ctx.say('phone_taken'); }
    throw e;
  }
  ctx.account = acc;
  ctx.state = {};
  await ctx.say('registered', { name: st.name });
  return sendMenu(ctx);
}

// ---------- listing ----------
async function startListing(ctx, text) {
  const since = iso(ctx.now() - DAY);
  if ((await ctx.deps.store.countListingsSince(ctx.account.id, since)) >= ctx.limits.listingsPerDay) {
    ctx.state = {};
    return ctx.say('listing_cap', { n: ctx.limits.listingsPerDay });
  }
  const p = await placeLists(ctx);
  const draft = text ? draftFromText(text, p.areas, p.cities) : {};
  ctx.state = { step: 'listing', draft };
  if (!text) await ctx.say('l_start');
  return askNext(ctx, Boolean(!text));
}

async function askNext(ctx, skipPurposeText) {
  const field = nextListingStep(ctx.state.draft);
  if (!field) return showSummary(ctx);
  return askField(ctx, field, skipPurposeText);
}

async function askField(ctx, field, skipPurposeText) {
  ctx.state.field = field;
  const L = ctx.L(), d = ctx.state.draft;
  const skip = [t(L, 'skip'), 'ls:skip'];
  switch (field) {
    case 'purpose':
      return ctx.deps.tg.send(ctx.chatId, skipPurposeText ? '👇' : t(L, 'q_purpose'), buttons([[[t(L, 'sale'), 'lv:sale'], [t(L, 'rent'), 'lv:rent']]]));
    case 'type': {
      const rows = [];
      for (let i = 0; i < FEED_TYPES.length; i += 2) rows.push(FEED_TYPES.slice(i, i + 2).map((x) => [typeLabel(x, L), 'lt:' + x]));
      return ctx.say('q_type', null, buttons(rows));
    }
    case 'city': {
      const p = await placeLists(ctx);
      const main = p.main.length ? p.main : ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi'];
      const rows = [];
      for (let i = 0; i < main.length; i += 3) rows.push(main.slice(i, i + 3).map((c) => [c, 'lc:' + c.slice(0, 50)]));
      return ctx.say('q_city', null, buttons(rows));
    }
    case 'area': return ctx.say('q_area');
    case 'size': return ctx.say('q_size');
    case 'price': return ctx.say(d.purpose === 'rent' ? 'q_price_rent' : 'q_price_sale', null, buttons([[[t(L, 'ask_seller_btn'), 'lp:ask']]]));
    case 'beds':
    case 'baths': {
      const nums = ['1', '2', '3', '4', '5', '6', '7', '8'].map((n) => [n, 'ln:' + n]);
      return ctx.say(field === 'beds' ? 'q_beds' : 'q_baths', null, buttons([nums.slice(0, 4), nums.slice(4), [skip]]));
    }
    case 'address': return ctx.say('q_address', null, buttons([[skip]]));
    case 'notes': return ctx.say('q_notes', null, buttons([[skip]]));
    default: return showSummary(ctx);
  }
}

async function afterAnswer(ctx) {
  ctx.state.field = null;
  if (ctx.state.editing) { ctx.state.editing = false; return showSummary(ctx); }
  return askNext(ctx);
}

async function onListingAnswer(ctx, text) {
  const d = ctx.state.draft, f = ctx.state.field;
  const n = normaliseText(text).toLowerCase();
  const skipWord = /^(skip|no|nahi|nahin|none|chhorein|چھوڑیں|نہیں)$/i.test(text.trim());
  switch (f) {
    case 'purpose':
      if (/\b(rent|kiraya|kiraye|lease)\b/.test(n) || /کرای/.test(text)) d.purpose = 'rent';
      else if (/\b(sale|sell|farokht|bechna|bechni|buy)\b/.test(n) || /فروخت/.test(text)) d.purpose = 'sale';
      else return askField(ctx, 'purpose');
      break;
    case 'type': {
      const c = parseCriteria(' ' + n + ' ');
      const type = c.property_types.find((x) => FEED_TYPES.includes(x));
      if (!type) return askField(ctx, 'type');
      d.property_type = type;
      break;
    }
    case 'city': {
      const p = await placeLists(ctx);
      const city = matchCity(text, p.cities);
      if (!city) { await ctx.say('bad_city'); return askField(ctx, 'city'); }
      d.city = city;
      break;
    }
    case 'area': {
      const v = text.replace(/\s+/g, ' ').trim();
      if (hasContactInfo(v)) return ctx.say('no_contact_in_text');
      if (v.length < 1 || v.length > 120) return askField(ctx, 'area');
      d.area = v;
      break;
    }
    case 'size': {
      const s = parseSize(text);
      if (!s) return ctx.say('bad_size');
      d.size_value = s.value; d.size_unit = s.unit;
      break;
    }
    case 'price': {
      const v = parsePrice(text);
      if (v === 'ask') { d.price_ask = true; d.price = null; }
      else if (typeof v === 'number' && v >= 1000) { d.price = v; d.price_ask = false; }
      else return ctx.say('bad_price');
      break;
    }
    case 'beds':
    case 'baths': {
      if (skipWord) { d[f] = null; d[f + '_skipped'] = true; break; }
      const v = parseCount(text);
      if (v == null || v > 50) return askField(ctx, f);
      d[f] = v;
      break;
    }
    case 'address':
    case 'notes': {
      if (skipWord) { d[f] = null; break; }
      const v = text.replace(/\s+/g, ' ').trim().slice(0, f === 'address' ? 160 : 500);
      if (hasContactInfo(v)) return ctx.say('no_contact_in_text');
      d[f] = v;
      break;
    }
    default: return askNext(ctx);
  }
  return afterAnswer(ctx);
}

function draftCard(ctx) {
  const d = ctx.state.draft;
  const row = Object.assign(listingRow(d), { ref: '—', created_at: iso(ctx.now()), poster_role: ctx.account.role });
  let s = card(row, ctx.L(), { own: true });
  if (row.address) s += '\n' + t(ctx.L(), 'summary_addr', { v: row.address });
  return s;
}
function showSummary(ctx) {
  const L = ctx.L();
  ctx.state.field = null;
  return ctx.send(t(L, 'summary_head') + '\n\n' + draftCard(ctx), buttons([[[t(L, 'confirm'), 'l:ok'], [t(L, 'edit'), 'l:edit'], [t(L, 'cancel'), 'l:x']]]));
}
function showFieldPicker(ctx) {
  const L = ctx.L(), d = ctx.state.draft;
  const fields = ['purpose', 'type', 'city', 'area', 'size', 'price'].concat(BUILT.includes(d.property_type) ? ['beds', 'baths'] : []).concat(['address', 'notes']);
  const rows = [];
  for (let i = 0; i < fields.length; i += 3) rows.push(fields.slice(i, i + 3).map((f) => [t(L, 'f_' + f), 'le:' + f]));
  return ctx.say('which_field', null, buttons(rows));
}
function clearField(d, f) {
  const keys = { type: ['property_type'], size: ['size_value', 'size_unit', 'size_skipped'], price: ['price', 'price_ask'],
    beds: ['beds', 'beds_skipped'], baths: ['baths', 'baths_skipped'] }[f] || [f];
  keys.forEach((k) => { delete d[k]; });
}

async function saveListing(ctx) {
  const st = ctx.state, d = st.draft;
  if (!d || nextListingStep(d)) return d ? askNext(ctx) : sendMenu(ctx);
  const store = ctx.deps.store;
  if ((await store.countListingsSince(ctx.account.id, iso(ctx.now() - DAY))) >= ctx.limits.listingsPerDay) {
    ctx.state = {};
    return ctx.say('listing_cap', { n: ctx.limits.listingsPerDay });
  }
  const row = listingRow(d);
  const dup = await store.findDuplicate(ctx.account.id, row);
  if (dup) { ctx.state = {}; return ctx.say('duplicate', { ref: dup.ref }); }
  let saved = null;
  for (let i = 0; i < 3 && !saved; i++) {
    try {
      saved = await store.insertListing(Object.assign({}, row, { account_id: ctx.account.id, ref: makeRef('DL'), expires_at: iso(ctx.now() + LISTING_DAYS * DAY) }));
    } catch (e) {
      if (!(e && (e.status === 409 || e.code === '23505'))) { console.error('[dealer] save listing:', e && e.message); break; }
    }
  }
  if (!saved) return ctx.say('save_failed');
  ctx.state = {};
  await ctx.say('posted', { ref: saved.ref });
  const n = await alertBuyers(ctx.deps, Object.assign({}, saved, { poster_role: ctx.account.role }), ctx.now()).catch((e) => { console.error('[dealer] alerts:', e && e.message); return 0; });
  if (n > 0) await ctx.say('posted_alerts', { n });
  return n;
}

// A new (or renewed) entry → buyers whose open requests it fits.
export async function alertBuyers(deps, listing, now) {
  const store = deps.store;
  const reqs = await store.alertingRequests({ purpose: listing.purpose, city: listing.city }, now);
  const fits = (reqs || []).filter((r) => r.account_id !== listing.account_id && matches(listing, requestQuery(r)));
  if (!fits.length) return 0;
  const blocked = await store.blockedWith(listing.account_id);
  const targets = fits.filter((r) => !blocked.has(r.account_id));
  const accounts = await store.accountsByIds([...new Set(targets.map((r) => r.account_id))]);
  const byId = new Map((accounts || []).map((a) => [a.id, a]));
  let sent = 0;
  for (const r of targets) {
    const acc = byId.get(r.account_id);
    if (!acc || acc.status !== 'active') continue;
    const fresh = await store.addMatches(r.id, [listing.id]);
    if (!fresh.length) continue;
    const L = acc.lang || 'en';
    try {
      const m = resultMessage(Object.assign({ source: 'feed' }, listing), L);
      await deps.tg.send(acc.chat_id, t(L, 'alert_new', { ref: r.ref, q: r.query.slice(0, 80) }) + '\n\n' + m.text, m.extra);
      sent++;
    } catch (e) { /* the buyer may have stopped the bot */ }
    if (r.status === 'open') await store.updateRequest(r.id, { status: 'answered', answered_at: iso(now) }).catch(() => null);
  }
  return sent;
}

// ---------- search (three sources, best 3) ----------
function resultButtons(L, listingId) {
  return buttons([[[t(L, 'btn_contact'), 'rv:' + listingId], [t(L, 'btn_report'), 'rp:' + listingId]]]);
}
// One result → message text + buttons, by source. Dealer AI entries: contact
// through the bot (daily limit). Website listings: the listing page (numbers
// there are for signed-in visitors). Partner: its own link, if any.
export function resultMessage(l, L) {
  const src = l.source || 'feed';
  if (src === 'feed') return { text: card(l, L) + '\n' + t(L, 'src_feed'), extra: resultButtons(L, l.id) };
  const body = card(Object.assign({}, l, { ref: src === 'site' ? 'AgenticCore Estate' : l.ref }), L) + '\n' +
    (src === 'site' ? t(L, 'src_site') : t(L, 'src_partner', { name: l.partner || 'Partner' }));
  const label = src === 'site' ? t(L, 'btn_view_site') : t(L, 'btn_view_partner', { name: l.partner || 'Partner' });
  return { text: body, extra: l.url ? buttons([[[label, l.url]]]) : undefined };
}
// Best matches across Dealer AI entries, website listings and the partner.
// skip: result keys already sent for this request.
export async function findAll(deps, accountId, q, now, skip, max) {
  const store = deps.store;
  const blocked = await store.blockedWith(accountId);
  return searchAll(q, {
    feed: () => store.liveListings({ purpose: q.purpose, city: q.city, types: q.property_types }, now),
    site: () => store.siteListings({ purpose: q.purpose, city: q.city, types: q.property_types }),
    partner: deps.partner || null
  }, {
    max: max || MAX_RESULTS, now, skip: skip || new Set(),
    exclude: (l) => (l.source || 'feed') === 'feed' && (l.account_id === accountId || blocked.has(l.account_id))
  });
}

async function doSearch(ctx, text) {
  const p = await placeLists(ctx);
  const q = parseQuery(text, p.areas, p.cities);
  if (!queryUsable(q)) { ctx.state = { step: 's_query' }; return ctx.say('s_need_area'); }
  const L = ctx.L(), store = ctx.deps.store, now = ctx.now();
  await ctx.say('s_understood', { q: describeQuery(q, L) });
  const found = await findAll(ctx.deps, ctx.account.id, q, now, null, ctx.limits.results);

  if (found.length) {
    const left = Math.max(0, revealLimit(ctx) - (await store.revealsToday(ctx.account.id, now)));
    await ctx.say('s_found', { n: found.length, left });
    for (const l of found) { const m = resultMessage(l, L); await ctx.send(m.text, m.extra); }
    ctx.state = { last: { text: text.slice(0, 600), q, ids: found.filter((l) => (l.source || 'feed') === 'feed').map((l) => l.id),
      sent: found.filter((l) => l.source && l.source !== 'feed').map(resultKey) } };
    return ctx.say('s_alert_offer', null, buttons([[[t(L, 's_alert_btn'), 'al']]]));
  }

  // nothing yet: a 24-hour request
  const req = await createRequest(ctx, text, q, 'open', REQUEST_HOURS * 3600000);
  if (!req) return;
  ctx.state = {};
  await ctx.say('s_none', { ref: req.ref });
  return notifyTeam(ctx, req, q);
}

async function createRequest(ctx, text, q, status, lifeMs, sentRefs) {
  const store = ctx.deps.store, now = ctx.now();
  const mine = await store.myRequests(ctx.account.id);
  if ((mine || []).filter((r) => r.status !== 'waiting_choice').length >= ctx.limits.openRequests) {
    ctx.state = {};
    await ctx.say('s_request_cap', { n: ctx.limits.openRequests });
    return null;
  }
  const until = iso(now + lifeMs);
  const row = { account_id: ctx.account.id, query: text.slice(0, 600), purpose: q.purpose, property_types: q.property_types, city: q.city,
    areas: q.areas, price_min: q.price_min, price_max: q.price_max, size_marla: q.size_marla, beds_min: q.beds_min,
    status, deadline_at: until, active_until: until, answered_at: status === 'answered' ? iso(now) : null, sent_refs: sentRefs || [] };
  for (let i = 0; i < 3; i++) {
    try { return await store.insertRequest(Object.assign({ ref: makeRef('BR') }, row)); } catch (e) {
      if (!(e && (e.status === 409 || e.code === '23505'))) { console.error('[dealer] save request:', e && e.message); break; }
    }
  }
  await ctx.say('save_failed');
  return null;
}

// The AgenticCore team hears about every unmatched request, to source options.
async function notifyTeam(ctx, req, q) {
  if (!ctx.deps.ownerId) return;
  const text = '🆕 Dealer AI — buyer request ' + req.ref + ' (24 hours)\n"' + req.query.slice(0, 300) + '"\nUnderstood: ' + describeQuery(q, 'en') +
    '\nBuyer: ' + ctx.account.name + ' (' + ctx.account.role + ')\n\nAny matching entry posted in this bot is sent to the buyer automatically. Details: feed_requests in Supabase.';
  await ctx.deps.tg.send(ctx.deps.ownerId, text).catch(() => null);   // the owner must have pressed Start once
}

// ---------- contact reveal / report / block ----------
async function reveal(ctx, listingId) {
  const store = ctx.deps.store, now = ctx.now();
  const l = await store.listingById(listingId);
  if (!l || l.status !== 'active' || new Date(l.expires_at).getTime() <= now) return ctx.say('not_available');
  if (l.account_id === ctx.account.id) return ctx.say('own_entry');
  if ((await store.blockedWith(ctx.account.id)).has(l.account_id)) return ctx.say('not_available');
  const poster = await store.accountById(l.account_id);
  if (!poster || poster.status !== 'active') return ctx.say('not_available');
  const limit = revealLimit(ctx);
  const used = await store.revealsToday(ctx.account.id, now);
  const again = await store.hasRevealed(ctx.account.id, l.id);
  if (!again) {
    if (used >= limit) return ctx.say('reveal_limit', { n: limit });
    await store.addReveal(ctx.account.id, l.id);
  }
  const L = ctx.L();
  return ctx.say('reveal', {
    ref: l.ref, name: poster.name, role: t(L, 'role_name_' + poster.role), phone: poster.phone,
    addr: l.address ? t(L, 'reveal_addr', { v: l.address }) : '', left: Math.max(0, limit - used - (again ? 0 : 1))
  }, buttons([[[t(L, 'btn_report'), 'rp:' + l.id], [t(L, 'btn_block'), 'bk:' + l.id]]]));
}

async function report(ctx, code, listingId) {
  const store = ctx.deps.store;
  const l = await store.listingById(listingId);
  if (!l) return ctx.say('not_available');
  if (l.account_id === ctx.account.id) return ctx.say('own_entry');
  const fresh = await store.addReport(ctx.account.id, l.id, code);
  if (!fresh) return ctx.say('already_reported');
  await ctx.say('reported');
  const after = await store.listingById(l.id);
  if (ctx.deps.ownerId && (code === 'fake' || (after && after.status === 'hidden'))) {
    const why = (after && after.status === 'hidden') ? 'hidden after 3 reports' : 'reported as fake';
    await ctx.deps.tg.send(ctx.deps.ownerId, '🚩 Dealer AI — entry ' + l.ref + ' ' + why + ' (' + l.area + ', ' + l.city + '). Review in feed_listings / feed_reports.').catch(() => null);
  }
}

async function block(ctx, listingId) {
  const l = await ctx.deps.store.listingById(listingId);
  if (!l) return ctx.say('not_available');
  if (l.account_id === ctx.account.id) return ctx.say('own_entry');
  await ctx.deps.store.addBlock(ctx.account.id, l.account_id);
  return ctx.say('blocked_done');
}

// ---------- my entries / my requests ----------
function listingStatus(l, L) {
  if (l.status === 'active') return t(L, 'st_active', { d: dateText(l.expires_at, L) });
  return t(L, 'st_' + l.status);
}
async function showMine(ctx) {
  const rows = await ctx.deps.store.myListings(ctx.account.id);
  const L = ctx.L();
  if (!rows || !rows.length) return ctx.say('mine_none');
  await ctx.say('mine_head', { n: rows.length });
  for (const l of rows) {
    const b = [];
    if (l.status === 'active') b.push([t(L, l.purpose === 'rent' ? 'btn_rented' : 'btn_sold'), 'mg:done:' + l.id]);
    if (l.status === 'active' || l.status === 'expired') b.push([t(L, 'btn_renew'), 'mg:renew:' + l.id]);
    if (l.status !== 'hidden') b.push([t(L, 'btn_remove'), 'mg:rm:' + l.id]);
    await ctx.send(card(Object.assign({ poster_role: ctx.account.role }, l), L, { own: true }) + '\n' + listingStatus(l, L), b.length ? buttons([b]) : undefined);
  }
}

async function manageListing(ctx, action, id, cb) {
  const store = ctx.deps.store, now = ctx.now();
  const l = await store.listingById(id);
  if (!l || l.account_id !== ctx.account.id) return ctx.say('not_available');
  if (action === 'done' && l.status === 'active') {
    await store.updateOwnListing(ctx.account.id, id, { status: l.purpose === 'rent' ? 'rented' : 'sold' });
    await ctx.say('done_sold', { ref: l.ref });
  } else if (action === 'renew' && (l.status === 'active' || l.status === 'expired')) {
    const until = iso(now + LISTING_DAYS * DAY);
    const updated = await store.updateOwnListing(ctx.account.id, id, { status: 'active', expires_at: until, expiry_notified_at: null });
    await ctx.say('done_renew', { ref: l.ref, d: dateText(until, ctx.L()) });
    if (l.status === 'expired' && updated) await alertBuyers(ctx.deps, Object.assign({}, updated, { poster_role: ctx.account.role }), now).catch(() => 0);
  } else if (action === 'rm' && l.status !== 'hidden' && l.status !== 'removed') {
    await store.updateOwnListing(ctx.account.id, id, { status: 'removed' });
    await ctx.say('done_remove', { ref: l.ref });
  } else return ctx.say('not_available');
  if (cb && cb.message) await ctx.deps.tg.removeButtons(ctx.chatId, cb.message.message_id);
}

function requestStatus(r, L) {
  if (r.status === 'open') return t(L, 'rs_open', { d: dateText(r.deadline_at, L) });
  if (r.status === 'answered') return t(L, 'rs_answered', { d: dateText(r.deadline_at, L) });
  return t(L, 'rs_waiting');
}
export function choiceButtons(L, id) {
  return buttons([[[t(L, 'btn_keep7'), 'rq:keep:' + id]], [[t(L, 'btn_change'), 'rq:change:' + id], [t(L, 'btn_close'), 'rq:close:' + id]]]);
}
async function showRequests(ctx) {
  const rows = await ctx.deps.store.myRequests(ctx.account.id);
  const L = ctx.L();
  if (!rows || !rows.length) return ctx.say('reqs_none');
  for (const r of rows) {
    const text = t(L, 'req_line', { ref: r.ref, q: r.query.slice(0, 120), st: requestStatus(r, L) });
    await ctx.send(text, r.status === 'waiting_choice' ? choiceButtons(L, r.id) : buttons([[[t(L, 'btn_close'), 'rq:close:' + r.id]]]));
  }
}

async function manageRequest(ctx, action, id, cb) {
  const store = ctx.deps.store, now = ctx.now();
  const r = await store.requestById(id);
  if (!r || r.account_id !== ctx.account.id || r.status === 'closed' || r.status === 'expired') return ctx.say('not_available');
  if (action === 'keep') {
    const until = iso(now + KEEP_DAYS * DAY);
    const n = (await store.matchCount(r.id)) + (r.sent_refs || []).length;
    await store.updateRequest(r.id, { status: n > 0 ? 'answered' : 'open', deadline_at: until, active_until: until }, ctx.account.id);
    await ctx.say('req_kept', { ref: r.ref, d: dateText(until, ctx.L()) });
  } else if (action === 'close' || action === 'change') {
    await store.updateRequest(r.id, { status: 'closed' }, ctx.account.id);
    if (action === 'change') { ctx.state = { step: 's_query' }; await ctx.say('req_change', { ref: r.ref }); }
    else await ctx.say('req_closed', { ref: r.ref });
  } else return null;
  if (cb && cb.message) await ctx.deps.tg.removeButtons(ctx.chatId, cb.message.message_id);
}

// ---------- buttons ----------
async function onCallback(ctx, cb) {
  const data = String(cb.data || '');
  await ctx.deps.tg.answerCallback(cb.id);
  if (ctx.account && ctx.account.status === 'blocked') return ctx.say('blocked_account');
  const [kind, a, b] = data.split(':');

  if (kind === 'lang' && ['en', 'ur', 'ro'].includes(a)) {
    ctx.lang = a;
    if (ctx.account) { await ctx.deps.store.updateAccount(ctx.account.id, { lang: a }); ctx.account.lang = a; return sendMenu(ctx); }
    ctx.state = { step: 'reg_name' };
    return ctx.say('intro');
  }
  if (kind === 'role' && ['owner', 'dealer', 'buyer'].includes(a)) return finishRegistration(ctx, a);
  if (!ctx.account) return chooseLanguage(ctx);

  switch (kind) {
    case 'm':
      if (a === 'add') return startListing(ctx);
      if (a === 'search') { ctx.state = { step: 's_query' }; return ctx.say('s_start'); }
      if (a === 'mine') return showMine(ctx);
      if (a === 'reqs') return showRequests(ctx);
      if (a === 'help') return ctx.say('help', { limit: revealLimit(ctx) });
      if (a === 'lang') return chooseLanguage(ctx);
      return sendMenu(ctx);
    case 'it': {
      const text = ctx.state.pending;
      ctx.state = {};
      if (!text) return sendMenu(ctx);
      return a === 'post' ? startListing(ctx, text) : doSearch(ctx, text);
    }
    // listing steps
    case 'lv': case 'lt': case 'lc': case 'lp': case 'ln': case 'ls': case 'le': case 'l': {
      const st = ctx.state;
      if (st.step !== 'listing' || !st.draft) return sendMenu(ctx);
      const d = st.draft;
      if (kind === 'l') {
        if (a === 'ok') return saveListing(ctx);
        if (a === 'edit') return showFieldPicker(ctx);
        ctx.state = {};
        return ctx.say('cancelled');
      }
      if (kind === 'le') { clearField(d, a); st.editing = true; return askField(ctx, a); }
      if (kind === 'lv' && (a === 'sale' || a === 'rent') && st.field === 'purpose') d.purpose = a;
      else if (kind === 'lt' && FEED_TYPES.includes(a) && st.field === 'type') d.property_type = a;
      else if (kind === 'lc' && st.field === 'city') {
        const p = await placeLists(ctx);
        const city = p.cities.find((c) => c.slice(0, 50) === data.slice(3));
        if (!city) return askField(ctx, 'city');
        d.city = city;
      } else if (kind === 'lp' && a === 'ask' && st.field === 'price') { d.price = null; d.price_ask = true; }
      else if (kind === 'ln' && (st.field === 'beds' || st.field === 'baths')) d[st.field] = Number(a);
      else if (kind === 'ls' && a === 'skip' && ['beds', 'baths', 'address', 'notes'].includes(st.field)) {
        d[st.field] = null;
        if (st.field === 'beds' || st.field === 'baths') d[st.field + '_skipped'] = true;
      } else return askField(ctx, st.field || nextListingStep(d) || 'purpose');
      if (cb.message) await ctx.deps.tg.removeButtons(ctx.chatId, cb.message.message_id);
      return afterAnswer(ctx);
    }
    // search results
    case 'al': {
      const last = ctx.state.last;
      if (!last) return ctx.say('s_start');
      const req = await createRequest(ctx, last.text, last.q, 'answered', KEEP_DAYS * DAY, last.sent);
      if (!req) return;
      await ctx.deps.store.addMatches(req.id, last.ids || []);
      ctx.state = {};
      if (cb.message) await ctx.deps.tg.removeButtons(ctx.chatId, cb.message.message_id);
      return ctx.say('s_alert_on', { ref: req.ref });
    }
    case 'rv': return reveal(ctx, a);
    case 'rp': {
      const l = await ctx.deps.store.listingById(a);
      if (!l) return ctx.say('not_available');
      const L = ctx.L();
      return ctx.say('report_why', { ref: l.ref }, buttons([
        [[t(L, 'rr_gone'), 'rr:gone:' + a], [t(L, 'rr_wrong'), 'rr:wrong:' + a]],
        [[t(L, 'rr_fake'), 'rr:fake:' + a], [t(L, 'rr_other'), 'rr:other:' + a]]
      ]));
    }
    case 'rr':
      if (!['gone', 'wrong', 'fake', 'other'].includes(a)) return null;
      if (cb.message) await ctx.deps.tg.removeButtons(ctx.chatId, cb.message.message_id);
      return report(ctx, a, b);
    case 'bk': return block(ctx, a);
    case 'mg': return manageListing(ctx, a, b, cb);
    case 'rq': return manageRequest(ctx, a, b, cb);
    default: return sendMenu(ctx);
  }
}
