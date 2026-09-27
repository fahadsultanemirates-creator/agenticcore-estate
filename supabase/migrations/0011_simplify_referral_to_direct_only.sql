-- ============================================================
-- AgenticCore Estate — simplify referral program to direct-only
-- ------------------------------------------------------------
-- Product decision: drop the 10-level tree, the 5-tier decreasing
-- payout schedule (25/15/10/5/2.5%), and the 4 locked "coming soon"
-- membership cards entirely. Replace with one flat rule: referring
-- account earns 10% of what a directly-referred account spends,
-- credited as AgenticCore Points (1 point = Rs 1). Points/login are
-- shared across every AgenticCore site via this same profiles row.
--
-- get_referral_tree(root_id, max_depth) also had a real RLS gap: it
-- was security definer but callable with ANY root_id, so any signed-in
-- user could pull another user's entire downline. Its replacement is
-- parameterless and scoped to auth.uid(), so it can only ever return
-- the caller's own direct referrals.
-- ============================================================

drop function if exists public.get_referral_tree(uuid, int);

create function public.get_my_direct_referrals()
returns table (id uuid, full_name text, joined_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.created_at as joined_at
  from public.profiles p
  where p.referred_by = auth.uid()
  order by p.created_at desc;
$$;

grant execute on function public.get_my_direct_referrals() to authenticated;

-- referral_ledger no longer tracks multiple levels -- every payout is a
-- flat 10% credit from a direct referral's own spend.
alter table public.referral_ledger drop constraint if exists referral_ledger_level_check;
alter table public.referral_ledger drop column if exists level;
