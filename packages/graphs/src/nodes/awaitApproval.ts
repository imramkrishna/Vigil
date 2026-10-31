import { eq } from "drizzle-orm";
import { interrupt } from "@langchain/langgraph";
import { approvals, incidents, withOrgContext } from "@vigil/core";
import type { VigilStateType, VigilUpdateType } from "../state";

export async function awaitApproval(
  state: VigilStateType
): Promise<VigilUpdateType> {
  if (!state.proposedAction || !state.incidentId) {
    return { approvalDecision: null };
  }

  const approvalId = await withOrgContext(state.orgId, async (tx) => {
    const [inserted] = await tx
      .insert(approvals)
      .values({
        orgId: state.orgId,
        incidentId: state.incidentId!,
        action: state.proposedAction!,
        decision: "pending",
      })
      .returning({ id: approvals.id });

    await tx
      .update(incidents)
      .set({ status: "awaiting_approval" })
      .where(eq(incidents.id, state.incidentId!));

    return inserted?.id ?? null;
  });

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
