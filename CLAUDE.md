# Krish Portfolio

## Database (Supabase)

The live Supabase project is connected through the Supabase MCP server (`.mcp.json`). Run database
migrations yourself with it — don't ask the user to paste SQL into the dashboard.

Rules for all database work:

- **File first.** Always write the change to a `.sql` file in `artifacts/krish-portfolio/supabase/`
  first, using `if not exists` (or another idempotent form) so it is safe to run more than once.
  Then apply it with the Supabase MCP (`apply_migration`) and verify it with a query (tables,
  columns, policies, seeded rows).
- **Additive only.** Only additive changes: create table, add column, add policy, create index,
  insert seed rows guarded against duplicates. Never `DROP`, `TRUNCATE`, `DELETE` data, or disable
  RLS without asking the user first and waiting for their explicit "yes".
- **Database before deploy.** After any code change that needs a database change, apply and verify
  the migration before pushing, so the live site and scheduled runs never fail on missing tables or
  columns.
