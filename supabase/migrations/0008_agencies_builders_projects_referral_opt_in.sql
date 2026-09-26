-- ============================================================
-- AgenticCore Estate — 4 signup categories + opt-in referral
-- ------------------------------------------------------------
-- Adds the two new account types (agency, builder) alongside the
-- existing buyer/seller (standard listings) and developer (projects):
--
-- 1. agency   — lists individual properties (same listings table,
--    same dashboard as standard) but carries an agency profile
--    (name, logo, description) and its logo shows on its listings.
-- 2. builder  — promotion-only profile (company name, logo,
--    description, projects completed, services/quotation info).
--    Does not list properties or projects itself.
--
-- "developer" keeps its existing meaning: lists whole PROJECTS.
-- Projects move to their own table (units/plots/brochure don't fit
-- a single-property listing row).
--
-- Also adds an explicit referral opt-in flag — every account type
-- can join the referral program, but it's a deliberate action, not
-- automatic just from having an account.
-- ============================================================

-- ---------- role expansion ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('buyer', 'seller', 'developer', 'agency', 'builder', 'admin'));

-- ---------- agency profile fields ----------
alter table public.profiles add column if not exists agency_name text;
alter table public.profiles add column if not exists agency_logo_path text;
alter table public.profiles add column if not exists agency_description text;

-- ---------- builder/developer company profile fields ----------
-- (promotion-only account — separate from "developer" which lists projects)
alter table public.profiles add column if not exists builder_company_name text;
alter table public.profiles add column if not exists builder_logo_path text;
alter table public.profiles add column if not exists builder_description text;
alter table public.profiles add column if not exists builder_projects_completed smallint;
alter table public.profiles add column if not exists builder_services text;

-- ---------- referral opt-in ----------
alter table public.profiles add column if not exists referral_joined boolean not null default false;
alter table public.profiles add column if not exists referral_joined_at timestamptz;

-- ---------- projects (developer project listings) ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  city text not null,
  area text not null,
  status text not null default 'off_plan' check (status in ('off_plan', 'under_construction', 'ready')),
  unit_types text[] not null default '{}', -- e.g. {residential_apartment, shop, office}
  total_units integer,
  total_plots integer,
  size_from numeric,
  size_to numeric,
  size_unit text not null default 'sqft' check (size_unit in ('marla', 'kanal', 'sqft', 'sqyd')),
  price_from numeric,
  price_to numeric,
  payment_plan text,
  possession_date text,
  description text,
  photos text[] not null default '{}',
  brochure_path text,
  created_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists projects_city_idx on public.projects(city);

alter table public.projects enable row level security;

create policy "projects are publicly readable" on public.projects
  for select using (true);
create policy "projects are insertable by owner" on public.projects
  for insert with check (auth.uid() = owner_id);
create policy "projects are updatable by owner" on public.projects
  for update using (auth.uid() = owner_id);
create policy "projects are deletable by owner" on public.projects
  for delete using (auth.uid() = owner_id);

create trigger projects_active_city
  before insert or update of city on public.projects
  for each row execute function public.enforce_active_city();

-- ---------- public-safe profile view: add the new fields visitors need ----------
create or replace view public.public_profiles as
select id, full_name, role, developer_tier, developer_status, seller_package,
       agency_name, agency_logo_path, agency_description,
       builder_company_name, builder_logo_path, builder_description,
       builder_projects_completed, builder_services
from public.profiles;

-- ---------- storage: project brochures (public — marketing material) ----------
insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', true)
on conflict (id) do nothing;

create policy "project assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'project-assets');

create policy "project assets are uploadable by authenticated owners"
  on storage.objects for insert
  with check (bucket_id = 'project-assets' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "project assets are deletable by their owner"
  on storage.objects for delete
  using (bucket_id = 'project-assets' and auth.uid()::text = (storage.foldername(name))[1]);
