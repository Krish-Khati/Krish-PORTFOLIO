-- Zedking Messenger Bot — new project row (GitHub repo only, no live demo).
-- Idempotent: safe to run more than once (skips if the slug or name already exists).
-- Run with the Supabase MCP (apply_migration), then verify with the select at the bottom.

insert into projects (
  name, slug, description, meta_description, long_description,
  features, tech_stack, github_url, live_url, gallery, position, featured, updated_at
)
select
  'Zedking Messenger Bot',
  'zedking-messenger-bot',
  'AI-powered Facebook Messenger automation bot for Zedking Institute (Kaithal, Haryana) — answers DMs in Hindi, English and Hinglish with Groq LLM, grounded in real course and fee data.',
  'AI-powered Facebook Messenger bot for Zedking Institute: Hindi, English and Hinglish DM auto-replies powered by Groq LLM, grounded in real course and fee data.',
  'Zedking Messenger Bot is a Facebook Messenger automation tool for Zedking Institute in Kaithal, Haryana. It uses only the official Meta Graph API / Messenger Platform, and answers page DMs with an AI reply instead of a fixed keyword list.

The reply path is deliberately small: the message goes to a Groq LLM (openai/gpt-oss-20b) with a system prompt built around a single knowledge-base file that holds the institute''s courses, fees, location, timings and contact details. The model is told to answer only from that text, so it cannot invent fees or course names, to reply in the language the user wrote in, and to send unrelated questions back to institute topics. If the API fails for any reason, the user still gets a safe fallback reply pointing at the phone number rather than silence.

Security and cost come before cleverness. Every webhook POST is checked against Meta''s X-Hub-Signature-256 header with a constant-time HMAC comparison that fails closed, requests are rate-limited per sender, and a daily cap keeps one person from spending the whole API quota. Every event is logged to a file that survives restarts, and a watchdog process restarts the server if it dies, so a crash between answering and replying does not lose the message.

The repo ships with offline tests (node --test) that need no network and no tokens.',
  '["Webhook verification plus HMAC-SHA256 signature check on every request", "AI replies grounded in a single course & fee knowledge base — no invented prices", "Replies in the detected language: Hindi, English or Hinglish", "Per-sender rate limiting and a daily AI quota cap", "Persistent file logging and an auto-restart watchdog process"]'::jsonb,
  '["Node.js", "Express", "Meta Graph API", "Groq LLM", "Facebook Messenger"]'::jsonb,
  'https://github.com/Krish-Khati/zedking-messenger-bot',
  '',  -- no live demo
  '[]'::jsonb, -- no screenshot yet: the UI shows the "Screenshots coming soon" placeholder
  (select coalesce(max(position), -1) + 1 from projects),
  false,
  now()
where not exists (
  select 1 from projects
  where slug = 'zedking-messenger-bot' or name = 'Zedking Messenger Bot'
);

select name, slug, github_url, live_url, tech_stack, gallery, position, featured
from projects
order by position;
