// AgenticCore Telegram bot (@AgenticcoreEstatebot) — Phase 1.
//
// One public bot; behind it the server routes each request to the right
// "agent": the Estate agent (accounts, listings — Amaan's existing listing
// logic) or the Pakistan agent (marketing services; ordering comes in
// Phase 2). Telegram does not let bots pass messages to each other, so the
// routing happens here rather than between bots.
//
// Safety model:
// - The person is identified only by Telegram's verified user id (and the
//   phone number Telegram confirms with the "share contact" button). Chat
//   text can never choose which account is acted on.
// - AI never performs actions. Account creation, listing and reminders are
//   plain code; Amaan's deterministic slot-filling extracts listing facts and
//   every fact is shown back to the person to confirm before publishing.
// - The owner (OWNER_TELEGRAM_ID) gets an alert for every account activity.

import crypto from 'node:crypto';
import { t } from './strings.mjs';
import { buttons, contactKeyboard, removeKeyboard } from './tg-api.mjs';
import { detectLang, contextualise, factsSummary, askFor, launchNotice } from '../assistant-service.mjs';
import { isLaunched, placeOf } from '../places.mjs';
import { observe, remember, recall, recallLine, pendingFacts, factLine } from '../memory.mjs';
import { replyToRequest } from '../amaan-handoff.mjs';
import { AMAAN } from '../assistant-knowledge.mjs';
import { extractFacts, templateDraft } from '../listing-draft.mjs';
import { PROPERTY_TYPES } from '../util.mjs';
import { pkMenu, startOrder, myOrders, onPkCallback, onPkInput, ownerDeliverStart, ownerMessage, ownerJobs } from './pk-orders.mjs';
import { looksLikeSearch, findProperty, startEnquiry, sendEnquiry } from './find.mjs';

export const LIMITS = { photos: 8, listingsPerDay: 5, loginLinksPerHour: 3, msgsPer10Min: 40, aiAnswersPerDay: 20 };
const BUILT = ['house', 'flat', 'upper_portion', 'lower_portion', 'room', 'farm_house'];
const VALID_TYPES = Object.keys(PROPERTY_TYPES);
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

// ---------- small helpers ----------
export function memberNo(n) { return n ? 'AC-' + n : ''; }

// Pakistani numbers are stored the way people type them on the website
// (03XXXXXXXXX); anything else as +<digits>. All forms are checked for clashes.
export function normalisePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^92(3\d{9})$/.test(d)) return '0' + d.slice(2);
  if (/^03\d{9}$/.test(d)) return d;
  return '+' + d;
}
export function phoneVariants(stored) {
  if (/^03\d{9}$/.test(stored)) { const r = stored.slice(1); return [stored, '+92' + r, '92' + r, '0092' + r]; }
  return [stored, stored.replace(/^\+/, '')];
}
export function maskPhone(p) { return String(p).replace(/.(?=.{4})/g, '•'); }
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const NAME_RE = /^[\p{L}][\p{L} .'-]{1,59}$/u;

const RE = {
  signup: /\b(sign ?up|register|create (an |my )?account|open (an |my )?account|new account|account (kholna|kholo|banana|banao|bana do)|naya account)\b|اکاؤنٹ (کھول|بنا)/i,
  list: /\b(list (my|a)|listing|sell (my|a)|rent out|post (my )?(property|house|plot|flat)|bechna|bechni|farokht|kiraye? (par|pe) (dena|deni))\b|لسٹ کر|بیچنا|فروخت کرن/i,
  mine: /\bmy listings?\b|\bmeri listings?\b|میری لسٹنگ/i,
  login: /\b(log ?in|sign ?in|password)\b|لاگ ان|سائن ان|پاس ورڈ/i,
  pk: /\b(marketing|design|logo|flyers?|brochures?|reels?|videos?|ads|advertis\w*|social media|branding|agenticcore ?pakistan|services|packages?|whats ?app card|(social |instagram |facebook )?posts?|photo (enhancement|editing)|enhance (my )?photos|order)\b|مارکیٹنگ|ڈیزائن|ویڈیو|اشتہار|واٹس ایپ کارڈ|لوگو/i,
  greet: /^(hi|hello|hey|salam|salaam|assalam\w*|aoa|menu|start)\b|^(السلام|سلام)/i,
  cancel: /^(\/cancel|cancel|stop|band karo|ruk jao|منسوخ)$/i,
  done: /^(done|finish(ed)?|ho gaya|ho gya|bas|ہو گیا|بس)$/i
};

function missingFacts(f) {
  const m = [];
  if (!f.purpose) m.push('purpose');
  if (!f.property_type) m.push('property_type');
  if (!f.city) m.push('city');
  if (!f.area) m.push('area');
  if (!f.price) m.push('price');
  if (!f.size_value) m.push('size');
  if (BUILT.includes(f.property_type)) { if (!f.beds) m.push('beds'); if (!f.baths) m.push('baths'); }
  return m;
}
function factsFromNotes(notes, areaNames) { return extractFacts(notes.slice().reverse().join('. '), areaNames || []); }

export function listingRow(f, ownerId, cityName) {
  const d = templateDraft(f);
  return {
    owner_id: ownerId, title: d.title.slice(0, 120), type: f.purpose === 'rent' ? 'rent' : 'buy', property_type: f.property_type,
    city: cityName, area: String(f.area).slice(0, 80), price: Math.round(f.price), beds: f.beds || 0, baths: f.baths || 0,
    size_marla: f.size_value || 0, size_unit: ['marla', 'kanal', 'sqft', 'sqyd'].includes(f.size_unit) ? f.size_unit : 'marla',
    description: d.description.slice(0, 3000), last_confirmed_at: new Date().toISOString()
  };
}
function reviewText(f, photoCount) {
  const d = templateDraft(f);
  return [d.title, factsSummary(f), 'Photos: ' + photoCount, '', d.description].join('\n');
}

// ---------- main entry ----------
// deps: { tg, store, voice:{configured, transcribe}, assistant:{handleTurn, areaNames}, quality,
//         ownerId, siteUrl, botUsername }
export async function handleUpdate(update, deps) {
  const msg = update.message;
  const cb = update.callback_query;
  const from = (msg && msg.from) || (cb && cb.from);
  const chat = (msg && msg.chat) || (cb && cb.message && cb.message.chat);
  if (!from || !chat || from.is_bot || chat.type !== 'private') return { ignored: true };
  if (!(await deps.store.firstSeen(update.update_id))) return { duplicate: true };

  const session = (await deps.store.getSession(chat.id)) || { chat_id: chat.id, tg_user_id: from.id, lang: 'en', state: {}, history: [] };
  session.tg_user_id = from.id;
  session.state = session.state || {};
  const ctx = {
    deps, chatId: chat.id, from, session,
    get lang() { return session.lang || 'en'; },
    say(key, vars, extra) { return deps.tg.send(chat.id, t(key, session.lang, vars), extra); },
    raw(text, extra) { return deps.tg.send(chat.id, text, extra); },
    account: null
  };
  // helpers shared with the Phase 2/3 modules
  ctx.isOwner = () => isOwner(ctx);
  ctx.requireActive = () => requireActive(ctx);
  ctx.log = (kind, detail, alertText) => logActivity(ctx, kind, detail, alertText);
  ctx.menu = () => menu(ctx);

  if (deps.refreshPlaces) await deps.refreshPlaces();      // learned places (cached 10 min)
  try {
    // simple per-chat flood limit
    const rl = session.state.rl || { at: Date.now(), n: 0 };
    if (Date.now() - rl.at > 10 * 60 * 1000) { rl.at = Date.now(); rl.n = 0; }
    rl.n += 1; session.state.rl = rl;
    if (rl.n > LIMITS.msgsPer10Min) {
      if (rl.n === LIMITS.msgsPer10Min + 1) await ctx.say('too_fast');
      if (cb) await deps.tg.answerCallback(cb.id);
      return { limited: true };
    }

    ctx.account = await deps.store.linkedAccount(from.id);

    if (cb) { await deps.tg.answerCallback(cb.id); await onCallback(ctx, cb); }
    else await onMessage(ctx, msg);
  } catch (e) {
    console.error('[telegram] update failed:', e && e.message);
    await ctx.say('error').catch(() => null);
  } finally {
    const keep = session.state.rl;
    if (!session.state.flow) session.state = keep ? { rl: keep } : {};
    await deps.store.saveSession(session).catch((e) => console.error('[telegram] session save failed:', e && e.message));
  }
  return { ok: true };
}

async function alert(ctx, text) {
  const id = ctx.deps.ownerId;
  if (!id) return;
  await ctx.deps.tg.send(id, '🔔 ' + text).catch(() => null);
}
async function logActivity(ctx, kind, detail, alertText) {
  await ctx.deps.store.log(ctx.account, kind, detail);
  if (alertText) await alert(ctx, alertText);
}

function menu(ctx) {
  const L = ctx.lang;
  if (ctx.account) {
    return buttons([[[t('btn_list', L), 'm:list']], [[t('btn_my_listings', L), 'm:mine'], [t('btn_login', L), 'm:login']], [[t('btn_services', L), 'm:services'], [t('btn_help', L), 'm:help']]]);
  }
  return buttons([[[t('btn_signup', L), 'm:signup']], [[t('btn_have_account', L), 'm:have']], [[t('btn_services', L), 'm:services'], [t('btn_help', L), 'm:help']]]);
}
async function showMenu(ctx) {
  if (ctx.account) {
    const line = recallLine(await recall(ctx.deps.store, ctx.account), (v) => PROPERTY_TYPES[v] || v);
    if (line) await ctx.say('welcome_back', { name: ctx.account.full_name, member: memberNo(ctx.account.member_no) });
    return line ? ctx.say('welcome_recall', { what: line }, menu(ctx)) : ctx.say('welcome_back', { name: ctx.account.full_name, member: memberNo(ctx.account.member_no) }, menu(ctx));
  }
  return ctx.say('welcome_new', {}, menu(ctx));
}

// ---------- incoming messages ----------
async function onMessage(ctx, msg) {
  const s = ctx.session.state;
  let text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 800) : '';

  if (msg.voice || msg.audio) {
    if (!ctx.deps.voice.configured()) return ctx.say('voice_off');
    try {
      const file = await ctx.deps.tg.download((msg.voice || msg.audio).file_id, 5 * 1024 * 1024);
      text = await ctx.deps.voice.transcribe(file.bytes, 'voice.ogg');
    } catch (e) { return ctx.say('voice_failed'); }
    ctx.session.lang = detectLang(text, ctx.session.lang);
    await ctx.say('heard', { text });
  } else if (text) {
    ctx.session.lang = detectLang(text, ctx.session.lang);
  }

  const isCommand = /^\//.test(text);
  if (!isCommand && ['order', 'changes', 'deliver'].includes(s.flow) && (await onPkInput(ctx, msg, text))) return;
  if (!isCommand && s.flow === 'enquiry' && text) return sendEnquiry(ctx, text);
  if (msg.contact) return onContact(ctx, msg.contact);
  if (msg.photo) return onPhoto(ctx, msg.photo);
  if (msg.document) {
    if (s.flow === 'list' && s.step === 'photos') return ctx.say('photo_as_file');
    return ctx.say('photo_not_now');
  }
  if (!text) return;

  // commands
  const cmd = text.match(/^\/(\w+)(?:@\w+)?(?:\s+(.+))?$/);
  if (cmd) {
    const [, name, arg] = cmd;
    if (name === 'start') {
      if (arg && /^link_[A-Za-z0-9_-]{20,60}$/.test(arg)) return linkWithToken(ctx, arg.slice(5));
      ctx.session.state = { rl: s.rl };
      if (arg === 'pk') return pkMenu(ctx);          // from agenticcorepk.com
      return showMenu(ctx);
    }
    if (name === 'menu') { ctx.session.state = { rl: s.rl }; return showMenu(ctx); }
    if (name === 'help') return ctx.say('help', {}, menu(ctx));
    if (name === 'cancel') { ctx.session.state = { rl: s.rl }; await ctx.say('cancelled', {}, removeKeyboard()); return showMenu(ctx); }
    if (name === 'login') return sendLoginLink(ctx);
    if (name === 'list') return startListing(ctx);
    if (name === 'mylistings') return myListings(ctx);
    if (name === 'signup') return startSignup(ctx);
    if (name === 'orders') return myOrders(ctx);
    if (name === 'order') return startOrder(ctx, arg);
    if (name === 'services') return pkMenu(ctx);
    if (name === 'stats' && isOwner(ctx)) return ownerStats(ctx);
    if (name === 'deliver' && isOwner(ctx)) return ownerDeliverStart(ctx, arg);
    if (name === 'jobs' && isOwner(ctx)) return ownerJobs(ctx);
    if (name === 'learn' && isOwner(ctx)) return ownerLearn(ctx);
    if (name === 'reply' && isOwner(ctx)) {
      const mm = String(arg || '').match(/^(AR-[A-Z0-9]{4,8})\s+([\s\S]+)$/i);
      if (!mm) return ctx.raw('Use: /reply AR-XXXXXX your message');
      const r = await replyToRequest(ctx.deps, mm[1].toUpperCase(), mm[2]);
      return ctx.raw(r.ok ? '✓ Sent to the client.' : r.reason === 'no_telegram' ? 'This client has not connected Telegram (AC-' + r.member_no + '). Reply by WhatsApp or email from the admin page.' : 'No request ' + mm[1] + ' found.');
    }
    if (name === 'msg' && isOwner(ctx)) { const mm = String(arg || '').match(/^(ACPK-\d+)\s+([\s\S]+)$/i); return ownerMessage(ctx, mm && mm[1], mm && mm[2]); }
    return showMenu(ctx);
  }

  if (s.flow && RE.cancel.test(text)) { ctx.session.state = { rl: s.rl }; await ctx.say('cancelled', {}, removeKeyboard()); return showMenu(ctx); }
  if (s.flow === 'signup') return signupText(ctx, text);
  if (s.flow === 'list') return listingText(ctx, text);

  // no flow: route to the right agent
  if (RE.mine.test(text)) return myListings(ctx);
  if (RE.signup.test(text) && !ctx.account) return startSignup(ctx);
  if (RE.list.test(text)) return startListing(ctx, text);
  if (RE.login.test(text)) return sendLoginLink(ctx);
  if (RE.pk.test(text)) return ctx.account ? startOrder(ctx, text) : pkMenu(ctx);
  if (looksLikeSearch(text)) return findProperty(ctx, text);
  if (RE.greet.test(text)) return showMenu(ctx);
  return guideAnswer(ctx, text);
}

function isOwner(ctx) { return Boolean(ctx.deps.ownerId) && String(ctx.from.id) === String(ctx.deps.ownerId); }

// General questions: the Estate guide's answers (AI wording only, facts from the knowledge base).
async function guideAnswer(ctx, text) {
  // AI wording for at most 20 answers per chat per day; after that the same
  // answers come straight from the knowledge base (no cost, same facts).
  const rl = ctx.session.state.rl;
  const day = new Date().toISOString().slice(0, 10);
  if (rl.aiDay !== day) { rl.aiDay = day; rl.aiN = 0; }
  const gd = ctx.deps.assistant.guideDeps();
  if (rl.aiN >= LIMITS.aiAnswersPerDay) gd.allowAI = false;
  else if (gd.allowAI) rl.aiN += 1;
  const out = await ctx.deps.assistant.handleTurn({ bot: 'guide', site: 'estate', lang: ctx.lang, messages: [{ role: 'user', text }] }, gd);
  ctx.session.lang = out.lang || ctx.session.lang;
  return ctx.raw(out.reply, menu(ctx));
}

// ---------- callbacks (buttons) ----------
async function onCallback(ctx, cb) {
  const data = String(cb.data || '');
  const msgId = cb.message && cb.message.message_id;
  const s = ctx.session.state;
  if (await onPkCallback(ctx, data, msgId)) return;
  if (/^q:[0-9a-f-]{36}$/.test(data)) return startEnquiry(ctx, data.slice(2));
  if (/^kb:[ar]:\d+$/.test(data) && isOwner(ctx)) return ownerDecide(ctx, data, msgId);
  switch (data) {
    case 'm:signup': return startSignup(ctx);
    case 'm:have': return ctx.say('have_account', {}, buttons([[['agenticcore.estate', ctx.deps.siteUrl + '/login.html']]]));
    case 'm:list': return startListing(ctx);
    case 'm:mine': return myListings(ctx);
    case 'm:login': return sendLoginLink(ctx);
    case 'm:services': return pkMenu(ctx);
    case 'm:help': return ctx.say('help', {}, menu(ctx));
    case 's:yes': if (s.flow === 'signup' && s.step === 'confirm') { await ctx.deps.tg.removeButtons(ctx.chatId, msgId); return createAccount(ctx); } return;
    case 's:edit': if (s.flow === 'signup') { s.step = 'name'; return ctx.say('signup_name'); } return;
    case 'l:done': if (s.flow === 'list' && s.step === 'photos') return toReview(ctx); return;
    case 'l:publish': if (s.flow === 'list' && s.step === 'review') { await ctx.deps.tg.removeButtons(ctx.chatId, msgId); return publish(ctx); } return;
    case 'l:edit': if (s.flow === 'list') { s.step = 'review'; s.editing = true; return ctx.say('what_change'); } return;
    case 'l:cancel': ctx.session.state = { rl: s.rl }; await ctx.deps.tg.removeButtons(ctx.chatId, msgId); return ctx.say('cancelled', {}, menu(ctx));
    default:
      if (/^av:[0-9a-f-]{36}$/.test(data)) return confirmAvailable(ctx, data.slice(3), msgId);
  }
}

// ---------- accounts ----------
async function startSignup(ctx) {
  if (ctx.account) return showMenu(ctx);
  ctx.session.state = { rl: ctx.session.state.rl, flow: 'signup', step: 'contact', data: {} };
  return ctx.say('signup_contact', {}, contactKeyboard(t('btn_share_phone', ctx.lang)));
}

async function onContact(ctx, contact) {
  const s = ctx.session.state;
  if (s.flow !== 'signup' || s.step !== 'contact') return showMenu(ctx);
  if (!contact.user_id || contact.user_id !== ctx.from.id) return ctx.say('contact_not_yours', {}, contactKeyboard(t('btn_share_phone', ctx.lang)));
  const phone = normalisePhone(contact.phone_number);
  if (phone.replace(/\D/g, '').length < 10) return ctx.say('contact_not_yours', {}, contactKeyboard(t('btn_share_phone', ctx.lang)));
  if (await ctx.deps.store.profileByPhone(phoneVariants(phone))) {
    ctx.session.state = { rl: s.rl };
    await logActivity(ctx, 'signup_phone_in_use', {}, 'Sign-up stopped: a Telegram user shared a number that already has an account (' + maskPhone(phone) + ').');
    return ctx.say('phone_exists', {}, removeKeyboard());
  }
  s.data = { phone }; s.step = 'name';
  return ctx.say('signup_name', {}, removeKeyboard());
}

async function signupText(ctx, text) {
  const s = ctx.session.state;
  if (s.step === 'contact') return ctx.say('signup_contact', {}, contactKeyboard(t('btn_share_phone', ctx.lang)));
  if (s.step === 'name') {
    const name = text.replace(/\s+/g, ' ').trim();
    if (!NAME_RE.test(name)) return ctx.say('bad_name');
    s.data.name = name; s.step = s.data.email ? 'confirm' : 'email';
    if (s.step === 'email') return ctx.say('signup_email');
  }
  if (s.step === 'email') {
    const email = text.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return ctx.say('bad_email');
    s.data.email = email; s.step = 'confirm';
  }
  if (s.step === 'confirm') {
    return ctx.say('signup_confirm', { name: s.data.name, phone: s.data.phone, email: s.data.email },
      buttons([[[t('btn_yes_open', ctx.lang), 's:yes']], [[t('btn_change', ctx.lang), 's:edit']]]));
  }
}

async function createAccount(ctx) {
  const s = ctx.session.state;
  const { name, phone, email } = s.data || {};
  if (!name || !phone || !email) return startSignup(ctx);
  let user;
  try {
    user = await ctx.deps.store.createUser({ email, fullName: name, phone });
  } catch (e) {
    const m = String(e.message || '') + ' ' + String(e.code || '');
    if (/already|exists|registered/i.test(m)) { s.step = 'email'; delete s.data.email; return ctx.say('email_exists'); }
    if (/database error/i.test(m)) { ctx.session.state = { rl: s.rl }; return ctx.say('phone_exists'); }   // unique phone clash in the signup trigger
    throw e;
  }
  const userId = user && (user.id || (user.user && user.user.id));
  if (!userId) throw new Error('create_user_no_id');
  await ctx.deps.store.link(userId, ctx.from.id, ctx.chatId, ctx.from.username);
  ctx.account = await ctx.deps.store.linkedAccount(ctx.from.id);
  ctx.session.state = { rl: s.rl };
  const member = memberNo(ctx.account && ctx.account.member_no);
  await logActivity(ctx, 'account_created', { via: 'telegram' }, 'New account ' + member + ' — ' + name + ', ' + maskPhone(phone) + ' (Telegram).');
  let link = null;
  try { link = await ctx.deps.store.signInLink(email, ctx.deps.siteUrl + '/set-password.html'); } catch (e) { link = null; }
  await ctx.say('account_ready', { member }, link ? buttons([[[t('btn_open_link', ctx.lang), link]]]) : undefined);
  return showMenu(ctx);
}

async function linkWithToken(ctx, token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const userId = await ctx.deps.store.useLinkToken(hash);
  if (!userId) return ctx.say('link_invalid');
  await ctx.deps.store.link(userId, ctx.from.id, ctx.chatId, ctx.from.username);
  ctx.account = await ctx.deps.store.linkedAccount(ctx.from.id);
  ctx.session.state = { rl: ctx.session.state.rl };
  const member = memberNo(ctx.account && ctx.account.member_no);
  await logActivity(ctx, 'telegram_linked', {}, 'Telegram connected to account ' + member + '.');
  await ctx.say('linked', { member });
  return showMenu(ctx);
}

async function sendLoginLink(ctx) {
  if (!ctx.account) return ctx.say('need_account', {}, buttons([[[t('btn_signup', ctx.lang), 'm:signup']], [[t('btn_have_account', ctx.lang), 'm:have']]]));
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  if ((await ctx.deps.store.countActivity(ctx.account.id, 'login_link', since)) >= LIMITS.loginLinksPerHour) return ctx.say('login_limit');
  const email = await ctx.deps.store.userEmail(ctx.account.id);
  const target = ctx.account.password_set_at ? '/my.html' : '/set-password.html';
  const link = email ? await ctx.deps.store.signInLink(email, ctx.deps.siteUrl + target) : null;
  if (!link) throw new Error('login_link_failed');
  await logActivity(ctx, 'login_link', {}, 'Website sign-in link sent to ' + memberNo(ctx.account.member_no) + '.');
  return ctx.say('login_link', {}, buttons([[[t(ctx.account.password_set_at ? 'btn_open_site' : 'btn_open_link', ctx.lang), link]]]));
}

async function requireActive(ctx) {
  if (!ctx.account) {
    await ctx.say('need_account', {}, buttons([[[t('btn_signup', ctx.lang), 'm:signup']], [[t('btn_have_account', ctx.lang), 'm:have']]]));
    return false;
  }
  if (await ctx.deps.store.frozen(ctx.account.id)) {
    await ctx.say('frozen', {}, buttons([[[t('btn_login', ctx.lang), 'm:login']]]));
    return false;
  }
  return true;
}

// ---------- listing ----------
async function startListing(ctx, firstText) {
  if (!(await requireActive(ctx))) return;
  ctx.session.state = { rl: ctx.session.state.rl, flow: 'list', step: 'details', notes: [], asked: null, photos: [] };
  if (firstText && firstText.length > 25) return listingText(ctx, firstText);   // "I want to sell my 10 marla house in G-13…"
  return ctx.raw(AMAAN.list_start[ctx.lang]);
}

async function listingText(ctx, text) {
  const s = ctx.session.state;
  if (s.step === 'photos' && RE.done.test(text)) return toReview(ctx);
  const areaNames = await ctx.deps.assistant.areaNames();
  const prev = (s.notes || []).length ? factsFromNotes(s.notes, areaNames) : null;
  s.notes = (s.notes || []).concat(contextualise(text, s.asked)).slice(-12);
  const facts = factsFromNotes(s.notes, areaNames);
  // a city that opens on 6 October: say so once, then carry on (listings are saved now)
  const notice = launchNotice(prev, facts, ctx.lang, ctx.deps.now && ctx.deps.now());
  // learning: the city a member chose for an area found in two cities, and
  // area names we don't know yet (both only count once 3 people agree)
  if (ctx.account && facts.city && facts.area) {
    if (prev && !prev.city && prev.city_options && prev.city_options.length > 1) await observe(ctx.deps.store, ctx.account, 'area', facts.city, facts.area, { from: 'city_choice' });
    else if ((!prev || prev.area !== facts.area || prev.city !== facts.city) && !placeOf(facts.area, facts.city)) await observe(ctx.deps.store, ctx.account, 'area', facts.city, facts.area, { from: 'chat' });
  }
  if (notice) await ctx.raw(notice);
  const miss = missingFacts(facts);
  if (miss.length) {
    s.step = 'details'; s.asked = miss[0];
    const summary = factsSummary(facts);
    return ctx.raw((summary ? summary + '\n' : '') + askFor(miss[0], facts, ctx.lang));
  }
  s.asked = null;
  if (s.step === 'review') return toReview(ctx);           // a change after the review → show it again
  if (s.step !== 'photos') {
    s.step = 'photos';
    return ctx.raw(factsSummary(facts) + '\n\n' + t('photos_ask', ctx.lang), buttons([[[t('btn_done_photos', ctx.lang), 'l:done']]]));
  }
  return ctx.say('photos_ask', {}, buttons([[[t('btn_done_photos', ctx.lang), 'l:done']]]));
}

// Photos are saved as they arrive (each update is quick), into the owner's
// own folder, so publishing later only links them.
async function onPhoto(ctx, sizes) {
  const s = ctx.session.state;
  if (!(s.flow === 'list' && s.step === 'photos')) return ctx.say('photo_not_now');
  if (!ctx.account) return requireActive(ctx);
  s.photos = s.photos || [];
  if (s.photos.length >= LIMITS.photos) return ctx.say('photo_max', {}, buttons([[[t('btn_done_photos', ctx.lang), 'l:done']]]));
  const sorted = sizes.slice().sort((a, b) => (a.width * a.height) - (b.width * b.height));
  const big = sorted[sorted.length - 1];
  const thumb = sorted.find((p) => p.width >= 600) || big;
  const n = s.photos.length + 1;
  const base = ctx.account.id + '/tg/' + Date.now() + '-' + n;
  try {
    const main = await ctx.deps.tg.download(big.file_id, PHOTO_MAX_BYTES);
    const url = await ctx.deps.store.uploadPhoto(base + '.jpg', main.bytes, 'image/jpeg');
    let thumbUrl = url;
    if (thumb.file_id !== big.file_id) {
      const small = await ctx.deps.tg.download(thumb.file_id, PHOTO_MAX_BYTES);
      thumbUrl = await ctx.deps.store.uploadPhoto(base + '-thumb.jpg', small.bytes, 'image/jpeg');
    }
    s.photos.push({ url, thumb: thumbUrl });
  } catch (e) {
    console.error('[telegram] photo save failed:', e && e.message);
    s.photoFailures = (s.photoFailures || 0) + 1;
    return ctx.say('error');
  }
  return ctx.say(s.photos.length >= LIMITS.photos ? 'photo_max' : 'photo_got', { n }, buttons([[[t('btn_done_photos', ctx.lang), 'l:done']]]));
}

async function toReview(ctx) {
  const s = ctx.session.state;
  if (!(s.photos || []).length) return ctx.say('need_photo');
  const facts = factsFromNotes(s.notes || [], await ctx.deps.assistant.areaNames());
  s.step = 'review'; s.editing = false;
  return ctx.say('review', { summary: reviewText(facts, s.photos.length) },
    buttons([[[t('btn_publish', ctx.lang), 'l:publish']], [[t('btn_change', ctx.lang), 'l:edit'], [t('btn_cancel', ctx.lang), 'l:cancel']]]));
}

// Every check the website applies, plus the bot's own limits.
export async function publishChecks(f, account, store, L) {
  const miss = missingFacts(f);
  if (miss.length) return { reason: t('why_missing', L, { what: miss.join(', ') }) };
  if (!VALID_TYPES.includes(f.property_type)) return { reason: t('why_missing', L, { what: 'property_type' }) };
  const cities = await store.activeCities();
  const city = cities.find((c) => c.toLowerCase() === String(f.city).toLowerCase());
  if (!city) return { reason: t('why_city', L, { cities: cities.join(', ') }) };
  const rent = f.purpose === 'rent';
  if (!(f.price >= (rent ? 1000 : 100000) && f.price <= (rent ? 5e7 : 5e10))) return { reason: t('why_price', L) };
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  if ((await store.countActivity(account.id, 'listing_published', since)) >= LIMITS.listingsPerDay) return { reason: t('why_daily', L, { n: LIMITS.listingsPerDay }) };
  const own = await store.ownListings(account.id);
  const dup = own.find((l) => Number(l.price) === Math.round(f.price) && l.property_type === f.property_type &&
    String(l.area).toLowerCase() === String(f.area).toLowerCase() && Number(l.size_marla) === Number(f.size_value));
  if (dup) return { reason: t('why_duplicate', L) };
  return { city };
}

async function publish(ctx) {
  const s = ctx.session.state;
  if (!(await requireActive(ctx))) return;
  const facts = factsFromNotes(s.notes || [], await ctx.deps.assistant.areaNames());
  const check = await publishChecks(facts, ctx.account, ctx.deps.store, ctx.lang);
  if (check.reason) { s.step = 'review'; return ctx.say('check_failed', { reason: check.reason }); }
  await ctx.say('publishing');
  const row = listingRow(facts, ctx.account.id, check.city);
  const photos = (s.photos || []).slice(0, LIMITS.photos);
  row.photos = photos.map((p) => p.url);
  row.thumbs = photos.map((p) => p.thumb);
  let listing;
  try { listing = await ctx.deps.store.insertListing(row); } catch (e) {
    console.error('[telegram] listing insert failed:', e && e.message);
    if (/frozen/i.test(String(e.message))) return ctx.say('frozen', {}, buttons([[[t('btn_login', ctx.lang), 'm:login']]]));
    return ctx.say('publish_error');
  }
  ctx.session.state = { rl: s.rl };
  const q = ctx.deps.quality.score(listing || row);
  const tips = q.tips.slice(0, 2).map((x) => '\n• ' + x).join('');
  const url = ctx.deps.siteUrl + '/listing.html?id=' + listing.id;
  await logActivity(ctx, 'listing_published', { listing_id: listing.id, photos: photos.length, score: q.score },
    'Listing published by ' + memberNo(ctx.account.member_no) + ': ' + row.title + ' — ' + url);
  await remember(ctx.deps.store, ctx.account, { cities: [check.city], areas: [row.area], types: [row.property_type], lang: ctx.lang, last_intent: 'list' });
  if (!isLaunched(check.city, ctx.deps.now && ctx.deps.now())) await ctx.say('published_prelaunch', { url, city: check.city, score: q.score, tips: tips ? '\n' + tips : '' }, menu(ctx));
  else await ctx.say('published', { url, score: q.score, tips: tips ? '\n' + tips : '' }, menu(ctx));
  if (s.photoFailures) await ctx.say('photos_failed', { n: s.photoFailures });
}

async function myListings(ctx) {
  if (!ctx.account) return ctx.say('need_account', {}, buttons([[[t('btn_signup', ctx.lang), 'm:signup']], [[t('btn_have_account', ctx.lang), 'm:have']]]));
  const rows = await ctx.deps.store.ownListings(ctx.account.id);
  if (!rows.length) return ctx.say('my_listings_none', {}, menu(ctx));
  const lines = rows.slice(0, 10).map((l, i) => (i + 1) + '. ' + l.title + (l.moderation_status === 'hidden' ? ' (hidden)' : '') + (l.city && !isLaunched(l.city) ? ' (shows from 6 Oct)' : '') + '\n' + ctx.deps.siteUrl + '/listing.html?id=' + l.id);
  return ctx.raw(t('my_listings', ctx.lang) + '\n\n' + lines.join('\n\n'), menu(ctx));
}

async function confirmAvailable(ctx, listingId, msgId) {
  if (!(await requireActive(ctx))) return;
  const row = await ctx.deps.store.updateListing(listingId, ctx.account.id, { last_confirmed_at: new Date().toISOString() });
  if (!row) return ctx.say('error');
  await ctx.deps.tg.removeButtons(ctx.chatId, msgId);
  await logActivity(ctx, 'listing_confirmed_available', { listing_id: listingId }, memberNo(ctx.account.member_no) + ' confirmed "' + row.title + '" is still available.');
  return ctx.say('avail_done');
}

async function ownerStats(ctx) {
  const st = ctx.deps.store;
  const count = async (table, filter, col) => ((await st.rest(table + '?select=' + col + (filter ? '&' + filter : ''))) || []).length;
  const today = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [accounts, links, published] = await Promise.all([
    count('profiles', 'created_via=eq.telegram', 'id'), count('telegram_links', '', 'user_id'),
    count('activity_log', 'kind=eq.listing_published&created_at=gt.' + encodeURIComponent(today), 'id')
  ]);
  return ctx.raw('Telegram accounts: ' + accounts + '\nConnected Telegram users: ' + links + '\nListings published via Telegram (24h): ' + published);
}

// ---------- learning memory: owner review ----------
async function ownerLearn(ctx) {
  const rows = await pendingFacts(ctx.deps.store, 10);
  if (!rows.length) return ctx.say('learn_none');
  await ctx.say('learn_head');
  for (const f of rows) await ctx.raw(factLine(f), buttons([[['✅ Approve', 'kb:a:' + f.id], ['✖ Reject', 'kb:r:' + f.id]]]));
}
async function ownerDecide(ctx, data, msgId) {
  const [, a, id] = data.split(':');
  const status = a === 'a' ? 'approved' : 'rejected';
  try {
    const name = await ctx.deps.store.rpc('kb_decide', { p_id: Number(id), p_status: status, p_by: null });
    if (msgId) await ctx.deps.tg.removeButtons(ctx.chatId, msgId);
    return ctx.say('learn_done', { name: name || '#' + id, status: status === 'approved' ? 'approved — added to the area list' : 'rejected' });
  } catch (e) { return ctx.say('error'); }
}
