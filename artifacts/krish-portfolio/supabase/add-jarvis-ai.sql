-- Jarvis AI Assistant — new project row (GitHub repo only, no live demo, desktop app so no screenshot).
-- Idempotent: safe to run more than once (skips if the slug or name already exists).
-- Run in the Supabase SQL Editor, then verify with the select at the bottom.

insert into projects (
  name, slug, description, meta_description, long_description,
  features, tech_stack, github_url, live_url, gallery, position, featured, updated_at
)
select
  'Jarvis AI Assistant',
  'jarvis-ai-assistant',  -- matches slugify('Jarvis AI Assistant') used by the static starter
  'Krish''s personal AI assistant for Windows: offline Hey Jarvis wake word, Hinglish voice conversation with a Gemini brain and Groq backup, a full-screen sci-fi HUD with system tray, plus WhatsApp messaging, screen vision and long-term memory.',
  'Windows AI assistant with offline Hey Jarvis wake word, Gemini brain with Groq backup, sci-fi HUD, WhatsApp automation, screen vision and memory.',
  'JARVIS is Krish''s personal AI assistant for Windows. You say or type in Hinglish, it listens, thinks, controls the PC and answers in a British voice, with a full-screen sci-fi HUD and a system tray behind it. The wake word runs offline on CPU with openWakeWord''s hey_jarvis ONNX model and a Vosk backup, so it stays dormant at about 1% CPU until called. Speech-to-text runs through a fallback chain of Groq Whisper, Gemini transcribe and Google — each call counted, with the next engine taking over on a limit or error — and the brain is Gemini with Groq (gpt-oss-120b) stepping in automatically when the free quota runs out, both sharing one conversation history.

Beyond conversation it operates the machine: local shortcuts answer time, date, battery, weather and app launch in a second without AI; tools do web search, YouTube, volume, screenshots, lock and shutdown; long-term memory stores facts you ask it to remember; and screen vision answers questions about what is on the screen without ever saving the capture to disk. It can also drive WhatsApp Desktop like a person — searching the contact, opening the right chat, confirming before sending or calling, and reading incoming messages from notifications — with a safety lock that only lets dangerous tools run when the current message asked for them, a DRY_RUN test mode, and confirmation prompts before anything destructive.',
  '["Offline Hey Jarvis wake word via openWakeWord ONNX with Vosk backup — no internet needed", "Speech-to-text fallback chain: Groq Whisper, Gemini transcribe and Google, then ElevenLabs or edge-tts voice replies", "Gemini main brain with automatic Groq (gpt-oss-120b) backup and one shared conversation history", "Full-screen sci-fi HUD with system tray, live CPU/RAM/battery/network stats, activity log and dock buttons", "WhatsApp Desktop automation — send messages and place or end calls with confirmation, reading incoming notifications", "Long-term memory, screen vision, and local shortcuts for time, weather, apps and PC power controls"]'::jsonb,
  '["Python", "Gemini", "Groq", "Vosk", "pywebview", "ElevenLabs"]'::jsonb,
  'https://github.com/Krish-Khati/jarvis-ai',
  '',  -- no live demo: local Windows desktop app
  '[]'::jsonb, -- no screenshot: desktop app, no live UI to capture
  (select coalesce(max(position), -1) + 1 from projects),
  false,
  now()
where not exists (
  select 1 from projects
  where slug = 'jarvis-ai-assistant' or name = 'Jarvis AI Assistant'
);

select name, slug, github_url, live_url, tech_stack, gallery, position, featured
from projects
order by position;
