// Voice notes → text with xAI (Grok) speech-to-text, the same endpoint the
// agenticcore-click bot uses (POST https://api.x.ai/v1/stt, multipart "file").
// XAI_API_KEY lives in Netlify (server only). Audio is not stored or logged.

export function voiceConfigured() { return Boolean((process.env.XAI_API_KEY || '').trim()); }

export async function transcribe(bytes, filename, fetchImpl) {
  const f = fetchImpl || globalThis.fetch;
  const form = new FormData();
  form.set('file', new Blob([bytes]), filename || 'voice.ogg');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await f('https://api.x.ai/v1/stt', {
      method: 'POST', headers: { Authorization: 'Bearer ' + (process.env.XAI_API_KEY || '').trim() }, body: form, signal: ctrl.signal
    });
    if (!res.ok) throw new Error('stt_' + res.status);
    const data = await res.json();
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) throw new Error('stt_empty');
    return text.slice(0, 800);
  } finally { clearTimeout(timer); }
}
