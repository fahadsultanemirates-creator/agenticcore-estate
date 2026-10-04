// Learning memory (migration 0023) — the server side.
//
// Shared knowledge: place names the system has learned from genuine
// listings and chats (3 different people, or the owner's approval) are
// loaded into services/places.mjs, so Amaan, the website assistant and the
// Telegram bot all get better at knowing which city an area or block is in.
// Member memory: a member's own cities, areas, property types and language,
// used to pick up where they left off. Contributors are hashed in the
// database; nothing personal goes into shared knowledge.

import { setLearnedPlaces } from './places.mjs';

const TTL = 10 * 60 * 1000;
let cache = { at: 0, rows: null };

// rowsFn: () => Promise<[{ city, area, kind, n }]> (kb_known_places)
export async function refreshPlaces(rowsFn, now = Date.now()) {
  if (cache.rows && now - cache.at < TTL) return cache.rows;
  try {
    const rows = (await rowsFn()) || [];
    cache = { at: now, rows };
    setLearnedPlaces(rows.map((r) => ({ city: r.city, area: r.area, n: Number(r.n) || 1 })));
    return rows;
  } catch (e) { cache.at = now; return cache.rows || []; }
}
export function resetPlacesCache() { cache = { at: 0, rows: null }; }

// One observation from a chat (the listing trigger covers published listings).
export async function observe(store, account, kind, city, name, detail) {
  if (!store || !store.rpc || !account || !city || !name) return;
  try { await store.rpc('kb_observe', { p_kind: kind, p_city: city, p_name: String(name).slice(0, 120), p_detail: detail || {}, p_source: 'telegram', p_contributor: account.id }); }
  catch (e) { /* learning never blocks the conversation */ }
}

export async function remember(store, account, patch) {
  if (!store || !store.rpc || !account) return null;
  const clean = {};
  for (const k of ['cities', 'areas', 'types']) if (Array.isArray(patch[k]) && patch[k].filter(Boolean).length) clean[k] = patch[k].filter(Boolean).map(String);
  for (const k of ['lang', 'last_intent']) if (patch[k]) clean[k] = String(patch[k]);
  if (!Object.keys(clean).length) return null;
  try { return await store.rpc('member_remember', { p_user: account.id, p_patch: clean }); } catch (e) { return null; }
}

export async function recall(store, account) {
  if (!store || !store.rest || !account) return null;
  try { const rows = await store.rest('member_memory?user_id=eq.' + account.id + '&select=data'); return (rows && rows[0] && rows[0].data) || null; }
  catch (e) { return null; }
}

// "Last time: house, Johar Town, Lahore" — for the welcome-back line.
export function recallLine(mem, typeLabel) {
  if (!mem) return '';
  const bits = [];
  if (mem.types && mem.types[0]) bits.push(typeLabel ? typeLabel(mem.types[0]) : mem.types[0]);
  if (mem.areas && mem.areas[0]) bits.push(mem.areas[0]);
  if (mem.cities && mem.cities[0] && !(mem.areas && mem.areas[0] && mem.areas[0].includes(mem.cities[0]))) bits.push(mem.cities[0]);
  return bits.join(', ');
}

// Owner review: what the system wants to learn (or has learned) and is
// waiting for a yes/no. Facts with only one contributor wait quietly until
// a second person confirms, so the owner isn't asked about every typo.
export async function pendingFacts(store, limit = 10) {
  try {
    return (await store.rest('kb_facts?status=in.(candidate,learned)&decided_at=is.null&sources=gte.2&select=id,kind,city,name,detail,status,sources,seen&order=sources.desc,last_seen.desc&limit=' + limit)) || [];
  } catch (e) { return []; }
}
export function factLine(f) {
  const what = f.kind === 'subarea' ? 'block/sub-area' + (f.detail && f.detail.parent ? ' of ' + f.detail.parent : '') : f.kind;
  return f.name + ' — ' + f.city + ' (' + what + ', ' + f.sources + ' people' + (f.status === 'learned' ? ', already in use' : '') + ')';
}

// Daily nudge to the owner (the 10-minute timer calls this; it only speaks
// in the 09:00–09:09 PKT slot, so once a day).
export async function learnDigest(deps, now = new Date()) {
  if (!deps.ownerId) return 0;
  const pkt = new Date(now.getTime() + 5 * 3600 * 1000);
  if (pkt.getUTCHours() !== 9 || pkt.getUTCMinutes() >= 10) return 0;
  const rows = await pendingFacts(deps.store, 50);
  if (!rows.length) return 0;
  await deps.tg.send(deps.ownerId, '📚 ' + rows.length + ' new place(s) to review — send /learn.').catch(() => null);
  return rows.length;
}
