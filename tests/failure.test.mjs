// Run: node --test tests/*.test.mjs
// AI failure states and the /api/copilot security boundary, with every
// network call mocked (no keys, no Supabase, no provider traffic).
import test from 'node:test';
import assert from 'node:assert/strict';

const LISTING = { id: '11111111-1111-1111-1111-111111111111', owner_id: 'owner', title: '7 Marla House Bahria Town Phase 8', type: 'buy', property_type: 'house', city: 'Rawalpindi', area: 'Bahria Town Phase 8', price: 33000000, beds: 5, baths: 6, size_marla: 7, size_unit: 'marla', description: 'Near park.', photos: [], verified: false, created_at: '2026-09-24T00:00:00Z' };

let provider = { mode: 'ok', reply: null, hits: [] };
let usageToday = 0;
globalThis.fetch = async (url, opts) => {
  url = String(url);
  const ok = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data });
  if (url.includes('/auth/v1/user')) {
    const auth = (opts.headers && opts.headers.Authorization) || '';
    return auth === 'Bearer good-token' ? ok({ id: 'owner' }) : auth === 'Bearer other-token' ? ok({ id: 'someone-else' }) : { ok: false, status: 401, text: async () => '{"msg":"bad jwt"}' };
  }
  if (url.includes('/rpc/ai_usage_today')) return ok(usageToday);
  if (url.includes('/rest/v1/ai_usage')) return ok(null);
  if (url.includes('/rest/v1/areas')) return ok([{ name: 'Bahria Town Phase 7' }, { name: 'Bahria Town Phase 8' }]);
  if (url.includes('/rest/v1/listings')) return ok([LISTING]);
  if (/api\.openai\.com|api\.anthropic\.com|api\.x\.ai/.test(url)) {
    provider.hits.push(url);
    if (provider.mode === 'error') return { ok: false, status: 500, json: async () => ({}) };
    if (provider.mode === 'hang') {
      return new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    const text = provider.mode === 'garbage' ? 'Sure! Here is your listing :)' : JSON.stringify(provider.reply);
    if (url.includes('anthropic')) return ok({ content: [{ type: 'text', text }] });
    return ok({ choices: [{ message: { content: text } }] });
  }
  throw new Error('unexpected fetch ' + url);
};

const { completeJSON, pickProvider } = await import('../services/ai.mjs');
const svc = await import('../services/copilot-service.mjs');
const { default: handler } = await import('../netlify/functions/copilot.mjs');

const NOTES = '10 marla house Bahria Phase 7, 5 bed, new construction, demand 5.2 crore';
function withKeys(env, fn) {
  return async () => {
    const saved = {};
    for (const k of Object.keys(env)) { saved[k] = process.env[k]; process.env[k] = env[k]; }
    try { await fn(); } finally { for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } provider = { mode: 'ok', reply: null, hits: [] }; }
  };
}
function post(body, token, ip) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  return handler(new Request('http://x/api/copilot', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }), { ip: ip || '10.0.0.1' });
}

test('no provider configured: nothing is sent anywhere, deterministic draft still works', async () => {
  assert.equal(pickProvider('draft'), null);
  const r = await svc.assistListing(NOTES);
  assert.equal(r.ai_used, null);
  assert.equal(r.facts.price, 52000000);
  assert.equal(provider.hits.length, 0);
});

test('provider 500 → falls back to the deterministic draft', withKeys({ OPENAI_API_KEY: 'k' }, async () => {
  provider.mode = 'error';
  const r = await svc.assistListing(NOTES);
  assert.equal(r.ai_used, null);
  assert.ok(r.draft.title.includes('10 Marla'));
  assert.equal(provider.hits.length, 1);
}));

test('provider returns non-JSON → falls back', withKeys({ OPENAI_API_KEY: 'k' }, async () => {
  provider.mode = 'garbage';
  const r = await svc.assistListing(NOTES);
  assert.equal(r.ai_used, null);
}));

test('provider returns the wrong shape → schema validation rejects it', withKeys({ OPENAI_API_KEY: 'k' }, async () => {
  provider.reply = { title: 42, description: ['x'] };
  const r = await svc.assistListing(NOTES);
  assert.equal(r.ai_used, null);
}));

test('provider hangs → request is aborted by the timeout', withKeys({ OPENAI_API_KEY: 'k' }, async () => {
  provider.mode = 'hang';
  const t0 = Date.now();
  const out = await completeJSON({ task: 'draft', system: 's', user: 'u', schema: { title: 'string' }, timeoutMs: 200 });
  assert.equal(out, null);
  assert.ok(Date.now() - t0 < 2000);
}));

test('per-task routing: AI_PROVIDER_DRAFT=anthropic uses Claude for drafts only', withKeys({ OPENAI_API_KEY: 'k1', ANTHROPIC_API_KEY: 'k2', AI_PROVIDER: 'openai', AI_PROVIDER_DRAFT: 'anthropic' }, async () => {
  assert.equal(pickProvider('draft'), 'anthropic');
  assert.equal(pickProvider('parse'), 'openai');
  provider.reply = { title: '10 Marla 5 Bed House in Bahria Phase 7', description: 'New construction. Demand 5.2 crore.', bullets: ['5 bedrooms'], keywords: ['bahria phase 7'] };
  const r = await svc.assistListing(NOTES);
  assert.equal(r.ai_used, 'anthropic');
  assert.ok(provider.hits[0].includes('anthropic'));
}));

test('provider named but its key missing → uses a provider that has a key', withKeys({ AI_PROVIDER: 'xai', OPENAI_API_KEY: 'k' }, async () => {
  assert.equal(pickProvider('draft'), 'openai');
}));

test('endpoint: draft and improve need a valid login', async () => {
  let res = await post({ action: 'draft', text: NOTES });
  assert.equal(res.status, 401);
  res = await post({ action: 'draft', text: NOTES }, 'forged-token');
  assert.equal(res.status, 401);
  res = await post({ action: 'draft', text: NOTES }, 'good-token', '10.0.0.2');
  assert.equal(res.status, 200);
});

test('endpoint: improve is refused for someone else\'s listing', async () => {
  const res = await post({ action: 'improve', listing_id: LISTING.id }, 'other-token', '10.0.0.3');
  assert.equal(res.status, 403);
  const ok = await post({ action: 'improve', listing_id: LISTING.id }, 'good-token', '10.0.0.4');
  assert.equal(ok.status, 200);
  assert.equal(typeof (await ok.json()).quality.score, 'number');
});

test('endpoint: oversized, malformed and unknown requests are rejected', async () => {
  assert.equal((await post('x'.repeat(5000))).status, 413);
  assert.equal((await post('{not json')).status, 400);
  assert.equal((await post({ action: 'drop_tables' })).status, 400);
  const put = await handler(new Request('http://x/api/copilot', { method: 'PUT', body: '{}' }), { ip: '1' });
  assert.equal(put.status, 405);
});

test('endpoint: daily AI allowance is enforced when a provider is on', withKeys({ OPENAI_API_KEY: 'k', AI_DAILY_LIMIT: '15' }, async () => {
  usageToday = 15;
  try {
    const res = await post({ action: 'draft', text: NOTES }, 'good-token', '10.0.0.5');
    assert.equal(res.status, 429);
    assert.equal(provider.hits.length, 0);
  } finally { usageToday = 0; }
}));

test('endpoint: public search is rate limited per IP', async () => {
  let last;
  for (let i = 0; i < 31; i++) last = await post({ action: 'find', text: '7 marla house bahria' }, null, '10.9.9.9');
  assert.equal(last.status, 429);
});

test('endpoint: errors never leak internals', async () => {
  const res = await post({ action: 'improve', listing_id: 'not-a-uuid' }, 'good-token', '10.0.0.6');
  const body = await res.json();
  assert.ok(!/stack|supabase|at \w+ \(/i.test(JSON.stringify(body)));
});
