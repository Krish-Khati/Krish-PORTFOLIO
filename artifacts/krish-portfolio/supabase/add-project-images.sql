-- Adds an image field to projects. Safe to run more than once.
-- Run it once in Supabase → SQL Editor. Uploads reuse the "covers" bucket set up in
-- add-post-covers.sql, so run that first if you haven't already.

alter table projects add column if not exists image text not null default '';
