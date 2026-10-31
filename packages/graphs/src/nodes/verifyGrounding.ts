import { z } from "zod";
import { createTierModels } from "@vigil/core";
import { VERIFY_GROUNDING_SYSTEM_PROMPT } from "../systemPrompts";
import type { VigilStateType, VigilUpdateType } from "../state";

const GroundingOutputSchema = z.object({
  grounded: z.boolean(),
  reason: z.string(),
});

export async function verifyGrounding(
  state: VigilStateType
): Promise<VigilUpdateType> {
  const { primary, fallback } = createTierModels("fast", {
    orgId: state.orgId,
    graph: "ask",
    threadId: state.threadId,
    node: "verifyGrounding",
  });

  const model = primary
    .withStructuredOutput(GroundingOutputSchema)
    .withFallbacks({
      fallbacks: [fallback.withStructuredOutput(GroundingOutputSchema)],
    });

  const result = await model.invoke([
    {
      role: "system",
      content: VERIFY_GROUNDING_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: JSON.stringify({
        answer: state.answer,
        retrievedChunks: state.retrievedChunks,
        opsContext: state.opsContext,
      }),
    },
  ]);

  return {
    grounded: result.grounded,
    timeline: [`Verified grounding: ${result.grounded} (${result.reason})`],
  };
}
