// Provider-abstracted AI access for AgenticCore services.
//
// Business logic calls completeJSON({ task, system, user, schema }) and never
// talks to a vendor directly. The provider for each task comes from env:
//   AI_PROVIDER            default provider: 'openai' | 'anthropic' | 'xai'
//   AI_PROVIDER_<TASK>     optional per-task override, e.g. AI_PROVIDER_DRAFT=anthropic
//   AI_MODEL / AI_MODEL_<TASK>   optional model override
//   OPENAI_API_KEY, ANTHROPIC_API_KEY, XAI_API_KEY   secrets (Netlify env only)
// If no key is configured every call returns null and callers fall back to
// the deterministic path, so the site keeps working without any AI provider.

const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  xai: 'grok-3-mini'
};
const KEY_ENV = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', xai: 'XAI_API_KEY' };

function env(name) { return (process.env[name] || '').trim(); }

export function pickProvider(task) {
  const t = String(task || '').toUpperCase();
  const wanted = env('AI_PROVIDER_' + t) || env('AI_PROVIDER');
  if (wanted && KEY_ENV[wanted] && env(KEY_ENV[wanted])) return wanted;
  // fall back to any provider that has a key
  return ['openai', 'anthropic', 'xai'].find((p) => env(KEY_ENV[p])) || null;
}

export function aiAvailable(task) { return Boolean(pickProvider(task)); }

function modelFor(provider, task) {
  return env('AI_MODEL_' + String(task || '').toUpperCase()) || env('AI_MODEL') || DEFAULT_MODELS[provider];
}

async function withTimeout(ms, fn) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); } finally { clearTimeout(timer); }
}

function extractJSON(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch (e) { return null; }
}

async function callOpenAICompatible(url, key, model, system, user, maxTokens, signal) {
  const res = await fetch(url, {
    method: 'POST', signal,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    })
  });
  if (!res.ok) throw new Error('provider ' + res.status);
  const data = await res.json();
  return data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
}

async function callAnthropic(key, model, system, user, maxTokens, signal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.2, system, messages: [{ role: 'user', content: user }] })
  });
  if (!res.ok) throw new Error('provider ' + res.status);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// Tiny schema validator: { field: 'string' | 'number' | 'boolean' | 'string[]' | ['enum', ...] | {optional: type} }
export function validate(obj, schema) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const out = {};
  for (const key of Object.keys(schema)) {
    let rule = schema[key]; let optional = false;
    if (rule && rule.optional) { optional = true; rule = rule.optional; }
    const v = obj[key];
    if (v === undefined || v === null || v === '') { if (optional) { out[key] = null; continue; } return null; }
    if (Array.isArray(rule)) { if (rule.indexOf(v) < 0) { if (optional) { out[key] = null; continue; } return null; } out[key] = v; continue; }
    if (rule === 'string') { if (typeof v !== 'string') return null; out[key] = v.slice(0, 2000); continue; }
    if (rule === 'number') { const n = Number(v); if (!isFinite(n)) { if (optional) { out[key] = null; continue; } return null; } out[key] = n; continue; }
    if (rule === 'boolean') { out[key] = Boolean(v); continue; }
    if (rule === 'string[]') { if (!Array.isArray(v)) { if (optional) { out[key] = []; continue; } return null; } out[key] = v.filter((x) => typeof x === 'string').map((x) => x.slice(0, 300)).slice(0, 20); continue; }
    return null;
  }
  return out;
}

// Returns { data, provider } or null (no provider / failure / invalid output).
export async function completeJSON(opts) {
  const provider = pickProvider(opts.task);
  if (!provider) return null;
  const key = env(KEY_ENV[provider]);
  const model = modelFor(provider, opts.task);
  const maxTokens = Math.min(opts.maxTokens || 600, 1200);
  const system = opts.system + '\nRespond with a single JSON object only.';
  try {
    const text = await withTimeout(opts.timeoutMs || 15000, function (signal) {
      if (provider === 'anthropic') return callAnthropic(key, model, system, opts.user, maxTokens, signal);
      const url = provider === 'xai' ? 'https://api.x.ai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      return callOpenAICompatible(url, key, model, system, opts.user, maxTokens, signal);
    });
    const data = validate(extractJSON(text), opts.schema);
    if (!data) { console.warn('[ai] invalid output from', provider, 'task', opts.task); return null; }
    return { data, provider };
  } catch (e) {
    // Log the failure class only — never the prompt, which may contain user text.
    console.warn('[ai] call failed', provider, opts.task, e && e.name === 'AbortError' ? 'timeout' : (e && e.message));
    return null;
  }
}
