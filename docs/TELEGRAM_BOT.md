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
