-- ============================================================
-- AgenticCore Estate — make public_profiles read-only (security fix, Oct 2026)
-- ------------------------------------------------------------
-- public.public_profiles (0004, refreshed in 0005/0008) is a simple view over
-- public.profiles owned by `postgres`, created without security_invoker. Postgres
-- treats such a view as auto-updatable, and writes through it are checked
-- against the view OWNER's rights, so they bypass the RLS on profiles.
-- Supabase's default grants gave anon and authenticated INSERT / UPDATE /
-- DELETE / TRUNCATE on the view, which let anyone with the public anon key:
--   * set any profile's role (e.g. to 'admin'),
--   * rename any account or change its developer_tier / seller_package / agency fields,
--   * delete any profile (cascading to that user's listings and projects).
--
-- The sites only ever SELECT from this view (db-client.js getUser / getListings),
-- so the fix is purely to take the write privileges away. SELECT stays granted to
-- anon and authenticated; the view definition, its columns, the profiles table,
-- its RLS policies and all data are unchanged.
-- ============================================================

revoke insert, update, delete, truncate on public.public_profiles from anon, authenticated;

-- Explicit, so the intended state is visible here even if defaults change later.
grant select on public.public_profiles to anon, authenticated;
