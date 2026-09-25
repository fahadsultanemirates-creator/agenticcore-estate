-- ============================================================
-- AgenticCore Estate — two-track pricing
-- ------------------------------------------------------------
-- Splits what was one tier concept into two, per the actual
-- business model:
-- 1. "Pricing Tiers" (Starter/Growth/Elite, Rs 5,000/15,000/30,000)
--    -- for ANY seller doing individual listings (houses, plots),
--    not tied to developer verification. New: profiles.seller_package.
-- 2. "Developer Project Packages" (Rs 15,000/50,000/200,000/Business
--    Pool) -- for verified developers listing whole PROJECTS
--    (societies, high-rises), with marketing bundled at higher tiers.
--    Reuses profiles.developer_tier, extended from 3 to 4 values.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_developer_tier_check;
alter table public.profiles add constraint profiles_developer_tier_check
  check (developer_tier in (1, 2, 3, 4));

alter table public.developer_applications drop constraint if exists developer_applications_tier_check;
alter table public.developer_applications add constraint developer_applications_tier_check
  check (tier in (1, 2, 3, 4));

alter table public.profiles add column if not exists seller_package smallint
  check (seller_package in (1, 2, 3));

-- refresh the public-safe view to expose the new column
create or replace view public.public_profiles as
select id, full_name, role, developer_tier, developer_status, seller_package
from public.profiles;
