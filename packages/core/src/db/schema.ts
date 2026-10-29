import {
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

/* -------------------------------------------------------------------------- */
/* Custom types & shared enums                                                */
/* -------------------------------------------------------------------------- */

/** Postgres full-text search column (not built into drizzle). */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const ROLES = ["viewer", "responder", "lead", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const SEVERITIES = ["SEV-1", "SEV-2", "SEV-3"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INCIDENT_STATUSES = [
  "investigating",
  "awaiting_approval",
  "monitoring",
  "resolved",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const DOCUMENT_STATUSES = ["pending", "indexed", "failed"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const APPROVAL_DECISIONS = ["pending", "approved", "rejected"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

/** text-embedding-3-small */
export const EMBEDDING_DIMENSIONS = 1536;

/* -------------------------------------------------------------------------- */
/* Tenancy                                                                    */
/* -------------------------------------------------------------------------- */

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull().default("viewer"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })]
);

/* -------------------------------------------------------------------------- */
/* Knowledge base (runbooks, postmortems, architecture docs)                  */
/* -------------------------------------------------------------------------- */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    source: text("source"),
    status: text("status", { enum: DOCUMENT_STATUSES }).notNull().default("pending"),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Same content uploaded twice in one org is a no-op.
    uniqueIndex("documents_org_content_hash_uq").on(t.orgId, t.contentHash),
    index("documents_org_idx").on(t.orgId),
  ]
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    tsv: tsvector("tsv"),
  },
  (t) => [
    index("chunks_org_idx").on(t.orgId),
    index("chunks_document_idx").on(t.documentId),
    // Semantic search
    index("chunks_embedding_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    // Keyword search
    index("chunks_tsv_gin_idx").using("gin", t.tsv),
  ]
);

/* -------------------------------------------------------------------------- */
/* Incidents & approvals                                                      */
/* -------------------------------------------------------------------------- */

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
    status: text("status", { enum: INCIDENT_STATUSES }).notNull().default("investigating"),
    openedBy: uuid("opened_by").references(() => user.id, { onDelete: "set null" }),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("incidents_org_status_idx").on(t.orgId, t.status)]
);

export type ProposedAction = {
  kind: "create_ticket" | "post_status" | "schedule_followup";
  title: string;
  target: string;
  payload: Record<string, unknown>;
  rationale: string;
  evidenceIds: string[];
  idempotencyKey: string;
};

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    action: jsonb("action").$type<ProposedAction>().notNull(),
    decision: text("decision", { enum: APPROVAL_DECISIONS }).notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("approvals_org_decision_idx").on(t.orgId, t.decision)]
);

/** One row per executed external write. The key makes retries safe. */
export const actionLog = pgTable("action_log", {
  idempotencyKey: text("idempotency_key").primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  result: jsonb("result").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Operations & governance                                                    */
/* -------------------------------------------------------------------------- */

/** Token and cost ledger, one row per LLM call. */
export const modelUsage = pgTable(
  "model_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    graph: text("graph", { enum: ["ask", "incident", "postmortem"] }).notNull(),
    threadId: text("thread_id"),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("model_usage_org_created_idx").on(t.orgId, t.createdAt)]
);

export const tenantBudgets = pgTable("tenant_budgets", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => orgs.id, { onDelete: "cascade" }),
  monthlyLimitUsd: doublePrecision("monthly_limit_usd").notNull().default(250),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => user.id, { onDelete: "set null" }),
    event: text("event").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_events_org_created_idx").on(t.orgId, t.createdAt)]
);

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  traceId: text("trace_id").notNull(),
  rating: text("rating", { enum: ["helpful", "flagged"] }).notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Read-only operations data (queried by the `data` / `history` specialists)  */
/* Kept in the same file for now. Move to a separate DB + role later.         */
/* -------------------------------------------------------------------------- */

export const opsServices = pgTable("ops_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  tier: integer("tier").notNull().default(1),
  owner: text("owner"),
  slackChannel: text("slack_channel"),
});

export const opsDeploys = pgTable(
  "ops_deploys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    service: text("service").notNull(),
    sha: text("sha").notNull(),
    author: text("author"),
    configDiff: jsonb("config_diff").$type<Record<string, unknown>>(),
    status: text("status", { enum: ["success", "failed", "rolled_back"] })
      .notNull()
      .default("success"),
    deployedAt: timestamp("deployed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ops_deploys_service_time_idx").on(t.service, t.deployedAt)]
);

export const opsPastIncidents = pgTable("ops_past_incidents", {
  id: text("id").primaryKey(), // e.g. "INC-1812"
  service: text("service").notNull(),
  summary: text("summary").notNull(),
  rootCause: text("root_cause"),
  resolution: text("resolution"),
  minutesToResolve: integer("minutes_to_resolve"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
});

/* -------------------------------------------------------------------------- */
/* Inferred row types                                                         */
/* -------------------------------------------------------------------------- */

export type Org = typeof orgs.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
export type ActionLogEntry = typeof actionLog.$inferSelect;
export type ModelUsage = typeof modelUsage.$inferSelect;

