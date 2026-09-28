-- Adds the "My Capabilities" tools + stats to the database so they're editable from the
-- admin panel. Safe to run more than once — run it once in the Supabase SQL editor.

create table if not exists tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists stats (
  id uuid primary key default gen_random_uuid(),
  value text not null,
  label text not null,
  sort_order int not null default 0
);

alter table tools enable row level security;
alter table stats enable row level security;

drop policy if exists "public reads tools" on tools;
drop policy if exists "admin manages tools" on tools;
create policy "public reads tools" on tools for select using (true);
create policy "admin manages tools" on tools for all to authenticated using (true) with check (true);

drop policy if exists "public reads stats" on stats;
drop policy if exists "admin manages stats" on stats;
create policy "public reads stats" on stats for select using (true);
create policy "admin manages stats" on stats for all to authenticated using (true) with check (true);

-- Seed with what's currently hardcoded on the site — only when the tables are still empty,
-- so running this file again never creates duplicates.
insert into tools (name, logo_url, sort_order)
select * from (values
  ('Claude', '', 0),
  ('GitHub Copilot', '', 1),
  ('ChatGPT', '', 2),
  ('VS Code', '', 3),
  ('GitHub', '', 4),
  ('Figma', '', 5),
  ('ElevenLabs', '', 6),
  ('Deepgram', '', 7),
  ('Cartesia AI', '', 8),
  ('LiveKit', '', 9)
) as seed(name, logo_url, sort_order)
where not exists (select 1 from tools);

insert into stats (value, label, sort_order)
select * from (values
  ('500+', 'Development Hours', 0),
  ('5+', 'Projects Built', 1),
  ('3+', 'Languages Known', 2)
) as seed(value, label, sort_order)
where not exists (select 1 from stats);

-- Tool logos reuse the "covers" storage bucket (created in add-post-covers.sql) under a
-- "tools/" folder — no new bucket or storage policy needed. Run add-post-covers.sql first
-- if this project doesn't have that bucket yet.
