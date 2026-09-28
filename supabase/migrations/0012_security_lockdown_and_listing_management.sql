-- ============================================================
-- AgenticCore Estate — security lockdown + listing management
-- ------------------------------------------------------------
-- Found in a pre-launch review on 28 Sep 2026. All of these were
-- exploitable from the browser console with the public anon key:
--
--  1. Signing up with raw_user_meta_data.role = 'admin' created an
--     admin account (handle_new_user copied the role as-is).
--  2. Any signed-in user could UPDATE their own profiles.role (to
--     'admin') or profiles.points (mint points): the owner update policy
--     had no column limits and 'authenticated' held UPDATE on every column.
--  3. Listing owners could set listings.verified = true on their own
--     listings, or move a listing to another owner_id.
--  4. cities / areas had RLS disabled, so anyone could insert, change or
--     delete them (cities gate which listings can be posted).
--
-- It also adds what listing owners need to manage their listings:
--  5. Owners (and admins) can delete a listing — there was no delete policy.
--  6. get_listing_contact(): signed-in visitors can see a listing owner's
--     name and phone so buyers can actually reach the seller, without
--     making profiles.phone readable in bulk.
--  7. Admins can update other users' profiles (the developer-application
--     decision already tried to, and was silently refused by RLS).
-- ============================================================

-- ---------- 1. signup can never create an admin ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name_val text := new.raw_user_meta_data->>'full_name';
  phone_val text := new.raw_user_meta_data->>'phone';
  role_val text := coalesce(new.raw_user_meta_data->>'role', 'buyer');
  referred_by_val uuid;
  ref_code_input text := new.raw_user_meta_data->>'referral_code';
  base_code text;
  generated_code text;
begin
  -- Only self-service roles can be chosen at signup; 'admin' is granted by
  -- hand in the SQL editor, never from signup metadata.
  if role_val not in ('buyer', 'seller', 'developer', 'agency', 'builder') then
    role_val := 'buyer';
  end if;

  if ref_code_input is not null and ref_code_input <> '' then
    select id into referred_by_val from public.profiles where referral_code = upper(ref_code_input) limit 1;
  end if;

  base_code := upper(regexp_replace(coalesce(full_name_val, 'user'), '[^a-zA-Z]', '', 'g'));
  base_code := left(nullif(base_code, ''), 6);
  generated_code := coalesce(base_code, 'USER') || floor(random() * 9000 + 1000)::text;

  insert into public.profiles (id, full_name, phone, role, referred_by, referral_code, developer_status)
  values (
    new.id,
    coalesce(full_name_val, 'AgenticCore Estate user'),
    coalesce(nullif(phone_val, ''), new.id::text),
    role_val,
    referred_by_val,
    generated_code,
    case when role_val = 'developer' then 'unsubmitted' else null end
  );
  return new;
end;
$$;

-- ---------- 2. profiles: only safe columns are editable from the browser ----------
revoke insert, update, delete, truncate on public.profiles from anon;
revoke update, delete, truncate on public.profiles from authenticated;
grant update (
  full_name,
  cnic,
  agency_name, agency_logo_path, agency_description,
  builder_company_name, builder_logo_path, builder_description, builder_projects_completed, builder_services,
  referral_joined, referral_joined_at,
  -- still set from the browser during the launch window (developer
  -- applications are auto-approved; seller packages are chosen in the UI).
  -- Move these into security-definer RPCs next, then drop them here.
  developer_status, developer_tier, seller_package
) on public.profiles to authenticated;
-- Never user-editable: id, phone (login identity), role, points,
-- referral_code, referred_by, created_at.

drop policy if exists "profiles updatable by admin" on public.profiles;
create policy "profiles updatable by admin" on public.profiles
  for update using (public.is_admin());

-- ---------- 3. listings: owners edit content, never verification/ownership ----------
revoke insert, update, delete, truncate on public.listings from anon;
revoke insert, update, truncate on public.listings from authenticated;
grant insert (
  owner_id, title, type, property_type, city, area, price, beds, baths,
  size_marla, size_unit, description, photos
) on public.listings to authenticated;
grant update (
  title, type, property_type, city, area, price, beds, baths,
  size_marla, size_unit, description, photos
) on public.listings to authenticated;

-- Admins mark listings verified through this function instead.
create or replace function public.admin_set_listing_verified(p_listing uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  update public.listings set verified = p_verified where id = p_listing;
end;
$$;
revoke all on function public.admin_set_listing_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_listing_verified(uuid, boolean) to authenticated;

-- ---------- 4. cities / areas: public read, admin write ----------
alter table public.cities enable row level security;
alter table public.areas enable row level security;
drop policy if exists "cities are publicly readable" on public.cities;
create policy "cities are publicly readable" on public.cities for select using (true);
drop policy if exists "cities admin write" on public.cities;
create policy "cities admin write" on public.cities for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "areas are publicly readable" on public.areas;
create policy "areas are publicly readable" on public.areas for select using (true);
drop policy if exists "areas admin write" on public.areas;
create policy "areas admin write" on public.areas for all using (public.is_admin()) with check (public.is_admin());

-- ---------- 5. owners (and admins) can delete listings ----------
drop policy if exists "listings are deletable by owner or admin" on public.listings;
create policy "listings are deletable by owner or admin" on public.listings
  for delete using (auth.uid() = owner_id or public.is_admin());

-- ---------- 6. seller contact for signed-in visitors ----------
create or replace function public.get_listing_contact(p_listing uuid)
returns table (full_name text, phone text, agency_name text)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name,
         -- profiles created without a phone store the user id there; never return that
         case when p.phone = p.id::text then null else p.phone end,
         p.agency_name
  from public.listings l
  join public.profiles p on p.id = l.owner_id
  where l.id = p_listing
    and auth.uid() is not null;
$$;
revoke all on function public.get_listing_contact(uuid) from public, anon;
grant execute on function public.get_listing_contact(uuid) to authenticated;
