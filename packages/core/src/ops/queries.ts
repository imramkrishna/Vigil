import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  opsDeploys,
  opsPastIncidents,
  opsServices,
  withOrgContext,
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
