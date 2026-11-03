import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  actionLog,
  approvals,
  incidents,
  opsDeploys,
  opsPastIncidents,
  opsServices,
  withOrgContext,
  type ApprovalDecision,
  type DeploymentPlatform,
  type IncidentStatus,
  type PlatformConfig,
  type ProposedAction,
  type Severity,
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

export async function createIncident(params: {
  orgId: string;
  threadId: string;
  title: string;
  severity: Severity;
  openedBy?: string;
}) {
  return withOrgContext(params.orgId, async (tx) => {
    const [created] = await tx
      .insert(incidents)
      .values({
        orgId: params.orgId,
        threadId: params.threadId,
        title: params.title,
        severity: params.severity,
        status: "investigating",
        openedBy: params.openedBy ?? null,
      })
      .returning();
    return created!;
  });
}

export async function listIncidents(orgId: string) {
  return withOrgContext(orgId, async (tx) => {
    return tx
      .select()
      .from(incidents)
      .where(eq(incidents.orgId, orgId))
      .orderBy(desc(incidents.openedAt));
  });
}

export async function listApprovals(
  orgId: string,
  decision?: ApprovalDecision
) {
  return withOrgContext(orgId, async (tx) => {
    if (decision) {
      return tx
        .select()
        .from(approvals)
        .where(
          and(eq(approvals.orgId, orgId), eq(approvals.decision, decision))
        )
        .orderBy(desc(approvals.createdAt));
    }
    return tx
      .select()
      .from(approvals)
      .where(eq(approvals.orgId, orgId))
      .orderBy(desc(approvals.createdAt));
  });
}

export async function decideApproval(params: {
  orgId: string;
  approvalId: string;
  decision: "approved" | "rejected";
  decidedBy: string;
}) {
  return withOrgContext(params.orgId, async (tx) => {
    const [updated] = await tx
      .update(approvals)
      .set({
        decision: params.decision,
        decidedBy: params.decidedBy,
        decidedAt: new Date(),
      })
      .where(
        and(
          eq(approvals.id, params.approvalId),
          eq(approvals.orgId, params.orgId)
        )
      )
      .returning();

    if (!updated) {
      return null;
    }

    const [incident] = await tx
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.id, updated.incidentId),
          eq(incidents.orgId, params.orgId)
        )
      )
      .limit(1);

    return { approval: updated, incident: incident ?? null };
  });
}

export async function listOpsServices(orgId: string) {
  return withOrgContext(orgId, async (tx) => {
    return tx
      .select()
      .from(opsServices)
      .where(eq(opsServices.orgId, orgId))
      .orderBy(opsServices.tier, opsServices.name);
  });
}

export async function upsertOpsService(params: {
  orgId: string;
  name: string;
  tier?: number;
  owner?: string;
  slackChannel?: string;
  repoUrl?: string;
  githubBranch?: string;
  platform?: DeploymentPlatform;
  logUrl?: string;
  platformConfig?: PlatformConfig;
}) {
  return withOrgContext(params.orgId, async (tx) => {
    const [row] = await tx
      .insert(opsServices)
      .values({
        orgId: params.orgId,
        name: params.name.trim(),
        tier: params.tier ?? 1,
        owner: params.owner ?? null,
        slackChannel: params.slackChannel ?? null,
        repoUrl: params.repoUrl ?? null,
        githubBranch: params.githubBranch ?? "main",
        platform: params.platform ?? null,
        logUrl: params.logUrl ?? null,
        platformConfig: params.platformConfig ?? null,
      })
      .onConflictDoUpdate({
        target: [opsServices.orgId, opsServices.name],
        set: {
          tier: params.tier ?? 1,
          owner: params.owner ?? null,
          slackChannel: params.slackChannel ?? null,
          repoUrl: params.repoUrl ?? null,
          githubBranch: params.githubBranch ?? "main",
          platform: params.platform ?? null,
          logUrl: params.logUrl ?? null,
          platformConfig: params.platformConfig ?? null,
        },
      })
      .returning();
    return row!;
  });
}
