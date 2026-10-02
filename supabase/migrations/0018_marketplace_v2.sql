-- ============================================================
-- AgenticCore Estate — Marketplace V2 (additive)
-- ------------------------------------------------------------
-- Turns Estate from "listings + role-specific profile columns" into a
-- marketplace with five public categories:
--
--   PROPERTY      public.listings            (existing table, extended)
--   PROJECT       public.projects            (existing table, extended)
--   PROFESSIONAL  public.professionals       (new: agent / property professional)
--   AGENCY        public.agencies            (new: replaces profiles.agency_* for public use)
--   BUILDER       public.companies           (new: builder / developer company)
--
-- A user account (auth.users + profiles) is authentication and ownership.
-- Marketplace entities are the public objects; one account can own several.
-- Relationships: agency_members (professional <-> agency, both sides agree),
-- project_agencies (project <-> representing agency, both sides agree),
-- listings.agency_id / professional_id / project_id, projects.company_id,
-- company_rates (builder rate cards).
--
-- Also:
--  * is_sample on every marketplace entity: server-controlled demonstration
--    content, owned by one system account, never verified/featured/contactable,
--    excluded from counts and Copilot, removable with one script.
--  * verified / placement / moderation_status: admin-only (security-definer RPCs,
--    logged in admin_log). Paid placement exists in the schema but is inactive
--    (marketplace_settings.paid_placement_active = false).
--  * enquiries: stored, RLS-protected contact requests for all five categories.
--  * early_participants: auditable record of who created genuine marketplace
--    content before packages launch (1 Nov 2026) — the 30% early benefit.
--  * profiles.role gains 'professional' (signup intent); old values unchanged.
--
-- Nothing is dropped or loosened. Existing security from 0012–0017 stays:
-- column-level grants (extended, never widened to privileged columns), RLS
-- owner checks, approved-developer gate on projects, admin-only decisions.
-- ============================================================

-- ---------- 0. helpers ----------
-- The one system account that owns all sample content (created by the sample seed).
create or replace function public.mv2_sample_owner()
returns uuid language sql immutable set search_path = public
as $$ select '00000000-0000-4000-8000-00000000a001'::uuid $$;

create table if not exists public.marketplace_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.marketplace_settings (key, value) values
  ('packages_launch_at', '"2026-11-01T00:00:00+05:00"'),  -- packages planned from 1 Nov 2026 (PKT)
  ('paid_placement_active', 'false'),                     -- future commercial ranking: OFF
  ('samples_visible', 'true'),                            -- show sample content where categories are thin
  ('sample_fill_min', '5'),                               -- top up homepage rows to this many cards with samples
  ('early_benefit', '{"percent":30,"months":2}'),         -- stored for display; terms apply at package launch
  ('early_min_days', '7'),                                -- qualifying content must stay published this long
  ('enquiry_daily_limit', '20'),                          -- per sending account, rolling 24 hours
  ('max_professionals_per_account', '1'),                 -- one personal professional profile
  ('max_agencies_per_account', '2'),                      -- initial limits; admins can raise per account
  ('max_companies_per_account', '2')
on conflict (key) do nothing;
alter table public.marketplace_settings enable row level security;
drop policy if exists "marketplace settings are public" on public.marketplace_settings;
create policy "marketplace settings are public" on public.marketplace_settings for select using (true);
revoke all on public.marketplace_settings from public, anon, authenticated;
grant select on public.marketplace_settings to anon, authenticated;

create or replace function public.mv2_setting(p_key text)
returns jsonb language sql stable set search_path = public
as $$ select value from public.marketplace_settings where key = p_key $$;

-- https URLs only (user-uploaded media lives in our public buckets), or the
-- bundled sample images.
create or replace function public.mv2_safe_url(u text)
returns boolean language sql immutable set search_path = public
as $$ select u is null or u ~ '^https://[^\s"<>]+$' or u ~ '^images/samples/[a-z0-9._/-]+$' $$;

create or replace function public.mv2_safe_urls(u text[])
returns boolean language sql immutable set search_path = public
as $$ select coalesce(bool_and(public.mv2_safe_url(x)), true) from unnest(coalesce(u, '{}')) x $$;

-- ---------- 1. signup intent: 'professional' ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('buyer', 'seller', 'developer', 'agency', 'builder', 'professional', 'admin'));

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
    coalesce(nullif(phone_val, ''), new.id::text),
    role_val,
    referred_by_val,
    generated_code,
    case when role_val = 'developer' then 'unsubmitted' else null end
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- 2. new marketplace entities ----------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  logo_url text check (public.mv2_safe_url(logo_url)),
  cover_url text check (public.mv2_safe_url(cover_url)),
  description text check (char_length(description) <= 3000),
  office_address text check (char_length(office_address) <= 300),
  city text references public.cities(name),
  cities text[] not null default '{}',
  areas_served text[] not null default '{}',
  services text[] not null default '{}',
  segments text[] not null default '{}' check (segments <@ array['residential', 'commercial']),
  purposes text[] not null default '{}' check (purposes <@ array['sale', 'rent']),
  website_url text check (public.mv2_safe_url(website_url)),
  facebook_url text check (public.mv2_safe_url(facebook_url)),
  instagram_url text check (public.mv2_safe_url(instagram_url)),
  youtube_url text check (public.mv2_safe_url(youtube_url)),
  is_sample boolean not null default false,
  verified boolean not null default false,
  placement text not null default 'standard' check (placement in ('standard', 'priority', 'featured')),
  placement_until timestamptz,
  moderation_status text not null default 'active' check (moderation_status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agencies_sample_not_promoted check (not (is_sample and (verified or placement <> 'standard')))
);

create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 120),
  avatar_url text check (public.mv2_safe_url(avatar_url)),
  avatar_kind text not null default 'none' check (avatar_kind in ('photo', 'avatar', 'logo', 'none')),
  headline text check (char_length(headline) <= 160),
  intro text check (char_length(intro) <= 3000),          -- "What can I do for a client?"
  why_contact text check (char_length(why_contact) <= 1500),
  how_i_work text check (char_length(how_i_work) <= 1500),
  years_experience smallint check (years_experience between 0 and 70),   -- self-reported
  cities text[] not null default '{}',
  areas_served text[] not null default '{}',
  segments text[] not null default '{}' check (segments <@ array['residential', 'commercial']),
  purposes text[] not null default '{}' check (purposes <@ array['sale', 'rent']),
  property_types text[] not null default '{}',
  services text[] not null default '{}',
  languages text[] not null default '{}',
  overseas_clients boolean not null default false,
  commission_info text check (char_length(commission_info) <= 500),
  special_offer text check (char_length(special_offer) <= 500),
  deal_history text check (char_length(deal_history) <= 1500), -- self-reported unless verified
  website_url text check (public.mv2_safe_url(website_url)),
  facebook_url text check (public.mv2_safe_url(facebook_url)),
  instagram_url text check (public.mv2_safe_url(instagram_url)),
  youtube_url text check (public.mv2_safe_url(youtube_url)),
  is_sample boolean not null default false,
  verified boolean not null default false,
  placement text not null default 'standard' check (placement in ('standard', 'priority', 'featured')),
  placement_until timestamptz,
  moderation_status text not null default 'active' check (moderation_status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professionals_sample_not_promoted check (not (is_sample and (verified or placement <> 'standard')))
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  logo_url text check (public.mv2_safe_url(logo_url)),
  cover_url text check (public.mv2_safe_url(cover_url)),
  description text check (char_length(description) <= 3000),
  years_experience smallint check (years_experience between 0 and 100),   -- company-provided
  cities text[] not null default '{}',
  areas_served text[] not null default '{}',
  services text[] not null default '{}' check (services <@ array[
    'residential_construction', 'commercial_construction', 'grey_structure', 'turnkey',
    'renovation', 'architecture_design', 'interiors', 'project_development', 'other']),
  completed_projects text check (char_length(completed_projects) <= 2000),
  current_projects text check (char_length(current_projects) <= 2000),
  portfolio text[] not null default '{}' check (public.mv2_safe_urls(portfolio) and coalesce(array_length(portfolio, 1), 0) <= 12),
  payment_terms text check (char_length(payment_terms) <= 1500),
  website_url text check (public.mv2_safe_url(website_url)),
  facebook_url text check (public.mv2_safe_url(facebook_url)),
  instagram_url text check (public.mv2_safe_url(instagram_url)),
  youtube_url text check (public.mv2_safe_url(youtube_url)),
  is_sample boolean not null default false,
  verified boolean not null default false,
  placement text not null default 'standard' check (placement in ('standard', 'priority', 'featured')),
  placement_until timestamptz,
  moderation_status text not null default 'active' check (moderation_status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_sample_not_promoted check (not (is_sample and (verified or placement <> 'standard')))
);

-- Builder rate cards: company-provided estimates, always shown with their date.
create table if not exists public.company_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service text not null check (service in ('grey_structure', 'turnkey', 'renovation', 'commercial_construction', 'architecture_design', 'interiors', 'other')),
  rate_min numeric check (rate_min > 0),
  rate_max numeric check (rate_max > 0),
  unit text not null default 'per_sqft' check (unit in ('per_sqft', 'per_marla', 'per_kanal', 'lump_sum')),
  includes text check (char_length(includes) <= 1000),
  updated_on date not null default current_date,
  created_at timestamptz not null default now(),
  check (rate_max is null or rate_min is null or rate_max >= rate_min)
);

-- Professional <-> agency: requested by one side, accepted by the other (RPCs only).
create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'removed')),
  requested_by text not null check (requested_by in ('professional', 'agency')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (agency_id, professional_id)
);

-- Project <-> representing agency: requested by the project owner, accepted by the agency.
create table if not exists public.project_agencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'removed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (project_id, agency_id)
);

create index if not exists agencies_owner_idx on public.agencies(owner_id);
create index if not exists agencies_browse_idx on public.agencies(is_sample, moderation_status, created_at desc);
create index if not exists professionals_owner_idx on public.professionals(owner_id);
-- One personal professional profile per account (samples excluded).
create unique index if not exists professionals_one_per_account on public.professionals(owner_id) where not is_sample;
create index if not exists professionals_browse_idx on public.professionals(is_sample, moderation_status, created_at desc);
create index if not exists professionals_areas_idx on public.professionals using gin (areas_served);
create index if not exists companies_owner_idx on public.companies(owner_id);
create index if not exists companies_browse_idx on public.companies(is_sample, moderation_status, created_at desc);
create index if not exists company_rates_company_idx on public.company_rates(company_id);
create index if not exists agency_members_prof_idx on public.agency_members(professional_id);
create index if not exists project_agencies_agency_idx on public.project_agencies(agency_id);

-- ---------- 2b. public contact phone (separate from the login phone) ----------
-- profiles.phone is the login identity and stays private. A number is shown to
-- visitors only when the owner types it into one of these public fields; there
-- is no fallback to the login phone anywhere.
create or replace function public.mv2_valid_phone(p text)
returns boolean language sql immutable set search_path = public
as $$ select p is null or p ~ '^\+?[0-9][0-9 ()-]{6,19}$' $$;
alter table public.profiles add column if not exists public_phone text;
alter table public.profiles drop constraint if exists profiles_public_phone_valid;
alter table public.profiles add constraint profiles_public_phone_valid check (public.mv2_valid_phone(public_phone));
grant update (public_phone) on public.profiles to authenticated;
-- Agency / professional / company directory rows are publicly readable, so their
-- business numbers live in a separate owner-only table and reach visitors only
-- through the signed-in contact functions (same protection as before).
create table if not exists public.entity_public_phones (
  entity_type text not null check (entity_type in ('agency', 'professional', 'company')),
  entity_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null check (public.mv2_valid_phone(phone)),
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);
alter table public.entity_public_phones enable row level security;
revoke all on public.entity_public_phones from public, anon, authenticated;
grant select on public.entity_public_phones to authenticated;
drop policy if exists "entity phones owner or admin" on public.entity_public_phones;
create policy "entity phones owner or admin" on public.entity_public_phones for select
  using (owner_id = auth.uid() or public.is_admin());

-- ---------- 3. extend listings + projects ----------
alter table public.listings add column if not exists is_sample boolean not null default false;
alter table public.listings add column if not exists placement text not null default 'standard';
alter table public.listings add column if not exists placement_until timestamptz;
alter table public.listings add column if not exists moderation_status text not null default 'active';
alter table public.listings add column if not exists agency_id uuid references public.agencies(id) on delete set null;
alter table public.listings add column if not exists professional_id uuid references public.professionals(id) on delete set null;
alter table public.listings add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.listings add column if not exists thumbs text[] not null default '{}';
alter table public.listings drop constraint if exists listings_placement_check;
alter table public.listings add constraint listings_placement_check check (placement in ('standard', 'priority', 'featured'));
alter table public.listings drop constraint if exists listings_moderation_check;
alter table public.listings add constraint listings_moderation_check check (moderation_status in ('active', 'hidden'));
alter table public.listings drop constraint if exists listings_sample_not_promoted;
alter table public.listings add constraint listings_sample_not_promoted check (not (is_sample and (verified or placement <> 'standard')));
alter table public.listings drop constraint if exists listings_thumbs_safe;
alter table public.listings add constraint listings_thumbs_safe check (public.mv2_safe_urls(thumbs) and coalesce(array_length(thumbs, 1), 0) <= 8);
create index if not exists listings_browse_idx on public.listings(is_sample, moderation_status, type, city, created_at desc);
create index if not exists listings_agency_idx on public.listings(agency_id);
create index if not exists listings_professional_idx on public.listings(professional_id);
create index if not exists listings_project_idx on public.listings(project_id);

alter table public.projects add column if not exists is_sample boolean not null default false;
alter table public.projects add column if not exists verified boolean not null default false;
alter table public.projects add column if not exists placement text not null default 'standard';
alter table public.projects add column if not exists placement_until timestamptz;
alter table public.projects add column if not exists moderation_status text not null default 'active';
alter table public.projects add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.projects add column if not exists project_type text;
alter table public.projects add column if not exists approvals_info text;  -- owner-provided; never shown as verified
alter table public.projects add column if not exists thumbs text[] not null default '{}';
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.projects drop constraint if exists projects_placement_check;
alter table public.projects add constraint projects_placement_check check (placement in ('standard', 'priority', 'featured'));
alter table public.projects drop constraint if exists projects_moderation_check;
alter table public.projects add constraint projects_moderation_check check (moderation_status in ('active', 'hidden'));
alter table public.projects drop constraint if exists projects_type_check;
alter table public.projects add constraint projects_type_check check (project_type is null or project_type in ('residential', 'commercial', 'mixed'));
alter table public.projects drop constraint if exists projects_sample_not_promoted;
alter table public.projects add constraint projects_sample_not_promoted check (not (is_sample and (verified or placement <> 'standard')));
alter table public.projects drop constraint if exists projects_text_limits;
alter table public.projects add constraint projects_text_limits check (char_length(approvals_info) <= 1000);
alter table public.projects drop constraint if exists projects_media_safe;
alter table public.projects add constraint projects_media_safe check (public.mv2_safe_urls(thumbs) and public.mv2_safe_urls(photos));
create index if not exists projects_browse_idx on public.projects(is_sample, moderation_status, city, created_at desc);
create index if not exists projects_company_idx on public.projects(company_id);

-- ---------- 4. integrity triggers ----------
-- (a) sample rows belong to the system account only, so removing samples can
--     never touch customer data; non-sample rows can't be created by it either
--     (the seed is the only writer, as postgres).
create or replace function public.mv2_check_sample_owner()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.is_sample and new.owner_id <> public.mv2_sample_owner() then
    raise exception 'Sample content must be owned by the sample system account.';
  end if;
  if not new.is_sample and new.owner_id = public.mv2_sample_owner() then
    raise exception 'The sample system account can only own sample content.';
  end if;
  return new;
end;
$$;
revoke execute on function public.mv2_check_sample_owner() from public, anon, authenticated;

-- (b) per-account limits for profile-type entities (anti-spam). Defaults live in
--     marketplace_settings (professional 1, agency 2, builder/developer 2); an admin
--     can raise the limit for one account (account_entity_limits) for a genuine
--     multi-business owner. Properties and projects have no count limit.
create table if not exists public.account_entity_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity text not null check (entity in ('professionals', 'agencies', 'companies')),
  max_count smallint not null check (max_count between 0 and 50),
  set_by uuid references public.profiles(id),
  set_at timestamptz not null default now(),
  primary key (user_id, entity)
);
alter table public.account_entity_limits enable row level security;
revoke all on public.account_entity_limits from public, anon, authenticated;
grant select on public.account_entity_limits to authenticated;
drop policy if exists "entity limits own or admin" on public.account_entity_limits;
create policy "entity limits own or admin" on public.account_entity_limits for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.mv2_entity_limit(p_user uuid, p_entity text)
returns int language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select max_count from public.account_entity_limits where user_id = p_user and entity = p_entity),
    (public.mv2_setting('max_' || p_entity || '_per_account') #>> '{}')::int,
    1)
$$;

create or replace function public.mv2_entity_cap()
returns trigger language plpgsql security definer set search_path = public
as $$
declare n int; v_max int;
begin
  if new.is_sample then return new; end if;
  execute format('select count(*) from public.%I where owner_id = $1 and not is_sample', tg_table_name) into n using new.owner_id;
  v_max := public.mv2_entity_limit(new.owner_id, tg_table_name);
  if n >= v_max then
    raise exception '%', case tg_table_name
      when 'professionals' then 'One account can have one professional profile. Edit your existing profile instead.'
      else 'This account has reached its limit of ' || v_max || ' ' || case tg_table_name when 'agencies' then 'agency' else 'company' end ||
           ' profiles. Contact us if you manage more businesses.' end
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.mv2_entity_cap() from public, anon, authenticated;
revoke execute on function public.mv2_entity_limit(uuid, text) from public, anon, authenticated;

-- (c) relationship links must point at things the owner controls
create or replace function public.mv2_check_listing_links()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.professional_id is not null and not exists (
       select 1 from public.professionals p where p.id = new.professional_id and p.owner_id = new.owner_id and p.is_sample = new.is_sample) then
    raise exception 'You can only attach your own professional profile to a listing.';
  end if;
  if new.agency_id is not null and not exists (
       select 1 from public.agencies a where a.id = new.agency_id and a.is_sample = new.is_sample and (
         a.owner_id = new.owner_id
         or exists (select 1 from public.agency_members m join public.professionals p on p.id = m.professional_id
                     where m.agency_id = a.id and m.status = 'active' and p.owner_id = new.owner_id))) then
    raise exception 'You can only list under an agency you own or are an active member of.';
  end if;
  if new.project_id is not null and not exists (
       select 1 from public.projects pr where pr.id = new.project_id and pr.owner_id = new.owner_id and pr.is_sample = new.is_sample) then
    raise exception 'You can only link a listing to your own project.';
  end if;
  return new;
end;
$$;
revoke execute on function public.mv2_check_listing_links() from public, anon, authenticated;

create or replace function public.mv2_check_project_links()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.company_id is not null and not exists (
       select 1 from public.companies c where c.id = new.company_id and c.owner_id = new.owner_id and c.is_sample = new.is_sample) then
    raise exception 'You can only link a project to your own company profile.';
  end if;
  return new;
end;
$$;
revoke execute on function public.mv2_check_project_links() from public, anon, authenticated;

drop trigger if exists listings_sample_owner on public.listings;
create trigger listings_sample_owner before insert or update of is_sample, owner_id on public.listings
  for each row execute function public.mv2_check_sample_owner();
drop trigger if exists listings_links on public.listings;
create trigger listings_links before insert or update of agency_id, professional_id, project_id, owner_id on public.listings
  for each row execute function public.mv2_check_listing_links();
drop trigger if exists projects_sample_owner on public.projects;
create trigger projects_sample_owner before insert or update of is_sample, owner_id on public.projects
  for each row execute function public.mv2_check_sample_owner();
drop trigger if exists projects_links on public.projects;
create trigger projects_links before insert or update of company_id, owner_id on public.projects
  for each row execute function public.mv2_check_project_links();
drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at before update on public.projects
  for each row execute function public.touch_listing_updated_at();

do $$
declare t text;
begin
  foreach t in array array['agencies', 'professionals', 'companies'] loop
    execute format('drop trigger if exists %1$s_sample_owner on public.%1$I', t);
    execute format('create trigger %1$s_sample_owner before insert or update of is_sample, owner_id on public.%1$I for each row execute function public.mv2_check_sample_owner()', t);
    execute format('drop trigger if exists %1$s_cap on public.%1$I', t);
    execute format('create trigger %1$s_cap before insert on public.%1$I for each row execute function public.mv2_entity_cap()', t);
    execute format('drop trigger if exists %1$s_touch on public.%1$I', t);
    execute format('create trigger %1$s_touch before update on public.%1$I for each row execute function public.touch_listing_updated_at()', t);
  end loop;
end $$;

-- ---------- 5. RLS + grants ----------
-- Public read hides moderated rows (owners and admins still see their own).
drop policy if exists "listings are publicly readable" on public.listings;
create policy "listings are publicly readable" on public.listings
  for select using (moderation_status = 'active' or owner_id = auth.uid() or public.is_admin());
drop policy if exists "projects are publicly readable" on public.projects;
create policy "projects are publicly readable" on public.projects
  for select using (moderation_status = 'active' or owner_id = auth.uid() or public.is_admin());
-- admins moderate projects through the RPCs below; owners keep their update/delete policies
drop policy if exists "projects updatable by admin" on public.projects;

-- listings: the column grants from 0012 gain the three relationship links + thumbnails;
-- is_sample / placement / moderation_status / verified stay server-controlled.
grant insert (agency_id, professional_id, project_id, thumbs) on public.listings to authenticated;
grant update (agency_id, professional_id, project_id, thumbs) on public.listings to authenticated;

-- projects: move from table-wide INSERT/UPDATE to column grants, so the new
-- privileged columns (is_sample, verified, placement, moderation) can't be written.
revoke insert, update on public.projects from authenticated;
grant insert (owner_id, title, city, area, status, unit_types, total_units, total_plots, size_from, size_to,
              size_unit, price_from, price_to, payment_plan, possession_date, description, photos, brochure_path,
              company_id, project_type, approvals_info, thumbs) on public.projects to authenticated;
grant update (title, city, area, status, unit_types, total_units, total_plots, size_from, size_to,
              size_unit, price_from, price_to, payment_plan, possession_date, description, photos, brochure_path,
              company_id, project_type, approvals_info, thumbs) on public.projects to authenticated;

alter table public.agencies enable row level security;
alter table public.professionals enable row level security;
alter table public.companies enable row level security;
alter table public.company_rates enable row level security;
alter table public.agency_members enable row level security;
alter table public.project_agencies enable row level security;

revoke all on public.agencies, public.professionals, public.companies, public.company_rates,
              public.agency_members, public.project_agencies from public, anon, authenticated;
grant select on public.agencies, public.professionals, public.companies, public.company_rates to anon, authenticated;
grant select on public.agency_members, public.project_agencies to anon, authenticated;
grant delete on public.agencies, public.professionals, public.companies, public.company_rates to authenticated;

grant insert (owner_id, name, logo_url, cover_url, description, office_address, city, cities, areas_served, services,
              segments, purposes, website_url, facebook_url, instagram_url, youtube_url) on public.agencies to authenticated;
grant update (name, logo_url, cover_url, description, office_address, city, cities, areas_served, services,
              segments, purposes, website_url, facebook_url, instagram_url, youtube_url) on public.agencies to authenticated;

grant insert (owner_id, display_name, avatar_url, avatar_kind, headline, intro, why_contact, how_i_work, years_experience,
              cities, areas_served, segments, purposes, property_types, services, languages, overseas_clients,
              commission_info, special_offer, deal_history, website_url, facebook_url, instagram_url, youtube_url)
  on public.professionals to authenticated;
grant update (display_name, avatar_url, avatar_kind, headline, intro, why_contact, how_i_work, years_experience,
              cities, areas_served, segments, purposes, property_types, services, languages, overseas_clients,
              commission_info, special_offer, deal_history, website_url, facebook_url, instagram_url, youtube_url)
  on public.professionals to authenticated;

grant insert (owner_id, name, logo_url, cover_url, description, years_experience, cities, areas_served, services,
              completed_projects, current_projects, portfolio, payment_terms, website_url, facebook_url, instagram_url, youtube_url)
  on public.companies to authenticated;
grant update (name, logo_url, cover_url, description, years_experience, cities, areas_served, services,
              completed_projects, current_projects, portfolio, payment_terms, website_url, facebook_url, instagram_url, youtube_url)
  on public.companies to authenticated;

grant insert (company_id, service, rate_min, rate_max, unit, includes, updated_on) on public.company_rates to authenticated;
grant update (service, rate_min, rate_max, unit, includes, updated_on) on public.company_rates to authenticated;

do $$
declare t text;
begin
  foreach t in array array['agencies', 'professionals', 'companies'] loop
    execute format('drop policy if exists "%1$s public read" on public.%1$I', t);
    execute format('create policy "%1$s public read" on public.%1$I for select using (moderation_status = ''active'' or owner_id = auth.uid() or public.is_admin())', t);
    execute format('drop policy if exists "%1$s owner insert" on public.%1$I', t);
    execute format('create policy "%1$s owner insert" on public.%1$I for insert with check (owner_id = auth.uid() and not is_sample)', t);
    execute format('drop policy if exists "%1$s owner update" on public.%1$I', t);
    execute format('create policy "%1$s owner update" on public.%1$I for update using (owner_id = auth.uid() and not is_sample) with check (owner_id = auth.uid() and not is_sample)', t);
    execute format('drop policy if exists "%1$s owner delete" on public.%1$I', t);
    execute format('create policy "%1$s owner delete" on public.%1$I for delete using ((owner_id = auth.uid() and not is_sample) or public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "company rates public read" on public.company_rates;
create policy "company rates public read" on public.company_rates for select using (
  exists (select 1 from public.companies c where c.id = company_id and (c.moderation_status = 'active' or c.owner_id = auth.uid() or public.is_admin())));
drop policy if exists "company rates owner write" on public.company_rates;
create policy "company rates owner write" on public.company_rates for all
  using (exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid() and not c.is_sample))
  with check (exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid() and not c.is_sample));

-- Relationships: active ones are public (team pages); pending ones only to the two sides.
drop policy if exists "agency members visible" on public.agency_members;
create policy "agency members visible" on public.agency_members for select using (
  status = 'active'
  or exists (select 1 from public.agencies a where a.id = agency_id and a.owner_id = auth.uid())
  or exists (select 1 from public.professionals p where p.id = professional_id and p.owner_id = auth.uid())
  or public.is_admin());
drop policy if exists "project agencies visible" on public.project_agencies;
create policy "project agencies visible" on public.project_agencies for select using (
  status = 'active'
  or exists (select 1 from public.agencies a where a.id = agency_id and a.owner_id = auth.uid())
  or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  or public.is_admin());

-- ---------- 6. relationship RPCs (both sides must agree) ----------
create or replace function public.request_agency_membership(p_professional uuid, p_agency uuid)
returns public.agency_members language plpgsql security definer set search_path = public
as $$
declare
  v_prof public.professionals; v_ag public.agencies; v_by text; r public.agency_members;
begin
  if auth.uid() is null then raise exception 'Please log in.' using errcode = '42501'; end if;
  select * into v_prof from public.professionals where id = p_professional;
  select * into v_ag from public.agencies where id = p_agency;
  if v_prof.id is null or v_ag.id is null or v_prof.is_sample or v_ag.is_sample then raise exception 'Profile not found.'; end if;
  if v_prof.owner_id = auth.uid() then v_by := 'professional';
  elsif v_ag.owner_id = auth.uid() then v_by := 'agency';
  else raise exception 'You can only link profiles you manage.' using errcode = '42501'; end if;
  -- the same account owning both sides is accepted immediately
  insert into public.agency_members (agency_id, professional_id, status, requested_by, decided_at)
  values (p_agency, p_professional,
          case when v_prof.owner_id = v_ag.owner_id then 'active' else 'pending' end, v_by,
          case when v_prof.owner_id = v_ag.owner_id then now() end)
  on conflict (agency_id, professional_id) do update
     set status = case when public.agency_members.status = 'active' then 'active'
                       when v_prof.owner_id = v_ag.owner_id then 'active' else 'pending' end,
         requested_by = excluded.requested_by, created_at = now(), decided_at = excluded.decided_at
  returning * into r;
  return r;
end;
$$;

create or replace function public.decide_agency_membership(p_membership uuid, p_decision text)
returns public.agency_members language plpgsql security definer set search_path = public
as $$
declare
  m public.agency_members; v_prof_owner uuid; v_ag_owner uuid;
begin
  if p_decision not in ('active', 'declined', 'removed') then raise exception 'Unknown decision.'; end if;
  select * into m from public.agency_members where id = p_membership;
  if m.id is null then raise exception 'Request not found.'; end if;
  select owner_id into v_prof_owner from public.professionals where id = m.professional_id;
  select owner_id into v_ag_owner from public.agencies where id = m.agency_id;
  if p_decision = 'removed' then
    -- either side can end an active or pending link
    if auth.uid() not in (v_prof_owner, v_ag_owner) and not public.is_admin() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  else
    -- only the side that did NOT ask can accept or decline
    if m.status <> 'pending' then raise exception 'This request is no longer pending.'; end if;
    if not ((m.requested_by = 'professional' and auth.uid() = v_ag_owner)
         or (m.requested_by = 'agency' and auth.uid() = v_prof_owner)) then
      raise exception 'Only the other side can accept or decline this request.' using errcode = '42501';
    end if;
  end if;
  update public.agency_members set status = p_decision, decided_at = now() where id = p_membership returning * into m;
  -- a professional who leaves an agency stops listing under it
  if p_decision in ('removed', 'declined') then
    update public.listings set agency_id = null
     where agency_id = m.agency_id and owner_id = v_prof_owner and owner_id <> v_ag_owner;
  end if;
  return m;
end;
$$;

create or replace function public.request_project_agency(p_project uuid, p_agency uuid)
returns public.project_agencies language plpgsql security definer set search_path = public
as $$
declare v_pr public.projects; v_ag public.agencies; r public.project_agencies;
begin
  select * into v_pr from public.projects where id = p_project;
  select * into v_ag from public.agencies where id = p_agency;
  if v_pr.id is null or v_ag.id is null or v_pr.is_sample or v_ag.is_sample then raise exception 'Not found.'; end if;
  if v_pr.owner_id <> auth.uid() then raise exception 'Only the project owner can add a representing agency.' using errcode = '42501'; end if;
  insert into public.project_agencies (project_id, agency_id, status, decided_at)
  values (p_project, p_agency, case when v_ag.owner_id = auth.uid() then 'active' else 'pending' end,
          case when v_ag.owner_id = auth.uid() then now() end)
  on conflict (project_id, agency_id) do update set status = case when public.project_agencies.status = 'active' then 'active' else excluded.status end,
     created_at = now(), decided_at = excluded.decided_at
  returning * into r;
  return r;
end;
$$;

create or replace function public.decide_project_agency(p_link uuid, p_decision text)
returns public.project_agencies language plpgsql security definer set search_path = public
as $$
declare l public.project_agencies; v_pr_owner uuid; v_ag_owner uuid;
begin
  if p_decision not in ('active', 'declined', 'removed') then raise exception 'Unknown decision.'; end if;
  select * into l from public.project_agencies where id = p_link;
  if l.id is null then raise exception 'Request not found.'; end if;
  select owner_id into v_pr_owner from public.projects where id = l.project_id;
  select owner_id into v_ag_owner from public.agencies where id = l.agency_id;
  if p_decision = 'removed' then
    if auth.uid() not in (v_pr_owner, v_ag_owner) and not public.is_admin() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  elsif not (l.status = 'pending' and auth.uid() = v_ag_owner) then
    raise exception 'Only the agency can accept or decline this request.' using errcode = '42501';
  end if;
  update public.project_agencies set status = p_decision, decided_at = now() where id = p_link returning * into l;
  return l;
end;
$$;

revoke all on function public.request_agency_membership(uuid, uuid), public.decide_agency_membership(uuid, text),
                       public.request_project_agency(uuid, uuid), public.decide_project_agency(uuid, text) from public, anon;
grant execute on function public.request_agency_membership(uuid, uuid), public.decide_agency_membership(uuid, text),
                          public.request_project_agency(uuid, uuid), public.decide_project_agency(uuid, text) to authenticated;

-- ---------- 7. contact + enquiries (samples are never contactable) ----------
-- Resolves any marketplace target to its owner, sample flag and visibility.
create or replace function public.mv2_target(p_type text, p_id uuid, out owner_id uuid, out is_sample boolean, out visible boolean, out title text)
language plpgsql stable security definer set search_path = public
as $$
begin
  case p_type
    when 'listing' then select l.owner_id, l.is_sample, l.moderation_status = 'active', l.title into owner_id, is_sample, visible, title from public.listings l where l.id = p_id;
    when 'project' then select p.owner_id, p.is_sample, p.moderation_status = 'active', p.title into owner_id, is_sample, visible, title from public.projects p where p.id = p_id;
    when 'professional' then select p.owner_id, p.is_sample, p.moderation_status = 'active', p.display_name into owner_id, is_sample, visible, title from public.professionals p where p.id = p_id;
    when 'agency' then select a.owner_id, a.is_sample, a.moderation_status = 'active', a.name into owner_id, is_sample, visible, title from public.agencies a where a.id = p_id;
    when 'company' then select c.owner_id, c.is_sample, c.moderation_status = 'active', c.name into owner_id, is_sample, visible, title from public.companies c where c.id = p_id;
    else raise exception 'Unknown category.';
  end case;
end;
$$;
revoke execute on function public.mv2_target(text, uuid) from public, anon, authenticated;

-- Public contact number for any target. Only numbers the owner typed into a
-- public field are ever returned — never profiles.phone (the login identity).
--   listing:      linked professional → linked agency → owner's public number
--   project:      developer company → owner's public number
--   professional / agency / company: that profile's public number
create or replace function public.mv2_public_phone(p_type text, p_id uuid)
returns text language plpgsql stable security definer set search_path = public
as $$
declare v text;
begin
  case p_type
    when 'listing' then
      select coalesce(pp.phone, ap.phone, nullif(o.public_phone, '')) into v
        from public.listings l
        join public.profiles o on o.id = l.owner_id
        left join public.entity_public_phones pp on pp.entity_type = 'professional' and pp.entity_id = l.professional_id
        left join public.entity_public_phones ap on ap.entity_type = 'agency' and ap.entity_id = l.agency_id
       where l.id = p_id;
    when 'project' then
      select coalesce(cp.phone, nullif(o.public_phone, '')) into v
        from public.projects p join public.profiles o on o.id = p.owner_id
        left join public.entity_public_phones cp on cp.entity_type = 'company' and cp.entity_id = p.company_id
       where p.id = p_id;
    when 'professional', 'agency', 'company' then
      select e.phone into v from public.entity_public_phones e where e.entity_type = p_type and e.entity_id = p_id;
    else v := null;
  end case;
  return v;
end;
$$;
revoke execute on function public.mv2_public_phone(text, uuid) from public, anon, authenticated;

-- The owner publishes (or clears, with null/empty) a profile's business number.
create or replace function public.set_entity_public_phone(p_type text, p_id uuid, p_phone text)
returns void language plpgsql security definer set search_path = public
as $$
declare t record; v text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if auth.uid() is null then raise exception 'Please log in.' using errcode = '42501'; end if;
  if p_type not in ('agency', 'professional', 'company') then raise exception 'Unknown category.'; end if;
  select * into t from public.mv2_target(p_type, p_id);
  if t.owner_id is null or t.owner_id <> auth.uid() then raise exception 'Not found or not yours.' using errcode = '42501'; end if;
  if t.is_sample then raise exception 'Sample content has no contact.'; end if;
  if not public.mv2_valid_phone(v) then raise exception 'Please enter a valid phone number, or leave it empty.'; end if;
  if v is null then
    delete from public.entity_public_phones where entity_type = p_type and entity_id = p_id;
  else
    insert into public.entity_public_phones (entity_type, entity_id, owner_id, phone)
    values (p_type, p_id, auth.uid(), v)
    on conflict (entity_type, entity_id) do update set phone = excluded.phone, owner_id = excluded.owner_id, updated_at = now();
  end if;
end;
$$;
revoke all on function public.set_entity_public_phone(text, uuid, text) from public, anon;
grant execute on function public.set_entity_public_phone(text, uuid, text) to authenticated;

-- a deleted profile takes its number with it
create or replace function public.mv2_drop_entity_phone()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.entity_public_phones
   where entity_id = old.id
     and entity_type = case tg_table_name when 'agencies' then 'agency' when 'professionals' then 'professional' else 'company' end;
  return old;
end;
$$;
revoke execute on function public.mv2_drop_entity_phone() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['agencies', 'professionals', 'companies'] loop
    execute format('drop trigger if exists %1$s_drop_phone on public.%1$I', t);
    execute format('create trigger %1$s_drop_phone after delete on public.%1$I for each row execute function public.mv2_drop_entity_phone()', t);
  end loop;
end $$;

-- Listing contact (0012): same signature, but it now returns the PUBLIC number
-- only (null if the owner has not published one), and nothing for samples or
-- hidden listings. Visitors can always send an enquiry instead.
create or replace function public.get_listing_contact(p_listing uuid)
returns table (full_name text, phone text, agency_name text)
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(pr.display_name, p.full_name),
         public.mv2_public_phone('listing', l.id),
         coalesce(a.name, p.agency_name)
  from public.listings l
  join public.profiles p on p.id = l.owner_id
  left join public.agencies a on a.id = l.agency_id
  left join public.professionals pr on pr.id = l.professional_id
  where l.id = p_listing
    and not l.is_sample
    and l.moderation_status = 'active'
    and auth.uid() is not null;
$$;
revoke all on function public.get_listing_contact(uuid) from public, anon;
grant execute on function public.get_listing_contact(uuid) to authenticated;

-- Same rule for every category: signed-in visitors only, never samples,
-- public number only.
create or replace function public.get_marketplace_contact(p_type text, p_id uuid)
returns table (display_name text, phone text)
language plpgsql stable security definer set search_path = public
as $$
declare t record;
begin
  if auth.uid() is null then return; end if;
  select * into t from public.mv2_target(p_type, p_id);
  if t.owner_id is null or t.is_sample or not t.visible then return; end if;
  return query select case when p_type in ('listing', 'project') then p.full_name else t.title end,
                      public.mv2_public_phone(p_type, p_id)
                 from public.profiles p where p.id = t.owner_id;
end;
$$;
revoke all on function public.get_marketplace_contact(text, uuid) from public, anon;
grant execute on function public.get_marketplace_contact(text, uuid) to authenticated;

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('listing', 'project', 'professional', 'agency', 'company')),
  target_id uuid not null,
  target_title text,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text,
  sender_phone text,
  message text not null check (char_length(message) between 2 and 2000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);
create index if not exists enquiries_recipient_idx on public.enquiries(recipient_id, created_at desc);
create index if not exists enquiries_sender_idx on public.enquiries(sender_id, created_at desc);
alter table public.enquiries enable row level security;
revoke all on public.enquiries from public, anon, authenticated;
grant select on public.enquiries to authenticated;
drop policy if exists "enquiries visible to both sides" on public.enquiries;
create policy "enquiries visible to both sides" on public.enquiries for select
  using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

create or replace function public.send_enquiry(p_type text, p_id uuid, p_message text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare t record; v_me public.profiles; v_id uuid; v_recent int;
begin
  if auth.uid() is null then raise exception 'Please log in to send an enquiry.' using errcode = '42501'; end if;
  select * into t from public.mv2_target(p_type, p_id);
  if t.owner_id is null or not t.visible then raise exception 'This item is not available.'; end if;
  if t.is_sample then
    raise exception 'This is sample content shown for demonstration. It cannot receive enquiries.' using errcode = 'P0001';
  end if;
  if t.owner_id = auth.uid() then raise exception 'This is your own profile or listing.'; end if;
  if char_length(trim(coalesce(p_message, ''))) < 2 then raise exception 'Please write a short message.'; end if;
  -- launch anti-spam limit, configurable in marketplace_settings.enquiry_daily_limit (default 20)
  select count(*) into v_recent from public.enquiries where sender_id = auth.uid() and created_at > now() - interval '24 hours';
  if v_recent >= coalesce((public.mv2_setting('enquiry_daily_limit') #>> '{}')::int, 20) then
    raise exception 'You have sent many enquiries today. Please try again tomorrow.';
  end if;
  if p_phone is not null and trim(p_phone) <> '' and not public.mv2_valid_phone(trim(p_phone)) then
    raise exception 'Please enter a valid phone number, or leave it empty.';
  end if;
  select * into v_me from public.profiles where id = auth.uid();
  -- The sender's number is shared only if they typed it (or published one) — never their login phone.
  insert into public.enquiries (target_type, target_id, target_title, recipient_id, sender_id, sender_name, sender_phone, message)
  values (p_type, p_id, t.title, t.owner_id, auth.uid(), v_me.full_name,
          coalesce(nullif(trim(p_phone), ''), nullif(v_me.public_phone, '')),
          left(trim(p_message), 2000))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_enquiry_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_status not in ('new', 'read', 'archived') then raise exception 'Unknown status.'; end if;
  update public.enquiries set status = p_status where id = p_id and recipient_id = auth.uid();
  if not found then raise exception 'Enquiry not found.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.send_enquiry(text, uuid, text, text), public.set_enquiry_status(uuid, text) from public, anon;
grant execute on function public.send_enquiry(text, uuid, text, text), public.set_enquiry_status(uuid, text) to authenticated;

-- Samples are not "available" either.
create or replace function public.confirm_listing_available(p_listing uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz := now();
begin
  update public.listings
     set last_confirmed_at = v_at
   where id = p_listing
     and not is_sample
     and (owner_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'Listing not found or not yours' using errcode = '42501';
  end if;
  return v_at;
end;
$$;
revoke all on function public.confirm_listing_available(uuid) from public, anon;
grant execute on function public.confirm_listing_available(uuid) to authenticated;

-- ---------- 7b. account capabilities (one account, optional capabilities) ----------
-- Authorization for marketplace activity no longer depends on profiles.role
-- (which is now the signup intent / legacy value). Capabilities are granted by
-- review and recorded here; nobody can write this table from the browser.
--   project_publisher — may create projects. Any account may apply (developer
--   application); only an admin approves, revokes or restores it.
-- profiles.developer_status / developer_tier are kept in sync for the pages that
-- still read them (legacy, see comments at the end).
create table if not exists public.account_capabilities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null check (capability in ('project_publisher')),
  status text not null check (status in ('pending', 'approved', 'rejected', 'revoked')),
  application_id uuid references public.developer_applications(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  note text,
  primary key (user_id, capability)
);
alter table public.account_capabilities enable row level security;
revoke all on public.account_capabilities from public, anon, authenticated;
grant select on public.account_capabilities to authenticated;
drop policy if exists "capabilities own or admin" on public.account_capabilities;
create policy "capabilities own or admin" on public.account_capabilities for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.has_capability(p_user uuid, p_cap text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.account_capabilities where user_id = p_user and capability = p_cap and status = 'approved') $$;
-- the caller's own status (used by the application policy and the dashboard)
create or replace function public.my_capability_status(p_cap text)
returns text language sql stable security definer set search_path = public
as $$ select coalesce((select status from public.account_capabilities where user_id = auth.uid() and capability = p_cap), 'none') $$;
revoke all on function public.has_capability(uuid, text), public.my_capability_status(text) from public, anon;
grant execute on function public.has_capability(uuid, text), public.my_capability_status(text) to authenticated;

-- An application (from ANY account) opens a pending capability request.
create or replace function public.developer_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set developer_status = 'pending'
   where id = new.user_id
     and coalesce(developer_status, 'unsubmitted') in ('unsubmitted', 'rejected');
  insert into public.account_capabilities (user_id, capability, status, application_id, requested_at)
  values (new.user_id, 'project_publisher', 'pending', new.id, now())
  on conflict (user_id, capability) do update
     set status = 'pending', application_id = excluded.application_id, requested_at = now(),
         decided_at = null, decided_by = null, note = null
   where public.account_capabilities.status = 'rejected';
  return new;
end;
$$;
revoke all on function public.developer_application_submitted() from public, anon, authenticated;

-- Any account may apply once at a time (none or after a rejection); the row
-- itself still cannot arrive approved (0017 column grants + this check).
drop policy if exists "developer applications insertable by owner" on public.developer_applications;
create policy "developer applications insertable by owner" on public.developer_applications
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and decision_at is null and reviewer_id is null and reviewer_note is null and ai_doc_check_result is null
    and public.my_capability_status('project_publisher') in ('none', 'rejected')
  );

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

  insert into public.account_capabilities (user_id, capability, status, application_id, decided_at, decided_by, note)
  values (app.user_id, 'project_publisher', p_decision, app.id, now(), auth.uid(), coalesce(p_note, ''))
  on conflict (user_id, capability) do update
     set status = excluded.status, application_id = excluded.application_id, decided_at = now(),
         decided_by = auth.uid(), note = excluded.note;

  -- legacy mirror (developer_tier is display-only and never used for ranking)
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

-- Revoke (abuse, fraud, mistake) or restore a capability; logged.
create or replace function public.admin_set_capability(p_user uuid, p_cap text, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_cap <> 'project_publisher' or p_status not in ('approved', 'revoked') then raise exception 'Unknown capability or status.'; end if;
  if p_user = public.mv2_sample_owner() then raise exception 'Not for the sample account.'; end if;
  insert into public.account_capabilities (user_id, capability, status, decided_at, decided_by, note)
  values (p_user, p_cap, p_status, now(), auth.uid(), p_note)
  on conflict (user_id, capability) do update set status = excluded.status, decided_at = now(), decided_by = auth.uid(), note = excluded.note;
  update public.profiles set developer_status = case when p_status = 'approved' then 'approved' else 'rejected' end where id = p_user;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), 'capability:' || p_cap || ':' || p_status, 'account_capabilities', p_user, p_note);
end;
$$;
revoke all on function public.admin_set_capability(uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_capability(uuid, text, text, text) to authenticated;

-- Creating a project requires the approved capability — not a role.
drop policy if exists "projects are insertable by owner" on public.projects;
create policy "projects are insertable by owner" on public.projects
  for insert with check (auth.uid() = owner_id and public.has_capability(auth.uid(), 'project_publisher'));

-- carry existing developer reviews over
insert into public.account_capabilities (user_id, capability, status, decided_at)
select id, 'project_publisher', developer_status, case when developer_status <> 'pending' then now() end
  from public.profiles
 where developer_status in ('pending', 'approved', 'rejected')
on conflict (user_id, capability) do nothing;

-- ---------- 8. early participants (30% early benefit eligibility) ----------
-- Rule (server-side only):
--   An account qualifies when one of its GENUINE marketplace items
--     * was created before packages_launch_at (1 Nov 2026 00:00 PKT), and
--     * is still published (not deleted, not hidden by moderation) once it has
--       been live for early_min_days (7) days.
--   Qualifying items: a property listing; a project (only approved publishers can
--   create one); a professional, agency or builder/developer profile with real
--   content (at least 20 characters of introduction/description, or listed
--   services). Samples never qualify.
--   Creation must be before the cutoff; the 7 days may finish after it. Content
--   created in the last week before 1 Nov therefore completes by 8 Nov at the
--   latest; run admin_evaluate_early_participants() on/after 8 Nov 2026 to settle
--   everyone (eligibility is also evaluated whenever the owner changes or deletes
--   content or opens the dashboard).
--   Deleting an item BEFORE its 7 days: it never counts. Deleting it AFTER: the
--   eligibility already earned is recorded first (BEFORE DELETE) and stays.
--   Admins can revoke/restore (logged) for abuse, fraud or mistakes.
create table if not exists public.early_participants (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  qualified_at timestamptz not null default now(),       -- the moment the 7 days completed
  qualifying_type text not null,
  qualifying_id uuid,
  first_published_at timestamptz,                         -- creation time of the qualifying item
  source text not null default 'auto' check (source in ('auto', 'backfill', 'admin')),
  revoked_at timestamptz,
  revoked_reason text
);
alter table public.early_participants enable row level security;
revoke all on public.early_participants from public, anon, authenticated;
grant select on public.early_participants to authenticated;
drop policy if exists "early participants own row" on public.early_participants;
create policy "early participants own row" on public.early_participants for select
  using (user_id = auth.uid() or public.is_admin());

-- The owner's items that count (published now, genuine, created before the cutoff).
create or replace function public.mv2_early_items(p_owner uuid)
returns table (kind text, id uuid, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  with c as (select (public.mv2_setting('packages_launch_at') #>> '{}')::timestamptz as cutoff)
  select 'listings', l.id, l.created_at from public.listings l, c
   where l.owner_id = p_owner and not l.is_sample and l.moderation_status = 'active' and l.created_at < c.cutoff
  union all
  select 'projects', p.id, p.created_at from public.projects p, c
   where p.owner_id = p_owner and not p.is_sample and p.moderation_status = 'active' and p.created_at < c.cutoff
  union all
  select 'professionals', p.id, p.created_at from public.professionals p, c
   where p.owner_id = p_owner and not p.is_sample and p.moderation_status = 'active' and p.created_at < c.cutoff
     and (char_length(coalesce(p.intro, '') || coalesce(p.headline, '')) >= 20 or cardinality(p.services) > 0)
  union all
  select 'agencies', a.id, a.created_at from public.agencies a, c
   where a.owner_id = p_owner and not a.is_sample and a.moderation_status = 'active' and a.created_at < c.cutoff
     and (char_length(coalesce(a.description, '')) >= 20 or cardinality(a.services) > 0)
  union all
  select 'companies', co.id, co.created_at from public.companies co, c
   where co.owner_id = p_owner and not co.is_sample and co.moderation_status = 'active' and co.created_at < c.cutoff
     and (char_length(coalesce(co.description, '')) >= 20 or cardinality(co.services) > 0)
$$;

-- Record eligibility if an item has completed the qualifying period. Idempotent;
-- never re-qualifies an account an admin revoked.
create or replace function public.mv2_try_qualify(p_owner uuid, p_source text default 'auto')
returns boolean language plpgsql security definer set search_path = public
as $$
declare r record; v_days int; v_row public.early_participants;
begin
  if p_owner is null or p_owner = public.mv2_sample_owner() then return false; end if;
  select * into v_row from public.early_participants where user_id = p_owner;
  if v_row.user_id is not null then return v_row.revoked_at is null; end if;
  -- the account itself is being deleted (cascade): nothing to record
  if not exists (select 1 from public.profiles where id = p_owner) then return false; end if;
  v_days := coalesce((public.mv2_setting('early_min_days') #>> '{}')::int, 7);
  select * into r from public.mv2_early_items(p_owner) i
   where i.created_at <= now() - make_interval(days => v_days)
   order by i.created_at limit 1;
  if r.id is null then return false; end if;
  insert into public.early_participants (user_id, qualified_at, qualifying_type, qualifying_id, first_published_at, source)
  values (p_owner, r.created_at + make_interval(days => v_days), r.kind, r.id, r.created_at, p_source)
  on conflict (user_id) do nothing;
  return true;
end;
$$;

create or replace function public.mv2_early_on_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- BEFORE DELETE: the item is still in its table, so time already earned is kept.
  perform public.mv2_try_qualify(case when tg_op = 'DELETE' then old.owner_id else new.owner_id end);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function public.mv2_early_items(uuid), public.mv2_try_qualify(uuid, text), public.mv2_early_on_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['listings', 'projects', 'agencies', 'professionals', 'companies'] loop
    execute format('drop trigger if exists %1$s_early_participant on public.%1$I', t);
    execute format('drop trigger if exists %1$s_early_change on public.%1$I', t);
    execute format('create trigger %1$s_early_change after insert or update on public.%1$I for each row execute function public.mv2_early_on_change()', t);
    execute format('drop trigger if exists %1$s_early_delete on public.%1$I', t);
    execute format('create trigger %1$s_early_delete before delete on public.%1$I for each row execute function public.mv2_early_on_change()', t);
  end loop;
end $$;

-- The caller's status for the dashboard: qualified / pending (with the date it
-- completes) / none / revoked.
create or replace function public.my_early_status()
returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare v_row public.early_participants; r record; v_days int; v_cutoff timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('status', 'none'); end if;
  perform public.mv2_try_qualify(auth.uid());
  v_days := coalesce((public.mv2_setting('early_min_days') #>> '{}')::int, 7);
  v_cutoff := (public.mv2_setting('packages_launch_at') #>> '{}')::timestamptz;
  select * into v_row from public.early_participants where user_id = auth.uid();
  if v_row.user_id is not null then
    return jsonb_build_object('status', case when v_row.revoked_at is null then 'qualified' else 'revoked' end,
      'qualified_at', v_row.qualified_at, 'qualifying_type', v_row.qualifying_type, 'min_days', v_days, 'cutoff', v_cutoff);
  end if;
  select * into r from public.mv2_early_items(auth.uid()) order by created_at limit 1;
  if r.id is not null then
    return jsonb_build_object('status', 'pending', 'qualifying_type', r.kind, 'since', r.created_at,
      'qualifies_on', r.created_at + make_interval(days => v_days), 'min_days', v_days, 'cutoff', v_cutoff);
  end if;
  return jsonb_build_object('status', case when now() < v_cutoff then 'none' else 'closed' end, 'min_days', v_days, 'cutoff', v_cutoff);
end;
$$;
revoke all on function public.my_early_status() from public, anon;
grant execute on function public.my_early_status() to authenticated;

-- Settle everyone (run on/after 8 Nov 2026; safe to run any time). Logged.
create or replace function public.admin_evaluate_early_participants()
returns int language plpgsql security definer set search_path = public
as $$
declare n int := 0; o uuid;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  for o in select distinct owner_id from (
      select owner_id from public.listings union select owner_id from public.projects union select owner_id from public.agencies
      union select owner_id from public.professionals union select owner_id from public.companies) x
    where owner_id <> public.mv2_sample_owner() and not exists (select 1 from public.early_participants e where e.user_id = x.owner_id)
  loop
    if public.mv2_try_qualify(o) then n := n + 1; end if;
  end loop;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), 'early:evaluated', 'early_participants', md5('early_participants')::uuid, n || ' newly qualified');
  return n;
end;
$$;
revoke all on function public.admin_evaluate_early_participants() from public, anon;
grant execute on function public.admin_evaluate_early_participants() to authenticated;

-- ---------- 9. public counts (genuine, visible content only) ----------
create or replace function public.marketplace_stats()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'properties', (select count(*) from public.listings where not is_sample and moderation_status = 'active'),
    'projects', (select count(*) from public.projects where not is_sample and moderation_status = 'active'),
    'professionals', (select count(*) from public.professionals where not is_sample and moderation_status = 'active'),
    'agencies', (select count(*) from public.agencies where not is_sample and moderation_status = 'active'),
    'companies', (select count(*) from public.companies where not is_sample and moderation_status = 'active'),
    'by_city', coalesce((select jsonb_object_agg(city, n) from (
        select city, count(*) n from public.listings where not is_sample and moderation_status = 'active' group by city) c), '{}'),
    'popular_areas', coalesce((select jsonb_agg(jsonb_build_object('city', city, 'area', area, 'n', n)) from (
        select city, area, count(*) n from public.listings where not is_sample and moderation_status = 'active'
        group by city, area order by count(*) desc, area limit 8) a), '[]'));
$$;
revoke all on function public.marketplace_stats() from public;
grant execute on function public.marketplace_stats() to anon, authenticated;

-- ---------- 10. admin controls (logged; refuse samples where it matters) ----------
create or replace function public.mv2_admin_entity_table(p_type text)
returns text language sql immutable set search_path = public
as $$ select case p_type when 'listing' then 'listings' when 'project' then 'projects' when 'professional' then 'professionals'
                         when 'agency' then 'agencies' when 'company' then 'companies' end $$;

create or replace function public.admin_set_entity_verified(p_type text, p_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_t text := public.mv2_admin_entity_table(p_type); v_sample boolean;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if v_t is null then raise exception 'Unknown category.'; end if;
  execute format('select is_sample from public.%I where id = $1', v_t) into v_sample using p_id;
  if v_sample is null then raise exception 'Not found.'; end if;
  if v_sample and p_verified then raise exception 'Sample content can never be verified.'; end if;
  execute format('update public.%I set verified = $1 where id = $2', v_t) using p_verified, p_id;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), case when p_verified then 'verified' else 'unverified' end, v_t, p_id, null);
end;
$$;

create or replace function public.admin_set_entity_moderation(p_type text, p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_t text := public.mv2_admin_entity_table(p_type); n int;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if v_t is null or p_status not in ('active', 'hidden') then raise exception 'Unknown category or status.'; end if;
  execute format('update public.%I set moderation_status = $1 where id = $2', v_t) using p_status, p_id;
  get diagnostics n = row_count;   -- (EXECUTE does not set FOUND)
  if n = 0 then raise exception 'Not found.'; end if;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), 'moderation:' || p_status, v_t, p_id, p_note);
end;
$$;

-- Future packages: placement can be prepared, but it has no public effect and no
-- label until marketplace_settings.paid_placement_active is switched on.
create or replace function public.admin_set_entity_placement(p_type text, p_id uuid, p_placement text, p_until timestamptz default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_t text := public.mv2_admin_entity_table(p_type); v_sample boolean;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if v_t is null or p_placement not in ('standard', 'priority', 'featured') then raise exception 'Unknown category or placement.'; end if;
  execute format('select is_sample from public.%I where id = $1', v_t) into v_sample using p_id;
  if v_sample is null then raise exception 'Not found.'; end if;
  if v_sample and p_placement <> 'standard' then raise exception 'Sample content can never be promoted.'; end if;
  execute format('update public.%I set placement = $1, placement_until = $2 where id = $3', v_t) using p_placement, p_until, p_id;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), 'placement:' || p_placement, v_t, p_id, case when p_until is null then null else 'until ' || p_until::text end);
end;
$$;

-- Revoke: blocks the benefit (also before the account has qualified, so abuse
-- found early stays blocked). Restore: lifts the block — an account that had
-- qualified gets its record back; one that had not is re-evaluated by the
-- normal 7-day rule. Grant (p_qualified with no previous row): explicit admin
-- decision for a genuine case the rule missed. Everything is logged.
create or replace function public.admin_set_early_participant(p_user uuid, p_qualified boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_row public.early_participants;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_user = public.mv2_sample_owner() then raise exception 'The sample account can never qualify.'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Unknown account.'; end if;
  select * into v_row from public.early_participants where user_id = p_user;
  if p_qualified then
    if v_row.user_id is null then
      if not public.mv2_try_qualify(p_user, 'admin') then
        insert into public.early_participants (user_id, qualifying_type, source) values (p_user, 'admin', 'admin');
      end if;
    elsif v_row.qualifying_type = 'none' then          -- blocked before qualifying: back to the normal rule
      delete from public.early_participants where user_id = p_user;
      perform public.mv2_try_qualify(p_user);
    else
      update public.early_participants set revoked_at = null, revoked_reason = null where user_id = p_user;
    end if;
  else
    insert into public.early_participants (user_id, qualifying_type, source, revoked_at, revoked_reason)
    values (p_user, 'none', 'admin', now(), p_reason)
    on conflict (user_id) do update set revoked_at = now(), revoked_reason = excluded.revoked_reason;
  end if;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), case when p_qualified then 'early:restored' else 'early:revoked' end, 'early_participants', p_user, p_reason);
end;
$$;

create or replace function public.admin_set_marketplace_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_key not in ('samples_visible', 'sample_fill_min', 'paid_placement_active',
                   'enquiry_daily_limit', 'max_agencies_per_account', 'max_companies_per_account') then
    raise exception 'This setting is changed by migration only.';
  end if;
  -- value shape checks (a bad value must never disable a limit)
  if p_key in ('samples_visible', 'paid_placement_active') and jsonb_typeof(p_value) <> 'boolean' then
    raise exception 'Expected true or false.';
  end if;
  if p_key = 'sample_fill_min' and not (jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric between 0 and 10) then
    raise exception 'Expected a number from 0 to 10.';
  end if;
  if p_key = 'enquiry_daily_limit' and not (jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric between 1 and 200
                                           and (p_value #>> '{}')::numeric = trunc((p_value #>> '{}')::numeric)) then
    raise exception 'Expected a whole number from 1 to 200.';
  end if;
  if p_key in ('max_agencies_per_account', 'max_companies_per_account')
     and not (jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric between 1 and 50
              and (p_value #>> '{}')::numeric = trunc((p_value #>> '{}')::numeric)) then
    raise exception 'Expected a whole number from 1 to 50.';
  end if;
  update public.marketplace_settings set value = p_value, updated_at = now() where key = p_key;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), 'setting:' || p_key, 'marketplace_settings', md5(p_key)::uuid, p_value::text);
end;
$$;

-- Per-account override of the agency/company limit (e.g. a group that manages
-- several real businesses). Professional profiles stay one per account
-- (unique index), so they cannot be overridden. p_max null removes the override.
create or replace function public.admin_set_entity_limit(p_user uuid, p_entity text, p_max int, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_entity not in ('agencies', 'companies') then raise exception 'Only agency and company limits can be changed.'; end if;
  if p_max is not null and (p_max < 1 or p_max > 50) then raise exception 'Expected a whole number from 1 to 50.'; end if;
  if not exists (select 1 from public.profiles where id = p_user) or p_user = public.mv2_sample_owner() then
    raise exception 'Unknown account.';
  end if;
  if p_max is null then
    delete from public.account_entity_limits where user_id = p_user and entity = p_entity;
  else
    insert into public.account_entity_limits (user_id, entity, max_count, set_by, set_at)
    values (p_user, p_entity, p_max, auth.uid(), now())
    on conflict (user_id, entity) do update set max_count = excluded.max_count, set_by = excluded.set_by, set_at = excluded.set_at;
  end if;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), 'limit:' || p_entity, 'account_entity_limits', p_user,
          coalesce(p_max::text, 'default') || coalesce(' — ' || p_note, ''));
end;
$$;
revoke all on function public.admin_set_entity_limit(uuid, text, int, text) from public, anon;
grant execute on function public.admin_set_entity_limit(uuid, text, int, text) to authenticated;

-- cities/areas: 0017 removed browser writes; admins manage them through these.
create or replace function public.admin_set_city_active(p_city text, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  update public.cities set active = p_active where name = p_city;
  if not found then raise exception 'Unknown city.'; end if;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), case when p_active then 'city:activated' else 'city:deactivated' end, 'cities', md5(p_city)::uuid, p_city);
end;
$$;

create or replace function public.admin_add_area(p_city text, p_area text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_area, ''))) < 2 then raise exception 'Area name is required.'; end if;
  if exists (select 1 from public.areas where city_name = p_city and lower(name) = lower(trim(p_area))) then
    raise exception 'This area already exists.';
  end if;
  insert into public.areas (city_name, name, sort_order)
  values (p_city, trim(p_area), coalesce((select max(sort_order) + 1 from public.areas where city_name = p_city), 1))
  returning id into v_id;
  insert into public.admin_log (admin_id, action, target_table, target_id, note)
  values (auth.uid(), 'area:added', 'areas', v_id, p_city || ' / ' || trim(p_area));
  return v_id;
end;
$$;

revoke all on function public.admin_set_entity_verified(text, uuid, boolean),
                       public.admin_set_entity_moderation(text, uuid, text, text),
                       public.admin_set_entity_placement(text, uuid, text, timestamptz),
                       public.admin_set_early_participant(uuid, boolean, text),
                       public.admin_set_marketplace_setting(text, jsonb),
                       public.admin_set_city_active(text, boolean),
                       public.admin_add_area(text, text) from public, anon;
grant execute on function public.admin_set_entity_verified(text, uuid, boolean),
                          public.admin_set_entity_moderation(text, uuid, text, text),
                          public.admin_set_entity_placement(text, uuid, text, timestamptz),
                          public.admin_set_early_participant(uuid, boolean, text),
                          public.admin_set_marketplace_setting(text, jsonb),
                          public.admin_set_city_active(text, boolean),
                          public.admin_add_area(text, text) to authenticated;

-- 0012's listing verification now also refuses samples (the table constraint
-- would reject it anyway; this gives a clear message).
create or replace function public.admin_set_listing_verified(p_listing uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_verified and exists (select 1 from public.listings where id = p_listing and is_sample) then
    raise exception 'Sample content can never be verified.';
  end if;
  update public.listings set verified = p_verified where id = p_listing;
  if found then
    insert into public.admin_log (admin_id, action, target_table, target_id, note)
    values (auth.uid(), case when p_verified then 'verified' else 'unverified' end, 'listings', p_listing, null);
  end if;
end;
$$;
revoke all on function public.admin_set_listing_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_listing_verified(uuid, boolean) to authenticated;

-- internal helpers are never callable from the API
-- (mv2_sample_owner and mv2_safe_url stay executable: triggers and CHECK constraints run as the writer)
revoke execute on function public.mv2_admin_entity_table(text) from public, anon, authenticated;
revoke execute on function public.mv2_setting(text) from public, anon, authenticated;

-- ---------- 11. carry existing accounts into the new model ----------
-- Agency and builder accounts already have profile fields; give each one a
-- public entity (their old profile columns stay untouched), link agency
-- accounts' listings to their agency, and record genuine pre-launch
-- participants with the date of their first content.
insert into public.agencies (owner_id, name, logo_url, description)
select p.id, p.agency_name,
       case when public.mv2_safe_url(p.agency_logo_path) then p.agency_logo_path end,
       left(p.agency_description, 3000)
  from public.profiles p
 where p.role = 'agency' and char_length(coalesce(p.agency_name, '')) >= 2
   and not exists (select 1 from public.agencies a where a.owner_id = p.id);

insert into public.companies (owner_id, name, logo_url, description, completed_projects)
select p.id, p.builder_company_name,
       case when public.mv2_safe_url(p.builder_logo_path) then p.builder_logo_path end,
       left(concat_ws(E'\n\n', p.builder_description, p.builder_services), 3000),
       case when p.builder_projects_completed > 0 then p.builder_projects_completed::text || ' completed projects (company-provided)' end
  from public.profiles p
 where p.role = 'builder' and char_length(coalesce(p.builder_company_name, '')) >= 2
   and not exists (select 1 from public.companies c where c.owner_id = p.id);

update public.listings l set agency_id = a.id
  from public.agencies a
 where a.owner_id = l.owner_id and l.agency_id is null and not l.is_sample;

-- Existing genuine participants: evaluated with the same 7-day rule (source 'backfill').
select public.mv2_try_qualify(o.owner_id, 'backfill')
  from (select distinct owner_id from public.listings where not is_sample
        union select owner_id from public.projects where not is_sample
        union select owner_id from public.agencies where not is_sample
        union select owner_id from public.companies where not is_sample) o;

-- ---------- 12. legacy columns (kept for compatibility, not authority) ----------
comment on column public.profiles.role is 'Signup intent / legacy account type. Marketplace V2 authorization uses entity ownership and account_capabilities, not this value (except admin).';
comment on column public.profiles.developer_status is 'Legacy mirror of account_capabilities(project_publisher). Admin-controlled; not client-writable since 0017.';
comment on column public.profiles.developer_tier is 'DEPRECATED. Planned-scale answer from the developer application. Never used for ranking or placement. Not client-writable.';
comment on column public.profiles.seller_package is 'DEPRECATED. Old seller package idea; packages are not live. Not client-writable; not used anywhere in Marketplace V2.';
comment on column public.profiles.phone is 'Login identity. PRIVATE: never returned by public contact functions. Public numbers are opt-in: profiles.public_phone and entity_public_phones.';
