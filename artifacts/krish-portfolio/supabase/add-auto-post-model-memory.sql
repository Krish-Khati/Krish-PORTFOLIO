-- Lets the auto blog post script remember which AI model last worked, so it tries that one
-- first on the next run instead of starting from the top of the ranked list every time.
-- Stored as "<provider>:<model>", e.g. "gemini:gemini-flash-latest". Safe to run more than once.

alter table auto_post_settings add column if not exists last_working_model text;
