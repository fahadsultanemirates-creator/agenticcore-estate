-- Learning memory (0023) — LOCAL database only (all migrations through 0023 + sample seed).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false) $$;
grant execute on function pg_temp.as_user(text), pg_temp.as_service() to anon, authenticated, service_role;

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
 ('e2300000-0000-0000-0000-000000000001', 'm1@x.pk', extensions.crypt('Pass-w1', extensions.gen_salt('bf')), '{"full_name":"M One","phone":"03217000001"}'),
 ('e2300000-0000-0000-0000-000000000002', 'm2@x.pk', extensions.crypt('Pass-w1', extensions.gen_salt('bf')), '{"full_name":"M Two","phone":"03217000002"}'),
 ('e2300000-0000-0000-0000-000000000003', 'm3@x.pk', extensions.crypt('Pass-w1', extensions.gen_salt('bf')), '{"full_name":"M Three","phone":"03217000003"}');

-- 1. listings teach: a known area counts; a block inside a known area is a sub-area candidate
select pg_temp.as_service();
insert into public.listings (owner_id, title, type, property_type, city, area, price) values
 ('e2300000-0000-0000-0000-000000000001', 'A', 'buy', 'house', 'Lahore', 'Johar Town', 25000000),
 ('e2300000-0000-0000-0000-000000000001', 'B', 'buy', 'house', 'Lahore', 'Johar Town Block G', 25000000),
 ('e2300000-0000-0000-0000-000000000001', 'C', 'buy', 'house', 'Lahore', 'Bismillah Housing Scheme', 25000000);
do $t$ begin
  if (select status from public.kb_facts where city = 'Lahore' and name = 'Johar Town Block G') <> 'candidate' then raise exception 'FAIL new block is a candidate'; end if;
  if (select kind || ':' || (detail ->> 'parent') from public.kb_facts where name = 'Johar Town Block G') <> 'subarea:Johar Town' then raise exception 'FAIL sub-area parent'; end if;
  if exists (select 1 from public.kb_known_places() where area = 'Bismillah Housing Scheme') then raise exception 'FAIL one person taught the bots'; end if;
  raise notice 'ok  1 listings are observed; a new place stays a candidate (one person cannot teach the system)';
end $t$;

-- 2. same person again does not count twice; three different people → learned
insert into public.listings (owner_id, title, type, property_type, city, area, price) values
 ('e2300000-0000-0000-0000-000000000001', 'C2', 'buy', 'house', 'Lahore', 'Bismillah Housing Scheme', 26000000),
 ('e2300000-0000-0000-0000-000000000002', 'D', 'buy', 'house', 'Lahore', 'bismillah housing scheme', 25000000);
do $t$ begin
  if (select sources from public.kb_facts where name = 'Bismillah Housing Scheme') <> 2 then raise exception 'FAIL distinct contributors'; end if;
end $t$;
insert into public.listings (owner_id, title, type, property_type, city, area, price) values
 ('e2300000-0000-0000-0000-000000000003', 'E', 'buy', 'house', 'Lahore', 'Bismillah Housing Scheme', 25000000);
do $t$ begin
  if (select status from public.kb_facts where name = 'Bismillah Housing Scheme') <> 'learned' then raise exception 'FAIL three people → learned'; end if;
  if not exists (select 1 from public.kb_known_places() where area = 'Bismillah Housing Scheme' and city = 'Lahore') then raise exception 'FAIL bots see learned place'; end if;
  if exists (select 1 from public.kb_fact_sources where contributor like 'e23%') then raise exception 'FAIL contributor stored in clear'; end if;
  if exists (select 1 from public.areas where name = 'Bismillah Housing Scheme') then raise exception 'FAIL dropdown changed without the owner'; end if;
  raise notice 'ok  2 three different people → learned (bots use it); contributors hashed; dropdowns unchanged';
end $t$;

-- 3. owner approves → joins the area dropdown; reject removes it from the bots
do $t$ declare v bigint; begin
  select id into v from public.kb_facts where name = 'Bismillah Housing Scheme';
  perform public.kb_decide(v, 'approved', null);
  if not exists (select 1 from public.areas where city_name = 'Lahore' and name = 'Bismillah Housing Scheme') then raise exception 'FAIL approved area in dropdown'; end if;
  select id into v from public.kb_facts where name = 'Johar Town Block G';
  perform public.kb_decide(v, 'rejected', null);
  if exists (select 1 from public.kb_known_places() where area = 'Johar Town Block G') then raise exception 'FAIL rejected used'; end if;
  raise notice 'ok  3 owner approval adds the area to the dropdown; rejected facts are never used';
end $t$;

-- 4. members: no access to shared knowledge internals or others' memory; own memory readable/deletable
do $t$ begin
  perform public.member_remember('e2300000-0000-0000-0000-000000000001', '{"cities":["Lahore"],"areas":["Johar Town"],"types":["house"],"lang":"ro","phone":"0300"}');
  perform public.member_remember('e2300000-0000-0000-0000-000000000001', '{"areas":["DHA Lahore","Johar Town"]}');
  if (select data -> 'areas' from public.member_memory where user_id = 'e2300000-0000-0000-0000-000000000001') <> '["DHA Lahore","Johar Town"]'::jsonb then raise exception 'FAIL merge order %', (select data from public.member_memory); end if;
  if (select data ? 'phone' from public.member_memory where user_id = 'e2300000-0000-0000-0000-000000000001') then raise exception 'FAIL non-whitelisted key stored'; end if;
end $t$;
select pg_temp.as_user('e2300000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ begin
  if exists (select 1 from public.member_memory) then raise exception 'FAIL sees another member memory'; end if;
  if exists (select 1 from public.kb_facts) then raise exception 'FAIL member reads kb internals'; end if;
  begin perform public.kb_observe('area', 'Lahore', 'Fake Town', '{}', 'x', 'me'); raise exception 'FAIL member observes directly'; exception when insufficient_privilege then null; end;
  begin perform public.kb_decide(1, 'approved', null); raise exception 'FAIL member decides'; exception when insufficient_privilege then null; end;
  begin perform public.member_remember('e2300000-0000-0000-0000-000000000001', '{"lang":"en"}'); raise exception 'FAIL writes others memory'; exception when insufficient_privilege then null; end;
  perform public.member_remember('e2300000-0000-0000-0000-000000000002', '{"lang":"en"}');
  if (select count(*) from public.member_memory) <> 1 then raise exception 'FAIL own memory'; end if;
  delete from public.member_memory;
  if exists (select 1 from public.member_memory) then raise exception 'FAIL delete own'; end if;
  raise notice 'ok  4 members: own memory only (read, delete); cannot read, teach or approve shared knowledge';
end $t$;
reset role;
select pg_temp.as_service();
set role anon;
do $t$ begin
  if not exists (select 1 from public.kb_known_places()) then raise exception 'FAIL anon reads known places'; end if;
  raise notice 'ok  5 visitors (website assistant) can read learned place names only';
end $t$;
reset role;

-- 6. samples never teach
reset role;
update public.listings set area = 'Sample Only Town' where id = (select id from public.listings where is_sample limit 1);
do $t$ begin
  if exists (select 1 from public.kb_facts where name = 'Sample Only Town') then raise exception 'FAIL sample taught'; end if;
  raise notice 'ok  6 sample listings never teach anything';
end $t$;
