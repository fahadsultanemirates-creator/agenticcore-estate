-- ============================================================
-- AgenticCore Estate — launch-scope schema additions
-- ------------------------------------------------------------
-- Adds what's needed to actually load/search real properties:
-- a restricted city/area list (Islamabad + Rawalpindi at launch,
-- more cities added by row, not by redeploy), a real property-type
-- taxonomy (house/flat/plot/commercial/etc., not just buy/rent),
-- listing photos, and a CNIC policy change: profiles.cnic is now
-- nullable (only developers/agencies and individual sellers about
-- to post a listing need to provide it — not every buyer at signup,
-- matching how Zameen/Graana actually gate identity verification).
-- ============================================================

-- ---------- cities (launch scope, extensible by row) ----------
-- name is the identity (matches how listings.city already stores a
-- plain display string like 'Islamabad') so no slug/name mapping is
-- needed anywhere in the frontend.
create table if not exists public.cities (
  name text primary key,
  active boolean not null default true,
  sort_order smallint not null default 0
);

insert into public.cities (name, active, sort_order) values
  ('Islamabad', true, 1),
  ('Rawalpindi', true, 2),
  ('Lahore', false, 3),
  ('Karachi', false, 4)
on conflict (name) do nothing;

-- ---------- areas (curated sectors/societies per city) ----------
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  city_name text not null references public.cities(name),
  name text not null,
  sort_order smallint not null default 0
);

create index if not exists areas_city_idx on public.areas(city_name);

insert into public.areas (city_name, name, sort_order) values
  ('Islamabad', 'F-6', 1), ('Islamabad', 'F-7', 2), ('Islamabad', 'F-8', 3),
  ('Islamabad', 'F-10', 4), ('Islamabad', 'F-11', 5),
  ('Islamabad', 'G-6', 6), ('Islamabad', 'G-7', 7), ('Islamabad', 'G-8', 8),
  ('Islamabad', 'G-9', 9), ('Islamabad', 'G-10', 10), ('Islamabad', 'G-11', 11),
  ('Islamabad', 'G-13', 12), ('Islamabad', 'E-11', 13), ('Islamabad', 'I-8', 14),
  ('Islamabad', 'I-10', 15), ('Islamabad', 'DHA Islamabad Phase 1', 16),
  ('Islamabad', 'DHA Islamabad Phase 2', 17), ('Islamabad', 'Bahria Town Phase 4', 18),
  ('Islamabad', 'Bahria Town Phase 7', 19), ('Islamabad', 'Bahria Town Phase 8', 20),
  ('Islamabad', 'Bahria Enclave', 21), ('Islamabad', 'Bani Gala', 22),
  ('Islamabad', 'Gulberg Greens', 23), ('Islamabad', 'Soan Garden', 24),
  ('Islamabad', 'PWD Housing Society', 25), ('Islamabad', 'Top City-1', 26),
  ('Islamabad', 'Park View City', 27), ('Islamabad', 'Blue Area', 28),
  ('Rawalpindi', 'Bahria Town Phase 1', 1), ('Rawalpindi', 'Bahria Town Phase 3', 2),
  ('Rawalpindi', 'Bahria Town Phase 8', 3), ('Rawalpindi', 'DHA Phase 1', 4),
  ('Rawalpindi', 'DHA Phase 2', 5), ('Rawalpindi', 'DHA Phase 5', 6),
  ('Rawalpindi', 'Askari 10', 7), ('Rawalpindi', 'Askari 11', 8), ('Rawalpindi', 'Askari 14', 9),
  ('Rawalpindi', 'Satellite Town', 10), ('Rawalpindi', 'Chaklala Scheme 1', 11),
  ('Rawalpindi', 'Chaklala Scheme 3', 12), ('Rawalpindi', 'Westridge', 13),
  ('Rawalpindi', 'Gulraiz Housing Scheme', 14), ('Rawalpindi', 'Adiala Road', 15),
  ('Rawalpindi', 'Race Course Road', 16), ('Rawalpindi', 'Cantt', 17),
  ('Rawalpindi', 'PWD Housing Society', 18)
on conflict do nothing;

-- ---------- property types ----------
-- Flat list; the UI groups them into Residential/Plots/Commercial
-- via a static client-side map (property-taxonomy.js), the same
-- grouping Zameen's filters use.
alter table public.listings
  add column if not exists property_type text
    check (property_type in (
      'house', 'flat', 'upper_portion', 'lower_portion', 'room', 'farm_house',
      'residential_plot', 'commercial_plot', 'agricultural_land',
      'office', 'shop', 'warehouse', 'building'
    ));

-- backfill any pre-existing rows (none expected pre-launch) before making it required
update public.listings set property_type = 'house' where property_type is null;
alter table public.listings alter column property_type set not null;

-- ---------- photos ----------
alter table public.listings add column if not exists photos text[] not null default '{}';

-- ---------- city stays a plain text column (unchanged shape), but is
-- now restricted to active rows in `cities` at insert/update time, so
-- launching a new city later is one INSERT, not a schema change ----------
create or replace function public.enforce_active_city()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.cities where name = new.city and active = true) then
    raise exception 'This city is not yet open for listings.';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_active_city on public.listings;
create trigger listings_active_city
  before insert or update of city on public.listings
  for each row execute function public.enforce_active_city();

-- ---------- CNIC policy: nullable on profiles, required only when it matters ----------
-- (developer applications already carry their own cnic column and are
-- unaffected by this). Individual sellers are asked for it inline the
-- first time they post a listing, enforced by db-client.js before insert,
-- not by a NOT NULL constraint, so browsing/holding an account never
-- requires it.
alter table public.profiles alter column cnic drop not null;

-- ---------- is_admin() helper (avoids recursive RLS on profiles) ----------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- admin needs to see every profile / application / listing / log row,
-- not just their own — add explicit admin-wide policies alongside the
-- existing owner-only ones from 0001.
create policy "profiles readable by admin" on public.profiles
  for select using (public.is_admin());

create policy "listings updatable by admin" on public.listings
  for update using (public.is_admin());

-- ---------- referral tree via RPC (keeps profiles' RLS tight; the tree
-- only ever needs id/full_name/referred_by, never phone/cnic) ----------
create or replace function public.get_referral_tree(root_id uuid, max_depth int default 5)
returns table (level int, id uuid, full_name text)
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
  select level, id, full_name from tree order by level;
$$;

-- ---------- featured-agency ranking (developer tier 3 = "Elite") ----------
-- Used by db-client.js's getListings to sort Elite-tier developer
-- listings first, mirroring Zameen's "Featured Agency" boost concept.
create or replace function public.listing_owner_developer_tier(owner uuid)
returns smallint
language sql
stable
as $$
  select developer_tier from public.profiles where id = owner;
$$;

-- ---------- storage buckets ----------
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('developer-docs', 'developer-docs', false)
on conflict (id) do nothing;

-- listing photos: public read, owner can upload/delete under a path
-- prefixed with their own listing's owner_id
create policy "listing photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "listing photos are uploadable by authenticated owners"
  on storage.objects for insert
  with check (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "listing photos are deletable by their owner"
  on storage.objects for delete
  using (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- developer docs: private — only the uploading owner or an admin can read
create policy "developer docs readable by owner or admin"
  on storage.objects for select
  using (bucket_id = 'developer-docs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));

create policy "developer docs uploadable by owner"
  on storage.objects for insert
  with check (bucket_id = 'developer-docs' and auth.uid()::text = (storage.foldername(name))[1]);
