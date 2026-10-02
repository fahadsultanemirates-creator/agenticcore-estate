-- Run against a LOCAL database built from supabase/migrations (never production).
-- Proves migration 0015: public_profiles is readable but not writable by anon/authenticated.
-- Each statement below must fail with 42501 "permission denied for view public_profiles".
\set ON_ERROR_STOP 0
set role anon;
update public.public_profiles set role = 'admin' where false;
delete from public.public_profiles where false;
insert into public.public_profiles (id, full_name, role) select gen_random_uuid(), 'x', 'admin' where false;
reset role;
set role authenticated;
update public.public_profiles set role = 'admin' where false;
delete from public.public_profiles where false;
reset role;
-- These must all be true / succeed.
select has_table_privilege('anon', 'public.public_profiles', 'SELECT') as anon_can_read,
       has_table_privilege('authenticated', 'public.public_profiles', 'SELECT') as auth_can_read,
       not has_table_privilege('anon', 'public.public_profiles', 'UPDATE') and not has_table_privilege('anon', 'public.public_profiles', 'DELETE')
       and not has_table_privilege('anon', 'public.public_profiles', 'INSERT') and not has_table_privilege('anon', 'public.public_profiles', 'TRUNCATE')
       and not has_table_privilege('authenticated', 'public.public_profiles', 'UPDATE') and not has_table_privilege('authenticated', 'public.public_profiles', 'DELETE')
       and not has_table_privilege('authenticated', 'public.public_profiles', 'INSERT') and not has_table_privilege('authenticated', 'public.public_profiles', 'TRUNCATE') as writes_revoked;
