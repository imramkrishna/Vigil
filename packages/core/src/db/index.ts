import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://vigil:vigil@localhost:5432/vigil";

export const pool = new Pool({
  connectionString,
  max: 20,
});

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export type DbClient = typeof db;

/**
 * Runs a callback inside a PostgreSQL transaction with `app.current_org_id`
 * set via `set_config(..., true)` so Row-Level Security policies are enforced
 * for the duration of the transaction.
 */
export async function withOrgContext<T>(
  orgId: string,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    return fn(tx);
  });
}

export * from "./schema";
export { schema };
