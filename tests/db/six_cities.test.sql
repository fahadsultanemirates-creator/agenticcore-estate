-- Six cities (0022) — run on a LOCAL database built from all migrations
-- through 0022 plus the sample seed (never production).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.anon() returns void language sql as $$ select set_config('request.jwt.claims', '{}', false) $$;
grant execute on function pg_temp.as_user(text), pg_temp.anon() to anon, authenticated;

do $t$ begin
  if (select count(*) from public.cities where active) <> 6 then raise exception 'FAIL six active cities'; end if;
  if (select string_agg(name, ',' order by sort_order) from public.cities) <> 'Islamabad,Rawalpindi,Lahore,Karachi,Sialkot,Faisalabad' then raise exception 'FAIL order'; end if;
  if (select launch_at from public.cities where name = 'Sialkot') <> timestamptz '2026-10-05 19:00:00+00' then raise exception 'FAIL launch time is 00:00 PKT'; end if;
  if (select launch_at from public.cities where name = 'Islamabad') is not null then raise exception 'FAIL Islamabad has no launch date'; end if;
  if (select count(*) from public.areas where city_name = 'Lahore' and name in ('DHA Lahore', 'Bahria Town Lahore', 'Gulberg', 'Johar Town', 'Model Town')) <> 5 then raise exception 'FAIL Lahore areas'; end if;
  if (select count(*) from public.areas where city_name = 'Karachi' and name in ('DHA Karachi', 'Clifton', 'Bahria Town Karachi', 'Gulshan-e-Iqbal', 'Scheme 33')) <> 5 then raise exception 'FAIL Karachi areas'; end if;
  if (select count(*) from public.areas where city_name = 'Sialkot' and name in ('Cantonment', 'DHA Sialkot', 'Sialkot city')) <> 3 then raise exception 'FAIL Sialkot areas'; end if;
  if (select count(*) from public.areas where city_name = 'Faisalabad' and name in ('Citi Housing Faisalabad', 'Eden Valley', 'Faisalabad city')) <> 3 then raise exception 'FAIL Faisalabad areas'; end if;
  if exists (select 1 from public.areas group by city_name, lower(name) having count(*) > 1) then raise exception 'FAIL duplicate areas'; end if;
  raise notice 'ok  1 six cities active in order; new four open 6 Oct 2026 00:00 PKT; areas added without duplicates';
end $t$;

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
 ('c6000000-0000-0000-0000-000000000001', 'lhr@x.pk', extensions.crypt('Pass-w1', extensions.gen_salt('bf')), '{"full_name":"Lahore Owner","phone":"03216666666"}');

-- an owner in each new city lists now (as themselves, through RLS)
select pg_temp.as_user('c6000000-0000-0000-0000-000000000001');
set role authenticated;
insert into public.listings (owner_id, title, type, property_type, city, area, price) values
 ('c6000000-0000-0000-0000-000000000001', 'L', 'buy', 'house', 'Lahore', 'Johar Town', 25000000),
 ('c6000000-0000-0000-0000-000000000001', 'K', 'buy', 'house', 'Karachi', 'Clifton', 90000000),
 ('c6000000-0000-0000-0000-000000000001', 'S', 'buy', 'house', 'Sialkot', 'Cantonment', 40000000),
 ('c6000000-0000-0000-0000-000000000001', 'F', 'buy', 'house', 'Faisalabad', 'Eden Valley', 30000000);
do $t$ begin
  if (select count(*) from public.listings where owner_id = auth.uid()) <> 4 then raise exception 'FAIL owner sees own pre-launch listings'; end if;
  raise notice 'ok  2 sign-ups can list in Lahore, Karachi, Sialkot and Faisalabad now; the owner sees them';
end $t$;
reset role;

-- publicly: hidden until launch, visible from launch (date check only)
select pg_temp.anon();
set role anon;
do $t$ begin
  if exists (select 1 from public.listings where city in ('Lahore', 'Karachi', 'Sialkot', 'Faisalabad') and moderation_status = 'active') and now() < timestamptz '2026-10-06 00:00+05'
    then raise exception 'FAIL pre-launch listings visible to the public'; end if;
  if not public.city_is_live('Islamabad') then raise exception 'FAIL Islamabad live'; end if;
  raise notice 'ok  3 before 6 October the public does not see listings in the four new cities';
end $t$;
reset role;
update public.cities set launch_at = now() - interval '1 second' where name = 'Lahore';   -- simulate launch moment
set role anon;
do $t$ begin
  if not exists (select 1 from public.listings where city = 'Lahore' and title = 'L') then raise exception 'FAIL Lahore listing visible after launch'; end if;
  if exists (select 1 from public.listings where city = 'Karachi' and title = 'K') then raise exception 'FAIL Karachi still hidden'; end if;
  raise notice 'ok  4 from the launch moment the listings show — no switch, just the date';
end $t$;
reset role;

-- visitors still cannot change cities or areas
set role anon;
do $t$ begin
  begin update public.cities set launch_at = null; raise exception 'FAIL anon changed cities'; exception when insufficient_privilege then null; end;
  begin insert into public.areas (city_name, name) values ('Lahore', 'X'); raise exception 'FAIL anon added an area'; exception when insufficient_privilege then null; end;
  raise notice 'ok  5 cities and areas stay read-only for visitors';
end $t$;
reset role;
