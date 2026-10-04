-- ============================================================
-- 0024 — Telegram accounts were recorded as 'web'.
--
-- Supabase's admin "create user" inserts the auth.users row first and
-- writes the custom app metadata (created_via: 'telegram') in a second
-- UPDATE, so the insert trigger from 0020 never saw it. Result: accounts
-- opened in the Telegram bot showed as created_via = 'web', /stats counted
-- 0 and the 30-day password reminders/freeze skipped them.
--
-- Fix: also react when app metadata gains created_via = 'telegram', and
-- correct existing rows. Only the server (service role) can set app
-- metadata, so a website sign-up still cannot mark itself as Telegram.
-- Safe to run more than once.
-- ============================================================

create or replace function public.ac_after_auth_meta_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data->>'created_via', '') = 'telegram'
     and coalesce(old.raw_app_meta_data->>'created_via', '') <> 'telegram' then
    update public.profiles set created_via = 'telegram' where id = new.id and created_via <> 'telegram';
  end if;
  return new;
end;
$$;
revoke execute on function public.ac_after_auth_meta_change() from public, anon, authenticated;
drop trigger if exists on_auth_user_meta_telegram on auth.users;
create trigger on_auth_user_meta_telegram after update of raw_app_meta_data on auth.users
  for each row execute function public.ac_after_auth_meta_change();

-- existing accounts opened in Telegram
update public.profiles p set created_via = 'telegram'
  from auth.users u
 where u.id = p.id and u.raw_app_meta_data->>'created_via' = 'telegram' and p.created_via <> 'telegram';
