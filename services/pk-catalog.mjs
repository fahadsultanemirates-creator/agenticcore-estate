// AgenticCore Pakistan price list for the assistants (website guide, Amaan)
// and the Telegram bot. Source of truth: the PK site's own published data
// (agenticcorepk.com/data/services.json + packages.json). The server reads
// it live (cached 15 minutes), so a price changed on the PK site is what the
// bots quote; data/pk-catalog.json (scripts/gen-pk-catalog.mjs) is the
// bundled fallback. Prices are only ever quoted word for word from here.

import bundled from '../data/pk-catalog.json' with { type: 'json' };

const PK_DATA = 'https://agenticcorepk.com/data/';
const TTL = 15 * 60 * 1000;

const rs = (n) => 'Rs ' + Number(n).toLocaleString('en-US');

// Only what the bots need, English + Urdu.
export function compactCatalog(services, packages) {
  return {
    source: services.meta && services.meta.source,
    notes: (services.meta && services.meta.notes) || [], notes_ur: (services.meta && services.meta.notes_ur) || [],
    groups: (services.groups || []).map((g) => ({ no: g.no, type: g.type, type_ur: g.type_ur })),
    services: (services.services || []).map((s) => ({
      no: s.no, group: s.group, name: s.name, name_ur: s.name_ur, brief: s.brief, brief_ur: s.brief_ur,
      partner: !!s.partner,
      lines: (s.lines || []).map((l) => ({ text: l.text, text_ur: l.text_ur, from: !!l.from, included: l.included || null, included_ur: l.included_ur || null })),
      delivery: s.delivery, delivery_ur: s.delivery_ur
    })),
    packages: (packages.packages || []).map((p) => ({
      no: p.no, id: p.id, section: p.section, name: p.name, name_ur: p.name_ur, for: p.for, for_ur: p.for_ur,
      monthly: p.monthly || null, monthly_from: !!p.monthly_from, setup: p.setup || null, setup_quoted: !!p.setup_quoted,
      min_months: p.min_months || 0, one_off: p.one_off || null, one_off_from: !!p.one_off_from, quote_only: !!p.quote_only,
      term_note: p.term_note || null, delivery_short: p.delivery_short, delivery_short_ur: p.delivery_short_ur,
      includes: (p.includes || []).map((i) => i.label), includes_ur: (p.includes || []).map((i) => i.label_ur || i.label),
      paid_separately: p.paid_separately || null
    })),
    running_costs: (services.running_costs || []).map((r) => ({ name: r.name, text: r.text }))
  };
}

// "Rs 7,999 a month, minimum 3 months, no set-up fee" (English, exact figures).
export function packagePrice(p) {
  if (p.one_off) return (p.one_off_from ? 'From ' : '') + rs(p.one_off) + ' one-off';
  const parts = [(p.monthly_from ? 'From ' : '') + rs(p.monthly) + ' a month'];
  if (p.min_months) parts.push('minimum ' + p.min_months + ' months');
  if (p.setup_quoted) parts.push('set-up quoted');
  else parts.push(p.setup ? rs(p.setup) + ' one-time set-up' : 'no set-up fee');
  return parts.join(', ');
}
export function packagePriceUr(p) {
  const n = (x) => Number(x).toLocaleString('en-US');
  if (p.one_off) return (p.one_off_from ? 'کم از کم ' : '') + 'Rs ' + n(p.one_off) + ' ایک بار';
  const parts = [(p.monthly_from ? 'کم از کم ' : '') + 'Rs ' + n(p.monthly) + ' ماہانہ'];
  if (p.min_months) parts.push('کم از کم ' + p.min_months + ' ماہ کے لیے');
  if (p.setup_quoted) parts.push('سیٹ اپ کی قیمت الگ سے بتائی جاتی ہے');
  else parts.push(p.setup ? 'Rs ' + n(p.setup) + ' ایک بار سیٹ اپ' : 'کوئی سیٹ اپ فیس نہیں');
  return parts.join('، ');
}

// The price list as plain text for the system prompt.
export function catalogText(cat) {
  const out = ['AGENTICCORE PAKISTAN PRICE LIST (published on agenticcorepk.com — quote these word for word)'];
  (cat.notes || []).forEach((n) => out.push('- ' + n));
  cat.groups.forEach((g) => {
    out.push('', 'SERVICES — ' + g.type);
    cat.services.filter((s) => s.group === g.no).forEach((s) => {
      const lines = s.lines.map((l) => l.text + (l.included ? ' Includes: ' + l.included : '')).join(' / ');
      out.push('#' + s.no + ' ' + s.name + ': ' + lines + ' Delivery: ' + s.delivery + (s.partner ? ' (partner work quoted separately)' : '') + ' — ' + s.brief);
    });
  });
  out.push('', 'MONTHLY PACKAGES AND LAUNCH KITS');
  cat.packages.forEach((p) => {
    out.push('Package ' + p.no + ' ' + p.name + ': ' + packagePrice(p) + (p.quote_only ? ' (proposal first)' : '') + '. For: ' + p.for +
      ' Includes: ' + p.includes.join('; ') + '. Delivery: ' + p.delivery_short + '.' + (p.paid_separately ? ' Paid separately: ' + p.paid_separately : ''));
  });
  if (cat.running_costs.length) {
    out.push('', 'RUNNING COSTS (paid by the client directly to the provider, never to AgenticCore)');
    cat.running_costs.forEach((r) => out.push('- ' + r.name + ': ' + r.text));
  }
  return out.join('\n');
}

// ---------- matching a question to services ----------
// Urdu / Roman Urdu words → the English words used in service names.
const ALIASES = [
  [/ویب\s*سائٹ|website|web\s*site|webside|websit/gi, ' website '], [/لوگو|logo/gi, ' logo '], [/برانڈنگ|برانڈ|branding/gi, ' brand '],
  [/بروشر|brochure|broucher|brochur/gi, ' brochure '], [/فلائر|flyer|flier|pamphlet|پمفلٹ/gi, ' flyer '], [/ویڈیو|video/gi, ' video '],
  [/ریل|reels?/gi, ' reel '], [/فلور\s*پلان|floor\s*plans?|naqsha|نقشہ/gi, ' floor plan map '], [/تھری\s*ڈی|3\s*-?\s*d\b/gi, ' 3d '],
  [/لینڈنگ\s*پیج|landing\s*page/gi, ' landing page '], [/پوسٹ|posts?\b/gi, ' post '], [/کارڈ|cards?\b/gi, ' card '],
  [/اشتہار(ات)?|\bads?\b|advertis\w*/gi, ' ads '], [/بوٹ|chat\s*bot|\bbots?\b/gi, ' bot '], [/ٹور|\btour\b/gi, ' tour '], [/ڈرون|drone/gi, ' drone '],
  [/کیپشنز?|captions?/gi, ' captions '], [/تصاویر|تصویر|فوٹو|photos?|pictures?|pics?/gi, ' photo '], [/پورٹل|portal/gi, ' portal '],
  [/سی\s*آر\s*ایم|\bcrm\b/gi, ' crm '], [/بکنگ|booking/gi, ' booking '], [/قسط|اقساط|instal+ments?|qist/gi, ' instalment '],
  [/گوگل|google/gi, ' google '], [/فیس\s*بک|facebook/gi, ' facebook '], [/وائس|voice/gi, ' voice '], [/واٹس\s*ایپ|whatsapp/gi, ' whatsapp '],
  [/اقرار\s*نامہ|agreement/gi, ' agreement '], [/بیلٹنگ|balloting|ballot/gi, ' balloting '], [/پریزنٹیشن|presentation/gi, ' presentation '],
  [/کیلکولیٹر|calculator/gi, ' calculator '], [/ورچوئل|virtual|360/gi, ' virtual 360 '], [/سوشل\s*میڈیا|social\s*media/gi, ' social '],
  [/اسکرپٹ|script/gi, ' script '], [/ایس\s*ای\s*او|\bseo\b|blog/gi, ' seo blog '], [/ریویو|reviews?/gi, ' review ']
];
const GENERIC = new Set(['property', 'project', 'agency', 'agent', 'and', 'the', 'for', 'one', 'two', 'first', 'draft', 'setup', 'set', 'up',
  'system', 'management', 'plus', 'ai', 'developer', 'personal', 'single', 'easy', 'online', 'custom', 'service', 'kit', 'design', 'digital',
  'live', 'support', 'event', 'english', 'roman', 'urdu', 'platform', 'platforms', 'sale', 'purchase', 'rental', 'new',
  'plan', 'editing', 'listing', 'page', 'pages', 'media']);
function words(s) {
  let t = ' ' + String(s || '').toLowerCase() + ' ';
  ALIASES.forEach(([re, w]) => { t = t.replace(re, w); });
  return t.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
}
const PROJECT_HINT = /\b(project|tower|building|storey|story|floors?|society|scheme|developer|builder|plaza|mall|apartments)\b|منزل|عمارت|سوسائٹی|پراجیکٹ|پروجیکٹ|بلڈر|ڈویلپر|ٹاور/i;
const AGENCY_HINT = /\b(agency|agent|dealer|estate office|realtor|consultant)\b|ایجنسی|ایجنٹ|ڈیلر/i;

// Greedy: the best-matching service, then the best for the words left over
// ("website and 3D floor plan" → Project Website + 3D Floor Plan).
export function matchServices(cat, text, max) {
  const asked = new Set(words(text));
  const projectish = PROJECT_HINT.test(text), agencyish = AGENCY_HINT.test(text);
  const keysOf = (s) => { const k = words(s.name).filter((w) => !GENERIC.has(w) && w.length >= 2); return k.filter((w, i) => k.indexOf(w) === i); };
  const picked = [];
  while (asked.size && picked.length < (max || 3)) {
    let best = null;
    cat.services.forEach((s) => {
      if (picked.indexOf(s) >= 0) return;
      const keys = keysOf(s);
      const hit = keys.filter((w) => asked.has(w));
      if (!hit.length) return;
      let score = hit.length / keys.length;
      if (projectish && s.group === 2) score += 0.3;
      if (agencyish && s.group === 1) score += 0.3;
      if (score < 0.33) return;
      if (!best || hit.length > best.hit.length || (hit.length === best.hit.length && score > best.score)) best = { s, hit, score };
    });
    if (!best) break;
    picked.push(best.s);
    best.hit.forEach((w) => asked.delete(w));
  }
  return picked;
}

const PACKAGE_Q = /\b(packages?|plans?|monthly|subscription|launch kit)\b|پیکج|پیکیج|ماہانہ|پلان/i;
export function asksPackages(text) { return PACKAGE_Q.test(String(text || '')); }

// Deterministic answers (no AI needed): exact published lines.
export function servicesAnswer(list, lang) {
  if (lang === 'ur') {
    return list.map((s) => s.name_ur + ': ' + s.lines.map((l) => l.text_ur).join(' / ') + ' ڈیلیوری: ' + s.delivery_ur).join('\n') +
      '\nیہ AgenticCore Pakistan کی شائع شدہ ابتدائی قیمتیں ہیں (ٹیکس الگ)۔ بڑے یا خاص کام کی قیمت ٹیم بتاتی ہے۔';
  }
  const tail = lang === 'ro'
    ? 'Yeh AgenticCore Pakistan ki published introductory qeematein hain (tax alag). Bara ya custom kaam team quote karti hai.'
    : 'These are AgenticCore Pakistan\'s published introductory prices (taxes extra where applicable). Larger or custom work is quoted by the team.';
  return list.map((s) => s.name + ': ' + s.lines.map((l) => l.text).join(' / ') + ' Delivery: ' + s.delivery).join('\n') + '\n' + tail;
}
export function packagesAnswer(cat, lang) {
  if (lang === 'ur') {
    return 'AgenticCore Pakistan کے پیکجز:\n' + cat.packages.map((p) => '• ' + p.name_ur + ': ' + packagePriceUr(p)).join('\n') + '\nہر پیکج میں کیا شامل ہے، سروسز پیج پر دیکھیں یا مجھ سے پوچھیں۔';
  }
  const head = lang === 'ro' ? 'AgenticCore Pakistan ke packages:' : 'AgenticCore Pakistan packages:';
  const tail = lang === 'ro' ? 'Har package mein kya shamil hai, services page par dekhein ya mujh se poochein.' : 'Ask me what any package includes, or see the services page.';
  return head + '\n' + cat.packages.map((p) => '• ' + p.name + ': ' + packagePrice(p)).join('\n') + '\n' + tail;
}

// ---------- loading ----------
let cache = { at: 0, cat: bundled, text: catalogText(bundled) };
function valid(s, p) { return s && Array.isArray(s.services) && s.services.length >= 20 && p && Array.isArray(p.packages) && p.packages.length >= 3; }

// Returns { cat, text }. Never throws; falls back to the bundled copy.
export async function getCatalog(opts) {
  const o = opts || {};
  const now = o.now || Date.now();
  if (now - cache.at < TTL && cache.at) return cache;
  const f = o.fetchImpl || globalThis.fetch;
  try {
    const get = async (name) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      try { const r = await f(PK_DATA + name, { signal: ctrl.signal }); if (!r.ok) throw new Error('http_' + r.status); return await r.json(); } finally { clearTimeout(t); }
    };
    const [s, p] = await Promise.all([get('services.json'), get('packages.json')]);
    if (!valid(s, p)) throw new Error('shape');
    const cat = compactCatalog(s, p);
    cache = { at: now, cat, text: catalogText(cat) };
  } catch (e) {
    cache = { at: now - TTL + 60 * 1000, cat: cache.cat, text: cache.text };   // retry in a minute
  }
  return cache;
}
export function bundledCatalog() { return { cat: bundled, text: catalogText(bundled) }; }
