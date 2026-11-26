import crypto from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import {
  db,
  opsServiceLogs,
  opsServices,
  orgIntegrations,
  withOrgContext,
  type IntegrationAuthMethod,
  type IntegrationProvider,
  type IntegrationStatus,
  type OrgIntegration,
  type ServiceLogLevel,
} from "../db";
import {
  decryptSecret,
  encryptSecret,
  generateIngestToken,
  hashIngestToken,
  redactLogMessage,
  verifyIngestToken,
} from "../security";

/** Safe public view of an integration — NEVER includes encryptedSecret or raw credentials. */
export interface PublicOrgIntegration {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  name: string;
  authMethod: IntegrationAuthMethod;
  publicConfig: Record<string, unknown>;
  status: IntegrationStatus;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicIntegration(row: OrgIntegration): PublicOrgIntegration {
  return {
    id: row.id,
    orgId: row.orgId,
    provider: row.provider,
    name: row.name,
    authMethod: row.authMethod,
    publicConfig: row.publicConfig ?? {},
    status: row.status,
    lastVerifiedAt: row.lastVerifiedAt,
    lastError: row.lastError,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listOrgIntegrations(
  orgId: string,
  provider?: IntegrationProvider
): Promise<PublicOrgIntegration[]> {
  const rows = await withOrgContext(orgId, async (tx) => {
    if (provider) {
      return tx
        .select()
        .from(orgIntegrations)
        .where(
          and(
            eq(orgIntegrations.orgId, orgId),
            eq(orgIntegrations.provider, provider)
          )
        )
        .orderBy(desc(orgIntegrations.createdAt));
    }
    return tx
      .select()
      .from(orgIntegrations)
      .where(eq(orgIntegrations.orgId, orgId))
      .orderBy(desc(orgIntegrations.createdAt));
  });
  return rows.map(toPublicIntegration);
}

/** Internal-only helper: loads the full row including encryptedSecret for adapter execution. */
export async function getOrgIntegrationWithSecret(
  orgId: string,
  integrationId: string
): Promise<OrgIntegration | null> {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(orgIntegrations)
      .where(
        and(
          eq(orgIntegrations.orgId, orgId),
          eq(orgIntegrations.id, integrationId)
        )
      )
      .limit(1);
    return row ?? null;
  });
}

/** Internal-only helper: resolves the first connected integration for a provider if service didn't specify one. */
export async function findDefaultOrgIntegrationForProvider(
  orgId: string,
  provider: IntegrationProvider
): Promise<OrgIntegration | null> {
  return withOrgContext(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(orgIntegrations)
      .where(
        and(
          eq(orgIntegrations.orgId, orgId),
          eq(orgIntegrations.provider, provider)
        )
      )
      .orderBy(desc(orgIntegrations.lastVerifiedAt), desc(orgIntegrations.createdAt))
      .limit(5);
    return rows.find((r) => r.status === "connected") ?? rows[0] ?? null;
  });
}

export async function createOrgIntegration(params: {
  orgId: string;
  createdBy?: string | null;
  provider: IntegrationProvider;
  name: string;
  authMethod: IntegrationAuthMethod;
  publicConfig?: Record<string, unknown>;
  secret?: string | null;
}): Promise<{
  integration: PublicOrgIntegration;
  rawRow: OrgIntegration;
  oneTimeIngestToken?: string;
}> {
  let encryptedSecret: string | null = null;
  let keyVersion = 1;
  let oneTimeIngestToken: string | undefined;
  const publicConfig: Record<string, unknown> = { ...(params.publicConfig ?? {}) };

  if (params.authMethod === "ingest_token") {
    const generated = generateIngestToken();
    encryptedSecret = generated.tokenHash;
    oneTimeIngestToken = generated.rawToken;
    publicConfig.tokenPrefix = generated.tokenPrefix;
  } else if (
    params.authMethod === "service_account_json" ||
    params.authMethod === "api_key"
  ) {
    if (!params.secret || !params.secret.trim()) {
      throw new Error(
        `A secret credential is required for authMethod "${params.authMethod}".`
      );
    }
    const encrypted = encryptSecret(params.secret.trim());
    encryptedSecret = encrypted.ciphertext;
    keyVersion = encrypted.keyVersion;
  } else if (params.authMethod === "sts_assume_role") {
    // Generate a unique per-org ExternalId if not provided
    if (!publicConfig.externalId) {
      publicConfig.externalId = `vigil-${params.orgId.slice(0, 8)}-${crypto.randomBytes(6).toString("hex")}`;
    }
    encryptedSecret = null;
  } else {
    // iam_delegation stores no secret in Postgres
    encryptedSecret = null;
  }

  const row = await withOrgContext(params.orgId, async (tx) => {
    const [inserted] = await tx
      .insert(orgIntegrations)
      .values({
        orgId: params.orgId,
        provider: params.provider,
        name: params.name.trim(),
        authMethod: params.authMethod,
        publicConfig,
        encryptedSecret,
        keyVersion,
        status: params.authMethod === "ingest_token" ? "connected" : "pending",
        lastVerifiedAt: params.authMethod === "ingest_token" ? new Date() : null,
        createdBy: params.createdBy ?? null,
      })
      .returning();
    return inserted!;
  });

  return {
    integration: toPublicIntegration(row),
    rawRow: row,
    oneTimeIngestToken,
  };
}

export async function updateOrgIntegrationStatus(params: {
  orgId: string;
  integrationId: string;
  status: IntegrationStatus;
  lastError?: string | null;
}): Promise<PublicOrgIntegration | null> {
  const row = await withOrgContext(params.orgId, async (tx) => {
    const [updated] = await tx
      .update(orgIntegrations)
      .set({
        status: params.status,
        lastError: params.lastError ?? null,
        ...(params.status === "connected" ? { lastVerifiedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orgIntegrations.orgId, params.orgId),
          eq(orgIntegrations.id, params.integrationId)
        )
      )
      .returning();
    return updated ?? null;
  });
  return row ? toPublicIntegration(row) : null;
}

export async function deleteOrgIntegration(
  orgId: string,
  integrationId: string
): Promise<boolean> {
  return withOrgContext(orgId, async (tx) => {
    const deleted = await tx
      .delete(orgIntegrations)
      .where(
        and(
          eq(orgIntegrations.orgId, orgId),
          eq(orgIntegrations.id, integrationId)
        )
      )
      .returning({ id: orgIntegrations.id });
    return deleted.length > 0;
  });
}

export function decryptIntegrationSecret(row: OrgIntegration): string | null {
  if (!row.encryptedSecret) return null;
  if (row.authMethod === "ingest_token") return null;
  return decryptSecret(row.encryptedSecret);
}

/**
 * Authenticates an incoming `X-Vigil-Ingest-Key` header for `POST /api/ingest/logs`.
 * Uses a SECURITY DEFINER or direct lookup by SHA-256 hash. Since ingest requests
 * arrive without a user session, we look up the hashed token directly.
 */
export async function resolveIngestTokenIntegration(
  rawToken: string
): Promise<{ orgId: string; integrationId: string } | null> {
  const token = rawToken.trim();
  if (!token) return null;
  const hash = hashIngestToken(token);

  const [row] = await db
    .select({
      id: orgIntegrations.id,
      orgId: orgIntegrations.orgId,
      encryptedSecret: orgIntegrations.encryptedSecret,
    })
    .from(orgIntegrations)
    .where(
      and(
        eq(orgIntegrations.authMethod, "ingest_token"),
        eq(orgIntegrations.encryptedSecret, hash)
      )
    )
    .limit(1);

  if (!row || !row.encryptedSecret) return null;
  if (!verifyIngestToken(token, row.encryptedSecret)) return null;
  return { orgId: row.orgId, integrationId: row.id };
}

export interface IngestLogInput {
  timestamp?: string;
  level?: ServiceLogLevel;
  message: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Inserts a batch of redacted push log entries into `ops_service_logs` under org RLS.
 */
export async function ingestServiceLogs(params: {
  orgId: string;
  serviceName: string;
  integrationId?: string;
  logs: IngestLogInput[];
}): Promise<{ ingested: number; serviceId: string }> {
  const cleanName = params.serviceName.trim();
  if (!cleanName) {
    throw new Error("Service name is required for log ingestion.");
  }

  return withOrgContext(params.orgId, async (tx) => {
    let [svc] = await tx
      .select({ id: opsServices.id })
      .from(opsServices)
      .where(
        and(eq(opsServices.orgId, params.orgId), eq(opsServices.name, cleanName))
      )
      .limit(1);

    if (!svc) {
      const [created] = await tx
        .insert(opsServices)
        .values({
          orgId: params.orgId,
          integrationId: params.integrationId ?? null,
          name: cleanName,
          tier: 1,
          platform: "vps",
          platformConfig: { platform: "vps" },
        })
        .returning({ id: opsServices.id });
      svc = created!;
    }

    const capped = params.logs.slice(0, 500);
    if (capped.length === 0) {
      return { ingested: 0, serviceId: svc.id };
    }

    const rows = capped.map((entry) => {
      const parsedDate = entry.timestamp ? new Date(entry.timestamp) : new Date();
      const validDate = Number.isNaN(parsedDate.getTime())
        ? new Date()
        : parsedDate;
      return {
        orgId: params.orgId,
        serviceId: svc.id,
        timestamp: validDate,
        level: normalizeServiceLogLevel(entry.level),
        message: redactLogMessage(entry.message ?? ""),
        traceId: entry.traceId ?? null,
        metadata: entry.metadata ?? null,
      };
    });

    await tx.insert(opsServiceLogs).values(rows);
    return { ingested: rows.length, serviceId: svc.id };
  });
}

function normalizeServiceLogLevel(raw?: string): ServiceLogLevel {
  const val = (raw ?? "info").toLowerCase();
  if (val.includes("fatal") || val.includes("crit")) return "fatal";
  if (val.includes("err")) return "error";
  if (val.includes("warn")) return "warn";
  if (val.includes("debug")) return "debug";
  return "info";
}

/**
 * Deletes buffered VPS/log-drain rows older than `retentionDays` (default 14 days).
 * Invoked by the BullMQ daily retention worker.
 */
export async function pruneExpiredServiceLogs(
  retentionDays = 14
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const res = await db
    .delete(opsServiceLogs)
    .where(lt(opsServiceLogs.ingestedAt, cutoff))
    .returning({ id: opsServiceLogs.id });
  return res.length;
}

/** Ensures Forced RLS policies exist for integrations tables (used in migrations/tests). */
export async function countOrgIntegrationsRaw(): Promise<number> {
  const res = await db.execute(
    sql`SELECT count(*)::int AS count FROM org_integrations`
  );
  return Number((res.rows[0] as { count?: number } | undefined)?.count ?? 0);
}
