// Claude access for the AgenticCore assistants (server-side only).
// The key comes from the ANTHROPIC_API_KEY environment variable (Netlify),
// never from the browser. Every failure returns { ok: false, reason } so the
// caller can answer deterministically instead — raw provider errors are never
// shown to visitors, and prompts/replies are never logged.

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-opus-5-5';
let client = null;

function env(name) { return (process.env[name] || '').trim(); }
export function claudeAvailable() { return Boolean(env('ANTHROPIC_API_KEY')); }

function getClient() {
  if (!claudeAvailable()) return null;
  // Retries are off: a visitor is waiting, and the deterministic answer is ready.
  if (!client) client = new Anthropic({ maxRetries: 0 });
  return client;
}

// For tests: inject a stand-in with the same messages API.
export function setClaudeClient(stub) { client = stub; }

// system: [frozen text (cached), per-turn text]; messages: Anthropic.MessageParam[];
// schema: JSON schema for the reply (structured output).
export async function claudeJSON({ system, turnContext, messages, schema, maxTokens, timeoutMs }) {
  const c = client || getClient();
  if (!c) return { ok: false, reason: 'no_key' };
  try {
    const res = await c.beta.messages.create({
      model: env('AI_MODEL_ASSISTANT') || DEFAULT_MODEL,
      max_tokens: maxTokens || 3000,
      // A declined request is re-run server-side on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: turnContext }
      ],
      output_config: { effort: env('ASSISTANT_EFFORT') || 'low', format: { type: 'json_schema', schema } },
      messages
    }, { timeout: timeoutMs || Number(env('ASSISTANT_TIMEOUT_MS')) || 9000 });

    if (res.stop_reason === 'refusal') return { ok: false, reason: 'refusal' };
    if (res.stop_reason === 'max_tokens') return { ok: false, reason: 'truncated' };
    const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, reason: 'invalid_json' }; }
    return { ok: true, data, model: res.model };
  } catch (e) {
    // Most specific first; log the class only, never the conversation.
    let reason = 'error';
    if (e instanceof Anthropic.APIConnectionTimeoutError) reason = 'timeout';
    else if (e instanceof Anthropic.RateLimitError) reason = 'rate_limited';
    else if (e instanceof Anthropic.AuthenticationError) reason = 'auth';
    else if (e instanceof Anthropic.BadRequestError) reason = 'bad_request';
    else if (e instanceof Anthropic.APIConnectionError) reason = 'connection';
    else if (e instanceof Anthropic.APIError) reason = 'api_' + e.status;
    console.warn('[assistant] claude call failed:', reason);
    return { ok: false, reason };
  }
}
