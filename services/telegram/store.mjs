// Server-side Supabase access for the Telegram bot.
// Uses SUPABASE_SERVICE_ROLE_KEY (Netlify, server only, never sent to a
// browser or logged). It bypasses Row Level Security, so every function
// here acts only on the account the bot has already identified from the
// verified Telegram user -- callers never pass a user id from chat text.
// Database triggers (sample/link checks, profile caps, the 30-day freeze)
// still apply to everything written here.

import { SUPABASE_URL } from '../supabase.mjs';

export function serviceKey() { return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(); }
export function storeConfigured() { return Boolean(serviceKey()); }

export function makeStore(fetchImpl) {
  const f = fetchImpl || globalThis.fetch;
  function headers(extra) {
    const key = serviceKey();
    const h = { apikey: key, 'Content-Type': 'application/json' };
    // legacy service_role JWT also goes in Authorization; new sb_secret_ keys only in apikey
    if (/^eyJ/.test(key)) h.Authorization = 'Bearer ' + key;
    return Object.assign(h, extra || {});
  }
  async function req(path, opts) {
    opts = opts || {};
    if (!serviceKey()) throw new Error('store_not_configured');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 8000);
    try {
      const res = await f(SUPABASE_URL + path, {
        method: opts.method || 'GET', headers: headers(opts.headers),
        body: opts.raw ? opts.raw : (opts.body !== undefined ? JSON.stringify(opts.body) : undefined), signal: ctrl.signal
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
      if (!res.ok) {
        const e = new Error((data && (data.message || data.msg || data.error_description || data.error)) || ('supabase_' + res.status));
        e.status = res.status; e.code = data && (data.code || data.error_code);
        throw e;
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  const rest = (path, opts) => req('/rest/v1/' + path, opts);
  const enc = encodeURIComponent;

  return {
    rest,
    // ---- dedupe + sessions ----
    async firstSeen(updateId) {
      const rows = await rest('tg_seen_updates?on_conflict=update_id', {
        method: 'POST', body: { update_id: updateId }, headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }
      });
      return Array.isArray(rows) && rows.length > 0;
    },
    async getSession(chatId) {
      const rows = await rest('tg_sessions?chat_id=eq.' + Number(chatId) + '&select=*');
      return (rows && rows[0]) || null;
    },
    async saveSession(s) {
      await rest('tg_sessions?on_conflict=chat_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: { chat_id: s.chat_id, tg_user_id: s.tg_user_id, lang: s.lang, state: s.state || {}, history: (s.history || []).slice(-12), updated_at: new Date().toISOString() }
      });
    },
    // ---- accounts ----
    async linkedAccount(tgUserId) {
      const rows = await rest('telegram_links?tg_user_id=eq.' + Number(tgUserId) + '&select=user_id,chat_id,notify');
      if (!rows || !rows[0]) return null;
      const p = await rest('profiles?id=eq.' + rows[0].user_id + '&select=id,full_name,member_no,created_via,password_set_at,created_at,role');
      return p && p[0] ? Object.assign({ chat_id: rows[0].chat_id, notify: rows[0].notify }, p[0]) : null;
    },
    async frozen(userId) {
      const v = await rest('rpc/ac_account_frozen', { method: 'POST', body: { p_user: userId } });
      return v === true;
    },
    async profileByPhone(variants) {
      const rows = await rest('profiles?phone=in.(' + variants.map((v) => '"' + v + '"').map(enc).join(',') + ')&select=id');
      return (rows && rows[0]) || null;
    },
    async createUser({ email, fullName, phone }) {
      return req('/auth/v1/admin/users', {
        method: 'POST',
        body: { email, email_confirm: false, user_metadata: { full_name: fullName, phone, role: 'seller' }, app_metadata: { created_via: 'telegram' } }
      });
    },
    // One-time sign-in link for the website (Supabase magic link; it is
    // delivered in the private Telegram chat instead of by email).
    async signInLink(email, redirectTo) {
      for (const type of ['magiclink', 'recovery']) {
        try {
          const r = await req('/auth/v1/admin/generate_link', { method: 'POST', body: { type, email, redirect_to: redirectTo } });
          const link = r && (r.action_link || (r.properties && r.properties.action_link));
          if (link) return link;
        } catch (e) { if (type === 'recovery') throw e; }
      }
      return null;
    },
    async userEmail(userId) {
      const u = await req('/auth/v1/admin/users/' + userId);
      return u && u.email;
    },
    async link(userId, tgUserId, chatId, username) {
      // one Telegram account per website account and vice versa
      await rest('telegram_links?tg_user_id=eq.' + Number(tgUserId), { method: 'DELETE' });
      await rest('telegram_links?on_conflict=user_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: { user_id: userId, tg_user_id: Number(tgUserId), chat_id: Number(chatId), tg_username: username || null, linked_at: new Date().toISOString() }
      });
    },
    async useLinkToken(tokenHash) {
      const rows = await rest('tg_link_tokens?token_hash=eq.' + enc(tokenHash) + '&used_at=is.null&expires_at=gt.' + enc(new Date().toISOString()), {
        method: 'PATCH', body: { used_at: new Date().toISOString() }, headers: { Prefer: 'return=representation' }
      });
      return (rows && rows[0] && rows[0].user_id) || null;
    },
    async log(user, kind, detail) {
      await rest('activity_log', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: { user_id: user ? user.id : null, member_no: user ? user.member_no : null, channel: 'telegram', kind, detail: detail || {} }
      }).catch(() => null);
    },
    async countActivity(userId, kind, sinceIso) {
      const rows = await rest('activity_log?user_id=eq.' + userId + '&kind=eq.' + enc(kind) + '&created_at=gt.' + enc(sinceIso) + '&select=id');
      return (rows || []).length;
    },
    // ---- listings ----
    async activeCities() {
      const rows = await rest('cities?active=eq.true&select=name');
      return (rows || []).map((r) => r.name);
    },
    async ownListings(userId) {
      return (await rest('listings?owner_id=eq.' + userId + '&is_sample=eq.false&select=id,title,price,area,city,size_marla,size_unit,property_type,type,moderation_status,last_confirmed_at,created_at&order=created_at.desc&limit=20')) || [];
    },
    async insertListing(row) {
      const rows = await rest('listings', { method: 'POST', body: row, headers: { Prefer: 'return=representation' } });
      return rows && rows[0];
    },
    async updateListing(id, ownerId, patch) {
      const rows = await rest('listings?id=eq.' + id + '&owner_id=eq.' + ownerId, { method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' } });
      return rows && rows[0];
    },
    async uploadPhoto(path, bytes, contentType) {
      await req('/storage/v1/object/listing-photos/' + path.split('/').map(enc).join('/'), {
        method: 'POST', raw: bytes, headers: { 'Content-Type': contentType, 'x-upsert': 'true' }, timeoutMs: 15000
      });
      return SUPABASE_URL + '/storage/v1/object/public/listing-photos/' + path;
    },
    // ---- notifications ----
    async markSent(kind, ref, userId) {
      const rows = await rest('tg_notifications?on_conflict=kind,ref', {
        method: 'POST', body: { kind, ref, user_id: userId || null }, headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }
      });
      return Array.isArray(rows) && rows.length > 0;   // false = already sent before
    }
  };
}
