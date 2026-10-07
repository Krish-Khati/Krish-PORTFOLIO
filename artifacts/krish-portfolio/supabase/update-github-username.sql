-- Username rebrand: KRRISH972 -> krish-khati (GitHub), plus the new Instagram / LinkedIn
-- profile links and the display name "Krish Khati".
--
-- Idempotent: every statement is a no-op the second time it runs, so this is safe to re-run.
-- Run with the Supabase MCP (apply_migration), then verify with the selects at the bottom.

-- 1. Projects: swap only the username part of each GitHub URL (repo names are untouched).
update public.projects
set github_url = replace(github_url, 'github.com/KRRISH972', 'github.com/krish-khati')
where github_url like '%github.com/KRRISH972%';

-- 2. Site settings: shallow jsonb merge so tagline/email/phone/location/roles/youtube stay as they are.
update public.site_settings
set data = data || '{
  "name": "Krish Khati",
  "github": "https://github.com/krish-khati",
  "instagram": "https://www.instagram.com/krish_khati_/",
  "linkedin": "https://www.linkedin.com/in/krish-khati/"
}'::jsonb
where id = 1;

-- Verify: expect 3 github_url values under krish-khati, and the settings row below.
select name, github_url from public.projects order by position;

select data->>'name'      as name,
       data->>'github'    as github,
       data->>'instagram' as instagram,
       data->>'linkedin'  as linkedin,
       data->>'youtube'   as youtube
from public.site_settings
where id = 1;
