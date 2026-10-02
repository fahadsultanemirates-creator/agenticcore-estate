-- ============================================================
-- AgenticCore Estate — Security Hardening Phase 2, part 1 (additive)
-- ------------------------------------------------------------
-- Adds the secure replacements first, so the live Estate and AgenticCore
-- Pakistan frontends keep working while they switch over. 0017 then removes
-- the old, insecure privileges. Nothing here changes existing data.
--
-- 1. login_email_for_phone(phone, password)
--    Replaces email_for_phone(phone), which let ANY anonymous caller turn a
--    phone number into that account's email address. The new function only
--    returns the email when the caller also supplies the account's correct
--    password (checked against auth.users with bcrypt), i.e. it reveals
--    nothing a successful login wouldn't. Failed attempts are throttled per
--    phone number (5 per 15 minutes) in a private table.
--
-- 2. Developer applications can no longer approve themselves.
--    A new application only moves the profile to developer_status='pending'
--    (trigger, server-side). Approval and the package tier are granted only by
--    admin_decide_developer_application(), which is admin-only and also writes
--    admin_log. (0017 removes the client's ability to write those fields.)
--
-- 3. admin_log is written by trusted server functions only:
--    admin_decide_developer_application() and admin_set_listing_verified().
-- ============================================================

-- ---------- 1. phone login without disclosing emails ----------
create table if not exists public.phone_login_attempts (
  id bigint generated always as identity primary key,
  phone text not null,
  created_at timestamptz not null default now()
);
create index if not exists phone_login_attempts_phone_time on public.phone_login_attempts (phone, created_at desc);
alter table public.phone_login_attempts enable row level security;
-- no policies and no grants: only the security-definer function below touches it
revoke all on public.phone_login_attempts from public, anon, authenticated;

create or replace function public.login_email_for_phone(p_phone text, p_password text)
returns text
language plpgsql
volatile
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_hash text;
  v_recent int;
  -- bcrypt hash of a random string: keeps the timing similar when the phone is unknown
  c_dummy constant text := '$2a$10$ea5iU8coNesGb9/wmJsWHufoYn6EMoIbCRl0N.2suG/MGyZRldZiq';
begin
  if p_phone is null or length(trim(p_phone)) < 7 or p_password is null or p_password = '' then
    return null;
  end if;

  select count(*) into v_recent
    from public.phone_login_attempts
   where phone = p_phone and created_at > now() - interval '15 minutes';
  if v_recent >= 5 then
    raise exception 'Too many login attempts for this phone number. Please wait 15 minutes or log in with your email.'
      using errcode = 'P0001';
  end if;

  select u.email, u.encrypted_password into v_email, v_hash
    from auth.users u
    join public.profiles p on p.id = u.id
   where p.phone = p_phone
   limit 1;

  if v_hash is not null and v_hash = extensions.crypt(p_password, v_hash) then
    return v_email;
  end if;

  perform extensions.crypt(p_password, c_dummy);
  insert into public.phone_login_attempts (phone) values (p_phone);
  delete from public.phone_login_attempts where created_at < now() - interval '1 day';
  return null;
end;
$$;
revoke all on function public.login_email_for_phone(text, text) from public;
grant execute on function public.login_email_for_phone(text, text) to anon, authenticated;

-- ---------- 2. developer applications: pending until an admin decides ----------
create or replace function public.developer_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- First application (or a re-application after rejection) puts the account in review.
  -- An already-approved developer is left as is; an admin decides any new tier request.
  update public.profiles
     set developer_status = 'pending'
   where id = new.user_id
     and coalesce(developer_status, 'unsubmitted') in ('unsubmitted', 'rejected');
  return new;
end;
$$;
revoke all on function public.developer_application_submitted() from public, anon, authenticated;

drop trigger if exists developer_application_submitted on public.developer_applications;
create trigger developer_application_submitted
  after insert on public.developer_applications
  for each row execute function public.developer_application_submitted();

create or replace function public.admin_decide_developer_application(p_application uuid, p_decision text, p_note text default null)
returns public.developer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.developer_applications;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  update public.developer_applications
     set status = p_decision, decision_at = now(), reviewer_id = auth.uid(), reviewer_note = coalesce(p_note, '')
   where id = p_application
  returning * into app;
  if not found then
    raise exception 'Application not found';
  end if;

  update public.profiles
     set developer_status = p_decision,
         developer_tier = case when p_decision = 'approved' then app.tier else developer_tier end
   where id = app.user_id;

  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), p_decision, 'developer_applications', app.id, coalesce(p_note, ''));

  return app;
end;
$$;
revoke all on function public.admin_decide_developer_application(uuid, text, text) from public, anon;
grant execute on function public.admin_decide_developer_application(uuid, text, text) to authenticated;

-- ---------- 3. listing verification is logged too ----------
create or replace function public.admin_set_listing_verified(p_listing uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  update public.listings set verified = p_verified where id = p_listing;
  if found then
    insert into public.admin_log (admin_id, action, target_table, target_id, note)
    values (auth.uid(), case when p_verified then 'verified' else 'unverified' end, 'listings', p_listing, null);
  end if;
end;
$$;
revoke all on function public.admin_set_listing_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_listing_verified(uuid, boolean) to authenticated;
