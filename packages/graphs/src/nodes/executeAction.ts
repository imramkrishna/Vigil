import {
  findActionLogByKey,
  saveActionLog,
  updateIncidentStatus,
} from "@vigil/core";
import type { VigilStateType, VigilUpdateType } from "../state";

export async function executeAction(
  state: VigilStateType
): Promise<VigilUpdateType> {
  if (!state.proposedAction) {
    return {};
  }

  const key = state.proposedAction.idempotencyKey;

  const existing = await findActionLogByKey(state.orgId, key);
  if (existing?.result) {
    return {
      executionResult: existing.result,
      timeline: [`Action already executed (idempotent): ${state.proposedAction.title}`],
    };
  }

  const resultPayload: Record<string, unknown> = {
    executedAt: new Date().toISOString(),
    kind: state.proposedAction.kind,
    target: state.proposedAction.target,
    title: state.proposedAction.title,
    status: "completed",
  };

  await saveActionLog({
    orgId: state.orgId,
    idempotencyKey: key,
    result: resultPayload,
  });

  if (state.incidentId) {
    await updateIncidentStatus(state.orgId, state.incidentId, "monitoring");
  }

  return {
    executionResult: resultPayload,
    timeline: [`Executed action: ${state.proposedAction.title}`],
  };
}
