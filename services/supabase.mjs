// Minimal Supabase REST client for the service layer.
// Uses ONLY the public (anon/publishable) key, so every read and write is
// subject to the same Row Level Security as the website. When a user is
// signed in, their own access token is forwarded, so AI actions can never
// do more than that user could do in the browser. No service-role key.

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iuwjlvcfnxbfhbkztsel.supabase.co';
export const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_h6IgoqSDyVscFbKVaxWMiQ_Lsws9lWv';

const LISTING_COLS = 'id,owner_id,title,type,property_type,city,area,price,beds,baths,size_marla,size_unit,description,photos,verified,created_at';

async function rest(path, opts) {
  opts = opts || {};
  const headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + (opts.token || SUPABASE_KEY), 'Content-Type': 'application/json' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 8000);
  try {
    const res = await fetch(SUPABASE_URL + path, { method: opts.method || 'GET', headers: Object.assign(headers, opts.headers || {}), body: opts.body ? JSON.stringify(opts.body) : undefined, signal: ctrl.signal });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) { const e = new Error((data && (data.message || data.msg)) || ('Supabase ' + res.status)); e.status = res.status; throw e; }
    return data;
  } finally { clearTimeout(timer); }
}

let areaCache = { at: 0, names: [] };
export async function getAreaNames() {
  if (Date.now() - areaCache.at < 10 * 60 * 1000 && areaCache.names.length) return areaCache.names;
  const rows = await rest('/rest/v1/areas?select=name');
  areaCache = { at: Date.now(), names: (rows || []).map((r) => r.name) };
  return areaCache.names;
}

// Coarse pre-filter in the database (purpose / city / types); the fine
// ranking and explanations happen in search.mjs.
export async function fetchCandidateListings(c) {
  // Genuine, visible listings only: sample (demonstration) and moderated rows are never Copilot results.
  const q = ['select=' + LISTING_COLS, 'is_sample=eq.false', 'moderation_status=eq.active', 'order=created_at.desc', 'limit=300'];
  if (c.purpose) q.push('type=eq.' + encodeURIComponent(c.purpose));
  if (c.city) q.push('city=eq.' + encodeURIComponent(c.city));
  if (c.property_types && c.property_types.length) q.push('property_type=in.(' + c.property_types.map(encodeURIComponent).join(',') + ')');
  return rest('/rest/v1/listings?' + q.join('&'));
}

export async function fetchListing(id, token) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const rows = await rest('/rest/v1/listings?select=' + LISTING_COLS + '&id=eq.' + id, { token });
  return (rows && rows[0]) || null;
}

// Returns { id, email } for a valid access token, else null.
export async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const u = await rest('/auth/v1/user', { token, timeoutMs: 5000 });
    return u && u.id ? { id: u.id } : null;
  } catch (e) { return null; }
}

// Per-user AI metering (table ai_usage, migration 0014). Inserted with the
// user's own token, so RLS guarantees a user can only write their own rows.
export async function aiUsageToday(token) {
  try { return Number(await rest('/rest/v1/rpc/ai_usage_today', { method: 'POST', token, body: {} })) || 0; }
  catch (e) { return null; } // table not installed yet → caller falls back to in-memory limits
}
export async function recordAiUsage(token, userId, feature, provider) {
  try {
    await rest('/rest/v1/ai_usage', { method: 'POST', token, body: { user_id: userId, feature, provider }, headers: { Prefer: 'return=minimal' } });
    return true;
  } catch (e) { return false; }
}
