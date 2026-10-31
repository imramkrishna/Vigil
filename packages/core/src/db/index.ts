import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(path.resolve(__dirname, "../../../../.env"));
  } catch {
    // Ignore if root .env is not present
  }
}

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://vigil:vigil@localhost:5432/vigil";

export const pool = new Pool({
  connectionString,
  max: 20,
});

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs a callback inside a PostgreSQL transaction with `app.current_org_id`
 * set via `set_config(..., true)` so Forced Row-Level Security policies allow
 * queries scoped to `orgId` for the duration of the transaction.
 */
export async function withOrgContext<T>(
  orgId: string,
  fn: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    return fn(tx);
  });
}

/**
 * Runs a callback inside a PostgreSQL transaction with `app.current_user_id`
 * set via `set_config(..., true)` so the user can resolve their `members` rows
 * under Forced RLS before an `orgId` is selected.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}

export * from "./schema";
export { schema };
