-- Supabase schema for the Krish portfolio admin panel (NOT applied yet).
-- Matches the types in src/admin/api.ts. Run in the Supabase SQL editor when connecting.

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  category text not null check (category in ('Journey', 'Learning', 'Projects', 'AI', 'Marketing')),
  date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'published')),
  blocks jsonb not null default '[]'::jsonb,
  cover text not null default '', -- cover image URL (see add-post-covers.sql for the storage bucket)
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  url text not null default '',
  image text not null default '', -- project thumbnail URL (see add-post-covers.sql for the storage bucket)
  position int not null default 0
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  -- limits keep the public contact form from being used to dump huge payloads
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now(),
  read boolean not null default false
);

create table if not exists site_settings (
  id int primary key default 1 check (id = 1), -- single row
  data jsonb not null
);

-- Row Level Security: visitors can read published content and send messages;
-- only signed-in users (the admin) can change anything.
alter table posts enable row level security;
alter table projects enable row level security;
alter table messages enable row level security;
alter table site_settings enable row level security;

create policy "public reads published posts" on posts for select using (status = 'published');
create policy "admin manages posts" on posts for all to authenticated using (true) with check (true);

create policy "public reads projects" on projects for select using (true);
create policy "admin manages projects" on projects for all to authenticated using (true) with check (true);

create policy "anyone can send a message" on messages for insert with check (true);
create policy "admin manages messages" on messages for all to authenticated using (true) with check (true);

create policy "public reads settings" on site_settings for select using (true);
create policy "admin manages settings" on site_settings for all to authenticated using (true) with check (true);

-- Note: "authenticated" means ANY signed-in user. Disable public sign-ups in
-- Supabase Auth settings so only the admin account exists.

-- Cover image storage: run add-post-covers.sql as well.
-- Existing project table without the image column: run add-project-images.sql.
-- heroImage / aboutPhoto settings need no migration — they're just new keys in site_settings.data.
