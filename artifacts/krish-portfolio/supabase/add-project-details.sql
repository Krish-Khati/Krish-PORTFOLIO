-- Project details + screenshot galleries — ALL the new columns for the project redesign, in one file.
-- Safe to run more than once (every statement uses "if not exists" or is idempotent).
-- Run it once in Supabase → SQL Editor → New query → paste → Run.
--
-- Existing projects keep working before and after this is run: the site, admin panel and build
-- skip any column that doesn't exist yet (with a warning), and after it runs the old single "url"
-- and "image" of each project are still used until you fill in the new fields.

-- Older single thumbnail (was add-project-images.sql) — becomes the first gallery image.
alter table projects add column if not exists image text not null default '';

alter table projects add column if not exists slug text not null default '';             -- /projects/<slug>; empty = made from the name
alter table projects add column if not exists badge text not null default '';            -- "Flagship", "Live", "In progress", …
alter table projects add column if not exists long_description text not null default ''; -- the write-up on the project's own page
alter table projects add column if not exists features jsonb not null default '[]'::jsonb;   -- ["Key feature", …]
alter table projects add column if not exists tech_stack jsonb not null default '[]'::jsonb; -- ["React", "Supabase", …]
alter table projects add column if not exists live_url text not null default '';
alter table projects add column if not exists github_url text not null default '';
alter table projects add column if not exists play_store_url text not null default '';
alter table projects add column if not exists video_url text not null default '';        -- YouTube or video file, shown as a gallery item
alter table projects add column if not exists featured boolean not null default false;    -- featured projects are the ones shown on the home page
alter table projects add column if not exists meta_description text not null default ''; -- Google snippet, 140–160 characters
alter table projects add column if not exists gallery jsonb not null default '[]'::jsonb;
  -- [{ "url", "thumb", "alt", "caption", "width", "height" }, …] — the first image is the cover
alter table projects add column if not exists updated_at timestamptz not null default now(); -- sitemap <lastmod>

-- No two projects can share a URL (empty slugs are allowed — those use the name).
create unique index if not exists projects_slug_unique on projects (slug) where slug <> '';

-- Screenshot uploads use the same public "covers" bucket as blog cover images (same as
-- add-post-covers.sql — repeated here so this one file is enough on its own).
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update set public = true;

drop policy if exists "admin uploads covers" on storage.objects;
drop policy if exists "admin updates covers" on storage.objects;
drop policy if exists "admin deletes covers" on storage.objects;
create policy "admin uploads covers" on storage.objects for insert to authenticated with check (bucket_id = 'covers');
create policy "admin updates covers" on storage.objects for update to authenticated using (bucket_id = 'covers');
create policy "admin deletes covers" on storage.objects for delete to authenticated using (bucket_id = 'covers');

-- Makes the new columns visible to the API right away (otherwise it can take a minute).
notify pgrst, 'reload schema';
