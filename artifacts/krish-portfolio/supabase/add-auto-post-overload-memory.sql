-- Lets the auto blog post script remember which AI model returned 503 (overloaded) on the most
-- recent run, so the next run doesn't immediately retry that same busy model first. Stored as
-- "<provider>:<model>", same format as last_working_model, and cleared to null on any run where
-- nothing was overloaded. Safe to run more than once.

alter table auto_post_settings add column if not exists last_overloaded_model text;
