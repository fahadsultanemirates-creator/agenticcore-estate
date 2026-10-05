-- ============================================================
-- 0026 — Master accounts: one account, many owners' numbers.
--
-- The AgenticCore team lists properties for owners who have no account.
-- A master account keeps its own login and profile, but each of its
-- listings can carry that property owner's contact number.
--
--  1. master_accounts: who is a master. Only the owner (SQL editor /
--     service role) adds or removes rows; people can read their own row.
--  2. is_master(): true for a master account (or an admin).
--  3. A listing's own contact number lives in entity_public_phones
--     (entity_type 'listing') — never in the public listings table, so it
--     is shown the same way as other numbers: to signed-in visitors only,
--     through get_listing_contact().
--  4. set_listing_contact_phone(): a master (or admin) sets or clears the
--     number on a listing they own. Everyone else keeps the account's
--     public number as before.
--  5. mv2_public_phone('listing'): the listing's own number comes first.
--  6. The number is removed when its listing is deleted.
-- Safe to run more than once.
-- ============================================================

create table if not exists public.master_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  note text,
  set_at timestamptz not null default now()
);
alter table public.master_accounts enable row level security;
revoke all on public.master_accounts from public, anon, authenticated;
grant select on public.master_accounts to authenticated;
grant all on public.master_accounts to service_role;
drop policy if exists "master accounts: own row or admin" on public.master_accounts;
create policy "master accounts: own row or admin" on public.master_accounts
  for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.is_master(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select p_user is not null and (exists (select 1 from public.master_accounts m where m.user_id = p_user)
                                     or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')) $$;
revoke all on function public.is_master(uuid) from public, anon;
grant execute on function public.is_master(uuid) to authenticated, service_role;

-- listing numbers share the table (and its privacy) with agency/professional/company numbers
alter table public.entity_public_phones drop constraint if exists entity_public_phones_entity_type_check;
alter table public.entity_public_phones add constraint entity_public_phones_entity_type_check
  check (entity_type = any (array['agency', 'professional', 'company', 'listing']));

create or replace function public.set_listing_contact_phone(p_listing uuid, p_phone text)
returns void language plpgsql security definer set search_path = public
as $$
declare l record; v text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if auth.uid() is null then raise exception 'Please log in.' using errcode = '42501'; end if;
  if not public.is_master(auth.uid()) then raise exception 'Only master accounts can set a number per listing.' using errcode = '42501'; end if;
  select id, owner_id, is_sample into l from public.listings where id = p_listing;
  if l.id is null or (l.owner_id <> auth.uid() and not public.is_admin()) then raise exception 'Not found or not yours.' using errcode = '42501'; end if;
  if l.is_sample then raise exception 'Sample content has no contact.'; end if;
  if not public.mv2_valid_phone(v) then raise exception 'Please enter a valid phone number, or leave it empty.'; end if;
  if v is null then
    delete from public.entity_public_phones where entity_type = 'listing' and entity_id = p_listing;
  else
    insert into public.entity_public_phones (entity_type, entity_id, owner_id, phone)
    values ('listing', p_listing, l.owner_id, v)
    on conflict (entity_type, entity_id) do update set phone = excluded.phone, owner_id = excluded.owner_id, updated_at = now();
  end if;
end;
$$;
revoke all on function public.set_listing_contact_phone(uuid, text) from public, anon;
grant execute on function public.set_listing_contact_phone(uuid, text) to authenticated;

create or replace function public.mv2_public_phone(p_type text, p_id uuid)
returns text language plpgsql stable security definer set search_path = public
as $function$
declare v text;
begin
  case p_type
    when 'listing' then
      select coalesce(lp.phone, pp.phone, ap.phone, nullif(o.public_phone, '')) into v
        from public.listings l
        join public.profiles o on o.id = l.owner_id
        left join public.entity_public_phones lp on lp.entity_type = 'listing' and lp.entity_id = l.id
        left join public.entity_public_phones pp on pp.entity_type = 'professional' and pp.entity_id = l.professional_id
        left join public.entity_public_phones ap on ap.entity_type = 'agency' and ap.entity_id = l.agency_id
       where l.id = p_id;
    when 'project' then
      select coalesce(cp.phone, nullif(o.public_phone, '')) into v
        from public.projects p join public.profiles o on o.id = p.owner_id
        left join public.entity_public_phones cp on cp.entity_type = 'company' and cp.entity_id = p.company_id
       where p.id = p_id;
    when 'professional', 'agency', 'company' then
      select e.phone into v from public.entity_public_phones e where e.entity_type = p_type and e.entity_id = p_id;
    else v := null;
  end case;
  return v;
end;
$function$;

create or replace function public.ac_drop_listing_phone()
returns trigger language plpgsql security definer set search_path = public
as $$ begin delete from public.entity_public_phones where entity_type = 'listing' and entity_id = old.id; return old; end; $$;
revoke execute on function public.ac_drop_listing_phone() from public, anon, authenticated;
drop trigger if exists listings_drop_phone on public.listings;
create trigger listings_drop_phone after delete on public.listings for each row execute function public.ac_drop_listing_phone();

-- The AgenticCore team account (AC-100004) is the first master account.
insert into public.master_accounts (user_id, note)
select u.id, 'AgenticCore team: lists properties for owners without an account'
  from auth.users u where lower(u.email) = 'agenticcoreagency@gmail.com'
on conflict (user_id) do nothing;
