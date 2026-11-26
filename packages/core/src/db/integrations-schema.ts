import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { opsServices, orgs } from "./schema";

export const INTEGRATION_PROVIDERS = [
  "gcp",
  "aws",
  "render",
  "vercel",
  "vps",
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_AUTH_METHODS = [
  "iam_delegation",
  "sts_assume_role",
  "service_account_json",
  "api_key",
  "ingest_token",
] as const;
export type IntegrationAuthMethod = (typeof INTEGRATION_AUTH_METHODS)[number];

export const INTEGRATION_STATUSES = ["pending", "connected", "error"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;
export type ServiceLogLevel = (typeof LOG_LEVELS)[number];

/* -------------------------------------------------------------------------- */
/* Cloud Account Integrations (Secret-isolated, Forced RLS on org_id)         */
/* -------------------------------------------------------------------------- */

export const orgIntegrations = pgTable(
  "org_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: INTEGRATION_PROVIDERS }).notNull(),
    name: text("name").notNull(),
    authMethod: text("auth_method", {
      enum: INTEGRATION_AUTH_METHODS,
    }).notNull(),
    /** Safe, non-sensitive display metadata (projectId, roleArn, externalId, region, ownerId, teamId, tokenPrefix) */
    publicConfig: jsonb("public_config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /** AES-256-GCM ciphertext (`iv:authTag:ciphertext`), SHA-256 hash for ingest_token, or NULL for zero-secret IAM */
    encryptedSecret: text("encrypted_secret"),
    keyVersion: integer("key_version").notNull().default(1),
    status: text("status", { enum: INTEGRATION_STATUSES })
      .notNull()
      .default("pending"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("org_integrations_org_provider_idx").on(t.orgId, t.provider),
    uniqueIndex("org_integrations_org_name_uq").on(t.orgId, t.name),
  ]
);

/* -------------------------------------------------------------------------- */
/* Rolling Push Log Buffer for Generic Linux VPS & Log Drains (Forced RLS)    */
/* -------------------------------------------------------------------------- */

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

export type OrgIntegration = typeof orgIntegrations.$inferSelect;
export type NewOrgIntegration = typeof orgIntegrations.$inferInsert;
export type OpsServiceLog = typeof opsServiceLogs.$inferSelect;
export type NewOpsServiceLog = typeof opsServiceLogs.$inferInsert;
