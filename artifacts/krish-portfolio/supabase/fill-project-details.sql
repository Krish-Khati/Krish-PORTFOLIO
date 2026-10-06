-- Fills in slugs, live links, screenshots, tags, descriptions and meta descriptions for the four
-- featured projects, so the live database matches src/data/projects.ts.
-- Screenshots are the static files in public/projects/*.png; they are referenced by their public path.
--
-- Idempotent: every statement only updates the row it matches, so this is safe to run more than once.
-- Run with the Supabase MCP (apply_migration), then verify with the select at the bottom.

update projects set
  slug = 'fitness-temple',
  description = 'A modern, high-energy gym website for "Fitness Temple" featuring a hero section, programs/disciplines showcase, stats bar (ratings, members, years active), and a sleek black-and-red themed UI with smooth navigation.',
  meta_description = 'Gym website design for Fitness Temple: hero section, programs showcase, stats bar and a sleek black-and-red themed UI.',
  live_url = 'https://fitness-temple-k0r76nt7c-kisshu1.vercel.app/',
  github_url = 'https://github.com/KRRISH972/FITNESS_TEMPLE',
  tech_stack = '["Web Design", "Responsive Design", "React", "Gym Website", "UI/UX"]'::jsonb,
  gallery = '[{"url": "/projects/fitness-temple.png", "alt": "Fitness Temple - Gym Website Homepage Screenshot showing hero section and programs", "caption": "", "width": 1440, "height": 1000}]'::jsonb,
  updated_at = now()
where name = 'Fitness Temple';

update projects set
  slug = 'memory-match-game',
  description = 'An interactive memory-matching arcade game with a modern gradient UI, built with real-time audio components and an engaging "Launch Arcade" entry screen.',
  meta_description = 'Memory match game arcade with a modern gradient UI, real-time audio and an engaging "Launch Arcade" entry screen.',
  live_url = 'https://memory-match-ashy.vercel.app/',
  github_url = 'https://github.com/KRRISH972/MEMORY-MATCH',
  tech_stack = '["Game Development", "JavaScript", "Browser Game", "UI/UX"]'::jsonb,
  gallery = '[{"url": "/projects/memory-match.png", "alt": "Memory Match - Browser Based Memory Arcade Game Launch Screen", "caption": "", "width": 1440, "height": 1000}]'::jsonb,
  updated_at = now()
where name = 'Memory Match Game';

update projects set
  slug = 'linguabridge',
  description = 'An AI-powered language translation tool that bridges communication across languages using AI.',
  meta_description = 'AI language translator that bridges communication across languages using AI, built by Krish.',
  live_url = 'https://linguabridge.ai.studio',
  github_url = 'https://github.com/KRRISH972/LINGUABRIDGE-',
  tech_stack = '["AI", "NLP", "Translation", "Web App"]'::jsonb,
  gallery = '[]'::jsonb,
  updated_at = now()
where name = 'LinguaBridge';

update projects set
  slug = 'calculator',
  description = 'A sleek, modern calculator app with a dark-themed UI, circular button design, and smooth interactions for basic arithmetic operations.',
  meta_description = 'Calculator app UI with a dark theme, circular buttons and smooth interactions for basic arithmetic operations.',
  live_url = '#',
  github_url = '',
  tech_stack = '["JavaScript", "UI Design", "Calculator App"]'::jsonb,
  gallery = '[{"url": "/projects/calculator.png", "alt": "Calculator App - Dark Theme UI with Circular Buttons", "caption": "", "width": 600, "height": 333}]'::jsonb,
  updated_at = now()
where name = 'Calculator';

-- Removed from the site (src/data/projects.ts, supabase/seed.sql, public/llms.txt): deleting the
-- row also drops /projects/m2f-gym-website from the prerendered pages and the sitemap.
delete from projects where name = 'M2F Gym Website';

select name, slug, live_url, github_url, meta_description, tech_stack, gallery
from projects
order by position;
