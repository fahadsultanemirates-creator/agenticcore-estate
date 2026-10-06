-- ============================================================
-- 0030 — Dealer AI: columns for the three-source search.
--
-- The best-3 search also sends website and partner results to buyers with
-- an open request; feed_requests remembers which were sent (sent_refs) and
-- when the website / partner were last checked (checked_at).
-- 0029 as later published already has them; this makes sure they exist
-- wherever the earlier 0029 ran. Safe to run more than once.
-- ============================================================

alter table public.feed_requests add column if not exists sent_refs text[] not null default '{}';
alter table public.feed_requests add column if not exists checked_at timestamptz;
