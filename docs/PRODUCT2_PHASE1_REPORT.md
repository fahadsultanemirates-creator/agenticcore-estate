# AgenticCore Estate — Product 2.0 / Phase 1 report

Branch: `claude/estate-product2-phase1` (based on production commit `319d42c`). **Not merged**: production (`claude/agenticcore-estate-site-l51zm4`) is unchanged.
Plan and audit: `docs/PRODUCT2_PHASE1_PLAN.md`. Image audit: `docs/IMAGE_AUDIT.md`.

---

## 1. What was changed

**Homepage (Stage C).** Rebuilt around user intent. Existing working features were kept.
- **Hero.** "Find property your way." with three actions: Search Properties, Ask AgenticCore and List a Property. The search box has three tabs: *Ask AgenticCore* (natural language, with four example prompts that run real searches), *Buy* and *Rent* (the conventional keyword/city/max-price search, which still opens buy.html / rent.html).
- **Sections, in order:**
  - featured real listings (duplicates collapsed; the rent row is hidden until rentals exist)
  - an "Ask AgenticCore" demo that runs real searches
  - Islamabad/Rawalpindi cards with live listing counts, plus popular areas taken from actual listings
  - Why list on AgenticCore
  - Free Listing Toolkit ("List free. Market smarter.") with a share card drawn from a real listing
  - Trust, explained
  - Agents & Agencies / Developers & Builders
  - How listing works
  - the AgenticCore family (AgenticCore Pakistan, Business Pool, Referrals)
  - the expansion map ("Khwabon se ghar tak", no longer the first thing people see)
  - final CTA
- **"Coming soon" on the homepage.** All prominent "Coming soon" blocks were removed.
- **Kept as-is.** The launch discount promise (50% / 30% for the first 2 months), 10% referral and 1 point = Rs 1.
- **SEO.** Meta description, Open Graph/Twitter tags, canonical, JSON-LD (Organization + WebSite SearchAction), skip link, semantic headings, lazy images with sizes.
- **Language.** Every new string exists in English and Urdu.

**Property Copilot (Stage D).** A secure server-side service at `/api/copilot` (Netlify Function).
- **Find.** Criteria are parsed deterministically: crore/lakh/"k", marla/kanal/sq ft, beds/baths, sectors like G-13, DHA/Bahria phases, Roman Urdu such as "kiraye pe" or "pindi".
  - An AI model may fill only fields the parser left empty. A location it suggests must appear literally in the user's text.
  - Real listings are fetched from Supabase with the public key and ranked. Each result carries "why it matches" reasons and "how it differs" notes computed from the row itself.
  - Vague requests get a follow-up question instead of results. Zero exact matches → the closest real listings, with the differences stated.
- **List.** Rough notes become known facts, a missing-information checklist, and a title/description/bullets/keywords/photo-order draft. Without AI a deterministic template draft is used. AI output is schema-validated, and rejected if it contains any number the owner didn't write.
- **Improve.** Owner-only. Returns the deterministic quality report plus optional AI wording suggestions (same invented-number guard).

**Listing assistance and quality (Stage E).**
- **sell.html.** Choose "Fill the form myself" or "Let AgenticCore help me list". The assistant only fills the form fields for review and never posts. It matches "Bahria Phase 7" to the real area "Bahria Town Phase 7". A live 0–100 quality score updates as you type.
- **Duplicate-post guard.** Warns before posting a listing that matches one you already have.
- **Listing detail (owner/admin).** The fake "Growth Score / AI Document Check" placeholders are gone. They're replaced by the real quality report (factors, points, top fixes) with Edit and Toolkit buttons.
- **Dashboards.** Seller and agency dashboards gained a Quality column and a Toolkit button per listing.
- **Floating Property Advisor.** Replaced by a working Copilot panel with three tabs:
  - *Find*: runs the real search.
  - *List*: opens the assisted sell flow.
  - *Improve*: opens your dashboard.

  On mobile the button steps aside while you're typing in any form field, and the page gets bottom clearance so it never covers controls.
- **RTL fix.** Urdu mode flipped English listing text ("Marla House for Sale in 7", "Cr 3.30 Rs"). This bug already existed on production and is now fixed site-wide.

**Free Listing Toolkit and trust (Stage F).**
- **`toolkit.html?id=…` (owner/admin only).**
  - WhatsApp 4:5, square and QR share cards drawn in the browser from the listing's own data and first photo. Each carries a small "Listed on AgenticCore Estate" mark and a QR code back to the listing. Download PNG, plus native Share on phones.
  - English and Roman Urdu captions (hand-written templates, not machine translation) with Copy and WhatsApp buttons.
  - Listing link, quality report and photo-order guide.
  - AI wording suggestions, metered against the daily allowance.
  - "Still available?" confirmation.
  - "Need to promote this listing?", linking to AgenticCore Pakistan services. It's a link only; no order is created.
- **Trust badges.** Every badge now has an explanation:
  - "Verified" was renamed **"✓ Checked"**: AgenticCore reviewed the listing information. It is *not* title, ownership or legal verification.
  - **Agency** / **Developer**: shows the account type.
  - **Photos (n)**: the listing includes owner-uploaded photos.
  - **Confirmed available**: the owner confirmed within 30 days.

  Listing detail also carries a disclaimer that we don't verify titles, NOCs or approvals. "AI Document Check" was reworded as *Document assistance (planned)*, which flags problems only and is never presented as verification.
- **Stale copy fixed.** The CNIC note no longer claims CNIC is "required for every account" (it's off during launch).

## 2. Files changed

- **New:**
  - Pages and browser scripts: `toolkit.html`, `toolkit.js`, `copilot.js`, `share-cards.js`, `home.js`, `listing-quality.js`
  - Styles: `home.css`, `product2.css`
  - Function and services: `netlify/functions/copilot.mjs`, `services/{ai,criteria,search,listing-draft,copilot-service,supabase,util}.mjs`
  - Migration: `supabase/migrations/0014_product2_listing_meta_and_ai_usage.sql`
  - Tests: `tests/copilot.test.mjs`, `tests/failure.test.mjs`
  - Docs: `docs/PRODUCT2_PHASE1_PLAN.md`, `docs/IMAGE_AUDIT.md`, this report
- **Changed:** `index.html` (rewritten), `i18n.js` (new EN/UR keys and a shared `acT()` helper; planned-feature and CNIC wording corrected), `listings.js`, `listing-detail.js`, `listing.html`, `sell.html`, `sell.js`, `ai-placeholders.js`, `dashboard.html`, `agency-dashboard.html`, `main.css`, `netlify.toml` (adds a `[functions]` block).
- **Not touched:** auth, `db-client.js` data functions, packages/pricing, referral and points logic, developer/admin/builder flows, existing migrations 0001–0013.

## 3. Database migrations added

`0014_product2_listing_meta_and_ai_usage.sql` is additive only and **not applied yet**.
- `listings.updated_at` (backfilled from `created_at`, maintained by a trigger) and `listings.last_confirmed_at`. Neither column is granted to clients, so the 0012 column-level grants stay exactly as they are.
- `confirm_listing_available(uuid)`: security-definer RPC that works only for the listing's owner (or an admin).
- `ai_usage` table with RLS: users can read and insert only their own rows, with no update or delete. `ai_usage_today()` counts the signed-in user's calls since midnight Pakistan time.

**Dry run.** The migration was run inside a transaction on the live project, then rolled back. Results:
- owner confirm works
- another user confirming → blocked
- direct `UPDATE` of `last_confirmed_at` → blocked
- inserting usage for another user → blocked
- update/delete of usage rows → blocked
- anon calling `ai_usage_today` → blocked
- trigger updates `updated_at`; no listing is left with a null `updated_at`

Afterwards I confirmed that nothing remained in the database.

**Until 0014 is applied:** the site works fully. The "Still available?" box stays hidden, and the daily AI cap falls back to the per-minute rate limits.

## 4. Environment variables required (Netlify → Site configuration → Environment variables)

| Variable | Required? | Purpose |
|---|---|---|
| `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` and/or `XAI_API_KEY` | Optional | Turns on AI refinement. **Without any key, everything still works** deterministically. |
| `AI_PROVIDER` | Optional | `openai` \| `anthropic` \| `xai` — default provider. |
| `AI_PROVIDER_PARSE`, `AI_PROVIDER_DRAFT`, `AI_PROVIDER_IMPROVE` | Optional | Per-task routing (e.g. drafts on Claude, parsing on OpenAI). |
| `AI_MODEL`, `AI_MODEL_<TASK>` | Optional | Model override. Defaults: `gpt-4o-mini`, `claude-haiku-4-5-20251001`, `grok-3-mini`. |
| `AI_DAILY_LIMIT` | Optional | Free AI calls per user per day (default 15). Needs migration 0014. |

No Supabase service-role key is used anywhere. The function calls Supabase with the public (publishable) key, or with the signed-in user's own token, so all existing RLS applies.

## 5. APIs / providers used

- Supabase REST (public key plus the user's token), and Supabase Auth `/auth/v1/user` to validate tokens.
- AI, via one `completeJSON()` abstraction (`services/ai.mjs`): OpenAI Chat Completions (JSON mode), Anthropic Messages and xAI (OpenAI-compatible). All calls have 15 s timeouts, token caps and temperature 0.2, and every response is schema-validated.
- `qrcode-generator@1.4.4` from jsDelivr, loaded only when a card is drawn. No other new libraries or frameworks.

## 6. AI features that are fully functional

With no keys, all of these still work:
- **Ask AgenticCore / Copilot Find** against real listings, with reasons, differences, follow-ups and closest matches.
- **AI-assisted listing:** facts, missing checklist and draft (template draft without a key; AI draft with a key) → fills the form for review.
- **Listing Quality score (0–100):** live on the sell form, owner report on the listing page, dashboard column. It's deterministic and never produced by an LLM.
- **Toolkit:** three share-card formats, QR, captions, share link, photo order.
- **AI wording suggestions:** these need a key. Without one the page says so politely.

## 7. Features that remain scaffolded / planned

- **Developer "Profile score"** and **Document assistance** are shown only on the developer dashboard, clearly labelled planned. They make no verification claims.
- **Copilot server messages in Urdu.** The results UI is translated, but sentences such as "1 listing matches…" and quality tips are English in Urdu mode. Phase 2.
- **Tool credits.** Not built. See §12.
- **AgenticCore Pakistan hand-off.** Links only. There's no order creation from Estate yet.
- **Identity / Agency / Developer "Verified" badges.** Not shown, because the system doesn't currently verify these (CNIC collection is off during launch; developer approval is automatic). Showing them would be a false claim.

## 8. Security considerations

- AI keys exist only in Netlify env. The browser talks only to `/api/copilot`.
- **Before any AI call:** input is capped (4 KB request body, 600–1500 characters of text) and PII is redacted: CNIC patterns, phone numbers and emails never reach a provider. Passwords and tokens are never part of a prompt.
- **Abuse limits:**
  - public Find: 30 requests / 10 min per IP
  - draft/improve: login required, 10 / 10 min per user and 20 / 10 min per IP, plus the daily AI allowance
  - error responses are generic (no stack traces or Supabase messages)
- Improve and toolkit are owner-only: checked server-side (403) and in the page. Confirming availability is enforced by the database RPC.
- **Invented-fact guard.** The AI can't introduce a number the owner didn't write. A draft that does is discarded and the template is used.
- RLS is unchanged for existing tables. 0014 adds only restrictive policies. The `verified` flag remains admin-only.
- Listing text is escaped everywhere it's rendered, including the new Copilot cards, toolkit and dashboard columns.

## 9. Test results

- **Unit tests: `node --test tests/*.test.mjs` → 21 / 21 pass.** Coverage:
  - parser and ranking; duplicates collapsed; follow-up for vague queries
  - invented-number rejection; PII redaction; owner-only improve
  - provider 500 / non-JSON / wrong shape / hang (timeout) → deterministic fallback
  - per-task provider routing
  - endpoint: 401 without or with a forged token, 403 for another user's listing, 413 / 400 / 405, daily cap 429 (no provider call made), IP rate limit 429, no internal errors leaked
- **Function build.** Bundles with esbuild (46 KB) and loads (`config.path = /api/copilot`).
- **Browser (Playwright/Chromium, Supabase mocked, real `/api/copilot` handler):**
  - Homepage at 360 / 390 / 1280 (EN) and 430 (UR): no JS errors, no horizontal overflow. Featured shows real listings; Ask returns an exact match with reasons, and a DHA query returns the closest match with differences. The share-card preview renders and is exportable.
  - Sell (360 EN / 430 UR / 1280 EN): assistant → draft → "Use this draft" fills type, purpose, title, description, price 5.2 crore → 52,000,000, 10 marla, 5 bed / 6 bath, city and the matched area. Quality updates live. Posting a duplicate is stopped.
  - Listing detail (owner): quality report with 4 tips; trust badges with explanations.
  - Copilot panel on buy.html: Find returns real matches; tabs, Escape to close, fits within 360px.
  - Dashboard: Quality column and Toolkit button.
  - Toolkit: all three cards render (1080×1350 / 1080×1080), PNG download works, captions, confirm available, AI-off message. **Non-owner is refused.**
- **Regression sweep.** Every page (25) × {anon 360/430-UR/768/1280, buyer 390/430-UR/1280, agency 390/1280-UR, developer 390/1280, admin 390/1280} = **325 page loads: 0 JS errors, 0 failed requests, 0 horizontal overflow, 0 untranslated blanks.**
- **Not testable here:** real Supabase from the browser and real AI providers (the sandbox blocks them). These need the Netlify deploy preview check below.

## 10. Screenshots / preview instructions

- **Easiest: a Netlify branch deploy.**
  1. In Netlify → *agenticcore.estate* site → Site configuration → Build & deploy → Branches and deploy contexts, add `claude/estate-product2-phase1` as a branch deploy.
  2. It publishes at `https://claude-estate-product2-phase1--<site-name>.netlify.app`, with the `/api/copilot` function.
  3. Log in with your normal account, since both sites share the same Supabase. Add that preview URL to Supabase Auth → Redirect URLs if login redirects fail.
- **Try on the preview:**
  1. On the homepage, type "7 marla house bahria phase 8 under 4 crore".
  2. Open *Sell → Let AgenticCore help me list*.
  3. On your listing, open the quality report and **Toolkit**.
  4. Switch to اردو.
- **Local:** run `netlify dev` in the repo (serves pages plus the function). `python3 -m http.server` shows pages only, and Ask AgenticCore will then fall back to the "use normal search" message.

## 11. Anything requiring owner approval

1. **Merge** `claude/estate-product2-phase1` into production.
2. **Apply migration 0014** (additive; dry run passed).
3. **AI keys:** which provider(s) to enable, and the daily free allowance (default 15 per user).
4. **Duplicate listings:** production has 10 copies of the same House 15-D listing. The homepage and search now collapse them visually, but I recommend deleting 9. I won't delete anything without your say-so.
5. **Unused images:** OK to delete them from `images/`, or move them out of the deployed folder? (See IMAGE_AUDIT.)
6. **Share image and new photos:** supply or approve the replacements R1–R3 in IMAGE_AUDIT, especially a proper 1200×630 `og:image`.

## 12. Recommended Phase 2 work

1. **Tool credits.** Keep AgenticCore Points (1 pt = Rs 1, referral money) separate from tool usage. Mixing them turns every AI call into a cash-equivalent liability and would change referral economics. Suggested design:
   - a separate `tool_credit_ledger` (grants from packages, launch promos or listing milestones; debits per paid tool)
   - optionally, a later *explicit* "convert points to credits" action once you approve a rate
   - `acToolkitEligibility()` in `toolkit.js` and the endpoint's daily-allowance check are the two hook points
2. **Urdu for server messages.** Localise Copilot sentences and quality tips (pass `lang` to the service), and add Urdu-script query parsing.
3. **Real verification states**, each backed by a workflow: switch CNIC back on → "Identity checked"; manual agency/developer document review → "Agency/Developer verified"; "Documents supplied" when files exist. Keep the "what this does not mean" text.
4. **Channel adapters.** Telegram and WhatsApp bots, plus an MCP server, calling the same `services/*` modules: `findProperty`, `assistListing`, `improveListing`.
5. **AgenticCore Pakistan hand-off.** A "Promote this listing" button that pre-fills a pk order with the listing's facts and photos (pk's Product 2.0 phase), with shared order status visible in both dashboards.
6. **Photo pipeline.** Resize on upload plus thumbnails. This is the biggest mobile-speed win. Also add photo reordering on the edit form, so the suggested order can actually be applied.
7. **Saved searches and alerts.** "Tell me when a match is listed" using the same criteria parser.
8. **Admin tools.** Duplicate detection on the admin side; a quality-score leaderboard to coach agencies.
