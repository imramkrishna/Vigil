import { createTierModels } from "@vigil/core";
import { AGENT_SYSTEM_PROMPT } from "../systemPrompts";
import { createVigilTools } from "../tools";
import type { VigilStateType, VigilUpdateType } from "../state";

/**
 * Decides which tools (if any) to call next. When it calls none, the graph
 * moves on to failure evaluation and fix generation with the evidence gathered.
 */
export async function agent(state: VigilStateType): Promise<VigilUpdateType> {
  const { tools } = createVigilTools(state.orgId);
  const { primary, fallback } = createTierModels("fast", {
    orgId: state.orgId,
    graph: "incident",
    threadId: state.threadId,
    node: "agent",
  });

  const model = primary
    .bindTools(tools)
    .withFallbacks({ fallbacks: [fallback.bindTools(tools)] });

  const seed = [
    state.severity ? `Severity: ${state.severity}` : null,
    `Failure / Request: ${state.query}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await model.invoke([
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: seed },
    ...state.messages,
  ]);

  return { messages: [response] };
}
