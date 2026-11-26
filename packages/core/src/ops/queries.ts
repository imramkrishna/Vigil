import { and, desc, eq, ilike } from "drizzle-orm";
import {
  account,
  incidents,
  members,
  opsDeploys,
  opsServices,
  orgIntegrations,
  withOrgContext,
  type DeploymentPlatform,
  type IncidentStatus,
  type PlatformConfig,
  type Severity,
} from "../db";

export async function getOrgGitHubToken(orgId: string): Promise<string | undefined> {
  try {
    return await withOrgContext(orgId, async (tx) => {
      const [row] = await tx
        .select({ accessToken: account.accessToken })
        .from(account)
        .innerJoin(members, eq(members.userId, account.userId))
        .where(
          and(eq(members.orgId, orgId), eq(account.providerId, "github"))
        )
        .limit(1);

      return row?.accessToken ?? undefined;
    });
  } catch {
    return undefined;
  }
}

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

// ─── Incident Helpers ──────────────────────────────────────────────

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
  integrationId?: string | null;
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
    if (params.integrationId) {
      const [owned] = await tx
        .select({ id: orgIntegrations.id })
        .from(orgIntegrations)
        .where(
          and(
            eq(orgIntegrations.id, params.integrationId),
            eq(orgIntegrations.orgId, params.orgId)
          )
        )
        .limit(1);

      if (!owned) {
        throw new Error(
          "Invalid integrationId: integration not found in this organization."
        );
      }
    }

    const [row] = await tx
      .insert(opsServices)
      .values({
        orgId: params.orgId,
        integrationId: params.integrationId ?? null,
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
          integrationId: params.integrationId ?? null,
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
