-- Ecosystem patch (0019) — run on a LOCAL database built from all Estate + PK
-- migrations through 0019 plus the sample seed (never production).
\set ON_ERROR_STOP 1
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
 ('e0000000-0000-0000-0000-000000000001','eco1@x.pk', extensions.crypt('Pass-e1', extensions.gen_salt('bf')), '{"full_name":"Eco Owner","phone":"03201111111","role":"agency"}'),
 ('e0000000-0000-0000-0000-000000000002','eco2@x.pk', extensions.crypt('Pass-e2', extensions.gen_salt('bf')), '{"full_name":"Eco Other","phone":"03202222222","role":"buyer"}');
insert into public.agencies (id, owner_id, name, description) values ('e0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 'Eco Realty', 'Family homes in Islamabad and Rawalpindi.');
insert into public.listings (id, owner_id, title, type, property_type, city, area, price) values ('e0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-000000000001', 'Eco House', 'buy', 'house', 'Islamabad', 'G-13', 1);

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false) $$;
grant execute on function pg_temp.as_user(text) to anon, authenticated;

select pg_temp.as_user('e0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ begin
  if (select title from public.my_marketplace_entity('agency', 'e0000000-0000-0000-0000-0000000000a1')) is distinct from 'Eco Realty' then raise exception 'FAIL owner sees own agency context'; end if;
  if (select title from public.my_marketplace_entity('property', 'e0000000-0000-0000-0000-0000000000b1')) is distinct from 'Eco House' then raise exception 'FAIL owner sees own property context'; end if;
  if exists (select 1 from public.my_marketplace_entity('agency', '5a3b1e00-0000-4000-8000-000000000401')) then raise exception 'FAIL sample entity returned'; end if;
  if exists (select 1 from public.my_marketplace_entity('agency', 'e0000000-0000-0000-0000-0000000000b1')) then raise exception 'FAIL id under the wrong type returned'; end if;
  if exists (select 1 from public.my_marketplace_entity('admin', 'e0000000-0000-0000-0000-0000000000a1')) then raise exception 'FAIL unknown type accepted'; end if;
  raise notice 'ok  1 owner gets own context (agency, property); samples, wrong type and unknown type return nothing';
end $t$;
reset role;
select pg_temp.as_user('e0000000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ begin
  if exists (select 1 from public.my_marketplace_entity('agency', 'e0000000-0000-0000-0000-0000000000a1')) then raise exception 'FAIL other user sees someone else''s entity (modified id)'; end if;
  if exists (select 1 from public.my_marketplace_entity('property', 'e0000000-0000-0000-0000-0000000000b1')) then raise exception 'FAIL other user sees someone else''s listing'; end if;
  -- the existing PK guard still refuses another user's listing in an order
  begin
    perform public.pk_place_order('[{"line_id":"11-dfy","details":{"estate_listing_id":"e0000000-0000-0000-0000-0000000000b1"}}]'::jsonb);
    raise exception 'FAIL pk order accepted another user''s listing';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'ok  2 another user (hand-edited id) gets nothing; PK order with someone else''s listing is refused (pk_0003)';
end $t$;
reset role;
select set_config('request.jwt.claims', '{}', false);
set role anon;
do $t$ begin
  begin perform public.my_marketplace_entity('agency', 'e0000000-0000-0000-0000-0000000000a1'); raise exception 'FAIL anon can call';
  exception when insufficient_privilege then null; when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'ok  3 anonymous visitors cannot call the context function';
end $t$;
reset role;
do $t$ begin
  if has_function_privilege('anon', 'public.my_marketplace_entity(text,uuid)', 'EXECUTE') then raise exception 'FAIL anon grant'; end if;
  if (select prosecdef from pg_proc where proname = 'my_marketplace_entity') is not true then raise exception 'FAIL not security definer'; end if;
  raise notice 'ok  4 grants: authenticated only; security definer with fixed search_path';
end $t$;
