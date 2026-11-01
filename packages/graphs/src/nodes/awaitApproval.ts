import { interrupt } from "@langchain/langgraph";
import { createPendingApproval, updateIncidentStatus } from "@vigil/core";
import type { VigilStateType, VigilUpdateType } from "../state";

export async function awaitApproval(
  state: VigilStateType
): Promise<VigilUpdateType> {
  if (!state.proposedAction || !state.incidentId) {
    return { approvalDecision: null };
  }

  const approvalId = await createPendingApproval({
    orgId: state.orgId,
    incidentId: state.incidentId,
    action: state.proposedAction,
  });

  await updateIncidentStatus(
    state.orgId,
    state.incidentId,
    "awaiting_approval"
  );

  const resumePayload = interrupt({
    approvalId,
    incidentId: state.incidentId,
    proposedAction: state.proposedAction,
  }) as { decision?: "approved" | "rejected" } | "approved" | "rejected";

  const decision =
    typeof resumePayload === "string"
      ? resumePayload
      : (resumePayload?.decision ?? "rejected");

  return {
    approvalId,
    approvalDecision: decision,
    timeline: [`Human approval decision: ${decision}`],
  };
}
