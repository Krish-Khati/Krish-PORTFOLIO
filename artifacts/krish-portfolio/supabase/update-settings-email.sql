-- Contact email change: dhimankrish10@gmail.com -> krrishai0916@gmail.com
--
-- Idempotent: the jsonb merge is a no-op the second time it runs, so this is safe to re-run.
-- Run with the Supabase MCP (apply_migration), then verify with the select at the bottom.

update public.site_settings
set data = data || '{"email": "krrishai0916@gmail.com"}'::jsonb
where id = 1
  and data->>'email' is distinct from 'krrishai0916@gmail.com';

-- Verify: expect krrishai0916@gmail.com
select data->>'email' as email
from public.site_settings
where id = 1;
