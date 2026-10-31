import { eq } from "drizzle-orm";
import { actionLog, incidents, withOrgContext } from "@vigil/core";
import type { VigilStateType, VigilUpdateType } from "../state";

export async function executeAction(
  state: VigilStateType
): Promise<VigilUpdateType> {
  if (!state.proposedAction) {
    return {};
  }

  const key = state.proposedAction.idempotencyKey;

  const executionResult = await withOrgContext(state.orgId, async (tx) => {
    const existing = await tx
      .select()
      .from(actionLog)
      .where(eq(actionLog.idempotencyKey, key))
      .limit(1);

    if (existing[0]?.result) {
      return existing[0].result;
    }

    const resultPayload: Record<string, unknown> = {
      executedAt: new Date().toISOString(),
      kind: state.proposedAction!.kind,
      target: state.proposedAction!.target,
      title: state.proposedAction!.title,
      status: "completed",
    };

    await tx.insert(actionLog).values({
      idempotencyKey: key,
      orgId: state.orgId,
      result: resultPayload,
    });

    if (state.incidentId) {
      await tx
        .update(incidents)
        .set({ status: "monitoring" })
        .where(eq(incidents.id, state.incidentId));
    }

    return resultPayload;
  });

  return {
    executionResult,
    timeline: [`Executed action: ${state.proposedAction.title}`],
  };
}
