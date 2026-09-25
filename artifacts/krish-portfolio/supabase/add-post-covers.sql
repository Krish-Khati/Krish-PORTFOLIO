-- Adds cover images to blog posts. Safe to run more than once.
-- Run it once in Supabase → SQL Editor on a project created from an older schema.sql.

alter table posts add column if not exists cover text not null default '';

-- Public bucket for cover images: anyone can view them, only the signed-in admin can change them.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update set public = true;

drop policy if exists "admin uploads covers" on storage.objects;
drop policy if exists "admin updates covers" on storage.objects;
drop policy if exists "admin deletes covers" on storage.objects;
create policy "admin uploads covers" on storage.objects for insert to authenticated with check (bucket_id = 'covers');
create policy "admin updates covers" on storage.objects for update to authenticated using (bucket_id = 'covers');
create policy "admin deletes covers" on storage.objects for delete to authenticated using (bucket_id = 'covers');
