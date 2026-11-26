import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { opsServices } from "./services";
import { orgs } from "./tenancy";

export const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;
export type ServiceLogLevel = (typeof LOG_LEVELS)[number];

export const opsServiceLogs = pgTable(
  "ops_service_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => opsServices.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    level: text("level", { enum: LOG_LEVELS }).notNull().default("info"),
    message: text("message").notNull(),
    traceId: text("trace_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ops_service_logs_org_svc_time_idx").on(
      t.orgId,
      t.serviceId,
      t.timestamp
    ),
    index("ops_service_logs_ingested_idx").on(t.ingestedAt),
  ]
);

export type OpsServiceLog = typeof opsServiceLogs.$inferSelect;
export type NewOpsServiceLog = typeof opsServiceLogs.$inferInsert;
