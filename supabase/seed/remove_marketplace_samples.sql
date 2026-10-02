-- ============================================================
-- AgenticCore Estate — remove ALL marketplace sample content
-- ------------------------------------------------------------
-- Deletes only rows with is_sample = true (which 0018 guarantees are owned by
-- the sample system account), their relationship rows, and the system account.
-- Customer data cannot be touched: every delete is filtered on is_sample /
-- the system account id, and the script stops if anything unexpected is found.
-- To hide samples temporarily instead, an admin can switch the
-- 'samples_visible' setting off (admin dashboard or admin_set_marketplace_setting).
-- ============================================================
begin;

do $$
declare n int;
begin
  -- safety: the system account must own nothing that is not a sample
  select (select count(*) from public.listings where owner_id = public.mv2_sample_owner() and not is_sample)
       + (select count(*) from public.projects where owner_id = public.mv2_sample_owner() and not is_sample)
       + (select count(*) from public.agencies where owner_id = public.mv2_sample_owner() and not is_sample)
       + (select count(*) from public.professionals where owner_id = public.mv2_sample_owner() and not is_sample)
       + (select count(*) from public.companies where owner_id = public.mv2_sample_owner() and not is_sample)
    into n;
  if n > 0 then raise exception 'Stopped: the sample account owns % non-sample rows. Nothing was deleted.', n; end if;
  -- samples never receive enquiries; if any exist something is wrong
  select count(*) into n from public.enquiries where recipient_id = public.mv2_sample_owner();
  if n > 0 then raise exception 'Stopped: % enquiries point at the sample account. Nothing was deleted.', n; end if;
end $$;

delete from public.listings where is_sample and owner_id = public.mv2_sample_owner();
delete from public.projects where is_sample and owner_id = public.mv2_sample_owner();      -- cascades project_agencies
delete from public.professionals where is_sample and owner_id = public.mv2_sample_owner(); -- cascades agency_members
delete from public.agencies where is_sample and owner_id = public.mv2_sample_owner();
delete from public.companies where is_sample and owner_id = public.mv2_sample_owner();     -- cascades company_rates
delete from public.profiles where id = public.mv2_sample_owner();
delete from auth.users where id = public.mv2_sample_owner();

do $$
begin
  if exists (select 1 from public.listings where is_sample) or exists (select 1 from public.projects where is_sample)
     or exists (select 1 from public.agencies where is_sample) or exists (select 1 from public.professionals where is_sample)
     or exists (select 1 from public.companies where is_sample) then
    raise exception 'Sample rows remain — rolled back.';
  end if;
end $$;

commit;
