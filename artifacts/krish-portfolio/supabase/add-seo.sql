-- SEO fields for blog posts — ALL the new columns for the SEO update, in one file.
-- Safe to run more than once (every line uses "if not exists").
-- Run it once in Supabase → SQL Editor → New query → paste → Run.
--
-- The site, admin panel and scripts all keep working before this is run (they log a warning and
-- skip these fields); running it simply lets the SEO fields be saved.

alter table posts add column if not exists seo_title text not null default '';        -- <title> in Google, max 60 characters
alter table posts add column if not exists meta_description text not null default ''; -- snippet under the title, 140–160 characters
alter table posts add column if not exists focus_keyword text not null default '';    -- the long-tail search phrase the post targets
alter table posts add column if not exists faqs jsonb not null default '[]'::jsonb;   -- [{ "question": "...", "answer": "..." }]
alter table posts add column if not exists cover_alt text not null default '';        -- alt text for the cover image

-- Makes the new columns visible to the API right away (otherwise it can take a minute).
notify pgrst, 'reload schema';
