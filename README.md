# AgenticCore Estate

AI-run real estate marketplace for Pakistan — forked from AgenticCore Agency's
base structure, recolored to deep emerald + gold, and extended with buy/sell/rent
listings, a Developer Corner, an admin approval workflow, a referral system
(built to scale to 10 levels), two independent pricing tracks, a Business Pool
section, and scaffolding for three upcoming AI features.

It's a static site (no build step) — open `index.html` directly, or serve the
folder with any static file server. Launch scope is Islamabad and Rawalpindi
only (enforced server-side via a `cities` table); more cities are a row
insert, not a redeploy.

## How the data layer works

**A real Supabase project backs this site** — `db-client.js` (the `AcDB`
object every page script calls) talks to real Postgres, Auth, and Storage,
not a mock. `supabase-client.js` holds the project URL + publishable key.
Schema lives in `supabase/migrations/` (`0001`–`0005`), including RLS
policies, a `handle_new_user()` trigger that creates a profile row on
signup, and security-definer RPCs (`get_referral_tree`, `email_for_phone`)
that keep phone/CNIC out of any broadly-readable table.

There are no seeded demo accounts — sign up for real through `signup.html`.
To get an admin account, sign up normally, then have someone with database
access run `update profiles set role = 'admin' where email = '...'`.

CNIC is collected only where it matters: developers give it at the
application step (`developer-apply.html`); an individual seller gives it
once, inline, the first time they post a listing (`sell.js`). Buyers never
need one.

## What's fully built

- **Listings**: `buy.html` / `rent.html` (filterable grids), `sell.html`
  (posting form), `listing.html` (detail page).
- **Auth**: `signup.html` / `login.html` — phone number + email + password;
  buyer/seller vs. developer role choice. CNIC is NOT collected at signup —
  individual sellers give it once, inline, the first time they post a
  listing (`sell.js`); developers give it at the application step below.
- **Developer Corner**: `developer-corner.html` (landing), `developer-apply.html`
  (CNIC + company document upload, project-package selection), `developer-pending.html`
  (72-hour review SLA with a live countdown), `developer-dashboard.html`.
- **Admin panel**: `admin-login.html` / `admin-dashboard.html` — review queue
  for pending developer applications, approve/reject with a note, decision
  history.
- **Two pricing tracks** (`packages.js` holds both as shared data):
  - **Listing Packages** (`pricing.html`) — Starter/Growth/Elite, Rs 5,000 /
    15,000 / 30,000 per month, for any account listing individual
    properties. Not tied to developer verification.
  - **Developer Project Packages** (`developer-packages.html`) — Launch/
    Growth/Scale/Business Pool, Rs 15,000 / 50,000 / 200,000 / custom per
    month, for verified developers listing whole projects. Growth and up
    bundle marketing (social content, brochures, banners) from AgenticCore
    Agency at no extra cost; Business Pool is a fully custom partnership.
- **Referral system**: `referral.html` (explainer) and `referral-dashboard.html`
  (your link, per-level payout breakdown, and a separate "team" view). Payout
  is 5 levels deep today (25% / 15% / 10% / 5% / 2.5%, paid in AgenticCore
  Points); `get_referral_tree()` and `AcDB.getReferralTree()` already accept
  a `max_depth` up to 10 so the payout table can extend without a schema
  change — the referral-dashboard's "team" table already shows all 10.
- **Business Pool**: `business-pool.html` — manager Telegram/WhatsApp contact
  and cross-support messaging with AgenticCore Agency / AgenticCore Biz.
- **Language toggle**: one click, top-right of every page (`i18n.js`) —
  switches nav, footer, hero, forms, and pricing between English and Urdu,
  including RTL layout. Deep secondary prose on a few explainer pages stays
  English-first; the toggle itself works sitewide.

## What's intentionally scaffolded, not implemented

Per scope, three AI-agent features have UI real estate reserved for them but
are **not** wired to a model:

- **Growth Score** — gauge widget on listing and developer-dashboard pages
  (`acGrowthScoreWidget()` in `ai-placeholders.js`), always shows `—`.
- **AI Document Check** — badge widget next to developer documents
  (`acDocCheckWidget()`), always shows "not run".
- **Property Advisor** — floating chat button/panel on every listing-adjacent
  page (`acMountPropertyAdvisor()`), input is disabled.

All three are clearly labeled "Coming soon" and have a single, obvious place
to plug in a real agent backend when it ships.

## File map

Flat, static-site convention (matches AgenticCore Agency): all HTML/CSS/JS at
the repo root, `supabase/migrations/` for the schema. Shared nav/footer are
injected by `partials.js` into `<div id="site-header">` / `<div id="site-footer">`
placeholders so ~20 pages don't each carry a full copy of the markup.
