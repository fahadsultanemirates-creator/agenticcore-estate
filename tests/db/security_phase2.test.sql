-- Security Hardening Phase 2 — run on a LOCAL database built from all Estate + PK
-- migrations (never production). Every check raises on failure.
\set ON_ERROR_STOP 1
-- ---------- fixtures: signup through the real trigger ----------
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
 ('a0000000-0000-0000-0000-000000000001','buyer@x.pk',     extensions.crypt('Secret-pass1', extensions.gen_salt('bf')), '{"full_name":"Buyer One","phone":"03001111111","role":"buyer"}'),
 ('a0000000-0000-0000-0000-000000000002','dev@x.pk',       extensions.crypt('Secret-pass2', extensions.gen_salt('bf')), '{"full_name":"Dev Co","phone":"03002222222","role":"developer"}'),
 ('a0000000-0000-0000-0000-000000000003','admin@x.pk',     extensions.crypt('Secret-pass3', extensions.gen_salt('bf')), '{"full_name":"Admin","phone":"03003333333","role":"admin"}'),
 ('a0000000-0000-0000-0000-000000000005','agency@x.pk',    extensions.crypt('Secret-pass5', extensions.gen_salt('bf')), '{"full_name":"Agency","phone":"03005555555","role":"agency"}');
update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000003';   -- admins are set by hand
insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
select 'a0000000-0000-0000-0000-000000000004','ref@x.pk', extensions.crypt('Secret-pass4', extensions.gen_salt('bf')),
       json_build_object('full_name','<img src=x onerror=alert(1)>','phone','03004444444','role','buyer','referral_code',(select referral_code from public.profiles where id='a0000000-0000-0000-0000-000000000001'))::jsonb;

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.expect_denied(sql text, what text) returns void language plpgsql as $$
begin
  begin execute sql; exception when insufficient_privilege or check_violation or raise_exception then return;
    when others then if sqlstate = '42501' then return; end if; raise exception 'FAIL % (unexpected error %: %)', what, sqlstate, sqlerrm; end;
  raise exception 'FAIL % was allowed', what;
end $$;
grant execute on function pg_temp.as_user(text), pg_temp.expect_denied(text, text) to anon, authenticated;

do $t$ begin
  if (select count(*) from public.profiles) <> 5 then raise exception 'FAIL signup trigger'; end if;
  if (select referred_by from public.profiles where id='a0000000-0000-0000-0000-000000000004') <> 'a0000000-0000-0000-0000-000000000001' then raise exception 'FAIL referral at signup'; end if;
  if (select developer_status from public.profiles where id='a0000000-0000-0000-0000-000000000002') <> 'unsubmitted' then raise exception 'FAIL developer starts unsubmitted'; end if;
  raise notice 'ok  signup trigger creates profiles (5), referral link, developer unsubmitted';
end $t$;

-- ---------- ANONYMOUS ----------
set role anon;
do $t$ begin
  if public.login_email_for_phone('03001111111', 'Secret-pass1') <> 'buyer@x.pk' then raise exception 'FAIL phone login with right password'; end if;
  if public.login_email_for_phone('03001111111', 'wrong') is not null then raise exception 'FAIL wrong password disclosed email'; end if;
  if public.login_email_for_phone('03009999999', 'Secret-pass1') is not null then raise exception 'FAIL unknown phone'; end if;
  perform pg_temp.expect_denied($$select public.email_for_phone('03001111111')$$, 'anon email_for_phone');
  perform pg_temp.expect_denied($$insert into public.cities (name) values ('Hackville')$$, 'anon insert cities');
  perform pg_temp.expect_denied($$delete from public.areas$$, 'anon delete areas');
  perform pg_temp.expect_denied($$insert into public.admin_log (admin_id, action, target_table, target_id) values (gen_random_uuid(),'x','x',gen_random_uuid())$$, 'anon forge admin_log');
  perform pg_temp.expect_denied($$insert into public.referral_ledger (beneficiary_id, source_user_id, transaction_value, points_awarded) values ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004',1,100000)$$, 'anon mint ledger');
  perform pg_temp.expect_denied($$insert into public.developer_applications (user_id, company_name, phone, tier) values (gen_random_uuid(),'x','x',3)$$, 'anon dev application');
  perform pg_temp.expect_denied($$insert into public.projects (owner_id,title,city,area) values ('a0000000-0000-0000-0000-000000000002','x','Islamabad','x')$$, 'anon insert project');
  perform pg_temp.expect_denied($$truncate public.projects$$, 'anon truncate projects');
  perform pg_temp.expect_denied($$update public.public_profiles set role='admin'$$, 'anon write public_profiles (0015)');
  if (select count(*) from public.cities where active) < 2 or (select count(*) from public.areas) < 10 then raise exception 'FAIL anon reads cities/areas'; end if;
  if (select count(*) from public.public_profiles) <> 5 then raise exception 'FAIL anon reads public_profiles'; end if;
  if (select count(*) from public.profiles) <> 0 then raise exception 'FAIL anon must not read profiles'; end if;
  perform pg_temp.expect_denied($$select count(*) from public.referral_ledger$$, 'anon ledger read');
  raise notice 'ok  anonymous: phone login needs the password, email_for_phone gone, all audited writes denied, reads work';
end $t$;
do $t$ declare i int; begin
  for i in 1..4 loop perform public.login_email_for_phone('03005555555', 'bad'); end loop;
  begin perform public.login_email_for_phone('03005555555', 'bad'); perform public.login_email_for_phone('03005555555', 'Secret-pass5');
    raise exception 'FAIL throttle did not trigger';
  exception when raise_exception then if sqlerrm not like 'Too many login attempts%' then raise; end if; end;
  if public.login_email_for_phone('03001111111', 'Secret-pass1') <> 'buyer@x.pk' then raise exception 'FAIL throttle is per phone'; end if;
  perform pg_temp.expect_denied($$select count(*) from public.phone_login_attempts$$, 'anon read attempts table');
  raise notice 'ok  phone-login throttle: 5 failures per phone per 15 min, other phones unaffected, attempts table private';
end $t$;
reset role;

-- ---------- NORMAL AUTHENTICATED USER (buyer) ----------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ declare n int; lid uuid; begin
  perform pg_temp.expect_denied($$update public.profiles set developer_status='approved' where id=auth.uid()$$, 'self-approve developer_status');
  perform pg_temp.expect_denied($$update public.profiles set developer_tier=3 where id=auth.uid()$$, 'self-grant developer_tier');
  perform pg_temp.expect_denied($$update public.profiles set seller_package=3 where id=auth.uid()$$, 'self-grant seller_package');
  perform pg_temp.expect_denied($$insert into public.profiles (id, full_name, phone, role, referral_code) values (gen_random_uuid(),'x','0300','admin','ZZZ1')$$, 'insert profile');
  perform pg_temp.expect_denied($$update public.profiles set role='admin' where id=auth.uid()$$, 'self role change');
  perform pg_temp.expect_denied($$select public.email_for_phone('03002222222')$$, 'authenticated email_for_phone');
  -- Marketplace V2 (0018): any account may APPLY for the project-publisher capability
  -- (approval stays admin-only, tested below and in marketplace_v2.test.sql), so the
  -- 0017-era "non-developer cannot apply" check became "cannot apply for someone else".
  perform pg_temp.expect_denied($$insert into public.developer_applications (user_id, company_name, phone, tier) values ('a0000000-0000-0000-0000-000000000002','Buyer Co','0300',1)$$, 'application for another account');
  perform pg_temp.expect_denied($$insert into public.admin_log (admin_id, action, target_table, target_id) values (auth.uid(),'approved','x',gen_random_uuid())$$, 'forge admin_log');
  perform pg_temp.expect_denied($$truncate public.projects$$, 'authenticated truncate projects');
  perform pg_temp.expect_denied($$truncate public.admin_log$$, 'authenticated truncate admin_log');
  perform pg_temp.expect_denied($$select public.admin_decide_developer_application((select id from public.developer_applications limit 1), 'approved', null)$$, 'non-admin decide');
  update public.profiles set full_name = 'Buyer Renamed', referral_joined = true, referral_joined_at = now(), agency_name = null, cnic = '35202-1234567-1' where id = auth.uid();
  get diagnostics n = row_count; if n <> 1 then raise exception 'FAIL own profile edit (name, referral join, cnic)'; end if;
  if (select role from public.profiles where id = auth.uid()) <> 'buyer' or (select count(*) from public.profiles) <> 1 then raise exception 'FAIL own profile read'; end if;
  insert into public.listings (owner_id,title,type,property_type,city,area,price,beds,baths,size_marla,size_unit,description,photos)
  values (auth.uid(),'5 Marla House','buy','house','Rawalpindi','Bahria Town Phase 8',18500000,3,3,5,'marla','x','{}') returning id into lid;
  update public.listings set price = 18000000, photos = array['https://example.org/a.jpg'] where id = lid;
  get diagnostics n = row_count; if n <> 1 then raise exception 'FAIL own listing edit'; end if;
  perform public.confirm_listing_available(lid);
  if (select count(*) from public.get_listing_contact(lid)) <> 1 then raise exception 'FAIL listing contact'; end if;
  if (select count(*) from public.get_my_direct_referrals()) <> 1 then raise exception 'FAIL direct referrals'; end if;
  raise notice 'ok  buyer: cannot self-grant status/tier/package/role or forge logs; can edit name/referral/cnic, list, edit, confirm, see contact and referrals';
end $t$;
reset role;

-- ---------- DEVELOPER APPLICATION PATH ----------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ declare n int; begin
  perform pg_temp.expect_denied($$insert into public.developer_applications (user_id, company_name, phone, tier, status, decision_at) values (auth.uid(),'Dev Co','0300',4,'approved',now())$$, 'pre-approved application');
  insert into public.developer_applications (user_id, company_name, phone, tier) values (auth.uid(), 'Dev Co <b>', '03002222222', 3);
  if (select developer_status from public.profiles where id = auth.uid()) <> 'pending' then raise exception 'FAIL application → pending'; end if;
  if (select developer_tier from public.profiles where id = auth.uid()) is not null then raise exception 'FAIL tier granted before approval'; end if;
  if (select status from public.developer_applications where user_id = auth.uid()) <> 'pending' then raise exception 'FAIL application status'; end if;
  perform pg_temp.expect_denied($$update public.developer_applications set status='approved' where user_id=auth.uid()$$, 'self-approve application');
  perform pg_temp.expect_denied($$update public.profiles set developer_status='approved' where id=auth.uid()$$, 'developer self-approve');
  perform pg_temp.expect_denied($$insert into public.projects (owner_id,title,city,area) values (auth.uid(),'Early Towers','Islamabad','Blue Area')$$, 'pending developer posts a project');
  raise notice 'ok  developer: cannot submit a pre-approved application or self-approve; application → pending, no tier; cannot post projects before approval';
end $t$;
reset role;

-- ---------- ADMIN ----------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
set role authenticated;
do $t$ declare app public.developer_applications; begin
  if not public.is_admin() then raise exception 'FAIL is_admin for admin'; end if;
  if (select count(*) from public.developer_applications where status = 'pending') <> 1 then raise exception 'FAIL admin reads queue'; end if;
  app := public.admin_decide_developer_application((select id from public.developer_applications limit 1), 'approved', 'Checked by phone');
  if app.status <> 'approved' or app.reviewer_id <> auth.uid() then raise exception 'FAIL decision recorded'; end if;
  if (select developer_status || '/' || developer_tier from public.profiles where id = 'a0000000-0000-0000-0000-000000000002') <> 'approved/3' then raise exception 'FAIL approval grants status + tier'; end if;
  perform public.admin_set_listing_verified((select id from public.listings limit 1), true);
  if (select count(*) from public.admin_log) <> 2 then raise exception 'FAIL admin_log written (got %)', (select count(*) from public.admin_log); end if;
  if (select string_agg(action, ',' order by action) from public.admin_log) <> 'approved,verified' then raise exception 'FAIL admin_log actions'; end if;
  perform pg_temp.expect_denied($$insert into public.admin_log (admin_id, action, target_table, target_id) values (auth.uid(),'x','x',gen_random_uuid())$$, 'admin direct admin_log insert (server functions only)');
  if (select count(*) from public.profiles) <> 5 then raise exception 'FAIL admin reads all profiles'; end if;
  raise notice 'ok  admin: is_admin, reads queue, decides (status + tier + reviewer), admin_log written by server functions only';
end $t$;
reset role;
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ declare n int; begin
  insert into public.projects (owner_id,title,city,area) values (auth.uid(),'Dev Towers','Islamabad','Blue Area');
  update public.projects set title = 'Dev Towers II' where owner_id = auth.uid();
  get diagnostics n = row_count; if n <> 1 then raise exception 'FAIL approved developer project edit'; end if;
  raise notice 'ok  approved developer: posts and edits projects';
end $t$;
reset role;
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ begin
  perform pg_temp.expect_denied($$insert into public.projects (owner_id,title,city,area) values (auth.uid(),'Buyer Towers','Islamabad','Blue Area')$$, 'buyer posts a project');
  if (select count(*) from public.admin_log) <> 0 then raise exception 'FAIL normal user reads admin_log'; end if;
  raise notice 'ok  normal user cannot read admin_log';
end $t$;
reset role;

-- ---------- AgenticCore Pakistan on the same project + referral points ----------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
set role authenticated;
do $t$ declare inv text; begin
  select max(invoice_number) into inv from public.pk_place_order('[{"line_id":"11-dfy"}]'::jsonb);
  if (select amount from public.pk_invoices where number = inv) <> 999 then raise exception 'FAIL PK order pricing'; end if;
  if (select count(*) from public.pk_tasks) <> 1 then raise exception 'FAIL PK own tasks'; end if;
  perform set_config('test.inv', inv, false);
  raise notice 'ok  PK: referred user places an order, server-priced, sees own task';
end $t$;
reset role;
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
set role authenticated;
select public.pk_admin_set_invoice_status((select id from public.pk_invoices where number = current_setting('test.inv')), 'paid', null) is not null;
reset role;
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ begin
  if (select count(*) from public.referral_ledger) <> 1 then raise exception 'FAIL referrer reads own ledger'; end if;
  if (select points from public.profiles where id = auth.uid()) < 99 then raise exception 'FAIL referral points credited'; end if;
  raise notice 'ok  referral: PK payment credits the referrer (ledger row + points) through the server function; referrer reads it';
end $t$;
reset role;

-- ---------- privilege / storage state ----------
do $t$ declare r record; begin
  for r in select t, p from unnest(array['cities','areas','admin_log','referral_ledger','developer_applications','projects']) t, unnest(array['TRUNCATE']) p loop
    if has_table_privilege('anon', 'public.' || r.t, r.p) or has_table_privilege('authenticated', 'public.' || r.t, r.p) then raise exception 'FAIL % still truncatable', r.t; end if;
  end loop;
  if (select count(*) from storage.buckets where id in ('listing-photos','project-assets','profile-assets','developer-docs') and file_size_limit is not null and allowed_mime_types is not null) <> 4 then raise exception 'FAIL bucket limits'; end if;
  raise notice 'ok  no TRUNCATE on audited tables; 4 Estate buckets have size + type limits';
end $t$;
