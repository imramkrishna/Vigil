import { z } from "zod";
import { assertWithinBudget, createTierModels } from "@vigil/core";
import { ROUTE_TASK_SYSTEM_PROMPT } from "../systemPrompts";
import type { VigilStateType, VigilUpdateType } from "../state";

const RouteOutputSchema = z.object({
  intent: z.enum(["docs", "sql", "both"]),
  serviceHint: z.string().optional(),
  searchQuery: z.string(),
});

export async function routeTask(
  state: VigilStateType
): Promise<VigilUpdateType> {
  await assertWithinBudget(state.orgId);

  if (state.mode === "postmortem") {
    return {
      timeline: ["Routed task to postmortem generator"],
    };
  }

  const { primary, fallback } = createTierModels("fast", {
    orgId: state.orgId,
    graph: state.mode,
    threadId: state.threadId,
    node: "routeTask",
  });

  const model = primary
    .withStructuredOutput(RouteOutputSchema)
    .withFallbacks({
      fallbacks: [fallback.withStructuredOutput(RouteOutputSchema)],
    });

  const result = await model.invoke([
    {
      role: "system",
      content: ROUTE_TASK_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `Mode: ${state.mode}\nSeverity: ${state.severity ?? "N/A"}\nRequest: ${state.query}`,
    },
  ]);

  return {
    intent: state.mode === "incident" ? "both" : result.intent,
    serviceHint: result.serviceHint,
    searchQuery: result.searchQuery || state.query,
    timeline: [
      `Classified intent=${result.intent}${result.serviceHint ? ` (service=${result.serviceHint})` : ""}`,
    ],
  };
}
