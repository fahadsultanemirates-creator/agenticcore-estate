-- ============================================================
-- AgenticCore Estate — marketplace SAMPLE content (reversible)
-- ------------------------------------------------------------
-- Demonstration records for the five marketplace categories, shown with a
-- visible SAMPLE badge while genuine inventory is still arriving.
-- NOT a migration: run it separately (SQL editor, as postgres) after 0018,
-- and remove it any time with remove_marketplace_samples.sql.
--
-- Everything here:
--   * is owned by ONE system account (public.mv2_sample_owner()) that has no
--     password and cannot log in;
--   * has is_sample = true, so it is never verified, featured, contactable,
--     counted, searched by Copilot, or eligible for any benefit (enforced by
--     constraints/RPCs in 0018, not just by this file);
--   * uses fictional names, illustrative prices and "Example location";
--     no real address, project, person or company is described.
-- Images: images/samples/** (see docs/MARKETPLACE_V2_SAMPLE_ASSETS.md).
-- Idempotent: re-running it changes nothing that already exists.
-- ============================================================
begin;

-- ---------- the system account ----------
insert into auth.users (id, email, raw_user_meta_data)
values (public.mv2_sample_owner(), 'sample-content@agenticcore.invalid',
        '{"full_name":"AgenticCore Estate — sample content","role":"buyer"}')
on conflict (id) do nothing;
-- (the signup trigger creates its profile; make sure it exists even if it was removed)
insert into public.profiles (id, full_name, phone, role, referral_code)
values (public.mv2_sample_owner(), 'AgenticCore Estate — sample content', public.mv2_sample_owner()::text, 'buyer', 'SAMPLE0000')
on conflict (id) do nothing;

-- ---------- agencies ----------
insert into public.agencies (id, owner_id, is_sample, name, logo_url, description, city, cities, services, segments, purposes) values
 ('5a3b1e00-0000-4000-8000-000000000401', public.mv2_sample_owner(), true, 'Horizon Real Estate', 'images/samples/agencies/horizon-real-estate-960.webp',
  'Sample agency profile. It shows how an agency can present its services, team and active listings on AgenticCore Estate. The name and logo are fictional demonstration content.',
  'Islamabad', '{Islamabad}', '{"Residential sales","Rentals","Property consultation"}', '{residential}', '{sale,rent}'),
 ('5a3b1e00-0000-4000-8000-000000000402', public.mv2_sample_owner(), true, 'Greenland Real Estate', 'images/samples/agencies/greenland-real-estate-960.webp',
  'Sample agency profile for demonstration. Example focus: family homes and plots. Fictional name and logo.',
  'Rawalpindi', '{Rawalpindi}', '{"Houses and plots","Rentals"}', '{residential}', '{sale,rent}'),
 ('5a3b1e00-0000-4000-8000-000000000403', public.mv2_sample_owner(), true, 'Nova Living Real Estate', 'images/samples/agencies/nova-living-real-estate-960.webp',
  'Sample agency profile for demonstration. Example focus: buying, selling, renting and investment advice. Fictional name and logo.',
  'Islamabad', '{Islamabad,Rawalpindi}', '{"Buy","Sell","Rent","Investment advice"}', '{residential}', '{sale,rent}'),
 ('5a3b1e00-0000-4000-8000-000000000404', public.mv2_sample_owner(), true, 'Skyline Properties', 'images/samples/agencies/skyline-properties-960.webp',
  'Sample agency profile for demonstration. Example focus: commercial and residential property. Fictional name and logo.',
  'Islamabad', '{Islamabad,Rawalpindi}', '{"Commercial property","Apartments","Rentals"}', '{residential,commercial}', '{sale,rent}'),
 ('5a3b1e00-0000-4000-8000-000000000405', public.mv2_sample_owner(), true, 'Prestige Real Estate', 'images/samples/agencies/prestige-real-estate-960.webp',
  'Sample agency profile for demonstration. Example focus: larger family homes. Fictional name and logo.',
  'Rawalpindi', '{Rawalpindi}', '{"Residential sales","Property consultation"}', '{residential}', '{sale}')
on conflict (id) do nothing;

-- ---------- property professionals ----------
insert into public.professionals (id, owner_id, is_sample, display_name, avatar_url, avatar_kind, headline, intro, why_contact, how_i_work,
                                  cities, segments, purposes, property_types, services, languages, overseas_clients, commission_info, special_offer) values
 ('5a3b1e00-0000-4000-8000-000000000301', public.mv2_sample_owner(), true, 'Bilal A.', 'images/samples/professionals/professional-1-720.webp', 'photo',
  'Example specialisation: residential sales',
  'Sample profile. It shows how a property professional can explain what they do for clients — even with no active listings.',
  'Example: helps families shortlist houses that match their budget and school runs.',
  'Example: a first call to understand your needs, then a shortlist and accompanied visits.',
  '{Islamabad}', '{residential}', '{sale}', '{house,flat}', '{"Buying support","Property visits"}', '{Urdu,English}', false,
  'Example: commission terms explained before any visit.', null),
 ('5a3b1e00-0000-4000-8000-000000000302', public.mv2_sample_owner(), true, 'Hamza R.', 'images/samples/professionals/professional-2-720.webp', 'photo',
  'Example specialisation: commercial property',
  'Sample profile for demonstration. Example work: offices and shops for businesses.',
  'Example: compares rent, maintenance and access for business tenants.',
  'Example: shares a written comparison of three options before visits.',
  '{Islamabad,Rawalpindi}', '{commercial}', '{sale,rent}', '{office,shop}', '{"Commercial leasing","Investment questions"}', '{Urdu,English}', true,
  null, 'Example: an offer a professional could choose to show here.'),
 ('5a3b1e00-0000-4000-8000-000000000303', public.mv2_sample_owner(), true, 'Tariq M.', 'images/samples/professionals/professional-3-720.webp', 'photo',
  'Example specialisation: overseas Pakistani buyers',
  'Sample profile for demonstration. Example work: helping clients abroad with video visits and paperwork checklists.',
  'Example: video walkthroughs and regular updates for buyers outside Pakistan.',
  'Example: weekly updates by WhatsApp; documents checked with the client''s own lawyer.',
  '{Rawalpindi}', '{residential}', '{sale}', '{house,residential_plot}', '{"Overseas client support","Video visits"}', '{Urdu,English,Punjabi}', true,
  null, null),
 ('5a3b1e00-0000-4000-8000-000000000304', public.mv2_sample_owner(), true, 'Ayesha K.', 'images/samples/professionals/professional-4-720.webp', 'photo',
  'Example specialisation: rentals for families',
  'Sample profile for demonstration. Example work: finding rental homes and portions for families.',
  'Example: checks utilities, parking and lease terms before you visit.',
  'Example: sends a shortlist within a few days and arranges visits.',
  '{Islamabad}', '{residential}', '{rent}', '{house,upper_portion,lower_portion,flat}', '{"Rental search","Lease guidance"}', '{Urdu,English}', false,
  null, null),
 ('5a3b1e00-0000-4000-8000-000000000305', public.mv2_sample_owner(), true, 'Sana F.', 'images/samples/professionals/professional-5-720.webp', 'photo',
  'Example specialisation: apartments and new projects',
  'Sample profile for demonstration. Example work: apartments and project bookings, working independently.',
  'Example: explains payment plans and possession timelines in plain language.',
  'Example: meets clients at project sites and compares payment plans side by side.',
  '{Islamabad,Rawalpindi}', '{residential}', '{sale,rent}', '{flat}', '{"Project bookings","Apartment rentals"}', '{Urdu,English}', true,
  null, null)
on conflict (id) do nothing;

insert into public.agency_members (agency_id, professional_id, status, requested_by, decided_at) values
 ('5a3b1e00-0000-4000-8000-000000000401', '5a3b1e00-0000-4000-8000-000000000301', 'active', 'agency', now()),
 ('5a3b1e00-0000-4000-8000-000000000404', '5a3b1e00-0000-4000-8000-000000000302', 'active', 'agency', now()),
 ('5a3b1e00-0000-4000-8000-000000000405', '5a3b1e00-0000-4000-8000-000000000303', 'active', 'agency', now()),
 ('5a3b1e00-0000-4000-8000-000000000403', '5a3b1e00-0000-4000-8000-000000000304', 'active', 'agency', now())
on conflict (agency_id, professional_id) do nothing;

-- ---------- builder / developer companies ----------
insert into public.companies (id, owner_id, is_sample, name, logo_url, description, cities, services, completed_projects, current_projects, payment_terms) values
 ('5a3b1e00-0000-4000-8000-000000000501', public.mv2_sample_owner(), true, 'Al-Haramain Developers', 'images/samples/builders/al-haramain-developers-960.webp',
  'Sample company profile. It shows how a builder or developer can explain its services, rates and projects. The name and logo are fictional demonstration content.',
  '{Islamabad,Rawalpindi}', '{project_development,commercial_construction}', 'Example: a list of completed buildings would appear here.', 'Example: current projects would appear here.',
  'Example: payment in agreed construction stages.'),
 ('5a3b1e00-0000-4000-8000-000000000502', public.mv2_sample_owner(), true, 'Capital Builders & Developers', 'images/samples/builders/capital-builders-developers-960.webp',
  'Sample company profile for demonstration. Example services: grey structure and turnkey homes, plus commercial buildings. Fictional name and logo.',
  '{Islamabad,Rawalpindi}', '{grey_structure,turnkey,commercial_construction}', 'Example: completed homes and buildings would be listed here.', null,
  'Example: foundation, structure and finishing stages, each paid on completion.'),
 ('5a3b1e00-0000-4000-8000-000000000503', public.mv2_sample_owner(), true, 'Nova Developments', 'images/samples/builders/nova-developments-960.webp',
  'Sample company profile for demonstration. Example focus: residential towers. Fictional name and logo.',
  '{Islamabad}', '{project_development}', null, 'Example: one residential tower project.', null),
 ('5a3b1e00-0000-4000-8000-000000000504', public.mv2_sample_owner(), true, 'Pineview Builders', 'images/samples/builders/pineview-builders-960.webp',
  'Sample company profile for demonstration. Example services: house construction from grey structure to turnkey, and renovation. Fictional name and logo.',
  '{Islamabad,Rawalpindi}', '{residential_construction,grey_structure,turnkey,renovation}', 'Example: completed houses would be listed here.', null,
  'Example: monthly payments against agreed milestones.'),
 ('5a3b1e00-0000-4000-8000-000000000505', public.mv2_sample_owner(), true, 'Riverdale Developers', 'images/samples/builders/riverdale-developers-960.webp',
  'Sample company profile for demonstration. Example focus: apartment buildings. Fictional name and logo.',
  '{Rawalpindi}', '{project_development,residential_construction}', null, 'Example: one apartment building under construction.', null)
on conflict (id) do nothing;

-- Illustrative rate cards: example figures only, clearly labelled in the UI.
insert into public.company_rates (id, company_id, service, rate_min, rate_max, unit, includes, updated_on) values
 ('5a3b1e00-0000-4000-8000-000000000601', '5a3b1e00-0000-4000-8000-000000000502', 'grey_structure', 3200, 3800, 'per_sqft', 'Example scope: foundation, structure, brickwork and plaster.', '2026-10-01'),
 ('5a3b1e00-0000-4000-8000-000000000602', '5a3b1e00-0000-4000-8000-000000000502', 'turnkey', 6500, 8500, 'per_sqft', 'Example scope: grey structure plus finishing, fittings and paint.', '2026-10-01'),
 ('5a3b1e00-0000-4000-8000-000000000603', '5a3b1e00-0000-4000-8000-000000000504', 'grey_structure', 3000, 3600, 'per_sqft', 'Example scope: structure and masonry; materials as agreed.', '2026-10-01'),
 ('5a3b1e00-0000-4000-8000-000000000604', '5a3b1e00-0000-4000-8000-000000000504', 'renovation', 1500, 4000, 'per_sqft', 'Example scope: depends on the rooms and finishes involved.', '2026-10-01'),
 ('5a3b1e00-0000-4000-8000-000000000605', '5a3b1e00-0000-4000-8000-000000000501', 'commercial_construction', 5500, 7500, 'per_sqft', 'Example scope: structure and core services for a commercial building.', '2026-10-01')
on conflict (id) do nothing;

-- ---------- projects ----------
insert into public.projects (id, owner_id, is_sample, title, city, area, status, project_type, unit_types, size_from, size_to, size_unit,
                             price_from, price_to, payment_plan, possession_date, description, photos, thumbs, company_id) values
 ('5a3b1e00-0000-4000-8000-000000000201', public.mv2_sample_owner(), true, 'Sample project: Twin residential towers', 'Islamabad', 'Example location', 'off_plan', 'residential',
  '{flat}', 850, 2400, 'sqft', 18000000, 65000000, 'Example: down payment, then quarterly instalments.', 'Example: 2029',
  'Sample project shown to demonstrate a project page — gallery, unit types, price range and payment plan. It is not a real development.',
  '{images/samples/projects/twin-residential-towers-1280.webp}', '{images/samples/projects/twin-residential-towers-card.webp}', '5a3b1e00-0000-4000-8000-000000000503'),
 ('5a3b1e00-0000-4000-8000-000000000202', public.mv2_sample_owner(), true, 'Sample project: High-rise residences', 'Rawalpindi', 'Example location', 'under_construction', 'residential',
  '{flat}', 950, 2800, 'sqft', 22000000, 80000000, 'Example: booking amount plus monthly instalments.', 'Example: 2028',
  'Sample project for demonstration. Illustrative prices; not a real development.',
  '{images/samples/projects/high-rise-residences-1280.webp}', '{images/samples/projects/high-rise-residences-card.webp}', '5a3b1e00-0000-4000-8000-000000000505'),
 ('5a3b1e00-0000-4000-8000-000000000203', public.mv2_sample_owner(), true, 'Sample project: Apartment tower under construction', 'Islamabad', 'Example location', 'under_construction', 'mixed',
  '{flat,shop}', 600, 1800, 'sqft', 12000000, 45000000, 'Example: instalments linked to construction progress.', 'Example: 2028',
  'Sample project for demonstration, showing how construction progress can be presented. Not a real development.',
  '{images/samples/projects/tower-under-construction-1280.webp}', '{images/samples/projects/tower-under-construction-card.webp}', '5a3b1e00-0000-4000-8000-000000000502'),
 ('5a3b1e00-0000-4000-8000-000000000204', public.mv2_sample_owner(), true, 'Sample project: New residential plots', 'Rawalpindi', 'Example location', 'off_plan', 'residential',
  '{residential_plot}', 5, 20, 'marla', 6000000, 30000000, 'Example: plot booking with a two-year instalment plan.', 'Example: on development',
  'Sample project for demonstration, showing how an early-stage site can be listed. Not a real development.',
  '{images/samples/projects/fenced-development-site-1280.webp}', '{images/samples/projects/fenced-development-site-card.webp}', '5a3b1e00-0000-4000-8000-000000000504'),
 ('5a3b1e00-0000-4000-8000-000000000205', public.mv2_sample_owner(), true, 'Sample project: Commercial office building', 'Islamabad', 'Example location', 'ready', 'commercial',
  '{office,shop}', 400, 5000, 'sqft', 15000000, 250000000, 'Example: sale or lease options.', 'Example: ready',
  'Sample project for demonstration. Illustrative prices; not a real building.',
  '{images/samples/projects/commercial-office-building-1280.webp}', '{images/samples/projects/commercial-office-building-card.webp}', '5a3b1e00-0000-4000-8000-000000000501')
on conflict (id) do nothing;

insert into public.project_agencies (project_id, agency_id, status, decided_at) values
 ('5a3b1e00-0000-4000-8000-000000000201', '5a3b1e00-0000-4000-8000-000000000403', 'active', now()),
 ('5a3b1e00-0000-4000-8000-000000000202', '5a3b1e00-0000-4000-8000-000000000404', 'active', now())
on conflict (project_id, agency_id) do nothing;

-- ---------- property listings ----------
insert into public.listings (id, owner_id, is_sample, title, type, property_type, city, area, price, beds, baths, size_marla, size_unit,
                             description, photos, thumbs, agency_id, professional_id) values
 ('5a3b1e00-0000-4000-8000-000000000101', public.mv2_sample_owner(), true, 'Sample listing: Modern 10 Marla house', 'buy', 'house', 'Islamabad', 'Example location',
  65000000, 5, 6, 10, 'marla',
  'Sample listing shown to demonstrate how a property appears on AgenticCore Estate. The photo, price and details are illustrative and do not describe a real property for sale.',
  '{images/samples/properties/modern-villa-evening-1280.webp}', '{images/samples/properties/modern-villa-evening-card.webp}',
  '5a3b1e00-0000-4000-8000-000000000401', '5a3b1e00-0000-4000-8000-000000000301'),
 ('5a3b1e00-0000-4000-8000-000000000102', public.mv2_sample_owner(), true, 'Sample listing: Classic-style 7 Marla house', 'buy', 'house', 'Rawalpindi', 'Example location',
  38000000, 4, 4, 7, 'marla',
  'Sample listing for demonstration. Illustrative price and details; not a real property for sale.',
  '{images/samples/properties/classic-jaali-house-1280.webp}', '{images/samples/properties/classic-jaali-house-card.webp}',
  '5a3b1e00-0000-4000-8000-000000000405', '5a3b1e00-0000-4000-8000-000000000303'),
 ('5a3b1e00-0000-4000-8000-000000000103', public.mv2_sample_owner(), true, 'Sample listing: Contemporary 5 Marla house for rent', 'rent', 'house', 'Islamabad', 'Example location',
  120000, 3, 3, 5, 'marla',
  'Sample rental listing for demonstration. Illustrative rent and details; not a real property for rent.',
  '{images/samples/properties/contemporary-house-wood-gate-1280.webp}', '{images/samples/properties/contemporary-house-wood-gate-card.webp}',
  null, '5a3b1e00-0000-4000-8000-000000000305'),
 ('5a3b1e00-0000-4000-8000-000000000104', public.mv2_sample_owner(), true, 'Sample listing: 1 Kanal modern villa', 'buy', 'house', 'Islamabad', 'Example location',
  150000000, 6, 7, 1, 'kanal',
  'Sample listing for demonstration. Illustrative price and details; not a real property for sale.',
  '{images/samples/properties/modern-villa-stone-facade-1280.webp}', '{images/samples/properties/modern-villa-stone-facade-card.webp}',
  '5a3b1e00-0000-4000-8000-000000000404', '5a3b1e00-0000-4000-8000-000000000302'),
 ('5a3b1e00-0000-4000-8000-000000000105', public.mv2_sample_owner(), true, 'Sample listing: Heritage-style 1 Kanal residence', 'buy', 'house', 'Rawalpindi', 'Example location',
  95000000, 6, 6, 1, 'kanal',
  'Sample listing for demonstration. Illustrative price and details; not a real property for sale.',
  '{images/samples/properties/heritage-style-residence-1280.webp}', '{images/samples/properties/heritage-style-residence-card.webp}',
  '5a3b1e00-0000-4000-8000-000000000403', '5a3b1e00-0000-4000-8000-000000000304')
on conflict (id) do nothing;

commit;

-- What was seeded (all rows are is_sample = true and owned by the system account):
select 'listings' t, count(*) from public.listings where is_sample
union all select 'projects', count(*) from public.projects where is_sample
union all select 'professionals', count(*) from public.professionals where is_sample
union all select 'agencies', count(*) from public.agencies where is_sample
union all select 'companies', count(*) from public.companies where is_sample;
