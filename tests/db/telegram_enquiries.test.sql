-- Telegram Phase 3 enquiries (0021) — run on a LOCAL database built from all
-- migrations through 0021 plus the sample seed (never production).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false) $$;
create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false) $$;

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
 ('e2100000-0000-0000-0000-000000000001', 'seller21@x.pk', extensions.crypt('Pass-w1', extensions.gen_salt('bf')), '{"full_name":"Seller","phone":"03214444444"}'),
 ('e2100000-0000-0000-0000-000000000002', 'buyer21@x.pk', extensions.crypt('Pass-w2', extensions.gen_salt('bf')), '{"full_name":"Buyer","phone":"03215555555"}');
select pg_temp.as_service();
insert into public.listings (id, owner_id, title, type, property_type, city, area, price)
values ('e2100000-0000-0000-0000-0000000000b1', 'e2100000-0000-0000-0000-000000000001', 'Seller House', 'buy', 'house', 'Islamabad', 'G-13', 40000000);

do $t$ declare eid uuid; begin
  eid := public.send_enquiry_as('e2100000-0000-0000-0000-000000000002', 'listing', 'e2100000-0000-0000-0000-0000000000b1', 'Is it still available?', null);
  if eid is null then raise exception 'FAIL no enquiry id'; end if;
  if (select sender_id from public.enquiries where id = eid) <> 'e2100000-0000-0000-0000-000000000002' then raise exception 'FAIL sender is not the person'; end if;
  raise notice 'ok  1 the server sends an enquiry as the identified person';
end $t$;

do $t$ begin
  perform pg_temp.as_service();
  begin perform public.send_enquiry_as('e2100000-0000-0000-0000-000000000001', 'listing', 'e2100000-0000-0000-0000-0000000000b1', 'own', null);
    raise exception 'FAIL could enquire on own listing'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.send_enquiry_as('e2100000-0000-0000-0000-000000000002', 'listing', '5a3b1e00-0000-4000-8000-000000000101', 'sample', null);
    raise exception 'FAIL could enquire on a sample'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.send_enquiry_as('e2100000-0000-0000-0000-0000000000ff', 'listing', 'e2100000-0000-0000-0000-0000000000b1', 'ghost', null);
    raise exception 'FAIL unknown account accepted'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'ok  2 send_enquiry rules still apply: own listing, samples, unknown accounts refused';
end $t$;

-- 3. members and visitors cannot call it (only the server)
select pg_temp.as_user('e2100000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ begin
  begin perform public.send_enquiry_as('e2100000-0000-0000-0000-000000000001', 'listing', 'e2100000-0000-0000-0000-0000000000b1', 'spoof', null);
    raise exception 'FAIL member could send as someone else'; exception when insufficient_privilege then null; end;
  raise notice 'ok  3 not callable from the website (members cannot send as another person)';
end $t$;
reset role;
