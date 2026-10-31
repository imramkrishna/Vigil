import { z } from "zod";
import { createTierModels } from "@vigil/core";
import { SYNTHESIZE_ANSWER_SYSTEM_PROMPT } from "../systemPrompts";
import {
  CitationSchema,
  type VigilStateType,
  type VigilUpdateType,
} from "../state";

const AnswerOutputSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema),
  confidence: z.enum(["high", "medium", "low"]),
});

export async function synthesizeAnswer(
  state: VigilStateType
): Promise<VigilUpdateType> {
  const { primary, fallback } = createTierModels("strong", {
    orgId: state.orgId,
    graph: "ask",
    threadId: state.threadId,
    node: "synthesizeAnswer",
  });

  const model = primary
    .withStructuredOutput(AnswerOutputSchema)
    .withFallbacks({
      fallbacks: [fallback.withStructuredOutput(AnswerOutputSchema)],
    });

  const result = await model.invoke([
    {
      role: "system",
      content: SYNTHESIZE_ANSWER_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: JSON.stringify({
        question: state.query,
        attempt: state.attempts + 1,
        retrievedChunks: state.retrievedChunks,
        opsContext: state.opsContext,
      }),
    },
  ]);

  return {
    answer: result.answer,
    citations: result.citations,
    confidence: result.confidence,
    attempts: state.attempts + 1,
    timeline: [`Synthesized answer (attempt ${state.attempts + 1})`],
  };
}
