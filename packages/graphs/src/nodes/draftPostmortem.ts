import { z } from "zod";
import { eq } from "drizzle-orm";
import { approvals, createTierModels, incidents, withOrgContext } from "@vigil/core";
import { DRAFT_POSTMORTEM_SYSTEM_PROMPT } from "../systemPrompts";
import {
  ActionItemSchema,
  type VigilStateType,
  type VigilUpdateType,
} from "../state";

const PostmortemOutputSchema = z.object({
  postmortemMarkdown: z.string(),
  actionItems: z.array(ActionItemSchema),
});

export async function draftPostmortem(
  state: VigilStateType
): Promise<VigilUpdateType> {
  const incidentData = state.incidentId
    ? await withOrgContext(state.orgId, async (tx) => {
        const [inc] = await tx
          .select()
          .from(incidents)
          .where(eq(incidents.id, state.incidentId!))
          .limit(1);

        const incApprovals = await tx
          .select()
          .from(approvals)
          .where(eq(approvals.incidentId, state.incidentId!));

        return { incident: inc ?? null, approvals: incApprovals };
      })
    : { incident: null, approvals: [] };

  const { primary, fallback } = createTierModels("strong", {
    orgId: state.orgId,
    graph: "postmortem",
    threadId: state.threadId,
    node: "draftPostmortem",
  });

  const model = primary
    .withStructuredOutput(PostmortemOutputSchema)
    .withFallbacks({
      fallbacks: [fallback.withStructuredOutput(PostmortemOutputSchema)],
    });

  const result = await model.invoke([
    {
      role: "system",
      content: DRAFT_POSTMORTEM_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: JSON.stringify({
        query: state.query,
        incidentData,
        hypotheses: state.hypotheses,
        timeline: state.timeline,
        executionResult: state.executionResult,
      }),
    },
  ]);

  return {
    postmortemMarkdown: result.postmortemMarkdown,
    actionItems: result.actionItems,
    timeline: [
      `Drafted postmortem with ${result.actionItems.length} action items`,
    ],
  };
}
