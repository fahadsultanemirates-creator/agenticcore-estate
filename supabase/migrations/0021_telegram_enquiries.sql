-- ============================================================
-- 0021 — Telegram bot Phase 3: enquiries sent from Telegram.
-- The bot (server, service role) sends an enquiry for the person it has
-- identified from their verified Telegram account. It runs the existing
-- send_enquiry() as that person, so every rule still applies: visible
-- items only, no samples, no enquiring on your own listing, the rate
-- limits, the frozen-account check and the recipient notification.
-- Server only; not callable from the website.
-- ============================================================
create or replace function public.send_enquiry_as(p_sender uuid, p_type text, p_id uuid, p_message text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '') <> 'service_role' then
    raise exception 'Server only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_sender) then
    raise exception 'Unknown account' using errcode = '42501';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', p_sender, 'role', 'authenticated')::text, true);
  return public.send_enquiry(p_type, p_id, p_message, p_phone);
end;
$$;
revoke execute on function public.send_enquiry_as(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.send_enquiry_as(uuid, text, uuid, text, text) to service_role;
