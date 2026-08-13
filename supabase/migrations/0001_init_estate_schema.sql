-- ============================================================
-- AgenticCore Estate — intended production schema
-- ------------------------------------------------------------
-- This is NOT yet wired up (no live Supabase project has been
-- provisioned for this repo). It documents the schema that
-- /mock-db.js's localStorage model was deliberately designed
-- to mirror 1:1, so swapping the demo data layer for real
-- Supabase calls later is a mechanical change, not a redesign.
-- Run this against a Supabase project, then replace the calls
-- in mock-db.js with supabase-client.js + these tables.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profiles (extends auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null unique,
  cnic text not null, -- government ID number, never displayed publicly
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'developer', 'admin')),
  referred_by uuid references public.profiles(id),
  referral_code text not null unique,
  points integer not null default 0,
  developer_status text check (developer_status in ('unsubmitted', 'pending', 'approved', 'rejected')),
  developer_tier smallint check (developer_tier in (1, 2, 3)),
  created_at timestamptz not null default now()
);

create index if not exists profiles_referred_by_idx on public.profiles(referred_by);
create index if not exists profiles_referral_code_idx on public.profiles(referral_code);

-- ---------- developer_applications ----------
create table if not exists public.developer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_name text not null,
  phone text not null,
  cnic text not null,
  cnic_document_path text not null,       -- storage path in the 'developer-docs' bucket
  company_document_path text not null,    -- storage path in the 'developer-docs' bucket
  tier smallint not null check (tier in (1, 2, 3)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  due_by timestamptz not null default (now() + interval '72 hours'), -- review SLA
  decision_at timestamptz,
  reviewer_id uuid references public.profiles(id),
  reviewer_note text,
  ai_doc_check_result jsonb -- reserved for the AI Document Check feature; null until wired up
);

create index if not exists developer_applications_status_idx on public.developer_applications(status);

-- ---------- listings ----------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  type text not null check (type in ('buy', 'rent')),
  city text not null,
  area text not null,
  price numeric not null check (price > 0),
  beds smallint default 0,
  baths smallint default 0,
  size_marla numeric default 0,
  description text,
  verified boolean not null default false,
  growth_score numeric, -- reserved for the Growth Score AI feature; null until wired up
  created_at timestamptz not null default now()
);

create index if not exists listings_type_city_idx on public.listings(type, city);
create index if not exists listings_owner_idx on public.listings(owner_id);

-- ---------- referral_ledger ----------
-- one row per completed transaction payout, per level (1-5), per beneficiary
create table if not exists public.referral_ledger (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.profiles(id) on delete cascade,
  source_user_id uuid not null references public.profiles(id) on delete cascade,
  level smallint not null check (level between 1 and 5),
  transaction_reference text,
  transaction_value numeric not null,
  points_awarded numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists referral_ledger_beneficiary_idx on public.referral_ledger(beneficiary_id);

-- ---------- admin_log ----------
create table if not exists public.admin_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  action text not null,
  target_table text not null,
  target_id uuid not null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.developer_applications enable row level security;
alter table public.listings enable row level security;
alter table public.referral_ledger enable row level security;
alter table public.admin_log enable row level security;

create policy "profiles are readable by owner" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles are updatable by owner" on public.profiles
  for update using (auth.uid() = id);

create policy "developer applications readable by owner or admin" on public.developer_applications
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "developer applications insertable by owner" on public.developer_applications
  for insert with check (auth.uid() = user_id);
create policy "developer applications decidable by admin" on public.developer_applications
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "listings are publicly readable" on public.listings
  for select using (true);
create policy "listings are insertable by owner" on public.listings
  for insert with check (auth.uid() = owner_id);
create policy "listings are updatable by owner" on public.listings
  for update using (auth.uid() = owner_id);

create policy "referral ledger readable by beneficiary" on public.referral_ledger
  for select using (auth.uid() = beneficiary_id);

create policy "admin log readable by admin" on public.admin_log
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
