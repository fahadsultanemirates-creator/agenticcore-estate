-- ============================================================
-- 0025 — One Telegram update at a time per chat.
--
-- Telegram delivers updates in parallel (an album of photos is several
-- updates arriving together; a button can be tapped while a photo is still
-- uploading). Each update loads the chat's session, works, and saves it —
-- so the last one to finish overwrote the others: album photos were lost,
-- and an order review could be rolled back so "Place order" did nothing.
--
-- The bot now takes a short lock per chat before it loads the session and
-- releases it after saving. Other chats are never blocked. A lock left by
-- a crashed run expires by itself. Server only (service role).
-- Safe to run more than once.
-- ============================================================

create table if not exists public.tg_chat_locks (
  chat_id bigint primary key,
  until timestamptz not null
);
alter table public.tg_chat_locks enable row level security;
revoke all on public.tg_chat_locks from public, anon, authenticated;
grant all on public.tg_chat_locks to service_role;

-- true = this run holds the lock for p_seconds; false = another run has it
create or replace function public.tg_lock(p_chat bigint, p_seconds integer default 30)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  insert into public.tg_chat_locks (chat_id, until) values (p_chat, now() + make_interval(secs => least(greatest(p_seconds, 5), 60)))
  on conflict (chat_id) do update set until = excluded.until where public.tg_chat_locks.until < now();
  return found;
end;
$$;

create or replace function public.tg_unlock(p_chat bigint)
returns void language sql security definer set search_path = public
as $$ delete from public.tg_chat_locks where chat_id = p_chat $$;

revoke execute on function public.tg_lock(bigint, integer) from public, anon, authenticated;
revoke execute on function public.tg_unlock(bigint) from public, anon, authenticated;
grant execute on function public.tg_lock(bigint, integer) to service_role;
grant execute on function public.tg_unlock(bigint) to service_role;
