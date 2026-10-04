// Amaan → AgenticCore team. A signed-in person sends what they need (the
// conversation summary, an optional note and the files they attached in the
// Amaan chat) and the owner receives it in Telegram with the files. The
// owner answers with /reply AR-XXXXXX <text> (delivered to the person's
// Telegram when linked). Files stay in the person's own private folder
// (pk-attachments/<their id>/amaan-…); the owner gets short-lived links.
// The request is recorded in activity_log (kind 'amaan_request').

const KINDS = /^(image\/|video\/(mp4|quicktime|webm)$|application\/pdf$|application\/msword$|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$)/;
export const HANDOFF_LIMIT = 5;          // requests per person per 24 h

function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n); }
export function newRef(now = Date.now()) { return 'AR-' + now.toString(36).toUpperCase().slice(-6); }

// Validate the body for this user. Returns { ok, error?, req? }.
export function validateHandoff(body, userId) {
  const files = Array.isArray(body && body.files) ? body.files.slice(0, 10) : [];
  const prefix = new RegExp('^' + String(userId).replace(/[^0-9a-f-]/gi, '') + '/amaan-\\d{10,15}/[\\w.\\-]{1,100}$');
  for (const f of files) {
    if (!f || !prefix.test(String(f.path || ''))) return { ok: false, error: 'bad_file' };
    if (!KINDS.test(String(f.type || ''))) return { ok: false, error: 'bad_file' };
  }
  const summary = clean(body && body.summary, 600);
  if (summary.length < 3 && !files.length) return { ok: false, error: 'empty' };
  const messages = (Array.isArray(body && body.messages) ? body.messages.slice(-12) : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .map((m) => ({ role: m.role, text: clean(m.text, 400) }));
  return { ok: true, req: { site: body.site === 'pk' ? 'pk' : 'estate', lang: body.lang === 'ur' ? 'ur' : 'en', summary, note: clean(body.note, 600), messages,
    files: files.map((f) => ({ path: String(f.path), name: clean(f.name, 80) || String(f.path).split('/').pop(), type: String(f.type), size: Number(f.size) || 0 })) } };
}

function ownerText(ref, profile, r) {
  const who = profile ? ((profile.full_name || 'Member') + (profile.member_no ? ' (AC-' + profile.member_no + ')' : '')) : 'A member';
  const lines = ['📥 New request ' + ref + ' from ' + who + ' via Amaan on ' + (r.site === 'pk' ? 'agenticcorepk.com' : 'agenticcore.estate'), '', 'What they need:', r.summary || '(see files)'];
  if (r.note) lines.push('', 'Note: ' + r.note);
  const said = r.messages.filter((m) => m.role === 'user').slice(-4).map((m) => '• ' + m.text);
  if (said.length) lines.push('', 'From the chat:', ...said);
  lines.push('', 'Files: ' + r.files.length, '', 'Reply to them: /reply ' + ref + ' your message');
  return lines.join('\n').slice(0, 3900);
}

// deps: { userId, store, tg, ownerId, now }
export async function handleHandoff(body, deps) {
  const v = validateHandoff(body, deps.userId);
  if (!v.ok) return { status: 400, body: { error: v.error } };
  const r = v.req;
  const since = new Date((deps.now || Date.now()) - 24 * 3600 * 1000).toISOString();
  if ((await deps.store.countActivity(deps.userId, 'amaan_request', since)) >= HANDOFF_LIMIT) return { status: 429, body: { error: 'limit' } };
  const profile = await deps.store.profile(deps.userId).catch(() => null);
  const ref = newRef(deps.now || Date.now());
  await deps.store.rest('activity_log', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: { user_id: deps.userId, member_no: profile ? profile.member_no : null, channel: 'web', kind: 'amaan_request',
      detail: { ref, site: r.site, summary: r.summary, note: r.note, files: r.files.map((f) => ({ path: f.path, name: f.name, type: f.type })) } }
  });
  if (deps.ownerId) {
    await deps.tg.send(deps.ownerId, ownerText(ref, profile, r)).catch(() => null);
    for (const f of r.files) {
      const url = await deps.store.signedUrl('pk-attachments', f.path, 7 * 86400).catch(() => null);
      if (!url) continue;
      const send = /^image\//.test(f.type) ? deps.tg.sendPhoto : /^video\//.test(f.type) ? deps.tg.sendVideo : deps.tg.sendDocument;
      await send(deps.ownerId, url, ref + ' · ' + f.name).catch(() => deps.tg.send(deps.ownerId, ref + ' · ' + f.name + ': ' + url).catch(() => null));
    }
  }
  // the person gets a copy in Telegram when their account is linked
  const chat = await deps.store.chatFor(deps.userId).catch(() => null);
  if (chat) {
    const msg = r.lang === 'ur'
      ? 'آپ کی درخواست ' + ref + ' AgenticCore ٹیم کو مل گئی ہے (' + r.files.length + ' فائلیں)۔ ٹیم یہیں جواب دے گی۔'
      : 'Your request ' + ref + ' reached the AgenticCore team (' + r.files.length + ' file(s)). The team will reply here.';
    await deps.tg.send(chat, msg).catch(() => null);
  }
  return { status: 200, body: { ok: true, ref } };
}

// Owner command: /reply AR-XXXXXX text  → the person's Telegram (if linked).
export async function replyToRequest(deps, ref, text) {
  const rows = await deps.store.rest('activity_log?kind=eq.amaan_request&detail->>ref=eq.' + encodeURIComponent(ref) + '&select=user_id,member_no&limit=1');
  const row = rows && rows[0];
  if (!row || !row.user_id) return { ok: false, reason: 'not_found' };
  const chat = await deps.store.chatFor(row.user_id);
  if (!chat) return { ok: false, reason: 'no_telegram', member_no: row.member_no };
  await deps.tg.send(chat, 'Reply from the AgenticCore team about ' + ref + ':\n\n' + String(text).slice(0, 3500));
  return { ok: true };
}
