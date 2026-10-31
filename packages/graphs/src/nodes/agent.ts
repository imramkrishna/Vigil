import { createTierModels } from "@vigil/core";
import { AGENT_SYSTEM_PROMPT } from "../systemPrompts";
import { createVigilTools } from "../tools";
import type { VigilStateType, VigilUpdateType } from "../state";

/**
 * Decides which tools (if any) to call next. When it calls none, the graph
 * moves on to answer / hypothesis generation with the evidence gathered so far.
 */
export async function agent(state: VigilStateType): Promise<VigilUpdateType> {
  const { tools } = createVigilTools(state.orgId);
  const { primary, fallback } = createTierModels("fast", {
    orgId: state.orgId,
    graph: state.mode === "incident" ? "incident" : "ask",
    threadId: state.threadId,
    node: "agent",
  });

  const model = primary
    .bindTools(tools)
    .withFallbacks({ fallbacks: [fallback.bindTools(tools)] });

  const seed = [
    `Mode: ${state.mode}`,
    state.severity ? `Severity: ${state.severity}` : null,
    `Request: ${state.query}`,
    state.serviceHint ? `Likely service: ${state.serviceHint}` : null,
    `Suggested search: ${state.searchQuery || state.query}`,
    `Suggested sources: ${state.intent}`,
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
