-- Enable Storage
insert into storage.buckets (id, name, public)
values ('carteirinha-uploads', 'carteirinha-uploads', true)
on conflict (id) do nothing;

-- Allow public uploads (for join requests)
create policy "Public Uploads"
  on storage.objects for insert
  to public
  with check ( bucket_id = 'carteirinha-uploads' );

-- Allow public viewing
create policy "Public Access"
  on storage.objects for select
  to public
  using ( bucket_id = 'carteirinha-uploads' );
