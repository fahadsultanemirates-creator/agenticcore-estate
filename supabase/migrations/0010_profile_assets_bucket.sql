-- ============================================================
-- AgenticCore Estate — profile-assets storage bucket
-- ------------------------------------------------------------
-- Public bucket for agency and builder logos (promotional images,
-- same public-read model as listing-photos and project-assets).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('profile-assets', 'profile-assets', true)
on conflict (id) do nothing;

create policy "profile assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-assets');

create policy "profile assets are uploadable by authenticated owners"
  on storage.objects for insert
  with check (bucket_id = 'profile-assets' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "profile assets are updatable by their owner"
  on storage.objects for update
  using (bucket_id = 'profile-assets' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "profile assets are deletable by their owner"
  on storage.objects for delete
  using (bucket_id = 'profile-assets' and auth.uid()::text = (storage.foldername(name))[1]);
