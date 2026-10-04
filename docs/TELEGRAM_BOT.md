# AgenticCore Telegram bot — Phase 1

Bot: **@AgenticcoreEstatebot** (one public bot). Behind it the server routes each
request to the right agent: the **Estate agent** (accounts, listings — Amaan's
listing logic) or the **Pakistan agent** (marketing services; ordering in Telegram
is Phase 2). Telegram does not let bots message each other, so routing happens on
the server.

## What people can do (Phase 1)
- **Open an account**: share their mobile with Telegram's button (Telegram confirms
  it is theirs) → name → email → confirm. They get a member number (`AC-100001`…)
  and a one-time sign-in link to set a website password.
- **30-day rule**: an account opened in Telegram works straight away. If no
  password is set within 30 days, it is paused (nothing new accepted — listings,
  profiles, projects, enquiries) until the person signs in with a one-time link and
  sets a password. Nothing is deleted or hidden. Reminders go out on days 23 and 29.
- **Connect an existing account**: Dashboard → Account → *Connect Telegram* (a
  one-time code, 15 minutes).
- **List a property**: describe it (text or voice note, English/Urdu/Roman Urdu) →
  Amaan asks for anything missing → photos (up to 8) → the bot sends the details
  back as text → *Yes, publish it* → the listing goes live and the link comes back.
- **/login** — one-time website sign-in link (max 3 an hour). **/mylistings**,
  **/menu**, **/help**, **/cancel**.
- **Alerts in Telegram**: new enquiries, listing hidden by review, "Still
  available?" every 30 days (one-tap button), password reminders.
- **Owner alerts**: every account activity is sent to `OWNER_TELEGRAM_ID` and
  recorded in `activity_log` (member number, kind, time). `/stats` for the owner.

## Publishing checks (same as the website, plus bot limits)
Required facts (purpose, type, city, area, price, size; bedrooms/bathrooms for
built property), an active launch city, a sensible price, at least one photo, not a
duplicate of the person's own listing, at most 5 listings a day, account not paused.
Database triggers (sample/link checks, freeze) apply to the bot's writes as well.

## Security
- Webhook `/api/telegram` accepts only requests carrying Telegram's secret header;
  the secret is derived from the bot token (nothing extra to manage).
- The person is identified only by Telegram's verified user id. Chat text can never
  choose which account is acted on. AI never performs actions — it is used only to
  word general answers; listing facts come from Amaan's deterministic parser and are
  confirmed by the person.
- `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `XAI_API_KEY`,
  `ANTHROPIC_API_KEY` live only in Netlify environment variables (server side).
- Bot tables (`telegram_links`, `tg_*`) are closed to the website API; the website
  gets three own-account RPCs (link code, link status, disconnect). `activity_log` is
  admin-read only. Members cannot change their member number or freeze status.
- Sign-in links are sent only in the private chat and work once.
- Per-chat flood limit (40 messages / 10 minutes).

## Setup (owner)
1. Netlify (agenticcore-estate) environment variables, secret, Production:
   `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_TELEGRAM_ID`,
   optional `XAI_API_KEY` (voice notes).
2. Database: run `supabase/migrations/0020_telegram_bot_accounts.sql` **before**
   merging (until automatic migrations are approved).
3. Supabase → Authentication → URL Configuration → Redirect URLs: add
   `https://agenticcore.estate/**` so sign-in links open the set-password page.
4. Merge. Within 10 minutes `telegram-cron` registers the webhook and the bot
   commands; then open the bot and send /start.

## Files
`netlify/functions/telegram.mjs` (webhook), `netlify/functions/telegram-cron.mjs`
(every 10 min), `services/telegram/*` (bot, Telegram API, store, strings, voice,
notifications), `set-password.html`, `my.js` (Account → Telegram panel),
`supabase/migrations/0020_telegram_bot_accounts.sql`, tests in
`tests/telegram.test.mjs` and `tests/db/telegram_bot.test.sql`.

---

# Phase 2 — AgenticCore Pakistan orders in Telegram

## Client flow
1. "I need a WhatsApp card", "/order" or the menu → the bot matches the
   request against the live PK catalogue (`pk_catalog_v2`, one-off services
   only; monthly plans stay on the website). Prices come from the catalogue,
   never from the bot.
2. Quantity (1–20) → brief: notes, photos/files (stored privately in
   `pk-attachments/<client>/…`) and, optionally, one of the client's own
   Estate listings.
3. Text summary with the price → **Place order**. No payment is taken in
   Telegram; the team confirms first. The order is a normal ACPK task
   (`pk_place_order`, source `telegram`) and shows in the PK dashboard.
4. Status updates, messages and deliveries arrive in Telegram (and the
   dashboard). On delivery: **Approve** or **Ask for changes** (2 free
   rounds, the existing PK rule).

## Owner approval — at the start and at delivery
- Every new order alerts the owner with the choice of worker:
  🖼 Grok image · 🎬 Grok video · 🤖 Grok agent · 👤 Team (manual), or ✖ Decline.
  Nothing starts without that tap.
- Every result comes to the owner first: ✅ Deliver · 🔁 Redo · ✖ Reject.
  The client sees nothing until **Deliver**.
- Owner commands: `/jobs` (open work), `/deliver ACPK-0001` (send your own
  files/links, then Done), `/msg ACPK-0001 text` (message the client).

## Workers
| Worker | How it runs |
|---|---|
| Grok image | Timer (every 10 min): 2 options from the brief via xAI image generation. Labelled "AI-generated from the brief" — image generation does not use the client's photos. |
| Grok video | Timer: xAI video, image-to-video from the client's first photo when there is one; polled until ready (fails after 2 h). |
| Grok agent / Team | Picked up through the work inbox `/api/work` (below) or delivered by the owner with `/deliver`. |

## Work inbox `/api/work` (Grok agent on your computer, or Claude Code)
Header: `Authorization: Bearer <WORK_API_KEY>` (Netlify secret, 24+ chars).
- `GET /api/work` → open Grok-agent/Team jobs: order id, service, brief,
  listing link, client files (links valid 1 day).
- `POST /api/work` `{"action":"deliver","job_id":"…","note":"…","files":[{"url":"https://…"} or {"name":"card","content_type":"image/png","content_base64":"…"}]}`
  → files saved privately, sent to the owner for Deliver/Redo/Reject.
  JPG/PNG/WebP/MP4/PDF/ZIP, ≤25 MB each, ≤10 files; other https links are
  delivered as links.
- `POST /api/work` `{"action":"fail","job_id":"…","note":"why"}` → owner alerted.

# Phase 3 — finding property (OFF by default)
"I want a 10 marla house in G-13" → genuine listings only (no samples), with
an **Enquire** button that sends a normal enquiry as the person
(`send_enquiry_as` → `send_enquiry`, all its rules). Requires an
AgenticCore account; 15 searches and 10 enquiries a day. Turned on only with
`BOT_PROPERTY_SEARCH=on`; the access rule lives in one function
(`searchAccess` in `services/telegram/find.mjs`) so the agreed process
(paid plan, verification…) can be added there.

## Setup for Phase 2/3 (owner)
1. Supabase SQL editor: run PK `pk_0006_telegram_orders.sql`, then Estate
   `0021_telegram_enquiries.sql`.
2. Netlify (Estate): add `WORK_API_KEY` (any long random value) if you will
   use the work inbox. Optional: `XAI_IMAGE_MODEL`, `XAI_VIDEO_MODEL`.
3. Phase 3 later: `BOT_PROPERTY_SEARCH=on`.

## Phase 2/3 files
`services/telegram/{pk-orders,workers,find,strings-pk}.mjs`,
`netlify/functions/work.mjs`, `supabase/migrations/0021_telegram_enquiries.sql`,
`tests/telegram-phase2.test.mjs`, `tests/db/telegram_enquiries.test.sql`;
PK repo: `supabase/migrations/pk_0006_telegram_orders.sql`.
