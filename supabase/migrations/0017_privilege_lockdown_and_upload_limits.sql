-- ============================================================
-- AgenticCore Estate — Security Hardening Phase 2, part 2 (lockdown)
-- ------------------------------------------------------------
-- Apply after 0016 AND after the Estate / AgenticCore Pakistan frontends that
-- call login_email_for_phone() and admin_decide_developer_application() are live.
-- Only privileges are removed; no row of customer data is changed.
-- ============================================================

-- ---------- 1. commercial / developer fields are no longer self-editable ----------
-- 0012 left these three columns in the browser's UPDATE grant "for the launch
-- window", so any user could make themselves an approved developer on any tier
-- or pick any seller package. They are now set only by trusted server code
-- (admin_decide_developer_application, the 0016 trigger) or by an admin in SQL,
-- until the real package/payment workflow exists.
revoke update (developer_status, developer_tier, seller_package) on public.profiles from authenticated;
-- Profiles are created only by the handle_new_user() trigger at signup.
revoke insert on public.profiles from authenticated;

-- ---------- 2. developer applications can't arrive pre-approved ----------
revoke all on public.developer_applications from anon, authenticated;
grant select on public.developer_applications to authenticated;
grant insert (user_id, company_name, phone, cnic, cnic_document_path, company_document_path, tier)
  on public.developer_applications to authenticated;   -- status / decision / reviewer fields keep their defaults

drop policy if exists "developer applications insertable by owner" on public.developer_applications;
create policy "developer applications insertable by owner" on public.developer_applications
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and decision_at is null and reviewer_id is null and reviewer_note is null and ai_doc_check_result is null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'developer')
  );
-- Decisions go through admin_decide_developer_application(); the old direct-update
-- policy is no longer usable from the browser (no UPDATE grant) and is removed.
drop policy if exists "developer applications decidable by admin" on public.developer_applications;

-- ---------- 3. phone → email lookup is no longer public ----------
revoke all on function public.email_for_phone(text) from public, anon, authenticated;

-- ---------- 4. admin_log: readable by admins, written only by server functions ----------
revoke all on public.admin_log from anon, authenticated;
grant select on public.admin_log to authenticated;    -- RLS: admins only

-- ---------- 5. referral ledger: read-only for the beneficiary ----------
-- Rows are written by pk_admin_set_invoice_status() (security definer) only.
revoke all on public.referral_ledger from anon, authenticated;
grant select on public.referral_ledger to authenticated;   -- RLS: beneficiary only

-- ---------- 6. cities / areas: public read; admins edit in the SQL editor ----------
revoke all on public.cities from anon, authenticated;
revoke all on public.areas from anon, authenticated;
grant select on public.cities to anon, authenticated;
grant select on public.areas to anon, authenticated;

-- ---------- 7. projects: approved developers only; no anonymous writes, no TRUNCATE ----------
-- Posting a project is the privilege a developer application grants, so it now
-- requires developer_status = 'approved' (previously any signed-in user could
-- insert a project row through the API). TRUNCATE ignores row-level security.
revoke insert, update, delete, truncate, references, trigger on public.projects from anon;
revoke truncate on public.projects from authenticated;
drop policy if exists "projects are insertable by owner" on public.projects;
create policy "projects are insertable by owner" on public.projects
  for insert with check (
    auth.uid() = owner_id
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'developer' and p.developer_status = 'approved')
  );

-- ---------- 8. storage: size and type limits per bucket ----------
-- Matches what the current forms accept (photos as image/*, brochures as PDF).
update storage.buckets set file_size_limit = 10485760,   -- 10 MB per photo
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'listing-photos';
update storage.buckets set file_size_limit = 20971520,   -- 20 MB (photos and PDF brochures)
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
 where id = 'project-assets';
update storage.buckets set file_size_limit = 5242880,    -- 5 MB logos (no SVG: it can carry script)
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'profile-assets';
update storage.buckets set file_size_limit = 10485760,   -- 10 MB CNIC / company documents
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
 where id = 'developer-docs';
