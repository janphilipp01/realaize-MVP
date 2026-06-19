import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Strip sslmode from the URL — recent `pg` versions treat `sslmode=require` as
// `verify-full`, which fails against Supabase's self-signed pooler chain.
// We set ssl explicitly instead.
const connectionString = process.env.DATABASE_URL.replace(
  /([?&])sslmode=[^&]*&?/g,
  "$1",
).replace(/[?&]$/, "");

// Keep the pool small in serverless environments (e.g. Vercel Functions),
// where many short-lived instances each open their own pool against the
// Supabase transaction pooler. Override via DB_POOL_MAX (default 10 for
// long-running servers; set to 1 on serverless).
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX ?? 10),
});
export const db = drizzle(pool, { schema });

// Drizzle's transaction handle has the same query API as `db`.
type ScopedDb = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run `fn` inside a transaction that has `app.user_id` set to the caller's
 * Supabase auth UUID, so RLS policies (which read `auth_helpers.uid()`) apply.
 *
 * Always use this for any request-scoped DB work in the api-server. Passing
 * `null` runs unscoped — only do that for system tasks (cron jobs, seeds)
 * that legitimately need to bypass RLS by virtue of running with elevated
 * privileges.
 */
export async function withUserScope<T>(
  authId: string | null,
  fn: (tx: ScopedDb) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    if (authId) {
      // Third argument `true` = SET LOCAL — scoped to this transaction.
      await tx.execute(sql`select set_config('app.user_id', ${authId}, true)`);
    }
    return await fn(tx);
  });
}

export * from "./schema";
