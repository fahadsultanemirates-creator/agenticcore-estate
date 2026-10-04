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

// ---------- replies as voice notes (text → speech) ----------
// xAI (Grok) text-to-speech, the endpoint the agenticcore-click bot uses
// (POST https://api.x.ai/v1/tts → mp3, which Telegram accepts as a voice
// note). `language: 'auto'` reads Urdu script correctly. Voice: "naksh"
// (xAI's warm male voice with a South Asian accent); TTS_VOICE can pick
// another voice; nothing is stored.
export async function synthesize(text, lang, fetchImpl) {
  const f = fetchImpl || globalThis.fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await f('https://api.x.ai/v1/tts', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + (process.env.XAI_API_KEY || '').trim(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: lang === 'en' ? 'en' : 'auto', voice_id: (process.env.TTS_VOICE || 'naksh').trim(), output_format: { codec: 'mp3' } }),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('tts_' + res.status);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 500) throw new Error('tts_empty');
    return bytes;
  } finally { clearTimeout(timer); }
}

// What a reply sounds like read aloud: no links, commands, emoji or list
// bullets; "Rs 3,499" read as "3,499 روپے" in Urdu; at most ~700 characters,
// cut at the end of a sentence.
export function speakable(text, lang) {
  let s = String(text || '')
    .replace(/https?:\/\/\S+|www\.\S+|\S+\.(com|estate|html)\S*/gi, ' ')
    .replace(/(^|\s)\/[a-z_]+/gi, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}•·✓✔✖→›‹]/gu, ' ')
    .replace(/\bAC-(\d+)/g, 'AC $1');
  if (lang !== 'en') s = s.replace(/\bRs\.?\s?([\d,]+)/g, '$1 روپے');
  s = s.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
  if (s.length <= 700) return s;
  const cut = s.slice(0, 700);
  const end = Math.max(cut.lastIndexOf('۔'), cut.lastIndexOf('. '), cut.lastIndexOf('?'), cut.lastIndexOf('؟'), cut.lastIndexOf('\n'));
  return (end > 200 ? cut.slice(0, end + 1) : cut).trim();
}
