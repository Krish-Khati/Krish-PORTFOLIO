-- Adds the scrolling ticker under the hero ("ALWAYS BUILDING • PYTHON • …") to the database so
-- it's editable from the admin panel (Settings → Ticker). Safe to run more than once — run it
-- once in the Supabase SQL editor. Until it's run, the site shows the default items.

create table if not exists ticker_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  icon text not null default '',   -- '', 'code', 'sparkle', 'film' or 'database'
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- A single row (id = 1): the optional second, reverse-scrolling row shown on desktop.
create table if not exists ticker_settings (
  id int primary key default 1 check (id = 1),
  show_second_row boolean not null default true,
  second_row text[] not null default array['LEARN', 'BUILD', 'SHIP', 'REPEAT']
);

alter table ticker_items enable row level security;
alter table ticker_settings enable row level security;

drop policy if exists "public reads ticker items" on ticker_items;
drop policy if exists "admin manages ticker items" on ticker_items;
create policy "public reads ticker items" on ticker_items for select using (true);
create policy "admin manages ticker items" on ticker_items for all to authenticated using (true) with check (true);

drop policy if exists "public reads ticker settings" on ticker_settings;
drop policy if exists "admin manages ticker settings" on ticker_settings;
create policy "public reads ticker settings" on ticker_settings for select using (true);
create policy "admin manages ticker settings" on ticker_settings for all to authenticated using (true) with check (true);

-- Seed with the default items — only when the table is still empty, so running this file again
-- never creates duplicates or overwrites your edits.
insert into ticker_items (label, icon, sort_order)
select * from (values
  ('ALWAYS BUILDING', '', 0),
  ('PYTHON', 'code', 1),
  ('C / C++', '', 2),
  ('AI TOOLS', 'sparkle', 3),
  ('CLAUDE CODE', '', 4),
  ('SUPABASE', 'database', 5),
  ('WEB EXPERIMENTS', '', 6),
  ('VIDEO EDITING', 'film', 7),
  ('CONTENT CREATION', '', 8),
  ('GIT & GITHUB', '', 9),
  ('LOGIC FIRST', '', 10)
) as seed(label, icon, sort_order)
where not exists (select 1 from ticker_items);

insert into ticker_settings (id) values (1) on conflict (id) do nothing;
