-- NovaChat — new project row (live demo + GitHub repo + real screenshot).
-- Idempotent: safe to run more than once (skips if the slug or name already exists).
-- Run in the Supabase SQL Editor, then verify with the select at the bottom.

insert into projects (
  name, slug, description, meta_description, long_description,
  features, tech_stack, github_url, live_url, gallery, position, featured, updated_at
)
select
  'NovaChat',
  'novachat',  -- matches slugify('NovaChat') used by the static starter
  'NovaChat is a personal ChatGPT-style assistant: streaming chat, Cartesia voice conversation, Google Search grounding, and a multi-conversation memory — in one crafted, dark-first interface.',
  'NovaChat is a personal ChatGPT-style assistant: streaming chat, Cartesia voice, Google Search grounding and multi-conversation memory.',
  'NovaChat is a personal, ChatGPT-style AI assistant — streaming chat, voice-to-voice conversation, Google Search grounding, and multi-conversation memory. It is fully wired to real APIs: Groq for chat completions, Cartesia for voice, and SerpApi for search, all proxied through local Next.js API routes so keys never touch the browser.

Voice mode runs a real state machine (listening → transcribing → thinking → speaking → listening) with energy-based VAD endpointing and barge-in: sustained user speech during playback cuts the TTS and starts a new utterance. Chat history persists across conversations in localStorage, while API keys are held in memory for the session only. The design is dark-first with a warm ''Ember'' accent instead of the default blue AI gradient, and every external call fails with an actionable toast rather than a crash.',
  '["Streaming chat over Groq with SSE phases, markdown and code highlighting", "Voice-to-voice conversation: Cartesia TTS/STT with VAD endpointing and barge-in", "Google Search grounding through SerpApi with citation chips in the reply", "Multi-conversation memory persisted in localStorage; API keys never stored", "Every upstream call proxied through Next.js API routes — keys never reach the browser", "Dark-first \"Ember\" theme with first-class light, dark and system modes"]'::jsonb,
  '["Next.js", "React", "TypeScript", "Tailwind CSS", "Zustand", "Framer Motion"]'::jsonb,
  'https://github.com/Krish-Khati/NovaChat',
  'https://nova-chat-blue.vercel.app/',
  '[{"url":"/projects/novachat.png","alt":"NovaChat dark-first interface with Good afternoon Krish greeting, New chat sidebar, Ask NovaChat composer with Search and Think toggles and suggestion chips","caption":"","width":1440,"height":1000}]'::jsonb, -- real screenshot of the live site
  (select coalesce(max(position), -1) + 1 from projects),
  false,
  now()
where not exists (
  select 1 from projects
  where slug = 'novachat' or name = 'NovaChat'
);

select name, slug, github_url, live_url, tech_stack, gallery, position, featured
from projects
order by position;
