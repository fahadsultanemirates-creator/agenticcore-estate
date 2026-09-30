-- ============================================
-- 0014 — Product 2.0 Phase 1 (additive only)
--
-- 1. listings.updated_at      — maintained by trigger, not writable by clients.
-- 2. listings.last_confirmed_at + confirm_listing_available(uuid)
--    — the owner confirms "still available"; powers the "Confirmed available"
--    badge (30 days) and the freshness factor of the listing quality score.
-- 3. ai_usage + ai_usage_today() — per-user metering for AI listing help
--    (daily free allowance). Rows are inserted by /api/copilot using the
--    user's own token; RLS limits users to their own rows; no update/delete.
--
-- Nothing existing is dropped or loosened: the column-level grants from 0012
-- stay as they are (neither new column is granted to clients), and
-- `verified` is still set only through admin_set_listing_verified().
-- ============================================

-- ---------- 1 & 2. listing metadata ----------
alter table public.listings add column if not exists updated_at timestamptz;
alter table public.listings add column if not exists last_confirmed_at timestamptz;
update public.listings set updated_at = created_at where updated_at is null;
alter table public.listings alter column updated_at set default now();

create or replace function public.touch_listing_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.touch_listing_updated_at() from public, anon, authenticated;

drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at
  before update on public.listings
  for each row execute function public.touch_listing_updated_at();

create or replace function public.confirm_listing_available(p_listing uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz := now();
begin
  update public.listings
     set last_confirmed_at = v_at
   where id = p_listing
     and (owner_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'Listing not found or not yours' using errcode = '42501';
  end if;
  return v_at;
end;
$$;
revoke all on function public.confirm_listing_available(uuid) from public, anon;
grant execute on function public.confirm_listing_available(uuid) to authenticated;

-- ---------- 3. AI usage metering ----------
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  feature text not null check (feature in ('draft', 'improve', 'find', 'toolkit')),
  provider text not null check (char_length(provider) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_day on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon;
revoke all on public.ai_usage from authenticated;
grant select on public.ai_usage to authenticated;
grant insert (user_id, feature, provider) on public.ai_usage to authenticated;

drop policy if exists "ai_usage own rows readable" on public.ai_usage;
create policy "ai_usage own rows readable" on public.ai_usage
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "ai_usage own rows insertable" on public.ai_usage;
create policy "ai_usage own rows insertable" on public.ai_usage
  for insert with check (auth.uid() = user_id);

-- Calls used today (Pakistan time) by the signed-in user.
create or replace function public.ai_usage_today()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int
    from public.ai_usage
   where user_id = auth.uid()
     and created_at >= (date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi');
$$;
revoke all on function public.ai_usage_today() from public, anon;
grant execute on function public.ai_usage_today() to authenticated;
