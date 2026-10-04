-- ============================================================
-- 0023 — Learning memory for the websites and the bots.
--
-- Like a new agent who learns the market over time, AgenticCore now
-- remembers what it sees — safely:
--
-- 1. kb_facts: shared knowledge (areas, sub-areas/blocks, which city a
--    border society is listed under, landmarks). Every genuine listing
--    (website or Telegram) and every place a member names in a chat is an
--    observation. A new fact starts as 'candidate'; it becomes 'learned'
--    when 3 different people confirm it, or 'approved' when the owner says
--    yes in Telegram (or the admin page). Only learned/approved facts are
--    used by the bots; only owner-approved areas are added to the area
--    dropdowns. One person can never teach the system on their own.
--    Contributors are stored as a one-way hash, never as names or numbers.
-- 2. member_memory: what a member has told us they deal in (cities, areas,
--    property types, language) so Amaan can pick up where they left off.
--    Members can read and delete their own memory; nobody else can read it
--    except the server.
-- Samples never teach anything. No PII goes into shared knowledge.
-- ============================================================

create table if not exists public.kb_facts (
  id bigserial primary key,
  kind text not null check (kind in ('area', 'subarea', 'landmark', 'alias', 'note')),
  city text references public.cities(name) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  key text not null,
  detail jsonb not null default '{}'::jsonb,
  status text not null default 'candidate' check (status in ('candidate', 'learned', 'approved', 'rejected')),
  sources integer not null default 0,       -- distinct contributors
  seen integer not null default 0,          -- total observations
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_source text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  unique (kind, city, key)
);
create index if not exists kb_facts_status_idx on public.kb_facts(status, last_seen desc);

create table if not exists public.kb_fact_sources (
  fact_id bigint not null references public.kb_facts(id) on delete cascade,
  contributor text not null,                -- sha256 of the account id: counts people, identifies no one
  source text not null,
  created_at timestamptz not null default now(),
  primary key (fact_id, contributor)
);

create table if not exists public.member_memory (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 8192),
  updated_at timestamptz not null default now()
);

alter table public.kb_facts enable row level security;
alter table public.kb_fact_sources enable row level security;
alter table public.member_memory enable row level security;
revoke all on public.kb_facts, public.kb_fact_sources, public.member_memory from public, anon, authenticated;
grant all on public.kb_facts, public.kb_fact_sources, public.member_memory to service_role;
grant usage, select on sequence public.kb_facts_id_seq to service_role;
grant select on public.kb_facts to authenticated;
drop policy if exists "kb facts admins read" on public.kb_facts;
create policy "kb facts admins read" on public.kb_facts for select using (public.is_admin());
grant select, delete on public.member_memory to authenticated;
drop policy if exists "member memory own read" on public.member_memory;
create policy "member memory own read" on public.member_memory for select using (user_id = auth.uid());
drop policy if exists "member memory own delete" on public.member_memory;
create policy "member memory own delete" on public.member_memory for delete using (user_id = auth.uid());

create or replace function public.kb_key(p text) returns text language sql immutable
as $$ select trim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9؀-ۿ/ -]+', ' ', 'g'), '\s+', ' ', 'g')) $$;

-- One observation. Internal: called by the listing trigger and by the
-- server (service role) for chats. Returns the fact id.
create or replace function public.kb_observe(p_kind text, p_city text, p_name text, p_detail jsonb, p_source text, p_contributor text)
returns bigint language plpgsql security definer set search_path = public
as $$
declare
  v_role text := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
  v_id bigint; v_key text := public.kb_key(p_name);
begin
  if coalesce(v_role, '') not in ('service_role', '') and current_user not in ('postgres', 'supabase_admin') and not pg_trigger_depth() > 0 then
    raise exception 'Server only' using errcode = '42501';
  end if;
  if length(v_key) < 2 or length(p_name) > 120 or p_city is null or not exists (select 1 from public.cities where name = p_city) then return null; end if;
  insert into public.kb_facts (kind, city, name, key, detail, last_source)
  values (p_kind, p_city, trim(p_name), v_key, coalesce(p_detail, '{}'::jsonb), p_source)
  on conflict (kind, city, key) do update set last_seen = now(), last_source = excluded.last_source
  returning id into v_id;
  insert into public.kb_fact_sources (fact_id, contributor, source) values (v_id, encode(extensions.digest(coalesce(p_contributor, 'anon'), 'sha256'), 'hex'), p_source)
  on conflict do nothing;
  update public.kb_facts f set seen = seen + 1,
    sources = (select count(*) from public.kb_fact_sources s where s.fact_id = f.id),
    -- three different people → learned (the owner can still reject it)
    status = case when f.status = 'candidate' and (select count(*) from public.kb_fact_sources s where s.fact_id = f.id) >= 3 then 'learned' else f.status end
  where f.id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.kb_observe(text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.kb_observe(text, text, text, jsonb, text, text) to service_role;

-- Every genuine listing teaches its city + area (a known area just counts;
-- a new name, or a block inside a known area, becomes a candidate).
create or replace function public.kb_learn_from_listing()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_known text; v_kind text := 'area'; v_parent text;
begin
  if new.is_sample or new.city is null or coalesce(trim(new.area), '') = '' then return new; end if;
  if tg_op = 'UPDATE' and new.city is not distinct from old.city and new.area is not distinct from old.area then return new; end if;
  select a.name into v_known from public.areas a where a.city_name = new.city and lower(a.name) = lower(trim(new.area)) limit 1;
  if v_known is null then
    -- "Johar Town Block G": a block/sector inside a known area
    select a.name into v_parent from public.areas a
     where a.city_name = new.city and length(a.name) >= 4 and lower(trim(new.area)) like lower(a.name) || ' %'
     order by length(a.name) desc limit 1;
    if v_parent is not null then v_kind := 'subarea'; end if;
  end if;
  perform public.kb_observe(v_kind, new.city, coalesce(v_known, trim(new.area)),
    case when v_parent is not null then jsonb_build_object('parent', v_parent) else jsonb_build_object('known', v_known is not null) end,
    'listing', new.owner_id::text);
  return new;
exception when others then
  return new;            -- learning never blocks a listing
end;
$$;
drop trigger if exists listings_kb_learn on public.listings;
create trigger listings_kb_learn after insert or update of city, area on public.listings
  for each row execute function public.kb_learn_from_listing();

-- What the bots may use: known areas + learned/approved facts, with how
-- often each city was used for a name (so a border society's usual city
-- comes first). Public facts only (place names); no people.
create or replace function public.kb_known_places()
returns table (city text, area text, kind text, n integer)
language sql stable security definer set search_path = public
as $$
  select f.city, f.name, f.kind, f.sources from public.kb_facts f
   where f.status in ('learned', 'approved') and f.kind in ('area', 'subarea', 'alias')
  order by f.sources desc
  limit 2000
$$;
revoke execute on function public.kb_known_places() from public;
grant execute on function public.kb_known_places() to anon, authenticated, service_role;

-- Owner decision (Telegram via the server, or an admin on the website).
-- An approved area also joins the area dropdown for its city.
create or replace function public.kb_decide(p_id bigint, p_status text, p_by uuid default null)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_role text := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
  f public.kb_facts;
begin
  if not (coalesce(v_role, '') = 'service_role' or public.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'approved or rejected'; end if;
  update public.kb_facts set status = p_status, decided_by = coalesce(p_by, auth.uid()), decided_at = now() where id = p_id returning * into f;
  if f.id is null then raise exception 'Not found'; end if;
  if p_status = 'approved' and f.kind in ('area', 'subarea')
     and not exists (select 1 from public.areas a where a.city_name = f.city and lower(a.name) = lower(f.name)) then
    insert into public.areas (city_name, name, sort_order)
    values (f.city, f.name, coalesce((select max(sort_order) + 1 from public.areas where city_name = f.city), 1));
  end if;
  return f.name;
end;
$$;
revoke execute on function public.kb_decide(bigint, text, uuid) from public, anon;
grant execute on function public.kb_decide(bigint, text, uuid) to authenticated, service_role;

-- Member memory: the server merges small facts in (whitelisted keys only).
create or replace function public.member_remember(p_user uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_role text := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
  v_old jsonb; v_new jsonb; k text;
begin
  if coalesce(v_role, '') <> 'service_role' and auth.uid() is distinct from p_user then raise exception 'Own account only' using errcode = '42501'; end if;
  select data into v_old from public.member_memory where user_id = p_user;
  v_new := coalesce(v_old, '{}'::jsonb);
  for k in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if k in ('lang', 'last_intent') then v_new := v_new || jsonb_build_object(k, left(p_patch ->> k, 40));
    elsif k in ('cities', 'areas', 'types') then
      -- most recent first, unique, capped
      v_new := v_new || jsonb_build_object(k, (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select x from (select left(value, 60) x, min(o) o from (
          select value, ord o from jsonb_array_elements_text(p_patch -> k) with ordinality t(value, ord)
          union all select value, 100 + ord from jsonb_array_elements_text(coalesce(v_old -> k, '[]'::jsonb)) with ordinality t(value, ord)) u group by left(value, 60)) z
        order by o limit 8) y));
    end if;
  end loop;
  insert into public.member_memory (user_id, data, updated_at) values (p_user, v_new, now())
  on conflict (user_id) do update set data = excluded.data, updated_at = now();
  return v_new;
end;
$$;
revoke execute on function public.member_remember(uuid, jsonb) from public, anon;
grant execute on function public.member_remember(uuid, jsonb) to authenticated, service_role;
