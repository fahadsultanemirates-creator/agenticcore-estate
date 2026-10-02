-- ============================================================
-- AgenticCore Estate — 0019: cross-site entity context (additive)
-- ------------------------------------------------------------
-- Estate links to AgenticCore Pakistan with a small, allow-listed context:
--   ?from=estate&intent=<intent>&entity_type=<type>&entity_id=<uuid>
-- (plus the older &listing=<uuid> for property promotion, still guarded by
-- pk_0003). A URL is never proof of ownership. Before PK shows owner-specific
-- context ("Promoting: <your agency>"), it asks this function, which answers
-- only for the signed-in owner of a genuine (non-sample) entity and returns
-- nothing otherwise — so a hand-edited UUID reveals nothing and unlocks nothing.
--
-- One read-only security-definer function. No table, policy, grant on a
-- table, price, referral or early-benefit rule changes.
-- ============================================================

create or replace function public.my_marketplace_entity(p_type text, p_id uuid)
returns table (entity_type text, entity_id uuid, title text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_kind text := case p_type
    when 'property' then 'listing' when 'project' then 'project'
    when 'professional' then 'professional' when 'agency' then 'agency'
    when 'builder' then 'company' end;
  t record;
begin
  if auth.uid() is null or v_kind is null or p_id is null then return; end if;
  select * into t from public.mv2_target(v_kind, p_id);
  if t.owner_id is null or t.owner_id <> auth.uid() or t.is_sample then return; end if;
  return query select p_type, p_id, t.title;
end;
$$;
revoke all on function public.my_marketplace_entity(text, uuid) from public, anon;
grant execute on function public.my_marketplace_entity(text, uuid) to authenticated;
