-- ============================================================
-- AgenticCore Estate — public-safe profile subset
-- ------------------------------------------------------------
-- profiles' own RLS is intentionally tight (owner or admin only)
-- because it holds phone + CNIC. But a listing page needs to show
-- "Listed by <name>, verified developer" to ANY visitor, including
-- ones who aren't logged in. This view exposes only the columns
-- that are safe to show publicly, and (being a plain view with no
-- security_invoker override) runs with its owner's privileges, so
-- it can read profiles without being blocked by profiles' RLS.
-- ============================================================

create or replace view public.public_profiles as
select id, full_name, role, developer_tier, developer_status
from public.profiles;

grant select on public.public_profiles to anon, authenticated;
