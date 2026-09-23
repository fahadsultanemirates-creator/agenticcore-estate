-- ============================================================
-- AgenticCore Estate — real signup wiring
-- ------------------------------------------------------------
-- Two things the frontend needs that plain Supabase Auth doesn't
-- give you for free:
-- 1. A profiles row created atomically when someone signs up,
--    regardless of whether email confirmation is on (no SMTP is
--    configured for this project yet, so confirmation is left at
--    its project default — this trigger works either way since it
--    fires at auth.users insert time, not at confirmation time).
-- 2. Logging in with a phone number, since Supabase Auth's
--    password grant is email-only without SMS/phone-auth set up.
--    email_for_phone() resolves phone -> email server-side so the
--    "phone or email" login field from the original UI still works,
--    without exposing a broad SELECT on profiles.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name_val text := new.raw_user_meta_data->>'full_name';
  phone_val text := new.raw_user_meta_data->>'phone';
  role_val text := coalesce(new.raw_user_meta_data->>'role', 'buyer');
  referred_by_val uuid;
  ref_code_input text := new.raw_user_meta_data->>'referral_code';
  base_code text;
  generated_code text;
begin
  if ref_code_input is not null and ref_code_input <> '' then
    select id into referred_by_val from public.profiles where referral_code = upper(ref_code_input) limit 1;
  end if;

  base_code := upper(regexp_replace(coalesce(full_name_val, 'user'), '[^a-zA-Z]', '', 'g'));
  base_code := left(nullif(base_code, ''), 6);
  generated_code := coalesce(base_code, 'USER') || floor(random() * 9000 + 1000)::text;

  insert into public.profiles (id, full_name, phone, role, referred_by, referral_code, developer_status)
  values (
    new.id,
    coalesce(full_name_val, 'AgenticCore Estate user'),
    coalesce(nullif(phone_val, ''), new.id::text),
    role_val,
    referred_by_val,
    generated_code,
    case when role_val = 'developer' then 'unsubmitted' else null end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.email_for_phone(phone_input text)
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select u.email from auth.users u
  join public.profiles p on p.id = u.id
  where p.phone = phone_input
  limit 1;
$$;
