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
  varchar,
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

export const DEPLOYMENT_PLATFORMS = [
  "cloud_run",
  "aws_lambda",
  "aws_ec2",
  "render",
  "vercel",
  "custom",
] as const;
export type DeploymentPlatform = (typeof DEPLOYMENT_PLATFORMS)[number];

export type PlatformConfig =
  | {
      platform: "cloud_run";
      logUrl?: string;
      projectId: string;
      serviceName: string;
      region?: string;
    }
  | {
      platform: "aws_lambda";
      logUrl?: string;
      region: string;
      functionName: string;
      logGroupName?: string;
    }
  | {
      platform: "aws_ec2";
      logUrl?: string;
      region: string;
      logGroupName: string;
      instanceId?: string;
    }
  | {
      platform: "render";
      logUrl?: string;
      serviceId: string;
      ownerId?: string;
    }
  | {
      platform: "vercel";
      logUrl?: string;
      projectId: string;
      teamId?: string;
      deploymentId?: string;
    }
  | {
      platform: "custom";
      logUrl: string;
    };

/** text-embedding-3-small */
export const EMBEDDING_DIMENSIONS = 1536;

export interface ChunkMetadata {
  documentId?: string;
  documentName?: string;
  title?: string;
  sourceUrl?: string;
  storageKey?: string;
  mimeType?: string;
  page?: number;
  chunkIndex?: number;
  totalChunks?: number;
  charStart?: number;
  charEnd?: number;
  lineStart?: number;
  lineEnd?: number;
}

/* -------------------------------------------------------------------------- */
/* Tenancy                                                                    */
/* -------------------------------------------------------------------------- */

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

/* -------------------------------------------------------------------------- */
/* Knowledge base (runbooks, postmortems, architecture docs)                  */
/* -------------------------------------------------------------------------- */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Tenant organization (optional if user-scoped, required when using org RLS)
    orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),

    // Owner of the document
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Original filename / document title
    name: varchar("name", { length: 255 }).notNull(),

    // MIME type: application/pdf, text/markdown, etc.
    mimeType: varchar("mime_type", { length: 100 }).notNull(),

    // File size in bytes
    size: integer("size").notNull(),

    // Where the original file is stored (S3 key or URI)
    storageKey: text("storage_key").notNull(),

    // SHA-256 hash (64 hex chars) to detect duplicate/unchanged files
    contentHash: varchar("content_hash", { length: 64 }),

    // Processing state
    status: text("status", { enum: DOCUMENT_STATUSES })
      .default("pending")
      .notNull(),

    // Useful for displaying errors in the UI
    errorMessage: text("error_message"),

    // Number of chunks generated
    chunkCount: integer("chunk_count"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    processedAt: timestamp("processed_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    index("document_id_idx").on(table.id),
    index("documents_user_id_idx").on(table.userId),
    index("documents_org_id_idx").on(table.orgId),
    uniqueIndex("documents_org_content_hash_uq").on(
      table.orgId,
      table.contentHash,
    ),
  ],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),

    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),

    // Actual chunk text
    content: text("content").notNull(),

    // Position of this chunk within the document
    chunkIndex: integer("chunk_index").notNull(),

    // Page number, section heading, line/char offsets, source URL, etc.
    metadata: jsonb("metadata").$type<ChunkMetadata>().default({}),

    // Must match your embedding model's dimensions (1536 for text-embedding-3-small)
    embedding: vector("embedding", {
      dimensions: EMBEDDING_DIMENSIONS,
    }),

    // Full-text search tsvector column
    tsv: tsvector("tsv"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("document_chunks_document_id_idx").on(table.documentId),
    index("document_chunks_org_id_idx").on(table.orgId),

    // HNSW index for Vector Search (Semantic meaning)
    index("document_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),

    // GIN index for Full-Text Search (Exact keywords)
    index("document_chunks_tsv_idx").using("gin", table.tsv),
  ],
);

/** Alias for convenience across retrieval modules */
export const chunks = documentChunks;

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
  (t) => [index("incidents_org_status_idx").on(t.orgId, t.status)],
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
    decision: text("decision", { enum: APPROVAL_DECISIONS })
      .notNull()
      .default("pending"),
    decidedBy: uuid("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("approvals_org_decision_idx").on(t.orgId, t.decision)],
);

/** One row per executed external write. The key makes retries safe. */
export const actionLog = pgTable("action_log", {
  idempotencyKey: text("idempotency_key").primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  result: jsonb("result").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("model_usage_org_created_idx").on(t.orgId, t.createdAt)],
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
    actorId: uuid("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    event: text("event").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_events_org_created_idx").on(t.orgId, t.createdAt)],
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Read-only operations data (queried by the `data` / `history` specialists)  */
/* Kept in the same file for now. Move to a separate DB + role later.         */
/* -------------------------------------------------------------------------- */

export const opsServices = pgTable(
  "ops_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tier: integer("tier").notNull().default(1),
    owner: text("owner"),
    slackChannel: text("slack_channel"),
    platform: text("platform", { enum: DEPLOYMENT_PLATFORMS }),
    logUrl: text("log_url"),
    platformConfig: jsonb("platform_config").$type<PlatformConfig>(),
  },
  (t) => [
    uniqueIndex("ops_services_org_name_uq").on(t.orgId, t.name),
    index("ops_services_org_idx").on(t.orgId),
  ],
);

export const opsDeploys = pgTable(
  "ops_deploys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    sha: text("sha").notNull(),
    author: text("author"),
    configDiff: jsonb("config_diff").$type<Record<string, unknown>>(),
    status: text("status", { enum: ["success", "failed", "rolled_back"] })
      .notNull()
      .default("success"),
    deployedAt: timestamp("deployed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ops_deploys_org_service_time_idx").on(
      t.orgId,
      t.service,
      t.deployedAt,
    ),
  ],
);

export const opsPastIncidents = pgTable(
  "ops_past_incidents",
  {
    id: text("id").primaryKey(), // e.g. "INC-1812"
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    summary: text("summary").notNull(),
    rootCause: text("root_cause"),
    resolution: text("resolution"),
    minutesToResolve: integer("minutes_to_resolve"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("ops_past_incidents_org_service_idx").on(t.orgId, t.service)],
);

/* -------------------------------------------------------------------------- */
/* Inferred row types                                                         */
/* -------------------------------------------------------------------------- */

export type Org = typeof orgs.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type Chunk = DocumentChunk;
export type NewChunk = NewDocumentChunk;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
export type ActionLogEntry = typeof actionLog.$inferSelect;
export type ModelUsage = typeof modelUsage.$inferSelect;
