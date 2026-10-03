-- ============================================================
-- 0020 — AgenticCore Telegram bot (Phase 1): member numbers, linked
-- Telegram accounts, bot conversation state, activity log, and the
-- 30-day freeze for accounts created in Telegram without a password.
--
-- Everything the bot does runs server-side (Netlify function, service
-- role). The bot tables are not reachable by anon/authenticated at all;
-- the website only gets three narrow RPCs (link token, link status,
-- unlink) that act on the caller's own account.
-- ============================================================

-- ---------- 1. member numbers (AC-100001, AC-100002, ...) ----------
create sequence if not exists public.ac_member_no_seq start with 100001;
alter table public.profiles add column if not exists member_no bigint;
-- existing accounts get numbers in the order they joined
with ordered as (
  select id from public.profiles where member_no is null order by created_at, id
)
update public.profiles p set member_no = nextval('public.ac_member_no_seq')
  from ordered o where p.id = o.id;
alter table public.profiles alter column member_no set default nextval('public.ac_member_no_seq');
alter table public.profiles alter column member_no set not null;
do $$ begin
  alter table public.profiles add constraint profiles_member_no_key unique (member_no);
exception when duplicate_table or duplicate_object then null; end $$;
alter table public.profiles add column if not exists created_via text not null default 'web';
do $$ begin
  alter table public.profiles add constraint profiles_created_via_check check (created_via in ('web', 'telegram'));
exception when duplicate_object then null; end $$;
alter table public.profiles add column if not exists password_set_at timestamptz;

-- Members cannot change their own number, how the account was created, or
-- when a password was set (that decides the 30-day freeze). The number
-- never changes; the other two are set only by the server and the
-- auth triggers below.
create or replace function public.ac_protect_account_fields()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.member_no := old.member_no;
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '') in ('authenticated', 'anon') then
    new.created_via := old.created_via;
    new.password_set_at := old.password_set_at;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_account_fields on public.profiles;
create trigger profiles_protect_account_fields before update of member_no, created_via, password_set_at on public.profiles
  for each row execute function public.ac_protect_account_fields();

-- ---------- 2. how the account was created, and when a password was set ----------
-- every existing account signed up on the website with a password
update public.profiles set password_set_at = created_at where password_set_at is null and created_via = 'web';

-- created_via comes from app metadata, which only the server (service role)
-- can set -- a website signup cannot mark itself as a Telegram account.
-- Runs after on_auth_user_created (trigger names fire in alphabetical order).
create or replace function public.ac_after_auth_user_created()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
     set created_via = case when coalesce(new.raw_app_meta_data->>'created_via', '') = 'telegram' then 'telegram' else 'web' end,
         password_set_at = case when coalesce(new.encrypted_password, '') <> '' then now() else null end
   where id = new.id;
  return new;
end;
$$;
revoke execute on function public.ac_after_auth_user_created() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_zz_meta on auth.users;
create trigger on_auth_user_created_zz_meta after insert on auth.users
  for each row execute function public.ac_after_auth_user_created();

create or replace function public.ac_after_auth_password_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(new.encrypted_password, '') <> '' and new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles set password_set_at = now() where id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.ac_after_auth_password_change() from public, anon, authenticated;
drop trigger if exists on_auth_user_password_set on auth.users;
create trigger on_auth_user_password_set after update of encrypted_password on auth.users
  for each row execute function public.ac_after_auth_password_change();

-- ---------- 3. the 30-day freeze ----------
-- An account created in Telegram works straight away. If no password has
-- been set 30 days after it was created, it is frozen: nothing new is
-- accepted from it (listings, profiles, projects, enquiries) until the
-- person signs in with their one-time link and sets a password -- then it
-- works again automatically. Nothing is deleted or hidden.
create or replace function public.ac_account_frozen(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = p_user and created_via = 'telegram' and password_set_at is null
       and created_at < now() - interval '30 days')
$$;
revoke execute on function public.ac_account_frozen(uuid) from public, anon;
grant execute on function public.ac_account_frozen(uuid) to authenticated, service_role;

-- Applies to API requests made by the account itself or by the bot
-- (service role). Admin moderation and SQL-editor maintenance are not
-- affected. TG_ARGV[0] = the column holding the account id.
create or replace function public.ac_block_frozen_writes()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_role text := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
begin
  if v_owner is not null
     and (v_role = 'service_role' or auth.uid() = v_owner)
     and public.ac_account_frozen(v_owner) then
    raise exception 'This account is frozen because no password was set within 30 days. Sign in with your one-time link and set a password to unlock it.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.ac_block_frozen_writes() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['listings', 'agencies', 'professionals', 'companies', 'projects'] loop
    execute format('drop trigger if exists %1$s_frozen_account on public.%1$I', t);
    execute format('create trigger %1$s_frozen_account before insert or update on public.%1$I for each row execute function public.ac_block_frozen_writes(''owner_id'')', t);
  end loop;
end $$;
drop trigger if exists enquiries_frozen_account on public.enquiries;
create trigger enquiries_frozen_account before insert on public.enquiries
  for each row execute function public.ac_block_frozen_writes('sender_id');

-- ---------- 4. linked Telegram accounts ----------
create table if not exists public.telegram_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tg_user_id bigint not null unique,
  chat_id bigint not null,
  tg_username text,
  notify boolean not null default true,
  linked_at timestamptz not null default now()
);

-- one-time "Connect Telegram" codes made in the dashboard (stored hashed, 15 minutes)
create table if not exists public.tg_link_tokens (
  token_hash text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists tg_link_tokens_user_idx on public.tg_link_tokens(user_id);

-- conversation state per chat (what the bot is collecting, recent turns, language)
create table if not exists public.tg_sessions (
  chat_id bigint primary key,
  tg_user_id bigint,
  lang text not null default 'en' check (lang in ('en', 'ur', 'ro')),
  state jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Telegram can deliver an update twice; each update id is handled once
create table if not exists public.tg_seen_updates (
  update_id bigint primary key,
  seen_at timestamptz not null default now()
);

-- reminders and alerts already sent (so each goes out once)
create table if not exists public.tg_notifications (
  kind text not null,
  ref text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (kind, ref)
);

-- every account activity, for the owner's alerts and later billing/tasks
create table if not exists public.activity_log (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  member_no bigint,
  channel text not null default 'telegram' check (channel in ('telegram', 'web', 'system')),
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_user_idx on public.activity_log(user_id, created_at desc);
create index if not exists activity_log_created_idx on public.activity_log(created_at desc);

-- bot tables: server only (service role); admins can read the activity log
do $$
declare t text;
begin
  foreach t in array array['telegram_links', 'tg_link_tokens', 'tg_sessions', 'tg_seen_updates', 'tg_notifications', 'activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.activity_log_id_seq to service_role;
grant select on public.activity_log to authenticated;
drop policy if exists "activity log admins only" on public.activity_log;
create policy "activity log admins only" on public.activity_log for select using (public.is_admin());

-- ---------- 5. website RPCs (own account only) ----------
-- Dashboard "Connect Telegram": returns a one-time code for
-- t.me/<bot>?start=link_<code>. Only the hash is stored.
create or replace function public.create_telegram_link_token()
returns text language plpgsql security definer set search_path = public, extensions
as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'Please log in first.' using errcode = '42501'; end if;
  delete from public.tg_link_tokens where user_id = auth.uid() or expires_at < now() - interval '1 day';
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.tg_link_tokens (token_hash, user_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid(), now() + interval '15 minutes');
  return v_token;
end;
$$;
revoke execute on function public.create_telegram_link_token() from public, anon;
grant execute on function public.create_telegram_link_token() to authenticated;

create or replace function public.my_telegram_link()
returns table (linked boolean, tg_username text, linked_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select true, l.tg_username, l.linked_at from public.telegram_links l where l.user_id = auth.uid()
$$;
revoke execute on function public.my_telegram_link() from public, anon;
grant execute on function public.my_telegram_link() to authenticated;

create or replace function public.unlink_telegram()
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Please log in first.' using errcode = '42501'; end if;
  delete from public.telegram_links where user_id = auth.uid();
  insert into public.activity_log (user_id, member_no, channel, kind)
  select id, member_no, 'web', 'telegram_unlinked' from public.profiles where id = auth.uid();
end;
$$;
revoke execute on function public.unlink_telegram() from public, anon;
grant execute on function public.unlink_telegram() to authenticated;
