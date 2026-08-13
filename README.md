# AgenticCore Estate

AI-run real estate marketplace for Pakistan — forked from AgenticCore Agency's
base structure, recolored to deep emerald + gold, and extended with buy/sell/rent
listings, a Developer Corner, an admin approval workflow, a 5-level referral
system, a Business Pool section, and scaffolding for three upcoming AI features.

It's a static site (no build step) — open `index.html` directly, or serve the
folder with any static file server.

## How the data layer works right now

**No live backend has been provisioned for this repo yet.** Every flow —
signup, login, developer document submission, admin approval, listings,
referrals — runs against `mock-db.js`, a small localStorage-backed store, so
the whole product is clickable end to end in a browser with zero setup.

`supabase/migrations/0001_init_estate_schema.sql` documents the schema
`mock-db.js` was deliberately designed to mirror table-for-table. To move to a
real backend:

1. Create a Supabase project and run the migration.
2. Fill in `supabase-client.js` with the project URL + publishable key.
3. Swap the `AcDB.*` calls used throughout the page scripts (`auth.js`,
   `developer.js`, `admin.js`, `referral.js`, `sell.js`, `listings.js`,
   `listing-detail.js`, `dashboard.js`) for calls against `supabaseClient`
   and Supabase Auth. Function names were kept close to what Supabase calls
   would look like to make this a mechanical swap.

Demo accounts (see `login.html` for the same list):

| Role | Identifier | Password |
|---|---|---|
| Buyer | ayesha@example.com | password |
| Developer (approved, Elite) | bilal@builder.pk | password |
| Developer (pending review) | noor@builder.pk | password |
| Admin | admin@agenticcore.estate | admin123 |

Reset the demo dataset from a browser console with `AcDB.resetDemoData()`.

## What's fully built

- **Listings**: `buy.html` / `rent.html` (filterable grids), `sell.html`
  (posting form), `listing.html` (detail page).
- **Auth**: `signup.html` / `login.html` — phone number + government ID
  (CNIC) required for every account, buyer/seller vs. developer role choice.
- **Developer Corner**: `developer-corner.html` (landing), `developer-apply.html`
  (CNIC + company document upload, tier selection), `developer-pending.html`
  (72-hour review SLA with a live countdown), `developer-dashboard.html`.
- **Admin panel**: `admin-login.html` / `admin-dashboard.html` — review queue
  for pending developer applications, approve/reject with a note, decision
  history.
- **Pricing**: `pricing.html` — Developer Corner's 3 tiers (Rs 2,000 /
  10,000 / 20,000 per month).
- **Referral system**: `referral.html` (explainer, 5 levels) and
  `referral-dashboard.html` (your link, per-level breakdown, points).
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
