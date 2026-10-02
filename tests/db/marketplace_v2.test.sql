-- Marketplace V2 — run on a LOCAL database built from all Estate + PK migrations
-- through 0018 plus supabase/seed/marketplace_samples.sql (never production).
-- Every check raises on failure. Run tests/db/security_phase2.test.sql on a
-- separate fresh build as the Phase 2 regression suite.
\set ON_ERROR_STOP 1

-- ---------- fixtures: real accounts through the real signup trigger ----------
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
 ('b0000000-0000-0000-0000-000000000001','owner@x.pk', extensions.crypt('Pass-1111', extensions.gen_salt('bf')), '{"full_name":"Owner One","phone":"03101111111","role":"buyer"}'),
 ('b0000000-0000-0000-0000-000000000002','pro@x.pk',   extensions.crypt('Pass-2222', extensions.gen_salt('bf')), '{"full_name":"Pro Two","phone":"03102222222","role":"professional"}'),
 ('b0000000-0000-0000-0000-000000000003','agency@x.pk',extensions.crypt('Pass-3333', extensions.gen_salt('bf')), '{"full_name":"Agency Three","phone":"03103333333","role":"agency"}'),
 ('b0000000-0000-0000-0000-000000000004','dev@x.pk',   extensions.crypt('Pass-4444', extensions.gen_salt('bf')), '{"full_name":"Dev Four","phone":"03104444444","role":"developer"}'),
 ('b0000000-0000-0000-0000-000000000005','admin@x.pk', extensions.crypt('Pass-5555', extensions.gen_salt('bf')), '{"full_name":"Admin Five","phone":"03105555555","role":"admin"}'),
 ('b0000000-0000-0000-0000-000000000006','other@x.pk', extensions.crypt('Pass-6666', extensions.gen_salt('bf')), '{"full_name":"Other Six","phone":"03106666666","role":"builder"}');
update public.profiles set role = 'admin' where id = 'b0000000-0000-0000-0000-000000000005';
-- project-publisher capability approved directly here; the real apply → admin-approve
-- path is tested in section 20 (and in the Phase 2 suite)
insert into public.account_capabilities (user_id, capability, status, decided_at) values ('b0000000-0000-0000-0000-000000000004', 'project_publisher', 'approved', now());
update public.profiles set developer_status = 'approved' where id = 'b0000000-0000-0000-0000-000000000004';

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.expect_denied(sql text, what text) returns void language plpgsql as $$
begin
  begin execute sql; exception when insufficient_privilege or check_violation or raise_exception or invalid_parameter_value then return;
    when others then if sqlstate in ('42501', 'P0001', '23514', '22023') then return; end if; raise exception 'FAIL % (unexpected error %: %)', what, sqlstate, sqlerrm; end;
  raise exception 'FAIL % was allowed', what;
end $$;
create or replace function pg_temp.expect_rows(sql text, n int, what text) returns void language plpgsql as $$
declare got int;
begin
  execute 'with x as (' || sql || ' returning 1) select count(*) from x' into got;
  if got <> n then raise exception 'FAIL % (affected % rows, expected %)', what, got, n; end if;
end $$;
grant execute on function pg_temp.as_user(text), pg_temp.expect_denied(text, text), pg_temp.expect_rows(text, int, text) to anon, authenticated;

do $t$ begin
  if (select role from public.profiles where id = 'b0000000-0000-0000-0000-000000000002') <> 'professional' then raise exception 'FAIL professional signup role'; end if;
  if (select count(*) from public.listings where is_sample) <> 5 or (select count(*) from public.agencies where is_sample) <> 5 then raise exception 'FAIL sample seed present'; end if;
  if exists (select 1 from public.early_participants where user_id = public.mv2_sample_owner()) then raise exception 'FAIL sample account qualified'; end if;
  raise notice 'ok  0 fixtures: signup intent "professional" works; sample seed present; sample account never qualifies';
end $t$;

-- ---------- ANONYMOUS ----------
set role anon;
do $t$ begin
  if (select count(*) from public.listings where is_sample) <> 5 then raise exception 'FAIL anon reads sample listings'; end if;
  if (select count(*) from public.agencies) <> 5 or (select count(*) from public.professionals) <> 5 or (select count(*) from public.companies) <> 5 then raise exception 'FAIL anon reads directories'; end if;
  if (select count(*) from public.agency_members where status = 'active') <> 4 then raise exception 'FAIL anon reads active teams'; end if;
  if (public.marketplace_stats()->>'properties')::int <> 0 or (public.marketplace_stats()->>'agencies')::int <> 0 then raise exception 'FAIL samples counted in stats'; end if;
  if public.login_email_for_phone('03101111111', 'Pass-1111') <> 'owner@x.pk' then raise exception 'FAIL secure phone login'; end if;
  perform pg_temp.expect_denied($$select public.email_for_phone('03101111111')$$, 'anon email_for_phone');
  perform pg_temp.expect_denied($$insert into public.agencies (owner_id, name) values ('b0000000-0000-0000-0000-000000000003', 'X')$$, 'anon create agency');
  perform pg_temp.expect_denied($$select public.send_enquiry('agency', '5a3b1e00-0000-4000-8000-000000000401', 'hi')$$, 'anon enquiry');
  perform pg_temp.expect_denied($$select * from public.get_marketplace_contact('agency', '5a3b1e00-0000-4000-8000-000000000401')$$, 'anon contact');
  perform pg_temp.expect_denied($$select count(*) from public.enquiries$$, 'anon read enquiries');
  perform pg_temp.expect_denied($$select count(*) from public.early_participants$$, 'anon read early participants');
  perform pg_temp.expect_denied($$update public.marketplace_settings set value = 'true' where key = 'paid_placement_active'$$, 'anon change settings');
  raise notice 'ok  1 anonymous: reads directories + samples, stats exclude samples, phone login intact, cannot write/contact/enquire';
end $t$;
reset role;

-- ---------- OWNER (buyer) ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ declare lid uuid; n int; begin
  -- sample flag, verification, placement, moderation: never client-writable
  perform pg_temp.expect_denied($$insert into public.listings (owner_id,title,type,property_type,city,area,price,is_sample) values (auth.uid(),'x','buy','house','Islamabad','G-13',1,true)$$, 'insert listing as sample');
  perform pg_temp.expect_denied($$insert into public.listings (owner_id,title,type,property_type,city,area,price,placement) values (auth.uid(),'x','buy','house','Islamabad','G-13',1,'featured')$$, 'insert featured listing');
  perform pg_temp.expect_denied($$insert into public.agencies (owner_id, name, is_sample) values (auth.uid(), 'Fake', true)$$, 'create sample agency');
  perform pg_temp.expect_denied($$insert into public.agencies (owner_id, name, verified) values (auth.uid(), 'Fake', true)$$, 'create verified agency');
  perform pg_temp.expect_denied($$insert into public.early_participants (user_id, qualifying_type) values (auth.uid(), 'x')$$, 'self-grant early benefit');
  perform pg_temp.expect_denied($$update public.listings set is_sample = true where owner_id = auth.uid()$$, 'mark own listing sample');
  perform pg_temp.expect_denied($$update public.listings set placement = 'featured' where owner_id = auth.uid()$$, 'self-feature listing');
  perform pg_temp.expect_denied($$update public.listings set moderation_status = 'active' where owner_id = auth.uid()$$, 'self-moderate listing');
  perform pg_temp.expect_denied($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'self role change');
  perform pg_temp.expect_denied($$update public.profiles set seller_package = 3 where id = auth.uid()$$, 'self seller_package');
  perform pg_temp.expect_denied($$select public.admin_set_entity_placement('listing', '5a3b1e00-0000-4000-8000-000000000101', 'featured')$$, 'non-admin placement');
  perform pg_temp.expect_denied($$select public.admin_set_entity_verified('agency', '5a3b1e00-0000-4000-8000-000000000401', true)$$, 'non-admin verify');
  perform pg_temp.expect_denied($$select public.admin_set_early_participant(auth.uid(), true)$$, 'non-admin early grant');
  perform pg_temp.expect_denied($$select public.admin_set_marketplace_setting('paid_placement_active', 'true')$$, 'non-admin setting');
  perform pg_temp.expect_denied($$select public.admin_add_area('Islamabad', 'Hackville')$$, 'non-admin add area');
  -- existing property workflow still works
  insert into public.listings (owner_id,title,type,property_type,city,area,price,beds,baths,size_marla,size_unit,description,photos,thumbs)
  values (auth.uid(),'7 Marla House','buy','house','Rawalpindi','Bahria Town Phase 8',30000000,4,4,7,'marla','Real listing','{https://cdn.example/a.jpg}','{https://cdn.example/a-thumb.webp}') returning id into lid;
  perform set_config('test.lid', lid::text, false);
  update public.listings set price = 29500000 where id = lid;
  perform public.confirm_listing_available(lid);
  perform pg_temp.expect_denied($$update public.listings set thumbs = '{javascript:alert(1)}' where id = current_setting('test.lid')::uuid$$, 'unsafe thumbnail url');
  -- 7-day rule: a brand-new listing does not qualify yet; it is pending
  if exists (select 1 from public.early_participants where user_id = auth.uid()) then raise exception 'FAIL new listing qualified immediately'; end if;
  if public.my_early_status()->>'status' <> 'pending' then raise exception 'FAIL early status pending (got %)', public.my_early_status(); end if;
  if (public.marketplace_stats()->>'properties')::int <> 1 then raise exception 'FAIL genuine listing counted'; end if;
  -- samples are not contactable and cannot be confirmed
  if (select count(*) from public.get_listing_contact('5a3b1e00-0000-4000-8000-000000000101')) <> 0 then raise exception 'FAIL sample listing contact'; end if;
  if (select count(*) from public.get_marketplace_contact('professional', '5a3b1e00-0000-4000-8000-000000000301')) <> 0 then raise exception 'FAIL sample professional contact'; end if;
  perform pg_temp.expect_denied($$select public.send_enquiry('listing', '5a3b1e00-0000-4000-8000-000000000101', 'Is it available?')$$, 'enquiry to sample listing');
  perform pg_temp.expect_denied($$select public.send_enquiry('company', '5a3b1e00-0000-4000-8000-000000000502', 'Rates?')$$, 'enquiry to sample company');
  perform pg_temp.expect_denied($$select public.confirm_listing_available('5a3b1e00-0000-4000-8000-000000000101')$$, 'confirm sample listing');
  -- other people's things are untouchable
  perform pg_temp.expect_rows($$update public.agencies set name = 'Hijacked' where id = '5a3b1e00-0000-4000-8000-000000000401'$$, 0, 'edit sample agency');
  perform pg_temp.expect_rows($$delete from public.professionals where id = '5a3b1e00-0000-4000-8000-000000000301'$$, 0, 'delete sample professional');
  perform pg_temp.expect_rows($$update public.listings set price = 1 where is_sample$$, 0, 'edit sample listings');
  perform pg_temp.expect_denied($$update public.listings set agency_id = '5a3b1e00-0000-4000-8000-000000000401' where id = current_setting('test.lid')::uuid$$, 'list under someone else''s agency');
  perform pg_temp.expect_denied($$update public.listings set professional_id = '5a3b1e00-0000-4000-8000-000000000301' where id = current_setting('test.lid')::uuid$$, 'attach someone else''s professional');
  raise notice 'ok  2 owner: sample/featured/verified/moderation/early benefit cannot be self-granted; listing workflow works; new listing is pending (7-day rule); samples not contactable; others'' entities untouchable';
end $t$;
reset role;

-- ---------- PROFESSIONAL + AGENCY relationship ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000003');
set role authenticated;
do $t$ declare aid uuid; begin
  insert into public.agencies (owner_id, name, city, description, segments, purposes, website_url)
  values (auth.uid(), 'Real Agency', 'Islamabad', 'We sell homes.', '{residential}', '{sale}', 'https://real-agency.example') returning id into aid;
  perform set_config('test.aid', aid::text, false);
  perform pg_temp.expect_denied($$insert into public.agencies (owner_id, name, website_url) values (auth.uid(), 'Bad Link', 'javascript:alert(1)')$$, 'unsafe agency url');
  perform pg_temp.expect_denied($$insert into public.agencies (owner_id, name) values ('b0000000-0000-0000-0000-000000000001', 'Not mine')$$, 'create agency for someone else');
  raise notice 'ok  3 agency: creates own agency; unsafe links and agencies for other accounts refused';
end $t$;
reset role;

select pg_temp.as_user('b0000000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ declare pid uuid; m public.agency_members; lid uuid; begin
  insert into public.professionals (owner_id, display_name, headline, intro, cities, areas_served, purposes, commission_info)
  values (auth.uid(), 'Pro Two', 'Residential sales', 'I help families buy homes.', '{Islamabad}', '{G-13,DHA Phase 2}', '{sale}', '1% on sale, discussed upfront') returning id into pid;
  perform set_config('test.pid', pid::text, false);
  -- zero listings is fine: the profile itself is public
  if (public.marketplace_stats()->>'professionals')::int <> 1 then raise exception 'FAIL profile without listings is public'; end if;
  m := public.request_agency_membership(pid, current_setting('test.aid')::uuid);
  if m.status <> 'pending' or m.requested_by <> 'professional' then raise exception 'FAIL request is pending'; end if;
  perform set_config('test.mid', m.id::text, false);
  perform pg_temp.expect_denied($$select public.decide_agency_membership(current_setting('test.mid')::uuid, 'active')$$, 'professional accepts own request');
  perform pg_temp.expect_denied($$select public.request_agency_membership('5a3b1e00-0000-4000-8000-000000000301', current_setting('test.aid')::uuid)$$, 'link a profile you do not manage');
  perform pg_temp.expect_denied($$select public.request_agency_membership(current_setting('test.pid')::uuid, '5a3b1e00-0000-4000-8000-000000000401')$$, 'join a sample agency');
  insert into public.listings (owner_id,title,type,property_type,city,area,price,professional_id)
  values (auth.uid(),'Flat G-13','rent','flat','Islamabad','G-13',90000,pid) returning id into lid;
  perform set_config('test.plid', lid::text, false);
  perform pg_temp.expect_denied($$update public.listings set agency_id = current_setting('test.aid')::uuid where id = current_setting('test.plid')::uuid$$, 'list under agency before acceptance');
  raise notice 'ok  4 professional: public profile with zero listings; membership request stays pending; cannot self-accept, hijack profiles, join samples, or list under the agency yet';
end $t$;
reset role;

select pg_temp.as_user('b0000000-0000-0000-0000-000000000003');
set role authenticated;
do $t$ begin
  perform public.decide_agency_membership(current_setting('test.mid')::uuid, 'active');
  if (select status from public.agency_members where id = current_setting('test.mid')::uuid) <> 'active' then raise exception 'FAIL agency accepts'; end if;
  raise notice 'ok  5 agency accepts the professional';
end $t$;
reset role;

select pg_temp.as_user('b0000000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ begin
  update public.listings set agency_id = current_setting('test.aid')::uuid where id = current_setting('test.plid')::uuid;
  if (select agency_id from public.listings where id = current_setting('test.plid')::uuid) is distinct from current_setting('test.aid')::uuid then raise exception 'FAIL member lists under agency'; end if;
  perform public.decide_agency_membership(current_setting('test.mid')::uuid, 'removed');
  if (select agency_id from public.listings where id = current_setting('test.plid')::uuid) is not null then raise exception 'FAIL leaving unlinks listings'; end if;
  raise notice 'ok  6 active member lists under the agency; leaving unlinks those listings';
end $t$;
reset role;

-- ---------- ENQUIRIES ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ declare eid uuid; begin
  eid := public.send_enquiry('professional', current_setting('test.pid')::uuid, 'Hello, I need a 2 bed flat.', null);
  perform set_config('test.eid', eid::text, false);
  if (select count(*) from public.get_marketplace_contact('professional', current_setting('test.pid')::uuid)) <> 1 then raise exception 'FAIL signed-in contact for genuine profile'; end if;
  perform pg_temp.expect_denied($$select public.send_enquiry('listing', current_setting('test.lid')::uuid, 'own')$$, 'enquire on own listing');
  perform pg_temp.expect_denied($$select public.set_enquiry_status(current_setting('test.eid')::uuid, 'archived')$$, 'sender changes status');
  perform pg_temp.expect_denied($$insert into public.enquiries (target_type,target_id,recipient_id,sender_id,message) values ('listing',gen_random_uuid(),auth.uid(),auth.uid(),'x')$$, 'direct enquiry insert');
  if (select count(*) from public.enquiries) <> 1 then raise exception 'FAIL sender sees own enquiry'; end if;
  raise notice 'ok  7 enquiries: genuine profile reachable; own-item, direct insert and sender status change refused';
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ begin
  if (select count(*) from public.enquiries where status = 'new') <> 1 then raise exception 'FAIL recipient sees enquiry'; end if;
  perform public.set_enquiry_status(current_setting('test.eid')::uuid, 'read');
  raise notice 'ok  8 recipient reads and updates the enquiry';
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000006');
set role authenticated;
do $t$ begin
  if (select count(*) from public.enquiries) <> 0 then raise exception 'FAIL third party sees enquiries'; end if;
  if (select count(*) from public.early_participants) <> 0 then raise exception 'FAIL third party sees early participants'; end if;
  raise notice 'ok  9 third party sees no enquiries and no one else''s eligibility';
end $t$;
reset role;

-- ---------- PROJECTS + COMPANIES ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000006');
set role authenticated;
do $t$ declare cid uuid; begin
  insert into public.companies (owner_id, name, services, cities) values (auth.uid(), 'Other Builders', '{grey_structure,turnkey}', '{Rawalpindi}') returning id into cid;
  perform set_config('test.cid_other', cid::text, false);
  insert into public.company_rates (company_id, service, rate_min, rate_max, unit, includes) values (cid, 'grey_structure', 3000, 3500, 'per_sqft', 'Structure');
  perform pg_temp.expect_denied($$insert into public.company_rates (company_id, service, rate_min) values ('5a3b1e00-0000-4000-8000-000000000502', 'turnkey', 1)$$, 'add rates to another company');
  perform pg_temp.expect_denied($$insert into public.companies (owner_id, name, services) values (auth.uid(), 'Bad', '{flying}')$$, 'unknown company service');
  perform pg_temp.expect_denied($$insert into public.projects (owner_id,title,city,area) values (auth.uid(),'Unapproved','Islamabad','x')$$, 'unapproved account posts a project');
  raise notice 'ok  10 company: own company + rates; cannot edit others'' rates; projects still need an approved developer';
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000004');
set role authenticated;
do $t$ declare cid uuid; prj uuid; begin
  insert into public.companies (owner_id, name) values (auth.uid(), 'Dev Four Developments') returning id into cid;
  insert into public.projects (owner_id,title,city,area,company_id,project_type,approvals_info) values (auth.uid(),'Dev Heights','Islamabad','B-17',cid,'residential','NOC applied (owner-provided)') returning id into prj;
  perform set_config('test.prj', prj::text, false);
  perform pg_temp.expect_denied($$update public.projects set company_id = current_setting('test.cid_other')::uuid where id = current_setting('test.prj')::uuid$$, 'link project to someone else''s company');
  perform pg_temp.expect_denied($$update public.projects set verified = true where id = current_setting('test.prj')::uuid$$, 'self-verify project');
  perform pg_temp.expect_denied($$update public.projects set is_sample = true where id = current_setting('test.prj')::uuid$$, 'mark project sample');
  perform pg_temp.expect_denied($$select public.request_project_agency('5a3b1e00-0000-4000-8000-000000000201', current_setting('test.aid')::uuid)$$, 'represent a project you do not own');
  perform public.request_project_agency(prj, current_setting('test.aid')::uuid);
  if (select status from public.project_agencies where project_id = prj) <> 'pending' then raise exception 'FAIL representation pending'; end if;
  raise notice 'ok  11 approved developer: project linked to own company only; cannot self-verify/sample; representation request pending';
end $t$;
reset role;

-- ---------- ADMIN ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000005');
set role authenticated;
do $t$ declare n0 int; begin
  select count(*) into n0 from public.admin_log;
  perform public.admin_set_entity_verified('agency', current_setting('test.aid')::uuid, true);
  perform pg_temp.expect_denied($$select public.admin_set_entity_verified('agency', '5a3b1e00-0000-4000-8000-000000000401', true)$$, 'verify a sample');
  perform pg_temp.expect_denied($$select public.admin_set_entity_placement('listing', '5a3b1e00-0000-4000-8000-000000000101', 'featured')$$, 'feature a sample');
  perform pg_temp.expect_denied($$select public.admin_set_listing_verified('5a3b1e00-0000-4000-8000-000000000101', true)$$, 'verify a sample listing');
  perform public.admin_set_entity_placement('listing', current_setting('test.lid')::uuid, 'priority', null);
  perform public.admin_set_entity_moderation('professional', current_setting('test.pid')::uuid, 'hidden', 'test');
  perform public.admin_set_early_participant('b0000000-0000-0000-0000-000000000001', false, 'test revoke');
  perform pg_temp.expect_denied($$select public.admin_set_early_participant(public.mv2_sample_owner(), true)$$, 'qualify the sample account');
  perform public.admin_set_marketplace_setting('samples_visible', 'false');
  perform pg_temp.expect_denied($$select public.admin_set_marketplace_setting('packages_launch_at', '"2020-01-01"')$$, 'admin moves launch date from the browser');
  perform public.admin_add_area('Islamabad', 'Test Enclave');
  if (select count(*) from public.admin_log) - n0 <> 6 then raise exception 'FAIL admin actions logged (got %)', (select count(*) from public.admin_log) - n0; end if;
  perform pg_temp.expect_denied($$insert into public.admin_log (admin_id, action, target_table, target_id) values (auth.uid(),'x','x',gen_random_uuid())$$, 'direct admin_log insert');
  raise notice 'ok  12 admin: verify/placement/moderation/early/setting/area — all logged (6); samples can never be verified/featured';
end $t$;
reset role;

-- moderation + inactive placement as the public sees it (no JWT = anonymous visitor)
select set_config('request.jwt.claims', '{}', false);
set role anon;
do $t$ begin
  if exists (select 1 from public.professionals where id = current_setting('test.pid')::uuid) then raise exception 'FAIL hidden profile visible publicly'; end if;
  if (public.marketplace_stats()->>'professionals')::int <> 0 then raise exception 'FAIL hidden profile counted'; end if;
  if (select value from public.marketplace_settings where key = 'paid_placement_active') <> 'false'::jsonb then raise exception 'FAIL paid placement must stay off'; end if;
  raise notice 'ok  13 hidden content disappears publicly; paid placement remains switched off';
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ begin
  if not exists (select 1 from public.professionals where id = current_setting('test.pid')::uuid) then raise exception 'FAIL owner still sees hidden profile'; end if;
  raise notice 'ok  14 owner still sees their hidden profile';
end $t$;
reset role;

-- ---------- PK ↔ Estate handoff ownership (pk_0003) ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ declare tid uuid; begin
  perform public.pk_place_order('[{"line_id":"11-dfy"}]'::jsonb);
  select id into tid from public.pk_tasks order by created_at desc limit 1;
  perform set_config('test.tid', tid::text, false);
  perform public.pk_add_details(tid, jsonb_build_object('estate_listing_id', current_setting('test.lid')), null);
  perform pg_temp.expect_denied($$select public.pk_add_details(current_setting('test.tid')::uuid, jsonb_build_object('estate_listing_id', current_setting('test.plid')), null)$$, 'PK handoff with someone else''s listing');
  perform pg_temp.expect_denied($$select public.pk_add_details(current_setting('test.tid')::uuid, '{"estate_listing_id":"5a3b1e00-0000-4000-8000-000000000101"}'::jsonb, null)$$, 'PK handoff with a sample listing');
  raise notice 'ok  15 PK handoff: own listing accepted; another user''s or a sample listing refused';
end $t$;
reset role;

-- ---------- caps + privileges ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000006');
set role authenticated;
do $t$ begin
  insert into public.companies (owner_id, name) values (auth.uid(), 'Second Co');
  perform pg_temp.expect_denied($$insert into public.companies (owner_id, name) values (auth.uid(), 'Third Co')$$, 'more than 2 companies per account');
  perform pg_temp.expect_denied($$insert into public.agencies (owner_id, name) values (auth.uid(), 'A1'), (auth.uid(), 'A2'), (auth.uid(), 'A3')$$, 'more than 2 agencies per account');
  insert into public.professionals (owner_id, display_name) values (auth.uid(), 'Six Pro');
  perform pg_temp.expect_denied($$insert into public.professionals (owner_id, display_name) values (auth.uid(), 'Second Pro')$$, 'second professional profile');
  perform pg_temp.expect_denied($$select public.admin_set_entity_limit(auth.uid(), 'companies', 10)$$, 'non-admin raises own limit');
  perform pg_temp.expect_denied($$insert into public.account_entity_limits (user_id, entity, max_count) values (auth.uid(), 'companies', 10)$$, 'self-insert limit override');
  raise notice 'ok  16 limits: 1 professional profile, 2 agencies, 2 companies per account (settings); overrides admin-only';
end $t$;
reset role;
do $t$ declare t text; begin
  foreach t in array array['agencies','professionals','companies','company_rates','agency_members','project_agencies','enquiries','early_participants','marketplace_settings',
                               'entity_public_phones','account_capabilities','account_entity_limits'] loop
    if has_table_privilege('anon', 'public.' || t, 'INSERT') or has_table_privilege('anon', 'public.' || t, 'UPDATE')
       or has_table_privilege('anon', 'public.' || t, 'DELETE') or has_table_privilege('anon', 'public.' || t, 'TRUNCATE')
       or has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE') then
      raise exception 'FAIL % has a write/truncate grant it should not', t;
    end if;
  end loop;
  foreach t in array array['is_sample','verified','placement','moderation_status'] loop
    if has_column_privilege('authenticated', 'public.listings', t, 'UPDATE') or has_column_privilege('authenticated', 'public.projects', t, 'UPDATE')
       or has_column_privilege('authenticated', 'public.agencies', t, 'INSERT') or has_column_privilege('authenticated', 'public.professionals', t, 'UPDATE')
       or has_column_privilege('authenticated', 'public.companies', t, 'UPDATE') then
      raise exception 'FAIL column % is client-writable', t;
    end if;
  end loop;
  foreach t in array array['enquiries','early_participants','agency_members','entity_public_phones','account_capabilities','account_entity_limits'] loop
    if has_table_privilege('authenticated', 'public.' || t, 'INSERT') or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE') then raise exception 'FAIL % writable from the browser', t; end if;
  end loop;
  if has_table_privilege('authenticated', 'public.enquiries', 'INSERT') or has_table_privilege('authenticated', 'public.early_participants', 'INSERT')
     or has_table_privilege('authenticated', 'public.agency_members', 'INSERT') then raise exception 'FAIL relationship/eligibility tables writable'; end if;
  if has_function_privilege('anon', 'public.request_agency_membership(uuid,uuid)', 'EXECUTE') or has_function_privilege('anon', 'public.admin_set_entity_verified(text,uuid,boolean)', 'EXECUTE') then raise exception 'FAIL anon RPC grants'; end if;
  raise notice 'ok  17 privileges: no anon writes, no TRUNCATE, privileged columns + relationship/eligibility tables not client-writable';
end $t$;
reset role;

-- ---------- 18. early benefit: 7-day rule (time simulated by moving created_at) ----------
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
 ('b0000000-0000-0000-0000-000000000007','e7@x.pk', extensions.crypt('Pass-7777', extensions.gen_salt('bf')), '{"full_name":"Deletes Early","phone":"03107777777","role":"buyer"}'),
 ('b0000000-0000-0000-0000-000000000008','e8@x.pk', extensions.crypt('Pass-8888', extensions.gen_salt('bf')), '{"full_name":"Deletes Late","phone":"03108888888","role":"buyer"}'),
 ('b0000000-0000-0000-0000-000000000009','e9@x.pk', extensions.crypt('Pass-9999', extensions.gen_salt('bf')), '{"full_name":"Hidden Item","phone":"03109999999","role":"buyer"}'),
 ('b0000000-0000-0000-0000-00000000000a','ea@x.pk', extensions.crypt('Pass-aaaa', extensions.gen_salt('bf')), '{"full_name":"Last Week","phone":"03101010101","role":"agency"}'),
 ('b0000000-0000-0000-0000-00000000000b','eb@x.pk', extensions.crypt('Pass-bbbb', extensions.gen_salt('bf')), '{"full_name":"After Cutoff","phone":"03101212121","role":"agency"}'),
 ('b0000000-0000-0000-0000-00000000000c','ec@x.pk', extensions.crypt('Pass-cccc', extensions.gen_salt('bf')), '{"full_name":"Empty Profile","phone":"03101313131","role":"professional"}');
do $t$ declare l7 uuid; l8 uuid; l9 uuid; begin
  -- (a) created and deleted within 7 days: never counts
  insert into public.listings (owner_id,title,type,property_type,city,area,price, created_at)
  values ('b0000000-0000-0000-0000-000000000007','Quick','buy','house','Islamabad','G-13',1, now() - interval '6 days') returning id into l7;
  delete from public.listings where id = l7;
  if exists (select 1 from public.early_participants where user_id = 'b0000000-0000-0000-0000-000000000007') then raise exception 'FAIL deleted before 7 days still qualified'; end if;
  -- (b) live 8 days with nobody evaluating it, then deleted: BEFORE DELETE records the earned status, and it stays
  alter table public.listings disable trigger listings_early_change;
  insert into public.listings (owner_id,title,type,property_type,city,area,price, created_at)
  values ('b0000000-0000-0000-0000-000000000008','Lasted','buy','house','Islamabad','G-13',1, now() - interval '8 days') returning id into l8;
  -- (c) live 8 days but hidden by moderation before evaluation: never counts
  insert into public.listings (owner_id,title,type,property_type,city,area,price, created_at)
  values ('b0000000-0000-0000-0000-000000000009','Spam','buy','house','Islamabad','G-13',1, now() - interval '8 days') returning id into l9;
  update public.listings set moderation_status = 'hidden' where id = l9;
  alter table public.listings enable trigger listings_early_change;
  if exists (select 1 from public.early_participants where user_id = 'b0000000-0000-0000-0000-000000000008') then raise exception 'FAIL fixture evaluated too early'; end if;
  delete from public.listings where id = l8;
  if not exists (select 1 from public.early_participants where user_id = 'b0000000-0000-0000-0000-000000000008' and qualifying_type = 'listings' and revoked_at is null) then raise exception 'FAIL deletion after 7 days lost eligibility'; end if;
  if (select qualified_at - first_published_at from public.early_participants where user_id = 'b0000000-0000-0000-0000-000000000008') <> interval '7 days' then raise exception 'FAIL qualified_at = created + 7 days'; end if;
  update public.listings set price = 2 where id = l9;   -- any later evaluation still ignores hidden content
  if exists (select 1 from public.early_participants where user_id = 'b0000000-0000-0000-0000-000000000009') then raise exception 'FAIL hidden content qualified'; end if;
  -- (d) final week before the cutoff: created 6 days before cutoff, 7 days complete after it → qualifies
  --     (e) created after the cutoff → never qualifies, however long it lives
  update public.marketplace_settings set value = to_jsonb(now() - interval '2 days') where key = 'packages_launch_at';
  insert into public.agencies (owner_id, name, description, created_at) values ('b0000000-0000-0000-0000-00000000000a', 'Last Week Realty', 'Family homes and rentals in Rawalpindi.', now() - interval '8 days');
  update public.marketplace_settings set value = to_jsonb(now() - interval '12 days') where key = 'packages_launch_at';
  insert into public.agencies (owner_id, name, description, created_at) values ('b0000000-0000-0000-0000-00000000000b', 'Late Realty', 'Family homes and rentals in Rawalpindi.', now() - interval '10 days');
  if exists (select 1 from public.early_participants where user_id = 'b0000000-0000-0000-0000-00000000000b') then raise exception 'FAIL content created after the cutoff qualified'; end if;
  update public.marketplace_settings set value = '"2026-11-01T00:00:00+05:00"' where key = 'packages_launch_at';
  if not exists (select 1 from public.early_participants where user_id = 'b0000000-0000-0000-0000-00000000000a' and qualifying_type = 'agencies') then raise exception 'FAIL final-week content qualified after its 7 days'; end if;
  -- (f) an empty profile (no intro, no services) does not count
  insert into public.professionals (owner_id, display_name, created_at) values ('b0000000-0000-0000-0000-00000000000c', 'Empty', now() - interval '30 days');
  if exists (select 1 from public.early_participants where user_id = 'b0000000-0000-0000-0000-00000000000c') then raise exception 'FAIL empty profile qualified'; end if;
  update public.professionals set intro = 'I help overseas families buy plots in DHA.' where owner_id = 'b0000000-0000-0000-0000-00000000000c';
  if not exists (select 1 from public.early_participants where user_id = 'b0000000-0000-0000-0000-00000000000c' and qualifying_type = 'professionals') then raise exception 'FAIL completed profile qualifies'; end if;
  -- (g) the user revoked in section 12 stays blocked even after their listing passes 7 days
  update public.listings set created_at = now() - interval '9 days' where id = current_setting('test.lid')::uuid;
  if (select revoked_at from public.early_participants where user_id = 'b0000000-0000-0000-0000-000000000001') is null then raise exception 'FAIL revoked account re-qualified automatically'; end if;
  if exists (select 1 from public.early_participants where user_id = public.mv2_sample_owner()) then raise exception 'FAIL sample account qualified'; end if;
  raise notice 'ok  18 early 7-day rule: delete <7d never counts; delete >7d keeps it (BEFORE DELETE); hidden never; final week before cutoff counts; after cutoff never; empty profile never; revoked stays revoked';
end $t$;

select pg_temp.as_user('b0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ begin
  if public.my_early_status()->>'status' <> 'revoked' then raise exception 'FAIL status revoked'; end if;
  perform pg_temp.expect_denied($$select public.admin_evaluate_early_participants()$$, 'non-admin evaluate');
  perform pg_temp.expect_denied($$update public.early_participants set revoked_at = null where user_id = auth.uid()$$, 'self-unrevoke');
  perform pg_temp.expect_denied($$select public.mv2_try_qualify(auth.uid())$$, 'call internal qualify');
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000005');
set role authenticated;
do $t$ declare n0 int; n int; begin
  select count(*) into n0 from public.admin_log;
  perform public.admin_set_early_participant('b0000000-0000-0000-0000-000000000001', true, 'mistake');     -- restore → normal rule → qualifies (listing is 9 days old)
  if (select qualifying_type || '/' || (revoked_at is null)::text from public.early_participants where user_id = 'b0000000-0000-0000-0000-000000000001') <> 'listings/true' then raise exception 'FAIL restore re-evaluates'; end if;
  perform public.admin_set_early_participant('b0000000-0000-0000-0000-000000000008', false, 'fraud');
  perform public.admin_set_early_participant('b0000000-0000-0000-0000-000000000008', true, 'cleared');
  if (select qualifying_type from public.early_participants where user_id = 'b0000000-0000-0000-0000-000000000008') <> 'listings' then raise exception 'FAIL restore keeps the original record'; end if;
  n := public.admin_evaluate_early_participants();
  if (select count(*) from public.admin_log) - n0 <> 4 then raise exception 'FAIL early admin actions logged (got %)', (select count(*) from public.admin_log) - n0; end if;
  raise notice 'ok  19 early admin: revoke/restore logged; restore re-applies the rule; evaluation run is admin-only and logged';
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000007');
set role authenticated;
do $t$ begin
  if public.my_early_status()->>'status' <> 'none' then raise exception 'FAIL status none after early delete (got %)', public.my_early_status(); end if;
end $t$;
reset role;

-- ---------- 20. phone privacy ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000003');
set role authenticated;
do $t$ begin
  perform public.set_entity_public_phone('agency', current_setting('test.aid')::uuid, '051 1234567');
  perform pg_temp.expect_denied($$select public.set_entity_public_phone('agency', current_setting('test.aid')::uuid, 'call me')$$, 'invalid phone');
  perform pg_temp.expect_denied($$select public.set_entity_public_phone('agency', '5a3b1e00-0000-4000-8000-000000000401', '0511234567')$$, 'phone on a sample');
  perform pg_temp.expect_denied($$select public.set_entity_public_phone('professional', current_setting('test.pid')::uuid, '0511234567')$$, 'phone on someone else''s profile');
  perform pg_temp.expect_denied($$insert into public.entity_public_phones (entity_type, entity_id, owner_id, phone) values ('agency', current_setting('test.aid')::uuid, auth.uid(), '0511234567')$$, 'direct phone insert');
  perform pg_temp.expect_denied($$update public.profiles set phone = '03000000000' where id = auth.uid()$$, 'change login phone column');
  if (select count(*) from public.entity_public_phones) <> 1 then raise exception 'FAIL owner reads own number'; end if;
end $t$;
reset role;
select set_config('request.jwt.claims', '{}', false);
set role anon;
do $t$ begin
  perform pg_temp.expect_denied($$select count(*) from public.entity_public_phones$$, 'anon reads phone table');
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('agencies','professionals','companies','public_profiles') and column_name ilike '%phone%') then
    raise exception 'FAIL a publicly readable table exposes a phone column';
  end if;
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000006');
set role authenticated;
do $t$ declare r record; begin
  if (select count(*) from public.entity_public_phones) <> 0 then raise exception 'FAIL other account reads phone rows'; end if;
  select * into r from public.get_marketplace_contact('agency', current_setting('test.aid')::uuid);
  if r.phone is distinct from '051 1234567' then raise exception 'FAIL opted-in agency number (got %)', r.phone; end if;
  -- owner One has no public number: the login phone is NOT a fallback
  select * into r from public.get_listing_contact(current_setting('test.lid')::uuid);
  if r.phone is not null then raise exception 'FAIL login phone exposed as listing contact (%)', r.phone; end if;
  select * into r from public.get_marketplace_contact('listing', current_setting('test.lid')::uuid);
  if r.phone is not null then raise exception 'FAIL login phone exposed via marketplace contact'; end if;
  select * into r from public.get_marketplace_contact('company', current_setting('test.cid_other')::uuid);
  if r.phone is not null then raise exception 'FAIL company without public number'; end if;
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ begin
  perform pg_temp.expect_denied($$update public.profiles set public_phone = 'not a phone' where id = auth.uid()$$, 'invalid public phone');
  update public.profiles set public_phone = '+92 300 7654321' where id = auth.uid();
  if (select sender_phone from public.enquiries where id = current_setting('test.eid')::uuid) is not null then raise exception 'FAIL earlier enquiry carried the login phone'; end if;
  perform public.send_enquiry('agency', current_setting('test.aid')::uuid, 'Do you have rentals in G-13?', null);
  if (select sender_phone from public.enquiries where sender_id = auth.uid() order by created_at desc limit 1) <> '+92 300 7654321' then raise exception 'FAIL enquiry uses opted-in number'; end if;
  perform pg_temp.expect_denied($$select public.send_enquiry('agency', current_setting('test.aid')::uuid, 'Hi', 'abc')$$, 'enquiry with invalid phone');
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000006');
set role authenticated;
do $t$ begin
  if (select phone from public.get_listing_contact(current_setting('test.lid')::uuid)) <> '+92 300 7654321' then raise exception 'FAIL owner opted-in number shown'; end if;
  if exists (select 1 from public.get_listing_contact(current_setting('test.lid')::uuid) where phone = '03101111111') then raise exception 'FAIL login phone'; end if;
  raise notice 'ok  20 phone privacy: login phone never returned; opt-in numbers only (owner-only table, signed-in contact functions); invalid numbers and samples refused; enquiries never carry the login phone';
end $t$;
reset role;

-- ---------- 21. one account + optional capability (no role change, no second account) ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ begin
  if public.my_capability_status('project_publisher') <> 'none' then raise exception 'FAIL starts none'; end if;
  perform pg_temp.expect_denied($$insert into public.account_capabilities (user_id, capability, status) values (auth.uid(), 'project_publisher', 'approved')$$, 'self-grant capability');
  insert into public.developer_applications (user_id, company_name, phone, tier) values (auth.uid(), 'Owner One Homes', '03101111111', 1);
  if public.my_capability_status('project_publisher') <> 'pending' then raise exception 'FAIL application → pending'; end if;
  perform pg_temp.expect_denied($$insert into public.developer_applications (user_id, company_name, phone, tier) values (auth.uid(), 'Again', '0310', 1)$$, 'second application while pending');
  perform pg_temp.expect_denied($$insert into public.projects (owner_id,title,city,area) values (auth.uid(),'Too Early','Islamabad','G-13')$$, 'project before approval');
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000005');
set role authenticated;
do $t$ begin
  perform public.admin_decide_developer_application((select id from public.developer_applications where user_id = 'b0000000-0000-0000-0000-000000000001'), 'approved', 'Checked');
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ begin
  if public.my_capability_status('project_publisher') <> 'approved' then raise exception 'FAIL approved'; end if;
  insert into public.projects (owner_id,title,city,area) values (auth.uid(),'Owner One Residency','Islamabad','G-13');
  if (select role from public.profiles where id = auth.uid()) <> 'buyer' then raise exception 'FAIL role mutated'; end if;
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000005');
set role authenticated;
do $t$ begin
  perform public.admin_set_capability('b0000000-0000-0000-0000-000000000001', 'project_publisher', 'revoked', 'test');
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ begin
  perform pg_temp.expect_denied($$insert into public.projects (owner_id,title,city,area) values (auth.uid(),'After Revoke','Islamabad','G-13')$$, 'project after revoke');
  perform pg_temp.expect_denied($$insert into public.developer_applications (user_id, company_name, phone, tier) values (auth.uid(), 'Re-apply', '0310', 1)$$, 're-apply after revoke');
  if (select count(*) from public.projects where owner_id = auth.uid()) <> 1 then raise exception 'FAIL existing project kept'; end if;
  raise notice 'ok  21 capability: buyer account applies → pending → admin approves → creates a project (role unchanged); revoke blocks new projects and re-application; no self-grant';
end $t$;
reset role;

-- ---------- 22. configurable limits + legacy columns ----------
select pg_temp.as_user('b0000000-0000-0000-0000-000000000005');
set role authenticated;
do $t$ begin
  perform pg_temp.expect_denied($$select public.admin_set_marketplace_setting('enquiry_daily_limit', '0')$$, 'limit 0');
  perform pg_temp.expect_denied($$select public.admin_set_marketplace_setting('enquiry_daily_limit', '"x"')$$, 'limit text');
  perform pg_temp.expect_denied($$select public.admin_set_marketplace_setting('enquiry_daily_limit', '1.5')$$, 'limit fraction');
  perform pg_temp.expect_denied($$select public.admin_set_marketplace_setting('early_min_days', '0')$$, 'admin shortens 7-day rule from the browser');
  perform pg_temp.expect_denied($$select public.admin_set_marketplace_setting('max_professionals_per_account', '5')$$, 'admin raises professional limit');
  perform pg_temp.expect_denied($$select public.admin_set_entity_limit('b0000000-0000-0000-0000-000000000006', 'professionals', 3)$$, 'override professional limit');
  perform public.admin_set_marketplace_setting('enquiry_daily_limit', '2');
  perform public.admin_set_entity_limit('b0000000-0000-0000-0000-000000000006', 'companies', 3, 'manages a group');
end $t$;
reset role;
select pg_temp.as_user('b0000000-0000-0000-0000-000000000006');
set role authenticated;
do $t$ begin
  insert into public.companies (owner_id, name) values (auth.uid(), 'Third Co (override)');
  perform pg_temp.expect_denied($$insert into public.companies (owner_id, name) values (auth.uid(), 'Fourth Co')$$, 'beyond the override');
  perform public.send_enquiry('agency', current_setting('test.aid')::uuid, 'One', null);
  perform public.send_enquiry('agency', current_setting('test.aid')::uuid, 'Two', null);
  perform pg_temp.expect_denied($$select public.send_enquiry('agency', current_setting('test.aid')::uuid, 'Three', null)$$, 'enquiry over the configured limit');
  perform pg_temp.expect_denied($$update public.profiles set developer_tier = 5 where id = auth.uid()$$, 'self developer_tier');
  perform pg_temp.expect_denied($$update public.profiles set seller_package = 3 where id = auth.uid()$$, 'self seller_package');
end $t$;
reset role;
do $t$ begin
  update public.marketplace_settings set value = '20' where key = 'enquiry_daily_limit';
  if col_description('public.profiles'::regclass, (select attnum from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'developer_tier')) not like 'DEPRECATED%'
     or col_description('public.profiles'::regclass, (select attnum from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'seller_package')) not like 'DEPRECATED%' then
    raise exception 'FAIL legacy columns documented';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~ '(developer_tier|seller_package)' and prosrc ~* 'order by')
     then raise exception 'FAIL a function orders by a legacy column'; end if;
  raise notice 'ok  22 limits configurable by admin within bounds (enquiries/day, agency/company per account + per-account override); 7-day rule and 1-professional rule fixed; developer_tier/seller_package deprecated, not self-assignable, not used for ordering';
end $t$;
