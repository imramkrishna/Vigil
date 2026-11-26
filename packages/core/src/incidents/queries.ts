import { and, desc, eq } from "drizzle-orm";
import {
  incidents,
  withOrgContext,
  type IncidentStatus,
  type Severity,
} from "../db";

export async function getIncidentById(orgId: string, incidentId: string) {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.orgId, orgId)))
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
      .where(and(eq(incidents.id, incidentId), eq(incidents.orgId, orgId)));
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
