-- ============================================================
-- 0029 — AgenticCore Dealer AI: a Telegram-only property data feed.
--
-- A separate bot (@AgenticcoreDealerAIbot) where owners and dealers post
-- digital listings (no photos) and buyers search them in plain words.
-- A search returns the best 3 across Dealer AI entries, live website
-- listings (read only, public fields) and, once connected, a partner
-- project's search API.
-- Everything lives in its own feed_ tables:
--   * nothing here is readable by the website (RLS on, no policies, no
--     grants to anon/authenticated) — only the bot's server code, with the
--     service role, reads and writes it;
--   * nothing from the feed ever appears on the public website listings.
-- Safe to run more than once.
-- ============================================================

-- people who use the bot (verified Telegram number, chosen role)
create table if not exists public.feed_accounts (
  id uuid primary key default gen_random_uuid(),
  tg_user_id bigint not null unique,
  chat_id bigint not null,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null,                                   -- standard form (ac_norm_phone), shown only on a contact reveal
  role text not null check (role in ('owner', 'dealer', 'buyer')),
  lang text not null default 'ro' check (lang in ('en', 'ur', 'ro')),
  status text not null default 'active' check (status in ('active', 'blocked')),
  reveal_limit smallint,                                 -- per-account daily reveal limit (null = default)
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index if not exists feed_accounts_phone_key on public.feed_accounts (phone);

-- digital listings (sale / rent), 30 days unless renewed
create table if not exists public.feed_listings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                              -- short code people can quote, e.g. DL-4F7K2
  account_id uuid not null references public.feed_accounts(id) on delete cascade,
  purpose text not null check (purpose in ('sale', 'rent')),
  property_type text not null,
  city text not null,
  area text not null check (char_length(area) between 1 and 120),
  address text check (char_length(address) <= 160),     -- block / street: shown only with the contact
  size_value numeric check (size_value is null or size_value > 0),
  size_unit text check (size_unit is null or size_unit in ('marla', 'kanal', 'sqft', 'sqyd')),
  size_marla numeric,                                    -- for matching (1 kanal = 20, 225 sq ft = 1)
  price numeric check (price is null or price > 0),      -- null = "ask the seller"
  beds smallint check (beds is null or beds between 0 and 50),
  baths smallint check (baths is null or baths between 0 and 50),
  notes text check (char_length(notes) <= 500),
  status text not null default 'active' check (status in ('active', 'sold', 'rented', 'expired', 'removed', 'hidden')),
  reports smallint not null default 0,
  expires_at timestamptz not null default now() + interval '30 days',
  expiry_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feed_listings_search_idx on public.feed_listings (status, purpose, city, property_type, expires_at);
create index if not exists feed_listings_account_idx on public.feed_listings (account_id, created_at desc);

-- buyer requests: a search with no match waits 24 hours for new entries
create table if not exists public.feed_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                              -- e.g. BR-9QX3M
  account_id uuid not null references public.feed_accounts(id) on delete cascade,
  query text not null check (char_length(query) <= 600),
  purpose text check (purpose in ('sale', 'rent')),
  property_types text[] not null default '{}',
  city text,
  areas text[] not null default '{}',
  price_min numeric,
  price_max numeric,
  size_marla numeric,
  beds_min smallint,
  status text not null default 'open' check (status in ('open', 'answered', 'waiting_choice', 'closed', 'expired')),
  deadline_at timestamptz not null default now() + interval '24 hours',
  active_until timestamptz not null default now() + interval '24 hours',
  answered_at timestamptz,
  sent_refs text[] not null default '{}',               -- website / partner results already sent (source:id)
  checked_at timestamptz,                                -- last hourly look at the website + partner
  created_at timestamptz not null default now()
);
create index if not exists feed_requests_open_idx on public.feed_requests (status, deadline_at);
create index if not exists feed_requests_account_idx on public.feed_requests (account_id, created_at desc);

-- which listing was sent to which request (each pair once)
create table if not exists public.feed_matches (
  request_id uuid not null references public.feed_requests(id) on delete cascade,
  listing_id uuid not null references public.feed_listings(id) on delete cascade,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (request_id, listing_id)
);

-- contact reveals (daily limit per viewer; a repeat reveal is free)
create table if not exists public.feed_contact_reveals (
  viewer_id uuid not null references public.feed_accounts(id) on delete cascade,
  listing_id uuid not null references public.feed_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, listing_id)
);
create index if not exists feed_reveals_viewer_idx on public.feed_contact_reveals (viewer_id, created_at desc);

-- reports (3 different people → the listing is hidden for review) and blocks
create table if not exists public.feed_reports (
  reporter_id uuid not null references public.feed_accounts(id) on delete cascade,
  listing_id uuid not null references public.feed_listings(id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (reporter_id, listing_id)
);
create table if not exists public.feed_blocks (
  blocker_id uuid not null references public.feed_accounts(id) on delete cascade,
  blocked_id uuid not null references public.feed_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- the bot's own chat state and update de-duplication (separate from Amaan's)
create table if not exists public.feed_sessions (
  chat_id bigint primary key,
  state jsonb not null default '{}'::jsonb,
  lang text,
  updated_at timestamptz not null default now()
);
create table if not exists public.feed_seen_updates (
  update_id bigint primary key,
  seen_at timestamptz not null default now()
);

-- lock everything to the server (service role) only
do $$
declare t text;
begin
  foreach t in array array['feed_accounts', 'feed_listings', 'feed_requests', 'feed_matches', 'feed_contact_reveals',
                           'feed_reports', 'feed_blocks', 'feed_sessions', 'feed_seen_updates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- 3 reports from different people hide a listing until the team looks at it
create or replace function public.feed_after_report()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.feed_listings l
     set reports = (select count(*) from public.feed_reports r where r.listing_id = new.listing_id),
         status = case when (select count(*) from public.feed_reports r where r.listing_id = new.listing_id) >= 3 and l.status = 'active' then 'hidden' else l.status end,
         updated_at = now()
   where l.id = new.listing_id;
  return new;
end;
$$;
revoke execute on function public.feed_after_report() from public, anon, authenticated;
drop trigger if exists feed_reports_count on public.feed_reports;
create trigger feed_reports_count after insert on public.feed_reports for each row execute function public.feed_after_report();
