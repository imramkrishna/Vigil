import { z } from "zod";
import { createTierModels } from "@vigil/core";
import { FORM_HYPOTHESES_SYSTEM_PROMPT } from "../systemPrompts";
import {
  CitationSchema,
  HypothesisSchema,
  SuggestedFixSchema,
  type VigilStateType,
  type VigilUpdateType,
} from "../state";

const EvaluationOutputSchema = z.object({
  summary: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  hypotheses: z.array(HypothesisSchema),
  suggestedFixes: z.array(SuggestedFixSchema),
  citations: z.array(CitationSchema),
});

export async function formHypotheses(
  state: VigilStateType
): Promise<VigilUpdateType> {
  const { primary, fallback } = createTierModels("strong", {
    orgId: state.orgId,
    graph: "incident",
    threadId: state.threadId,
    node: "formHypotheses",
  });

  const model = primary
    .withStructuredOutput(EvaluationOutputSchema)
    .withFallbacks({
      fallbacks: [fallback.withStructuredOutput(EvaluationOutputSchema)],
    });

  const result = await model.invoke([
    {
      role: "system",
      content: FORM_HYPOTHESES_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: JSON.stringify({
        incident: state.query,
        severity: state.severity,
        retrievedChunks: state.retrievedChunks,
        opsContext: state.opsContext,
      }),
    },
  ]);

  return {
    answer: result.summary,
    confidence: result.confidence,
    hypotheses: result.hypotheses,
    suggestedFixes: result.suggestedFixes,
    citations: result.citations,
    timeline: [
      `Evaluated failure: ${result.hypotheses.length} root-cause ${
        result.hypotheses.length === 1 ? "hypothesis" : "hypotheses"
      }, ${result.suggestedFixes.length} suggested ${
        result.suggestedFixes.length === 1 ? "fix" : "fixes"
      }`,
    ],
  };
}
