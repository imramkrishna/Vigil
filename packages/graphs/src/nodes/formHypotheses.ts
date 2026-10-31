import crypto from "node:crypto";
import { z } from "zod";
import { createTierModels } from "@vigil/core";
import { FORM_HYPOTHESES_SYSTEM_PROMPT } from "../systemPrompts";
import {
  HypothesisSchema,
  type VigilStateType,
  type VigilUpdateType,
} from "../state";

const IncidentAnalysisOutputSchema = z.object({
  hypotheses: z.array(HypothesisSchema),
  proposedAction: z
    .object({
      kind: z.enum(["create_ticket", "post_status", "schedule_followup"]),
      title: z.string(),
      target: z.string(),
      payload: z.record(z.string(), z.unknown()),
      rationale: z.string(),
      evidenceIds: z.array(z.string()),
    })
    .nullable(),
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
    .withStructuredOutput(IncidentAnalysisOutputSchema)
    .withFallbacks({
      fallbacks: [fallback.withStructuredOutput(IncidentAnalysisOutputSchema)],
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

  const proposedAction = result.proposedAction
    ? {
        ...result.proposedAction,
        idempotencyKey: `${state.threadId}:${result.proposedAction.kind}:${crypto
          .createHash("sha256")
          .update(result.proposedAction.title)
          .digest("hex")
          .slice(0, 12)}`,
      }
    : null;

  return {
    hypotheses: result.hypotheses,
    proposedAction,
    timeline: [
      `Generated ${result.hypotheses.length} hypotheses${proposedAction ? ` and proposed action '${proposedAction.title}'` : ""}`,
    ],
  };
}
