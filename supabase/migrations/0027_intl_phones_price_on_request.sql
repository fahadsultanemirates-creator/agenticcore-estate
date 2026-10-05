-- ============================================================
-- 0027 — International phone numbers + "price on request".
--
-- 1. ac_norm_phone(): one standard form for every phone number
--    (+<country code><number>, digits only). Pakistani numbers can be typed
--    as 03001234567, 0300 1234567, 3001234567, 923001234567, 0092… or
--    +92 300 1234567; overseas numbers with their country code
--    (+971 50 123 4567, 00971501234567, +44 7700 900123, …).
-- 2. Sign-up stores the standard form, so the same number can't be used for
--    two accounts just by typing it differently.
-- 3. Login with a phone number matches the standard form, so any of the
--    ways above works (before, it had to be typed exactly as saved).
-- 4. Existing phone numbers are converted to the standard form.
-- 5. A listing may have no price: shown as "Price on request". Budget
--    searches simply skip it.
-- Safe to run more than once.
-- ============================================================

create or replace function public.ac_norm_phone(p text)
returns text language plpgsql immutable set search_path = public
as $$
declare d text;
begin
  if p is null then return null; end if;
  -- placeholder phones (an account id) are not numbers
  if p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-' then return p; end if;
  d := regexp_replace(trim(p), '[^0-9+]', '', 'g');
  d := regexp_replace(d, '(?!^)\+', '', 'g');              -- only a leading +
  if d = '' or d = '+' then return null; end if;
  if left(d, 2) = '00' then d := '+' || substr(d, 3); end if;
  if left(d, 1) = '+' then return '+' || regexp_replace(substr(d, 2), '^0+', ''); end if;
  -- no country code: Pakistani forms
  if d ~ '^0\d{9,10}$' then return '+92' || substr(d, 2); end if;   -- 03001234567, 0512345678
  if d ~ '^3\d{9}$' then return '+92' || d; end if;                  -- 3001234567
  if d ~ '^92\d{9,10}$' then return '+' || d; end if;                -- 923001234567
  return '+' || d;                                                   -- typed with country code but no +
end;
$$;
grant execute on function public.ac_norm_phone(text) to anon, authenticated, service_role;

-- existing numbers to the standard form (skips any that would clash)
update public.profiles p set phone = public.ac_norm_phone(p.phone)
 where public.ac_norm_phone(p.phone) is distinct from p.phone
   and public.ac_norm_phone(p.phone) is not null
   and not exists (select 1 from public.profiles q where q.id <> p.id and q.phone = public.ac_norm_phone(p.phone));

-- sign-up (website, PK site and Telegram all use this trigger)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $function$
declare
  full_name_val text := new.raw_user_meta_data->>'full_name';
  phone_val text := public.ac_norm_phone(nullif(new.raw_user_meta_data->>'phone', ''));
  role_val text := coalesce(new.raw_user_meta_data->>'role', 'buyer');
  referred_by_val uuid;
  ref_code_input text := new.raw_user_meta_data->>'referral_code';
  base_code text;
  generated_code text;
begin
  -- Only self-service roles can be chosen at signup; 'admin' is granted by
  -- hand in the SQL editor, never from signup metadata.
  if role_val not in ('buyer', 'seller', 'developer', 'agency', 'builder', 'professional') then
    role_val := 'buyer';
  end if;

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
    coalesce(phone_val, new.id::text),
    role_val,
    referred_by_val,
    generated_code,
    case when role_val = 'developer' then 'unsubmitted' else null end
  );
  return new;
end;
$function$;

-- phone + password login: any way of typing the number
create or replace function public.login_email_for_phone(p_phone text, p_password text)
returns text language plpgsql security definer set search_path = public, auth, extensions
as $function$
declare
  v_phone text := public.ac_norm_phone(p_phone);
  v_email text;
  v_hash text;
  v_recent int;
  c_dummy constant text := '$2a$10$ea5iU8coNesGb9/wmJsWHufoYn6EMoIbCRl0N.2suG/MGyZRldZiq';
begin
  if v_phone is null or length(v_phone) < 8 or p_password is null or p_password = '' then
    return null;
  end if;

  select count(*) into v_recent
    from public.phone_login_attempts
   where phone = v_phone and created_at > now() - interval '15 minutes';
  if v_recent >= 5 then
    raise exception 'Too many login attempts for this phone number. Please wait 15 minutes or log in with your email.'
      using errcode = 'P0001';
  end if;

  select u.email, u.encrypted_password into v_email, v_hash
    from auth.users u
    join public.profiles p on p.id = u.id
   where p.phone = v_phone
   limit 1;

  if v_hash is not null and v_hash = extensions.crypt(p_password, v_hash) then
    return v_email;
  end if;

  perform extensions.crypt(p_password, c_dummy);
  insert into public.phone_login_attempts (phone) values (v_phone);
  delete from public.phone_login_attempts where created_at < now() - interval '1 day';
  return null;
end;
$function$;

create or replace function public.email_for_phone(phone_input text)
returns text language sql stable security definer set search_path = public, auth
as $function$
  select u.email from auth.users u
  join public.profiles p on p.id = u.id
  where p.phone = public.ac_norm_phone(phone_input)
  limit 1;
$function$;

-- price on request: no price instead of a made-up one
alter table public.listings alter column price drop not null;
alter table public.listings drop constraint if exists listings_price_check;
alter table public.listings add constraint listings_price_check check (price is null or price > 0);
