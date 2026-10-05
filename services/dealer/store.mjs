// AgenticCore Dealer AI — database access (feed_ tables only, service role,
// server side). Every call that changes a listing or request filters by the
// account the bot identified from the verified Telegram user, so nobody can
// act on someone else's entry by guessing an id.

import { makeStore } from '../telegram/store.mjs';

const enc = encodeURIComponent;
const inList = (ids) => '(' + ids.map((x) => enc(x)).join(',') + ')';
const ACCOUNT_COLS = 'id,tg_user_id,chat_id,name,phone,role,lang,status,reveal_limit';
const LISTING_COLS = 'id,ref,account_id,purpose,property_type,city,area,address,size_value,size_unit,size_marla,price,beds,baths,notes,status,expires_at,created_at,feed_accounts(role)';

function withRole(rows) {
  return (rows || []).map((r) => {
    const x = Object.assign({}, r, { poster_role: r.feed_accounts ? r.feed_accounts.role : null });
    delete x.feed_accounts;
    return x;
  });
}
const one = (rows) => (Array.isArray(rows) && rows[0]) || null;
const startOfDayPK = (now) => {
  // midnight in Pakistan (UTC+5), as an ISO string
  const d = new Date(now + 5 * 3600 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - 5 * 3600 * 1000).toISOString();
};

export function makeDealerStore(fetchImpl) {
  const { rest } = makeStore(fetchImpl);
  const json = (method, body, prefer) => ({ method, body, headers: { Prefer: prefer || 'return=representation' } });

  return {
    // ---- updates + sessions (separate from the main bot's) ----
    async firstSeen(updateId) {
      const rows = await rest('feed_seen_updates?on_conflict=update_id', json('POST', { update_id: updateId }, 'resolution=ignore-duplicates,return=representation'));
      return Array.isArray(rows) && rows.length > 0;
    },
    async getSession(chatId) { return one(await rest('feed_sessions?chat_id=eq.' + Number(chatId) + '&select=state,lang')); },
    async saveSession(chatId, state, lang) {
      await rest('feed_sessions?on_conflict=chat_id', json('POST', { chat_id: Number(chatId), state: state || {}, lang: lang || null, updated_at: new Date().toISOString() },
        'resolution=merge-duplicates,return=minimal'));
    },

    // ---- accounts ----
    async accountByTg(tgUserId) { return one(await rest('feed_accounts?tg_user_id=eq.' + Number(tgUserId) + '&select=' + ACCOUNT_COLS)); },
    async accountById(id) { return one(await rest('feed_accounts?id=eq.' + enc(id) + '&select=' + ACCOUNT_COLS)); },
    async createAccount(row) { return one(await rest('feed_accounts', json('POST', row))); },
    async updateAccount(id, patch) { await rest('feed_accounts?id=eq.' + enc(id), json('PATCH', patch, 'return=minimal')); },

    // ---- listings ----
    async countListingsSince(accountId, sinceIso) {
      const rows = await rest('feed_listings?account_id=eq.' + enc(accountId) + '&created_at=gte.' + enc(sinceIso) + '&select=id');
      return (rows || []).length;
    },
    async findDuplicate(accountId, row) {
      let q = 'feed_listings?account_id=eq.' + enc(accountId) + '&status=eq.active&purpose=eq.' + row.purpose + '&property_type=eq.' + enc(row.property_type) +
        '&city=eq.' + enc(row.city) + '&area=ilike.' + enc(row.area.replace(/[%_*]/g, '')) + '&select=ref';
      q += row.size_marla == null ? '&size_marla=is.null' : '&size_marla=eq.' + row.size_marla;
      q += row.price == null ? '&price=is.null' : '&price=eq.' + row.price;
      return one(await rest(q));
    },
    async insertListing(row) { return one(await rest('feed_listings', json('POST', row))); },
    async listingById(id) { return one(withRole(await rest('feed_listings?id=eq.' + enc(id) + '&select=' + LISTING_COLS))); },
    async updateOwnListing(accountId, id, patch) {
      const rows = await rest('feed_listings?id=eq.' + enc(id) + '&account_id=eq.' + enc(accountId),
        json('PATCH', Object.assign({ updated_at: new Date().toISOString() }, patch)));
      return one(rows);
    },
    async myListings(accountId) {
      return rest('feed_listings?account_id=eq.' + enc(accountId) + '&status=neq.removed&order=created_at.desc&limit=10&select=' + LISTING_COLS.replace(',feed_accounts(role)', ''));
    },
    // Live entries for a search: coarse filter here, fine matching in feed.mjs
    async liveListings({ purpose, city, types }, now) {
      let q = 'feed_listings?status=eq.active&expires_at=gt.' + enc(new Date(now).toISOString());
      if (purpose) q += '&purpose=eq.' + purpose;
      if (city) q += '&city=eq.' + enc(city);
      if (types && types.length) q += '&property_type=in.' + inList(types);
      return withRole(await rest(q + '&order=created_at.desc&limit=300&select=' + LISTING_COLS));
    },

    // ---- requests ----
    async insertRequest(row) { return one(await rest('feed_requests', json('POST', row))); },
    async requestById(id) { return one(await rest('feed_requests?id=eq.' + enc(id) + '&select=*')); },
    async updateRequest(id, patch, accountId) {
      return one(await rest('feed_requests?id=eq.' + enc(id) + (accountId ? '&account_id=eq.' + enc(accountId) : ''), json('PATCH', patch)));
    },
    async myRequests(accountId) {
      return rest('feed_requests?account_id=eq.' + enc(accountId) + '&status=in.(open,answered,waiting_choice)&order=created_at.desc&limit=10&select=*');
    },
    // Requests still collecting matches for a new listing.
    async alertingRequests({ purpose, city }, now) {
      const iso = enc(new Date(now).toISOString());
      let q = 'feed_requests?status=in.(open,answered)&deadline_at=gt.' + iso + '&or=(purpose.is.null,purpose.eq.' + purpose + ')';
      q += '&or=(city.is.null,city.eq.' + enc('"' + city.replace(/"/g, '') + '"') + ')';
      return rest(q + '&limit=500&select=*');
    },
    async dueRequests(now) {
      return rest('feed_requests?status=in.(open,answered)&deadline_at=lte.' + enc(new Date(now).toISOString()) + '&limit=100&select=*');
    },
    async staleWaiting(now) {
      return rest('feed_requests?status=eq.waiting_choice&active_until=lte.' + enc(new Date(now).toISOString()) + '&limit=200&select=id');
    },

    // ---- matches ----
    // Returns the listing ids that were new for this request.
    async addMatches(requestId, listingIds) {
      if (!listingIds.length) return [];
      const rows = await rest('feed_matches?on_conflict=request_id,listing_id',
        json('POST', listingIds.map((l) => ({ request_id: requestId, listing_id: l, notified_at: new Date().toISOString() })), 'resolution=ignore-duplicates,return=representation'));
      return (rows || []).map((r) => r.listing_id);
    },
    async matchCount(requestId) { return ((await rest('feed_matches?request_id=eq.' + enc(requestId) + '&select=listing_id')) || []).length; },

    // ---- contact reveals ----
    async revealsToday(viewerId, now) {
      return ((await rest('feed_contact_reveals?viewer_id=eq.' + enc(viewerId) + '&created_at=gte.' + enc(startOfDayPK(now)) + '&select=listing_id')) || []).length;
    },
    async hasRevealed(viewerId, listingId) {
      return Boolean(one(await rest('feed_contact_reveals?viewer_id=eq.' + enc(viewerId) + '&listing_id=eq.' + enc(listingId) + '&select=listing_id')));
    },
    async addReveal(viewerId, listingId) {
      await rest('feed_contact_reveals?on_conflict=viewer_id,listing_id', json('POST', { viewer_id: viewerId, listing_id: listingId }, 'resolution=ignore-duplicates,return=minimal'));
    },

    // ---- reports + blocks ----
    async addReport(reporterId, listingId, reason) {
      const rows = await rest('feed_reports?on_conflict=reporter_id,listing_id',
        json('POST', { reporter_id: reporterId, listing_id: listingId, reason }, 'resolution=ignore-duplicates,return=representation'));
      return Array.isArray(rows) && rows.length > 0;
    },
    async addBlock(blockerId, blockedId) {
      await rest('feed_blocks?on_conflict=blocker_id,blocked_id', json('POST', { blocker_id: blockerId, blocked_id: blockedId }, 'resolution=ignore-duplicates,return=minimal'));
    },
    // Accounts on either side of a block with this one.
    async blockedWith(accountId) {
      const a = enc(accountId);
      const rows = await rest('feed_blocks?or=(blocker_id.eq.' + a + ',blocked_id.eq.' + a + ')&select=blocker_id,blocked_id');
      return new Set((rows || []).map((r) => (r.blocker_id === accountId ? r.blocked_id : r.blocker_id)));
    },

    // ---- expiry ----
    async expiringSoon(now, withinMs) {
      return rest('feed_listings?status=eq.active&expiry_notified_at=is.null&expires_at=lte.' + enc(new Date(now + withinMs).toISOString()) +
        '&expires_at=gt.' + enc(new Date(now).toISOString()) + '&limit=200&select=id,ref,account_id,expires_at');
    },
    async expiredNow(now) {
      return rest('feed_listings?status=eq.active&expires_at=lte.' + enc(new Date(now).toISOString()) + '&limit=200&select=id,ref,account_id,expires_at');
    },
    async setListing(id, patch) { await rest('feed_listings?id=eq.' + enc(id), json('PATCH', Object.assign({ updated_at: new Date().toISOString() }, patch), 'return=minimal')); },
    async accountsByIds(ids) {
      if (!ids.length) return [];
      return rest('feed_accounts?id=in.' + inList(ids) + '&select=' + ACCOUNT_COLS);
    },
    async cities() {
      const rows = await rest('cities?active=eq.true&order=sort_order.asc&select=name,projects_only');
      return (rows || []).map((r) => ({ name: r.name, main: r.projects_only !== true }));
    },
    async areaNames() { return ((await rest('areas?select=name')) || []).map((r) => r.name); },
    async cleanSeen(now) { await rest('feed_seen_updates?seen_at=lt.' + enc(new Date(now - 2 * 86400000).toISOString()), { method: 'DELETE' }); },
    async stats() {
      const count = async (q) => ((await rest(q + '&select=id')) || []).length;
      return {
        accounts: await count('feed_accounts?status=eq.active'),
        live: await count('feed_listings?status=eq.active'),
        open: await count('feed_requests?status=in.(open,answered,waiting_choice)')
      };
    }
  };
}
