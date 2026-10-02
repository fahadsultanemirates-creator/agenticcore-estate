# Marketplace V2 — post-migration, pre-seed verification checklist

Run this **in production after 0018 is applied and the new frontend is live, but BEFORE `marketplace_samples.sql` is run**. Tick each line, or record what happened. Status as of this branch: **every item below is UNTESTED in production.** The "Local evidence" column says what was proven on a local database or in the mocked browser harness. That is not proof for production.

Use two ordinary test accounts (A and B), not the admin account, plus the admin account. Clean up afterwards: delete the test listings/profiles from the dashboards; hide anything that cannot be deleted.

| # | Check | How | Expected | Local evidence |
|---|---|---|---|---|
| 1 | Migration applied cleanly | SQL editor: `select count(*) from marketplace_settings;` and `select to_regclass('public.account_capabilities'), to_regclass('public.entity_public_phones');` | 10 settings rows; both tables exist | Built 0001–0018 + PK migrations twice (and re-ran 0018 on top) without errors |
| 2 | Real queries — genuine data intact | `select count(*) from listings; select count(*) from profiles;` | Same counts as before (today: 10 listings, 1 profile); `select count(*) from listings where is_sample` = 0 | Backfill test data kept |
| 3 | RLS — anonymous | Logged-out browser: open `/properties.html`, `/agencies.html`; then in the SQL editor `set role anon; select count(*) from entity_public_phones;` (expect an error) and `reset role;` | Pages load; phone table not readable | DB suite groups 1, 17, 20 |
| 4 | RLS — other user | Account B opens A's dashboard URLs / tries to edit A's listing via the sell form `?edit=<A's id>` | Refused / "not yours" | DB suite groups 2, 3, 4 |
| 5 | Genuine upload | A: create a professional profile with a JPEG/PNG avatar (< 5 MB) | Saves; the image shows on the profile | Mock only (uploads not possible locally) |
| 6 | Invalid MIME rejected | A: try a `.pdf` or `.svg` as avatar/logo | Rejected with a message; nothing stored | Phase 2 production check passed (owner, 2026); not repeated for the new forms |
| 7 | Oversized upload rejected | A: try an image > 5 MB | Rejected | as above |
| 8 | WebP thumbnail | After 5/a listing photo upload: open the network tab on a card | Card image is a `.webp` under the listing/profile bucket | Mock only |
| 9 | Professional creation | A: Dashboard → Professional profile → create | Public page `professional.html?id=…` shows it; a second "Add another" link is NOT offered; inserting a second one via SQL as A fails (`One account can have one professional profile…`) | DB group 16; browser flow C |
| 10 | Agency creation | A: create an agency | Public page works; up to 2 per account, a 3rd is refused with the "limit of 2" message | DB group 16 |
| 11 | Builder/developer creation | A: create a builder/developer profile | Public page `builder.html?id=…` works; same 2-per-account limit | DB groups 10, 16 |
| 12 | Capability application | B (signed up as buyer): Dashboard → Projects → "Apply to list projects" → submit | B's dashboard shows "with our team"; `post-project.html` sends B back to the dashboard; B's role is still `buyer` | DB group 21; browser flow F |
| 13 | Approved project creation | Admin: approve B's application in the Developer applications queue | B can post a project; it appears on `/projects.html`; admin log has `approved` | DB group 21 |
| 14 | Enquiry | A sends B's project an enquiry from its page | B sees it under Enquiries; A sees it under Sent; A's **login phone does not appear** in it unless A typed a number or set a public number | DB groups 7, 8, 20; browser flow |
| 15 | Phone privacy | Signed in as B, click "Show contact number" on A's listing **before** A sets a public number | "No public number has been published…"; then A sets Account → Public contact number; B sees that number, never A's login phone | DB group 20; browser flows D, E |
| 16 | Phone privacy — existing listings | Open each existing genuine listing as a signed-in user | No phone shown until its owner publishes one (expected behaviour change) | DB group 20 |
| 17 | Estate → PK handoff | A: Dashboard → Promotion → "Promote with AgenticCore Pakistan" | PK opens with the listing; ordering works; B cannot attach A's listing in PK | DB group 15 (pk_0003) |
| 18 | Early benefit — pending | A's dashboard overview | "Your content is live. If it stays published, you qualify on <date + 7 days>." | DB group 18; browser flow G |
| 19 | Early benefit — admin | Admin → Marketplace → Early-participant benefit | Table loads already evaluated (no admin-log row for viewing); "Run evaluation now" returns a number and writes an `early:evaluated` row. Optional: `select * from cron.job where jobname = 'mv2-early-participants-daily';` (present only if pg_cron is installed) | DB groups 19, 23 |
| 20 | Admin moderation | Admin hides A's agency with a reason | It disappears from `/agencies.html` and from the counts; A still sees it with the "Hidden" note; admin log has `moderation:hidden` | DB groups 12–14 |
| 21 | Capability revoke/restore | Admin → Project-publisher capability → Revoke B, then Restore | While revoked B cannot add projects (existing project stays); restore re-enables; both logged | DB group 21 |
| 22 | Limits are configurable | Admin → Samples, limits & ranking → change enquiries/day to 21 and back to 20 | Saved; values outside 1–200 refused | DB group 22 |
| 23 | Sample isolation (before seeding) | `select count(*) from listings where is_sample;` | 0. Homepage rows show only genuine content plus empty-state CTAs | — |
| 24 | Sample isolation (after seeding — separate, owner-approved step) | Run `marketplace_samples.sql`; check badges on every sample card/page; contact disabled; `marketplace_stats()` unchanged; Copilot never returns a sample | All samples badged; counts exclude samples | DB groups 0–2; browser sweep |
| 25 | Navigation | Desktop: hover Properties → Buy / Rent / List free. Phone: open menu | Five primary items; Buy/Rent/List free under Properties; Developer Corner, Business Pool, Referrals in the footer | Browser flow A (360–1280 px, EN/UR) |

If any of 1–4, 14–16 or 20 fails: stop, do not seed, and follow the rollback in the report.
