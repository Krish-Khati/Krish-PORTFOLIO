-- Adds the automatic blog post system: a topic queue, an on/off publish setting, and a run
-- log, all editable from the admin panel's "Auto posts" page. Safe to run more than once.

create table if not exists auto_post_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text not null default '',
  category text not null check (category in ('Journey', 'Learning', 'Projects', 'AI', 'Marketing')),
  status text not null default 'pending' check (status in ('pending', 'used')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists auto_post_settings (
  id int primary key default 1 check (id = 1), -- single row
  publish_automatically boolean not null default false
);

insert into auto_post_settings (id, publish_automatically)
values (1, false)
on conflict (id) do nothing;

create table if not exists auto_post_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  topic text not null default '',
  status text not null check (status in ('success', 'failed')),
  message text not null default ''
);

alter table auto_post_topics enable row level security;
alter table auto_post_settings enable row level security;
alter table auto_post_runs enable row level security;

-- Only the signed-in admin manages these from the admin panel. The scheduled GitHub Action
-- uses the service_role key, which bypasses Row Level Security entirely, so it needs no policy.
drop policy if exists "admin manages auto post topics" on auto_post_topics;
create policy "admin manages auto post topics" on auto_post_topics for all to authenticated using (true) with check (true);

drop policy if exists "admin manages auto post settings" on auto_post_settings;
create policy "admin manages auto post settings" on auto_post_settings for all to authenticated using (true) with check (true);

drop policy if exists "admin manages auto post runs" on auto_post_runs;
create policy "admin manages auto post runs" on auto_post_runs for all to authenticated using (true) with check (true);

-- Model-picker memory for the auto blog post script (scripts/src/auto-blog-post.ts). All three
-- are stored as "<provider>:<model>" (blocked_models is a comma-separated list of those).
-- last_working_model: tried first on the next run.
-- last_overloaded_model: the model that returned 503 most recently; deprioritized next run, and
--   cleared back to null on any run where nothing was overloaded.
-- blocked_models: models that returned 404 "no longer available" — excluded permanently.
alter table auto_post_settings add column if not exists last_working_model text;
alter table auto_post_settings add column if not exists last_overloaded_model text;
alter table auto_post_settings add column if not exists blocked_models text;
