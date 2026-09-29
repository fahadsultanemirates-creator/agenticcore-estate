-- ============================================================
-- AgenticCore Estate — tidy-ups from the Supabase security advisor
-- (applied 29 Sep 2026 right after 0012)
-- ============================================================

-- Trigger function: only the auth.users trigger should run it, never the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Scoped to auth.uid(); anonymous callers have no referrals to see.
revoke execute on function public.get_my_direct_referrals() from public, anon;
grant execute on function public.get_my_direct_referrals() to authenticated;
-- Pin search_path on the two helpers the linter flagged.
alter function public.enforce_active_city() set search_path = public;
alter function public.listing_owner_developer_tier(uuid) set search_path = public;
