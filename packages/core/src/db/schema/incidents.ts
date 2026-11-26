import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { orgs } from "./tenancy";

export const SEVERITIES = ["SEV-1", "SEV-2", "SEV-3"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INCIDENT_STATUSES = [
  "investigating",
  "monitoring",
  "resolved",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    /** LangGraph checkpoint thread */
    threadId: text("thread_id").notNull().unique(),
    title: text("title").notNull(),
    severity: text("severity", { enum: SEVERITIES }).notNull(),
    status: text("status", { enum: INCIDENT_STATUSES })
      .notNull()
      .default("investigating"),
    openedBy: uuid("opened_by").references(() => user.id, {
      onDelete: "set null",
    }),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("incidents_org_status_idx").on(t.orgId, t.status)]
);

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
