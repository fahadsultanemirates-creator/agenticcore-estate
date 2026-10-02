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
See `docs/MARKETPLACE_V2_SAMPLE_ASSETS.md`. After the owner's brand-safety review:
- 14 images are used: 4 property photos, 5 project photos and 5 AI portraits.
- 12 are not shipped. These are the 10 agency/builder logos, which carried brand-like names, plus 2 photos with real or named places on them.
- Every sample now uses a generic label: "Sample Agency — …", "Sample Builder/Developer — …", "Sample Professional · …".

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
- EN: "Join during the free launch period and publish genuine marketplace content before packages launch on 1 November 2026. Once that content has stayed published for 7 days, you'll be eligible for 30% off your first two months of qualifying Estate marketplace packages once they launch." + "Sample, hidden or removed content does not qualify. Detailed package terms will apply when packages launch."
- UR: see `i18n.js` (owner-review block). Flagged for native-speaker review.

## 21. How eligibility is recorded (7-day rule)
- `mv2_early_items(owner)` lists the owner's items that count. Each must be:
  - genuine (not a sample);
  - `moderation_status = 'active'`;
  - created before `packages_launch_at` (2026-11-01 00:00 PKT).
- Profiles also need real content: at least 20 characters of introduction/description, or listed services.
- `mv2_try_qualify(owner)` records eligibility once one of those items is at least `early_min_days` (7) old. `qualified_at` = item creation + 7 days. It never re-qualifies an account that an admin revoked.
- It runs:
  - after every insert or update on the five tables;
  - **before** every delete (time already earned is kept);
  - whenever the owner opens the dashboard (`my_early_status()`);
  - when an admin runs `admin_evaluate_early_participants()`.
- Results:
  - Created and deleted within 7 days: never counts.
  - Deleted after 7 days: eligibility is recorded first and stays.
  - Hidden by moderation before evaluation: never counts.
- No browser write grants. Users read only their own row.
- Admin revoke works even before qualifying (it blocks). Restore re-applies the rule. Admin grant covers a genuine case the rule missed. All of these are logged.

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
- **Login phone (`profiles.phone`) is never returned to anyone else.**
- Public numbers are opt-in:
  - `profiles.public_phone`, for the account's own listings and projects;
  - `entity_public_phones`, for professional, agency and builder profiles. This table is owner/admin read only. It is written only through `set_entity_public_phone`, which refuses samples and other people's profiles.
- Resolution order:
  - listing: professional's number → agency's number → owner's public number;
  - project: company's number → owner's public number;
  - profile: its own number;
  - there is never a fallback to the login phone.
- Numbers are returned only to signed-in visitors through `get_listing_contact` / `get_marketplace_contact`. Nothing is returned for samples or hidden items.
- **Behaviour change:** existing listings show "No public number has been published — send an enquiry" until the owner sets a number. The old frontend already handles a missing number.
- **Enquiries:**
  - only through `send_enquiry`;
  - login required;
  - samples, hidden items and your own items refused;
  - limit `enquiry_daily_limit` (default 20 per 24 h, admin-configurable 1–200);
  - the sender's number is only what they type or their public number, never the login phone.

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
- **New tables:** browser rights are revoked, then granted per column. The browser never gets is_sample, verified, placement, moderation, eligibility, capability, limit-override or entity-phone writes.
- **Owner policies:** insert/update/delete require `owner_id = auth.uid() and not is_sample`. Public read hides moderated rows; owners and admins still see their own.
- **Projects:**
  - moved from table-wide to column grants;
  - **insert now requires `has_capability(auth.uid(),'project_publisher')`** instead of a role check.
- **Links:** triggers check that relationship links point at the owner's own or joined entities. Media and link columns accept https URLs or bundled sample paths only.
- **Limits:**
  - one professional profile per account (trigger plus a unique partial index);
  - agencies and builders up to `max_*_per_account` (2), with a per-account admin override up to 50.
- **Phase 2 (0015/0016/0017):** controls are unchanged, and pk_0003 is untouched. One Phase 2 test changed by design: "non-developer cannot submit an application" is now "cannot submit an application for another account", because any account may apply. Approval stays admin-only.

## 30. Test results
See the final pre-release report. Summary:
- DB: Marketplace V2 suite 23/23 groups, Phase 2 suite 11/11, public_profiles read-only.
- Node: 27/27.
- Browser: sweep of 18 pages × 7 viewport/language combinations clean; flows (old 7 + new 8 groups) as expected.
- Not run, and listed as untested: real Storage uploads; anything against production.

## 31. Contradictions remaining
See the final report, section H.

## 32. Owner decisions (resolved in the owner-review pass)
1. **Sample names:** renamed to generic demonstration labels. The logos and the named-place photo are removed; owner replacements are listed in the asset manifest.
2. **Samples:** they stay reversible with "top up to 5", and are not seeded yet.
3. **Early benefit:** 7-day rule (section 21). Final evaluation run on or after 8 Nov 2026.
4. **Limits:** 1 professional profile per account; 2 agencies and 2 builders/developers per account (configurable); unlimited properties and projects; 20 enquiries per day (configurable).
5. **Navigation:** five primary items; Buy/Rent/List free under Properties; Developer Corner, Business Pool and Referrals in the footer.
6. **Phone:** opt-in public business phone, never the login phone (section 25).
7. **Release:** before 1 November 2026, with "free during launch" and "packages planned from 1 November 2026"; no prices, paid placement OFF.

## 33. Account model: one account + optional capabilities
- **Account identity:** `auth.users` + `profiles` (one per person, phone/email login).
- **Signup intent:** `profiles.role` (buyer, professional, agency, builder, developer). It only pre-opens dashboard modules and is never used for marketplace authorization. `admin` is the one exception: it remains the admin flag (`is_admin()`).
- **Entities owned:** `professionals` (≤ 1), `agencies` (≤ 2 by default), `companies` (≤ 2 by default), `listings` (unlimited) and `projects` (unlimited, with capability). Ownership is `owner_id`.
- **Capabilities:** `account_capabilities(user_id, capability, status)`, where capability = `project_publisher` and status = pending/approved/rejected/revoked. It is written only by the application trigger and admin RPCs.
- **Approval state:** `developer_applications` holds the evidence. The capability row holds the decision. `profiles.developer_status` is a legacy mirror.
- **Authorization checks:**
  - projects insert → approved capability;
  - entity edits → `owner_id = auth.uid()`;
  - relationships → both sides' RPCs;
  - admin actions → `is_admin()` + `admin_log`;
  - PK handoff → pk_0003 ownership trigger.
- **Legacy columns:**
  - `developer_tier` and `seller_package` are DEPRECATED (column comments). They are not client-writable (0017 grants) and are not used for ranking (tested).
  - `developer_status` is a mirror only.

## 34. Production order and rollback
See the final pre-release report, sections I and J, and `docs/MARKETPLACE_V2_PRE_RELEASE_CHECKLIST.md`.

**NOT MERGED · NOT DEPLOYED · PRODUCTION DATABASE NOT TOUCHED · SAMPLE DATA NOT INSERTED INTO PRODUCTION**
