import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  actionLog,
  approvals,
  incidents,
  opsDeploys,
  opsPastIncidents,
  opsServices,
  withOrgContext,
  type IncidentStatus,
  type ProposedAction,
} from "../db";

export async function getServiceByName(orgId: string, serviceName: string) {
  return withOrgContext(orgId, async (tx) => {
    return tx
      .select()
      .from(opsServices)
      .where(
        and(
          eq(opsServices.orgId, orgId),
          ilike(opsServices.name, `%${serviceName.trim()}%`),
        ),
      )
      .limit(5);
  });
}

export async function getRecentDeploys(
  orgId: string,
  serviceName?: string,
  limit = 10,
) {
  return withOrgContext(orgId, async (tx) => {
    if (serviceName?.trim()) {
      return tx
        .select()
        .from(opsDeploys)
        .where(
          and(
            eq(opsDeploys.orgId, orgId),
            ilike(opsDeploys.service, `%${serviceName.trim()}%`),
          ),
        )
        .orderBy(desc(opsDeploys.deployedAt))
        .limit(limit);
    }

    return tx
      .select()
      .from(opsDeploys)
      .where(eq(opsDeploys.orgId, orgId))
      .orderBy(desc(opsDeploys.deployedAt))
      .limit(limit);
  });
}

export async function getPastIncidents(
  orgId: string,
  params: { service?: string; keyword?: string; limit?: number } = {},
) {
  const limit = params.limit ?? 5;

  return withOrgContext(orgId, async (tx) => {
    if (params.service?.trim() && params.keyword?.trim()) {
      return tx
        .select()
        .from(opsPastIncidents)
        .where(
          and(
            eq(opsPastIncidents.orgId, orgId),
            or(
              ilike(opsPastIncidents.service, `%${params.service.trim()}%`),
              ilike(opsPastIncidents.summary, `%${params.keyword.trim()}%`),
              ilike(opsPastIncidents.rootCause, `%${params.keyword.trim()}%`),
            ),
          ),
        )
        .orderBy(desc(opsPastIncidents.occurredAt))
        .limit(limit);
    }

    if (params.service?.trim()) {
      return tx
        .select()
        .from(opsPastIncidents)
        .where(
          and(
            eq(opsPastIncidents.orgId, orgId),
            ilike(opsPastIncidents.service, `%${params.service.trim()}%`),
          ),
        )
        .orderBy(desc(opsPastIncidents.occurredAt))
        .limit(limit);
    }

    if (params.keyword?.trim()) {
      return tx
        .select()
        .from(opsPastIncidents)
        .where(
          and(
            eq(opsPastIncidents.orgId, orgId),
            or(
              ilike(opsPastIncidents.summary, `%${params.keyword.trim()}%`),
              ilike(opsPastIncidents.rootCause, `%${params.keyword.trim()}%`),
            ),
          ),
        )
        .orderBy(desc(opsPastIncidents.occurredAt))
        .limit(limit);
    }

    return tx
      .select()
      .from(opsPastIncidents)
      .where(eq(opsPastIncidents.orgId, orgId))
      .orderBy(desc(opsPastIncidents.occurredAt))
      .limit(limit);
  });
}

export async function getPastIncidentById(orgId: string, incidentId: string) {
  return withOrgContext(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(opsPastIncidents)
      .where(
        and(
          eq(opsPastIncidents.orgId, orgId),
          eq(opsPastIncidents.id, incidentId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

// ─── Incident, Approval & Action Log Helpers ───────────────────────

export async function getIncidentById(orgId: string, incidentId: string) {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(incidents)
      .where(
        and(eq(incidents.id, incidentId), eq(incidents.orgId, orgId))
      )
      .limit(1);
    return row ?? null;
  });
}

export async function updateIncidentStatus(
  orgId: string,
  incidentId: string,
  status: IncidentStatus
): Promise<void> {
  await withOrgContext(orgId, async (tx) => {
    await tx
      .update(incidents)
      .set({
        status,
        ...(status === "resolved" ? { resolvedAt: new Date() } : {}),
      })
      .where(
        and(eq(incidents.id, incidentId), eq(incidents.orgId, orgId))
      );
  });
}

export async function createPendingApproval(params: {
  orgId: string;
  incidentId: string;
  action: ProposedAction;
}): Promise<string | null> {
  return withOrgContext(params.orgId, async (tx) => {
    const [inserted] = await tx
      .insert(approvals)
      .values({
        orgId: params.orgId,
        incidentId: params.incidentId,
        action: params.action,
        decision: "pending",
      })
      .returning({ id: approvals.id });
    return inserted?.id ?? null;
  });
}

export async function listApprovalsForIncident(
  orgId: string,
  incidentId: string
) {
  return withOrgContext(orgId, async (tx) => {
    return tx
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.incidentId, incidentId),
          eq(approvals.orgId, orgId)
        )
      )
      .orderBy(desc(approvals.createdAt));
  });
}

export async function findActionLogByKey(
  orgId: string,
  idempotencyKey: string
) {
  return withOrgContext(orgId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(actionLog)
      .where(
        and(
          eq(actionLog.idempotencyKey, idempotencyKey),
          eq(actionLog.orgId, orgId)
        )
      )
      .limit(1);
    return existing ?? null;
  });
}

export async function saveActionLog(params: {
  orgId: string;
  idempotencyKey: string;
  result: Record<string, unknown>;
}): Promise<void> {
  await withOrgContext(params.orgId, async (tx) => {
    await tx.insert(actionLog).values({
      idempotencyKey: params.idempotencyKey,
      orgId: params.orgId,
      result: params.result,
    });
  });
}
