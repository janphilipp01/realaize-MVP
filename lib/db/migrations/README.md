# DB Migrations

Two migration channels:

1. **Drizzle schema** (`src/schema/*.ts`) — applied via `pnpm --filter @workspace/db run push`. Handles tables, columns, enums, indexes, foreign keys.

2. **SQL files in this directory** — applied **manually** in numeric order via `psql` or the Supabase SQL editor. Used for things drizzle-kit can't (yet) express idiomatically: RLS policies, helper functions, triggers, seed data.

## Order

Apply Drizzle push **first** (so tables exist), then SQL files in numeric order.

```bash
# 1. Push schema
pnpm --filter @workspace/db run push

# 2. Apply RLS + triggers
psql "$DATABASE_URL" -f lib/db/migrations/0001_rls.sql
psql "$DATABASE_URL" -f lib/db/migrations/0002_supabase_user_trigger.sql
```

All SQL files are idempotent (`drop ... if exists` + `create or replace`) — re-running is safe.

## When you add a new domain table

1. Add the Drizzle schema file in `src/schema/<entity>.ts`, export it from `src/schema/index.ts`.
2. Run `pnpm --filter @workspace/db run push` to create the table.
3. Add a new SQL migration file `NNNN_<entity>_rls.sql` with the standard 4 policies (SELECT, INSERT, UPDATE, DELETE) using `auth_helpers.can_read / can_write / is_admin`.
4. Apply it via `psql`.
