// Telegram Bot API — the few calls the AgenticCore bot needs.
// The bot token comes from TELEGRAM_BOT_TOKEN (Netlify, server only) and is
// never logged. fetch is injectable for tests.

import crypto from 'node:crypto';

export function botToken() { return (process.env.TELEGRAM_BOT_TOKEN || '').trim(); }
export function botConfigured() { return Boolean(botToken()); }
// AgenticCore Dealer AI: a second, separate bot (DEALER_BOT_TOKEN).
export function dealerToken() { return (process.env.DEALER_BOT_TOKEN || '').trim(); }

// The webhook secret is derived from the bot token, so there is no second
// secret to manage: Telegram sends it back on every update and only
// someone holding the token could know it.
export function webhookSecret(token) {
  const t = token || botToken();
  return t ? crypto.createHash('sha256').update('agenticcore-telegram-webhook:' + t).digest('hex').slice(0, 48) : '';
}

// tokenFn: which bot to speak as (default: the main AgenticCore bot).
export function makeTelegram(fetchImpl, tokenFn) {
  const f = fetchImpl || globalThis.fetch;
  const tokenOf = tokenFn || botToken;
  async function call(method, payload, timeoutMs) {
    const token = tokenOf();
    if (!token) throw new Error('telegram_not_configured');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    try {
      const res = await f('https://api.telegram.org/bot' + token + '/' + method, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}), signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        const e = new Error('telegram_' + method + '_' + (data.error_code || res.status));
        e.description = data.description;
        throw e;
      }
      return data.result;
    } finally { clearTimeout(timer); }
  }
  return {
    call,
    send(chatId, text, extra) {
      return call('sendMessage', Object.assign({ chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true }, extra || {}));
    },
    // Files by https URL (signed links); Telegram downloads them itself.
    sendPhoto(chatId, url, caption, extra) { return call('sendPhoto', Object.assign({ chat_id: chatId, photo: url, caption: caption ? String(caption).slice(0, 1000) : undefined }, extra || {}), 20000); },
    sendVideo(chatId, url, caption, extra) { return call('sendVideo', Object.assign({ chat_id: chatId, video: url, caption: caption ? String(caption).slice(0, 1000) : undefined }, extra || {}), 30000); },
    sendDocument(chatId, url, caption, extra) { return call('sendDocument', Object.assign({ chat_id: chatId, document: url, caption: caption ? String(caption).slice(0, 1000) : undefined }, extra || {}), 30000); },
    typing(chatId) { return call('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => null); },
    answerCallback(id, text) { return call('answerCallbackQuery', { callback_query_id: id, text: text || undefined }).catch(() => null); },
    removeButtons(chatId, messageId) {
      return call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => null);
    },
    // Downloads a file the user sent (photo or voice note). Returns { bytes, path }.
    async download(fileId, maxBytes) {
      const file = await call('getFile', { file_id: fileId });
      if (!file || !file.file_path) throw new Error('telegram_file_missing');
      if (maxBytes && file.file_size && file.file_size > maxBytes) throw new Error('telegram_file_too_large');
      const res = await f('https://api.telegram.org/file/bot' + tokenOf() + '/' + file.file_path);
      if (!res.ok) throw new Error('telegram_file_' + res.status);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (maxBytes && bytes.length > maxBytes) throw new Error('telegram_file_too_large');
      return { bytes, path: file.file_path };
    }
  };
}

// Inline buttons: rows of [label, callback data].
export function buttons(rows) {
  return { reply_markup: { inline_keyboard: rows.map((r) => r.map(([text, data]) => (/^https:\/\//.test(data) ? { text, url: data } : { text, callback_data: data }))) } };
}
// The "Share my phone number" button (Telegram confirms the number is this account's).
export function contactKeyboard(label) {
  return { reply_markup: { keyboard: [[{ text: label, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } };
}
export function removeKeyboard() { return { reply_markup: { remove_keyboard: true } }; }
