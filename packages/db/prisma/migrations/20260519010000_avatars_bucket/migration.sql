insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Anyone can upload avatar"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'avatars');

create policy "Anyone can update avatar"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy "Public read avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');
