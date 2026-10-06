-- LinguaBridge: set the gallery to the Playwright screenshot taken on 06-10-2026
-- (public/projects/linguabridge.png, 1440x1000). Safe to run more than once.
update public.projects
set gallery = '[
  {
    "url": "/projects/linguabridge.png",
    "alt": "LinguaBridge - AI Translation App Showing Text Translation and Voice Interpreter Panels",
    "caption": "",
    "width": 1440,
    "height": 1000
  }
]'::jsonb
where slug = 'linguabridge';

select name, gallery
from public.projects
where slug = 'linguabridge';
