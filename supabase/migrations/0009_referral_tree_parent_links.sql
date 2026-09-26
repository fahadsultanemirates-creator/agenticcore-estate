-- ============================================================
-- AgenticCore Estate — referral tree parent links
-- ------------------------------------------------------------
-- get_referral_tree() already walks the referred_by chain but only
-- returned level/id/full_name, so the client could show flat lists
-- per level but not draw an actual tree (who referred whom). This
-- adds referred_by to the result so the dashboard can render a real
-- branching tree, not just level tables.
-- ============================================================

drop function if exists public.get_referral_tree(uuid, int);

create function public.get_referral_tree(root_id uuid, max_depth int default 5)
returns table (level int, id uuid, full_name text, referred_by uuid)
language sql
security definer
set search_path = public
stable
as $$
  with recursive tree as (
    select 1 as level, p.id, p.full_name, p.referred_by
    from public.profiles p
    where p.referred_by = root_id
    union all
    select tree.level + 1, p.id, p.full_name, p.referred_by
    from public.profiles p
    join tree on p.referred_by = tree.id
    where tree.level < max_depth
  )
  select level, id, full_name, referred_by from tree order by level;
$$;
