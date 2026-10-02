# AgenticCore Estate — Marketplace V2 report

Branch `claude/estate-marketplace-v2` (from production `3465ae0`). **Not merged, not deployed, production database not touched, sample data not inserted into production.** Everything was built and tested against a local Postgres built from every Estate and PK migration in production order.

## 1. Branch and commits
- `a705ba8`: schema (0018), reversible sample seed and removal, sample images, DB test suite
- `53d7e88`: homepage, five directories, detail pages, data/UI layers, bilingual strings
- `4f87c21`: one dashboard, signup by intent, admin controls, free-launch copy, Copilot, image weight
- final commit: these docs

## 2. Files
**New**
- `supabase/migrations/0018_marketplace_v2.sql`
- `supabase/seed/marketplace_samples.sql`, `supabase/seed/remove_marketplace_samples.sql`
- `tests/db/marketplace_v2.test.sql`
- `market-data.js`, `market-ui.js`, `market-detail.js`, `market.css`
- `account-data.js`, `my.html`, `my.js`, `admin-market.js`
- Directory pages: `properties.html`, `projects.html`, `professionals.html`, `agencies.html`, `builders.html`
- Detail pages: `project.html`, `professional.html`, `agency.html`, `builder.html`
- `images/samples/**` (50 WebP files: 25 assets × 2 sizes)
- `images/islamabad-skyline-800.webp`, `images/rawalpindi-house-800.webp`, `images/pakistan-map-800.webp`
- `docs/MARKETPLACE_V2_SAMPLE_ASSETS.md`, this report

**Changed**
- Pages: `index.html`, `buy.html`, `rent.html`, `listing.html`, `pricing.html`, `developer-corner.html`, `developer-apply.html`, `developer-pending.html`, `business-pool.html`, `signup.html`, `sell.html`, `post-project.html`, `admin-dashboard.html`
- Old dashboard pages (now redirect to `my.html`): `dashboard.html`, `agency-dashboard.html`, `builder-dashboard.html`, `developer-dashboard.html`, `agency-setup.html`, `builder-setup.html`
- `developer-packages.html` now redirects to `pricing.html#projects`
- Scripts: `home.js`, `listing-detail.js`, `listings.js`, `db-client.js`, `partials.js`, `auth.js`, `sell.js`, `project.js`, `developer.js`, `toolkit.js`, `ai-placeholders.js`, `copilot.js`
- Copilot service: `services/copilot-service.mjs`, `services/supabase.mjs`
- Other: `i18n.js` (+377 lines EN/UR), `main.css`, `auth.css`, `tests/copilot.test.mjs`, `tests/visual.test.mjs`

## 3. Database migrations
- One additive migration: **0018_marketplace_v2.sql**.
- Nothing is dropped, renamed or loosened.
- 0015 (read-only `public_profiles`), 0016 (secure phone login, admin decision RPC) and 0017 (privilege lockdown, upload limits) all stay in effect. The Phase 2 suite still passes 11/11 on top of 0018.
- Samples are **not** in the migration. They live in a separate, reversible seed.

## 4. Entities and relationships
```
auth.users ─1:1─ profiles (account: login + ownership; role = signup intent)
   │ owns (owner_id) ─────────────────────────────────────────────┐
   ├─< listings (PROPERTY)  ── agency_id ──> agencies              │
   │        │── professional_id ──> professionals                  │
   │        └── project_id ──> projects                            │
   ├─< projects (PROJECT) ── company_id ──> companies              │
   ├─< professionals (PROFESSIONAL)                                │
   ├─< agencies (AGENCY)                                           │
   └─< companies (BUILDER/DEVELOPER) ─< company_rates              │
agency_members:   professionals >──< agencies   (pending → active; the other side accepts)
project_agencies: projects >──< agencies        (project owner asks; agency accepts)
enquiries: sender profile → any of the five targets → recipient = target owner
early_participants: profile (auditable eligibility for the 30% benefit)
marketplace_settings: launch date, samples, paid placement switch (off)
```

Every marketplace entity carries the same admin-only columns:
- `is_sample`
- `verified`
- `placement`, `placement_until`
- `moderation_status`

## 5. How existing accounts and data stay compatible
- `profiles.role` keeps all old values and adds `professional`.
- Existing listings, projects and profile columns are untouched. The old `agency_*`/`builder_*` profile columns are kept and copied into the new public entities: an agency account gets an `agencies` row; a builder account gets a `companies` row.
- An agency account's existing listings are linked to its new agency entity.
- Genuine pre-launch participants are recorded in `early_participants`, dated by their first content.
- Production today: 1 profile, 10 listings. The owner account becomes an early participant dated from its first listing.
- The **current live frontend keeps working with 0018 applied**: the old project form only writes granted columns, and listing reads and contact are unchanged. So 0018 can go first.

## 6. The five categories
| Category | Directory | Detail | Who creates it |
|---|---|---|---|
| Properties | `properties.html`; `buy.html` and `rent.html` = same directory with a fixed purpose | `listing.html` | any account |
| Projects | `projects.html` | `project.html` | approved project (developer) accounts only — unchanged review flow |
| Professionals | `professionals.html` | `professional.html` | any account (useful with zero listings) |
| Agencies | `agencies.html` | `agency.html` | any account |
| Builders & Developers | `builders.html` | `builder.html` | any account |

- Each directory has category-specific filters, a "{n} found" count, Load more (12 per page, server-side `range`), an empty state, and a separate "Examples" strip of samples.
- The strip only shows while the category has fewer than 5 genuine records and no filter is applied. It is never mixed into results.

## 7. Homepage order
1. Hero and search (Ask AgenticCore / Buy / Rent), unchanged
2. Five ways to explore (category tiles with genuine counts)
3. Properties row
4. Projects row
5. Property Professionals row
6. Agencies row
7. Builders & Developers row
8. Islamabad & Rawalpindi discovery (cities, popular areas)
9. Estate + Pakistan ecosystem (artwork + LIST→CREATE→SHARE→PROMOTE→AUTOMATE)
10. Why list + badge explainer (consolidated, collapsible)
11. Launch period (free, packages from 1 Nov 2026, 30% benefit) + map
12. Final CTA

Notes:
- Each row has a heading, one sentence, View all, a create CTA, and horizontal scroll.
- Each row loads 10 genuine items. Labelled samples only top a row up to 5, after the genuine items.
- Removed: the long Ask demo, the toolkit card preview, the old partners panel with packages, the separate trust and how-it-works sections.
- Desktop height went from about 7,750px to 6,597px, and the upper half is now inventory.

## 8. Sample asset manifest
See `docs/MARKETPLACE_V2_SAMPLE_ASSETS.md`. In summary:
- 26 images were uploaded; 25 are used, 5 per category.
- 1 is excluded: it shows a "Bahria Enclave" name board, a real society.
- Builder names are as printed on the logos: Al-Haramain, Capital Builders & Developers, Nova Developments, Pineview, Riverdale.

## 9. Sample lifecycle
- **Insert:** run `supabase/seed/marketplace_samples.sql` in the SQL editor *after* the new frontend is live. It is idempotent.
- **Hide temporarily:** Admin → Marketplace → untick "Show samples", or lower the "top up to N cards" setting to 0.
- **Remove permanently:** run `supabase/seed/remove_marketplace_samples.sql`. It:
  - deletes only `is_sample` rows owned by the system account;
  - aborts if that account owns any non-sample row or has received an enquiry;
  - then deletes the system account.

Guarantees enforced by the database:
- Samples can only belong to the system account, and that account can only own samples.
- Samples can never be verified or promoted.
- Samples cannot be contacted, cannot receive enquiries, and cannot be confirmed available.
- Samples are excluded from `marketplace_stats()` and from Copilot.
- Samples never create early eligibility.

Tested: seed → remove → reseed. Removal with genuine rows present left all 9 genuine rows intact.

## 10–14. Card and profile fields
- **Property card:**
  - cover thumbnail
  - Buy/Rent, price (/mo), title, type · area, city
  - beds, baths, size
  - "Confirmed available" (genuine only), Checked badge (genuine only)
  - agency or professional attribution
  - SAMPLE badge
  - Featured label only when paid placement is switched on
- **Project card:** image, status, title, area/city/type, price range, unit types, developer company. **Project detail adds:** gallery, sizes, payment plan, possession, total units, description, brochure, approvals/NOC "as stated by the developer" with a not-verified note, representing agencies, linked units, contact/enquiry.
- **Professional card:** photo/avatar/logo/initials, name, headline, cities, sale/rent. **Profile adds:**
  - areas served, focus, property types, services, languages
  - experience (self-reported), overseas clients, agency
  - "What I can do for a client", "Why contact me", "How I work"
  - commission, special offer
  - deal history (self-reported note)
  - links, active listings, contact
- **Agency card:** logo, name, cities, services. **Profile adds:** cover, office, areas, focus, description, links, team, active listings, projects represented, contact.
- **Builder card:** logo, name, cities, services, lowest company rate. **Profile adds:**
  - experience (company-provided)
  - rate cards: service, Rs range, unit, "includes", "rate updated on", plus the required disclaimer
  - completed and current projects, payment terms, portfolio, links, projects, contact

## 15. Signup
Five intents map to the stored role:
- I want to browse or list property → `buyer`
- I'm a property professional → `professional`
- I'm an agency → `agency`
- I represent a project → `developer` (the existing review flow is unchanged)
- I'm a builder / developer company → `builder`

One account can add any other profile later. Only the project category still depends on the role and admin approval.

## 16. Dashboard
- **One shell:** `my.html`. Modules: Overview, Properties, Projects, Professional, Agency, Builder/developer, Enquiries, Promotion, Referrals, Account.
- Modules appear for what the account manages or its signup intent; "Add to the marketplace" opens the others.
- The header Dashboard link goes to `my.html` for every account (fixes the agency/builder routing bug); admins go to the admin panel.
- All writes use RLS and column grants. Relationships use the two-sided RPCs.

## 17. Search and pagination
- PostgREST queries with indexed equality, range and array-contains filters, plus `count: 'exact'` and `.range()`.
- Nothing loads a whole table.
- Filters are reflected in the URL so they can be shared.
- Indexes on (is_sample, moderation_status, …, created_at) for each entity; a GIN index on professional areas.

## 18. Ranking and featured placement (inactive)
- `placement` (standard / priority / featured) and `placement_until` exist on every entity.
- They can only be set by the admin RPC, which is logged and refuses samples.
- Ordering and the "Featured" label apply only if `marketplace_settings.paid_placement_active = true`. **It is false.** The admin panel shows it as inactive and offers no toggle; it can only be switched on in SQL when packages launch.
- The old `developer_tier = 3` "Featured Agency" boost and the "Elite developer" label are removed.

## 19. Free-launch wording
- EN: "Listing is free during our launch period." / "Marketplace packages are planned from 1 November 2026. They are not available yet — prices will be announced later."
- UR: "ہمارے لانچ کے دوران لسٹنگ مفت ہے۔" / "مارکیٹ پلیس پیکجز 1 نومبر 2026 سے متوقع ہیں۔ یہ ابھی دستیاب نہیں — قیمتوں کا اعلان بعد میں کیا جائے گا۔"

## 20. 30% wording
- EN: "Join during the free launch period and create genuine marketplace content before packages launch, and you'll be eligible for 30% off your first two months of qualifying Estate marketplace packages once they launch." + "Sample or demonstration content does not qualify. Detailed package terms will apply when packages launch."
- UR: "مفت لانچ کے دوران شامل ہوں اور پیکجز شروع ہونے سے پہلے حقیقی مارکیٹ پلیس مواد بنائیں، تو پیکجز آنے پر اہل Estate مارکیٹ پلیس پیکجز کے پہلے دو مہینوں پر 30% رعایت کے حقدار ہوں گے۔" + "نمونہ یا مثال کا مواد اس کے لیے اہل نہیں۔ پیکجز کے آغاز پر ان کی تفصیلی شرائط لاگو ہوں گی۔"

## 21. How eligibility is recorded
- An `after insert` trigger on all five entity tables writes `early_participants(user_id, qualified_at, qualifying_type, qualifying_id, source='auto')`. It fires for the first genuine item created before `packages_launch_at` (2026-11-01 00:00 PKT).
- The table has no browser write grants. Users can read only their own row.
- Admins grant or revoke it with `admin_set_early_participant` (logged, with a reason). The sample account can never qualify.
- 0018 backfills existing accounts (source `backfill`, dated by their first content).

## 22. Geography
- "Currently serving Islamabad & Rawalpindi" / "More cities are coming." (UR: "فی الحال اسلام آباد اور راولپنڈی میں" / "مزید شہر جلد آ رہے ہیں۔")
- The map is kept. Lahore and Karachi stay inactive.
- New cities and areas are added through admin RPCs (0017 had removed browser writes).

## 23. Estate ↔ AgenticCore Pakistan
- Owner-only "Promote with AgenticCore Pakistan" button, shown on their property page, in Properties rows and in the Promotion module:
  `https://agenticcorepk.netlify.app/?from=estate&intent=promote&listing=<uuid>`
- PK still checks ownership after login (pk_0003 trigger). Tested: own listing accepted; another user's listing refused; sample listing refused.
- Projects and profiles have no safe PK destination yet, so they link to `services.html` without claiming any transfer.

## 24. Cross-site benefits: prepared, not promised
- The site makes no reciprocal-benefit claim. Copy says PK services are paid and optional.
- Suggested future model, for the package launch:
  - allowance tables keyed by package, e.g. `estate_package_allowances(package, item, qty, period, rollover=false)`;
  - usage rows written only by server RPCs, like PK's existing `pk_package_allowances` / `pk_usage`.

## 25. Contact and enquiry security
- **Phone numbers:** only for signed-in visitors, via security-definer RPCs (`get_listing_contact`, `get_marketplace_contact`). These return nothing for samples or hidden content.
- **Enquiries:** stored rows with no direct insert grant; the only way in is `send_enquiry`. It:
  - requires login;
  - refuses samples, hidden items and your own items;
  - limits each account to 20 enquiries per 24 hours;
  - sets the recipient on the server.
- Only the sender and recipient can read an enquiry (plus admins), and only the recipient can change its status.
- No contact numbers were invented for samples. Their contact box is disabled with an explanation.

## 26. Media
- On upload, the browser makes a 640px WebP thumbnail next to each listing or project photo (`thumbs[]`). Cards use the thumbnail; detail pages use the photo.
- Logos and avatars are re-encoded to WebP (max 1200px). The 0017 size and type limits still apply.
- Lazy loading and `decoding=async` are used throughout.
- Samples: 480×360 card images and 1280px detail images.
- Homepage: about 1.16 MB in total (was 1.70 MB before re-encoding), CLS 0 (mobile) / 0.014 (desktop).
- Older listings without thumbnails fall back to the photo.

## 27. Admin
Admin panel → Marketplace (all actions go through logged RPCs):
- Per category: list, mark checked, hide/unhide with a reason, prepared placement (with a "no public effect yet" confirmation). Samples get no verify or placement controls.
- Early participants: list with revoke/restore.
- Samples: counts, visibility, top-up number, removal instructions.
- Cities (activate/deactivate) and adding areas.
- Developer review is unchanged.

## 28. EN/Urdu
- All new UI has both languages: about 330 new keys, 523 keys checked by script with **0 missing**.
- Directions are right-to-left in Urdu; tested at 390 and 1280.
- **For native-speaker review:**
  - the "کرتا/کرتی" style forms in the signup and profile questions;
  - "نمونہ" for Sample;
  - the transliterated terms ٹرن کی، گرے اسٹرکچر، آف پلان;
  - "خودکار بنائیں" (AUTOMATE);
  - the long 30% sentence;
  - "AgenticCore نے جانچا" for the Checked badge.
- Sample record text is English only.
- Some older pages (sell form labels, referral dashboard, login messages) were already partly English and are unchanged.

## 29. Security and RLS changes (0018)
- New tables: browser rights are revoked, then granted per column; the browser never gets is_sample/verified/placement/moderation.
- Owner insert/update/delete policies (`owner_id = auth.uid() and not is_sample`).
- Public read hides moderated rows (owners and admins still see their own).
- `projects` moved from table-wide to column grants.
- Triggers check that relationship links point at the owner's own or joined entities.
- Up to 3 profiles of each type per account.
- Safe-URL checks (https only, or bundled sample paths) on every media and link column.
- Every new function's EXECUTE grant was reviewed; anonymous users cannot call any write RPC.

## 30. Test results
- **DB, `tests/db/marketplace_v2.test.sql`:** **18/18 groups pass**, covering all 16 required points. These include: sample cannot be created or marked; samples not counted, not contactable, no enquiries; others' entities untouchable; agent↔agency and project↔company rules; no self-granted featured, verified, moderation or early benefit; secure phone login; approval still admin-only; listing workflow; PK handoff; `public_profiles` read-only; admin logging (6 actions); hidden content; privileges.
- **Phase 2 regression, `tests/db/security_phase2.test.sql`:** **11/11** on a 0018 build.
- **`public_profiles_readonly.sql`:** passes.
- **Node:** **27/27**. Includes 2 new Copilot tests (only genuine visible listings are queried; category questions open the right directory) and the homepage image/ecosystem tests.
- **Browser sweep** (Playwright, mock data exported from the local DB): 18 pages × {360, 390, 430, 768, 1280 EN; 390 and 1280 UR}. Result: **0 horizontal overflow, 0 untranslated keys, 0 script errors, 0 injected-markup executions**.
- **Browser flows:** all passed —
  - modules per intent, header routing;
  - profile creation sends only granted columns and rejects `javascript:` links;
  - sample listing has a notice, disabled contact and no trust badges;
  - owner bar and PK link;
  - genuine enquiry sent and phone shown;
  - logged-out contact goes to login and back;
  - signup intents;
  - admin panel (sample rows have no verify/placement);
  - sell form shows only own agencies.
- **Not testable here:** real Supabase Storage uploads, the live PostgREST embed syntax against production, and real keyboard/screen-reader passes (focus styles and 44px targets were checked by script and CSS).

## 31. Contradictions remaining
- `profiles.developer_tier` / `seller_package` still exist and are still exposed in `public_profiles` (no longer used for ranking or labels).
- Older English-only strings on some legacy pages.
- The referral program copy (10% in points) is unchanged.
- A non-project account that wants to post projects needs a role change by an admin in SQL.

## 32. Owner decisions needed before release
1. Sample brand names may match real businesses (Skyline Properties, Prestige Real Estate, Capital Builders, Al-Haramain Developers). Keep or rename? "Al-Haramain" also has a religious connotation.
2. Seed samples in production? Keep "top up to 5"?
3. Early benefit:
   - Confirm "any genuine listing, project or profile created before 1 Nov 2026 00:00 PKT" qualifies.
   - Policy for content deleted soon after creation (admin can revoke).
4. Up to 3 profiles of each type per account; 20 enquiries per day per account.
5. Navigation: Buy/Rent live inside Properties; Developer Corner, Business Pool and Referrals moved to the footer.
6. Signed-in visitors see the owner's login phone on profiles, as they already do on listings. Alternatively, a separate public business phone could be added.
7. Release timing relative to 1 November 2026.

## 33. Proposed production order
1. Apply **0018** in the Supabase SQL editor. It is additive, and the current site keeps working.
2. Verify with the rollback-wrapped checks used for Phase 2.
3. Merge `claude/estate-marketplace-v2` into `claude/agenticcore-estate-site-l51zm4` and push. Netlify builds automatically.
4. Verify the live pages.
5. Only then run `supabase/seed/marketplace_samples.sql`. **Do not seed before the new frontend is live:** the old frontend would show samples without badges.
6. Owner spot-checks: one profile of each type, one enquiry, one upload.

## 34. Rollback
- **Frontend:** in Netlify, republish the previous production deploy (`6abfb3cb35c41b000862766f`, commit 3465ae0), or revert the merge. 0018 is compatible with the old frontend.
- **Samples:** run `remove_marketplace_samples.sql` first if rolling back the frontend.
- **Database:** 0018 can stay in place. Undoing it would mean dropping the new tables, which deletes any profiles created since, so it is not recommended without a separate decision.

**NOT MERGED · NOT DEPLOYED · PRODUCTION DATABASE NOT TOUCHED · SAMPLE DATA NOT INSERTED INTO PRODUCTION**
