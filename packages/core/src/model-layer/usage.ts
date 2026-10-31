import { and, eq, gte, sql } from "drizzle-orm";
import { modelUsage, tenantBudgets, withOrgContext } from "../db";

export async function getMonthlyBudgetStatus(orgId: string): Promise<{
  spentUsd: number;
  limitUsd: number;
  withinBudget: boolean;
}> {
  const now = new Date();
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  return withOrgContext(orgId, async (tx) => {
    const [budgetRow] = await tx
      .select({ limitUsd: tenantBudgets.monthlyLimitUsd })
      .from(tenantBudgets)
      .where(eq(tenantBudgets.orgId, orgId))
      .limit(1);

    const [spendRow] = await tx
      .select({
        spentUsd: sql<number>`coalesce(sum(${modelUsage.costUsd}), 0)`,
      })
      .from(modelUsage)
      .where(
        and(
          eq(modelUsage.orgId, orgId),
          gte(modelUsage.createdAt, startOfMonth)
        )
      );

    const limitUsd = Number(budgetRow?.limitUsd ?? 250);
    const spentUsd = Number(spendRow?.spentUsd ?? 0);

    return {
      spentUsd,
      limitUsd,
      withinBudget: spentUsd < limitUsd,
    };
  });
}

export async function assertWithinBudget(orgId: string): Promise<void> {
  const status = await getMonthlyBudgetStatus(orgId);
  if (!status.withinBudget) {
    throw new Error(
      `Tenant monthly LLM budget exceeded ($${status.spentUsd.toFixed(2)} / $${status.limitUsd.toFixed(2)})`
    );
  }
}
