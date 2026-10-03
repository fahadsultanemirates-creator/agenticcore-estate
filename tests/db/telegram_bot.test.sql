-- Telegram bot accounts (0020) — run on a LOCAL database built from all
-- Estate + PK migrations through 0020 plus the sample seed (never production).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false) $$;
create or replace function pg_temp.no_jwt() returns void language sql as $$
  select set_config('request.jwt.claims', '{}', false) $$;
grant execute on function pg_temp.as_user(text) to anon, authenticated;

-- a website signup (password) and a Telegram signup (no password, app metadata)
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-000000000001', 'web@x.pk', extensions.crypt('Pass-w1', extensions.gen_salt('bf')), '{"full_name":"Web Owner","phone":"03211111111"}');
insert into auth.users (id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data) values
 ('f0000000-0000-0000-0000-000000000002', 'tg@x.pk', '', '{"full_name":"Tg Owner","phone":"03212222222"}', '{"created_via":"telegram"}');
-- a website signup that tries to claim it came from Telegram (user metadata is not trusted)
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
 ('f0000000-0000-0000-0000-000000000003', 'fake@x.pk', extensions.crypt('Pass-w3', extensions.gen_salt('bf')), '{"full_name":"Fake","phone":"03213333333","created_via":"telegram"}');

do $t$ declare a int; b int; begin
  select member_no into a from public.profiles where id = 'f0000000-0000-0000-0000-000000000001';
  select member_no into b from public.profiles where id = 'f0000000-0000-0000-0000-000000000002';
  if a is null or b is null or b <= a or a < 100001 then raise exception 'FAIL member numbers % %', a, b; end if;
  if (select created_via from public.profiles where id = 'f0000000-0000-0000-0000-000000000001') <> 'web' then raise exception 'FAIL web created_via'; end if;
  if (select created_via from public.profiles where id = 'f0000000-0000-0000-0000-000000000002') <> 'telegram' then raise exception 'FAIL telegram created_via'; end if;
  if (select created_via from public.profiles where id = 'f0000000-0000-0000-0000-000000000003') <> 'web' then raise exception 'FAIL user metadata could mark an account as telegram'; end if;
  if (select password_set_at from public.profiles where id = 'f0000000-0000-0000-0000-000000000001') is null then raise exception 'FAIL web password_set_at'; end if;
  if (select password_set_at from public.profiles where id = 'f0000000-0000-0000-0000-000000000002') is not null then raise exception 'FAIL telegram account has password_set_at'; end if;
  raise notice 'ok  1 member numbers ascend from 100001; created_via only from app metadata; password time recorded';
end $t$;

-- 2. fresh Telegram account (under 30 days) can list
select pg_temp.as_service();
insert into public.listings (id, owner_id, title, type, property_type, city, area, price)
values ('f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-000000000002', 'Tg House', 'buy', 'house', 'Islamabad', 'G-13', 40000000);
select pg_temp.no_jwt();
do $t$ begin raise notice 'ok  2 a new Telegram account can list straight away'; end $t$;

-- 3. after 30 days without a password: frozen for the bot and for the member, not for admins/maintenance
update public.profiles set created_at = now() - interval '31 days' where id = 'f0000000-0000-0000-0000-000000000002';
do $t$ begin
  if not public.ac_account_frozen('f0000000-0000-0000-0000-000000000002') then raise exception 'FAIL not frozen after 30 days'; end if;
  if public.ac_account_frozen('f0000000-0000-0000-0000-000000000001') then raise exception 'FAIL web account frozen'; end if;
end $t$;
select pg_temp.as_service();
do $t$ begin
  begin
    insert into public.listings (owner_id, title, type, property_type, city, area, price)
    values ('f0000000-0000-0000-0000-000000000002', 'Blocked', 'buy', 'house', 'Islamabad', 'G-13', 1);
    raise exception 'FAIL bot could list for a frozen account';
  exception when sqlstate 'P0001' then null; end;
end $t$;
select pg_temp.as_user('f0000000-0000-0000-0000-000000000002');
set role authenticated;
do $t$ begin
  begin
    update public.listings set title = 'Edited' where id = 'f0000000-0000-0000-0000-0000000000b1';
    raise exception 'FAIL frozen member could edit';
  exception when sqlstate 'P0001' then null; end;
end $t$;
reset role;
select pg_temp.no_jwt();
update public.listings set moderation_status = 'active' where id = 'f0000000-0000-0000-0000-0000000000b1';
do $t$ begin raise notice 'ok  3 frozen after 30 days: bot and member blocked; maintenance not affected'; end $t$;

-- 4. the member cannot unfreeze themselves by editing profile fields
select pg_temp.as_user('f0000000-0000-0000-0000-000000000002');
set role authenticated;
-- refused outright where the column is not granted, otherwise silently kept by the trigger
do $t$ begin
  update public.profiles set password_set_at = now(), created_via = 'web', member_no = 1 where id = 'f0000000-0000-0000-0000-000000000002';
exception when insufficient_privilege then null; end $t$;
reset role;
select pg_temp.no_jwt();
-- also check the trigger itself, with full table privileges (as Supabase grants by default)
grant update on public.profiles to authenticated;
select pg_temp.as_user('f0000000-0000-0000-0000-000000000002');
set role authenticated;
update public.profiles set password_set_at = now(), created_via = 'web', member_no = 1 where id = 'f0000000-0000-0000-0000-000000000002';
reset role;
select pg_temp.no_jwt();
do $t$ begin
  if not public.ac_account_frozen('f0000000-0000-0000-0000-000000000002') then raise exception 'FAIL member unfroze by editing profile'; end if;
  if (select member_no from public.profiles where id = 'f0000000-0000-0000-0000-000000000002') = 1 then raise exception 'FAIL member number changed'; end if;
  raise notice 'ok  4 member cannot change member number, created_via or password time';
end $t$;

-- 5. setting a password (auth update) unfreezes
update auth.users set encrypted_password = extensions.crypt('New-pass-1', extensions.gen_salt('bf')) where id = 'f0000000-0000-0000-0000-000000000002';
do $t$ begin
  if public.ac_account_frozen('f0000000-0000-0000-0000-000000000002') then raise exception 'FAIL still frozen after password'; end if;
end $t$;
select pg_temp.as_service();
insert into public.listings (owner_id, title, type, property_type, city, area, price)
values ('f0000000-0000-0000-0000-000000000002', 'Back', 'buy', 'house', 'Islamabad', 'G-13', 1);
select pg_temp.no_jwt();
do $t$ begin raise notice 'ok  5 setting a password unfreezes the account'; end $t$;

-- 6. bot tables are closed to members and visitors
select pg_temp.as_user('f0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ declare t text; begin
  foreach t in array array['telegram_links', 'tg_link_tokens', 'tg_sessions', 'tg_seen_updates', 'tg_notifications'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'FAIL % readable by members', t;
    exception when insufficient_privilege then null; end;
  end loop;
  if (select count(*) from public.activity_log) <> 0 then raise exception 'FAIL activity log visible to a member'; end if;
  raise notice 'ok  6 bot tables closed to members; activity log admin-only';
end $t$;

-- 7. link tokens: own account only, one per account, hashed, 15 minutes
do $t$ declare tok text; tok2 text; begin
  tok := public.create_telegram_link_token();
  tok2 := public.create_telegram_link_token();
  if length(tok) < 30 or tok ~ '[^A-Za-z0-9_-]' then raise exception 'FAIL token format %', tok; end if;
  if tok = tok2 then raise exception 'FAIL tokens repeat'; end if;
  if exists (select 1 from public.my_telegram_link()) then raise exception 'FAIL linked before linking'; end if;
end $t$;
reset role;
do $t$ begin
  if (select count(*) from public.tg_link_tokens where user_id = 'f0000000-0000-0000-0000-000000000001') <> 1 then raise exception 'FAIL old token not replaced'; end if;
  if exists (select 1 from public.tg_link_tokens where length(token_hash) <> 64) then raise exception 'FAIL token not hashed'; end if;
  raise notice 'ok  7 link tokens: own account, replaced on re-issue, stored hashed';
end $t$;
set role anon;
do $t$ begin
  begin perform public.create_telegram_link_token(); raise exception 'FAIL anon made a token';
  exception when insufficient_privilege then null; end;
end $t$;
reset role;

-- 8. unlink removes only the caller's own link
select pg_temp.no_jwt();
insert into public.telegram_links (user_id, tg_user_id, chat_id) values
 ('f0000000-0000-0000-0000-000000000001', 111, 111), ('f0000000-0000-0000-0000-000000000002', 222, 222);
select pg_temp.as_user('f0000000-0000-0000-0000-000000000001');
set role authenticated;
do $t$ begin
  if not exists (select 1 from public.my_telegram_link()) then raise exception 'FAIL link status'; end if;
  perform public.unlink_telegram();
end $t$;
reset role;
do $t$ begin
  if exists (select 1 from public.telegram_links where user_id = 'f0000000-0000-0000-0000-000000000001') then raise exception 'FAIL not unlinked'; end if;
  if not exists (select 1 from public.telegram_links where user_id = 'f0000000-0000-0000-0000-000000000002') then raise exception 'FAIL unlinked someone else'; end if;
  if not exists (select 1 from public.activity_log where kind = 'telegram_unlinked') then raise exception 'FAIL unlink not logged'; end if;
  raise notice 'ok  8 unlink: own link only, logged';
end $t$;
