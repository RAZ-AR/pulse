-- Create Supabase Storage buckets for photo uploads
-- Requires: Supabase project with Storage enabled

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('checkins', 'checkins', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('receipts', 'receipts', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Allow any authenticated user to upload to checkins
create policy "Authenticated users can upload checkins"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'checkins');

-- Allow public read of checkins
create policy "Public read checkins"
  on storage.objects for select
  to public
  using (bucket_id = 'checkins');

-- Allow authenticated user to upload to receipts
create policy "Authenticated users can upload receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts');

-- Allow public read of receipts
create policy "Public read receipts"
  on storage.objects for select
  to public
  using (bucket_id = 'receipts');
