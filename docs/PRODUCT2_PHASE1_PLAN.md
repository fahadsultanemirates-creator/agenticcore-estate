# AgenticCore Estate — Product 2.0 / Phase 1: audit and plan

Branch: `claude/estate-product2-phase1` (production branch `claude/agenticcore-estate-site-l51zm4` is untouched until the owner approves a merge).

## Stage A — audit findings

**Architecture.** Static HTML/CSS/vanilla JS on Netlify (git-connected build of the production branch, publish dir `.`), Supabase project `iuwjlvcfnxbfhbkztsel` for auth, Postgres, storage. No build step, no framework, no serverless functions yet. Shared with agenticcorepk.com (same auth/points).

**Working functionality to protect:** signup/login (phone-or-email, `handle_new_user`), buy/rent search + filters, sell flow (+ edit/delete added in 0012), listing detail + seller contact RPC, Developer Corner + application (auto-approved during launch; documents optional), admin review queue, agency/builder/developer dashboards, listing packages + developer project packages (`packages.js`, display-only pricing), referral (flat 10% direct, `get_my_direct_referrals`), AgenticCore Points (`profiles.points`, 1 point = Rs 1), Business Pool page, EN/UR toggle with RTL.

**Data reality (29 Sep 2026).** 1 account, 10 listings — all ten are the *same* property (House 15-D, Abu Bakr Block, Bahria Town Phase 8, Rs 3.3 crore, 2 photos) posted repeatedly. 0 projects, 0 developer applications, 2 active cities (Islamabad, Rawalpindi), 120 areas.

**Security state.** Lockdown migrations 0012/0013 applied: role/points not user-editable, `verified` admin-only, cities/areas RLS, owner delete, contact RPC for signed-in users. Remaining advisor items are intentional (public_profiles view, `email_for_phone`). CNIC collection at listing time is switched off (`needsCnic = false` in sell.js) — the "Identity verified" badge therefore cannot be shown truthfully.

**Existing AI scaffolding.** `ai-placeholders.js`: floating Property Advisor (disabled), Growth Score widget (always "—"), AI Document Check (always "not run"). `listings.growth_score` column exists, unused.

**Homepage UX problems.** Hero opens on a promotional map image; primary actions sit below it. Four of five "Featured" blocks say "Coming soon". A "Packages coming soon" section with no packages. The value-proposition headline sits halfway down the page. Two tall promo images (`rent-list-buy-sell.jpg`, `list-agency-builder-project.jpg`) read as ads and link nowhere. Copy leans generic ("AI-run marketplace", "run by agents and AI") without showing what the AI does.

**Technical debt noticed.** Duplicate-listing posting is possible (no guard). `auth_id_note` copy says CNIC is required for every account (it isn't). Listing detail language re-render rebuilt the whole page (owner bar fixed in 0012 work).

## Decisions (Phase 1)

1. **Service boundary: Netlify Functions** (`netlify/functions/copilot.mjs`). The browser calls `/api/copilot` only. Business logic lives in `netlify/functions/lib/` (plain ES modules, no dependencies) so Telegram/WhatsApp/MCP adapters can later import the same modules.
2. **Provider abstraction** (`lib/ai.mjs`): OpenAI, Anthropic and xAI (Grok) behind one `completeJSON()` call, chosen by `AI_PROVIDER`; keys only in Netlify environment variables. Strict JSON schema validation of every model output; timeouts; token caps; PII stripping (no CNIC/phone/email is ever sent).
3. **Find Property never depends on the model to pick listings.** Criteria are extracted (deterministic parser always; the model refines it when configured), then real rows are fetched from Supabase with the public key and ranked with deterministic, explainable reasons. The model never sees or writes listing facts it can present as its own; "why it matches" is computed from the row. Works with no AI key at all.
4. **Listing Quality score (0–100) is deterministic** (`listing-quality.js`, shared by browser and function) with listed factors and fix-it tips. The model may add wording suggestions, never the score.
5. **AI listing assistant** fills the existing sell form for review; it never posts. Deterministic extraction works without a key; with a key the model drafts title/description/bullets strictly from the user's words and returns a "missing information" checklist.
6. **Free Listing Toolkit** is mostly zero-cost and runs in the browser: WhatsApp card, square social card, QR share card, EN + Roman-Urdu captions, quality report, photo-order tips. The one paid step (AI-enhanced description) is metered by a new `ai_usage` ledger (per-user daily cap). **Points are not used or changed.**
7. **Trust badges** only for facts the system knows: "Checked by AgenticCore" (`verified`, admin-set), "Agency account"/"Developer account" (role, not a verification claim), "Photos supplied", "Confirmed available <date>" (new owner action). No identity/title/NOC claims.
8. **Additive migration 0014** only: `listings.updated_at`, `listings.last_confirmed_at`, `confirm_listing_available()` RPC, `ai_usage` table with own-row RLS, `ai_usage_today()` RPC. No existing column, policy, price or percentage changes.

## Files to change / add

Changed: `index.html`, `main.css`, `i18n.js`, `listings.js`, `listing-detail.js`, `sell.html`, `sell.js`, `ai-placeholders.js`, `dashboard.js`, `agency.js`, `netlify.toml`, `partials.js` (copilot mount).
Added: `copilot.js` (panel + hero client), `listing-quality.js`, `toolkit.html` + `toolkit.js`, `netlify/functions/copilot.mjs`, `netlify/functions/lib/{ai,criteria,search,listing-draft,quality,util}.mjs`, `supabase/migrations/0014_product2_listing_meta_and_ai_usage.sql`, `docs/IMAGE_AUDIT.md`, `docs/PRODUCT2_PHASE1_REPORT.md`, `tests/` (node tests for parser/search/quality).

## Needs owner approval before production
- Merging this branch to production.
- Applying migration 0014.
- Setting AI provider keys in Netlify (`AI_PROVIDER`, `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `XAI_API_KEY`, `AI_MODEL`).
- Deleting the 9 duplicate listings.
