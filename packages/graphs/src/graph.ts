import type { AIMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { getCheckpointer } from "./checkpointer";
import { VigilState, type VigilStateType } from "./state";
import { MAX_TOOL_ROUNDS } from "./tools";
import { agent, formHypotheses, runTools } from "./nodes";

export function buildVigilWorkflow() {
  return new StateGraph(VigilState)
    .addNode("agent", agent)
    .addNode("runTools", runTools)
    .addNode("formHypotheses", formHypotheses)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", (state: VigilStateType) => {
      const last = state.messages.at(-1) as AIMessage | undefined;
      const wantsTools = (last?.tool_calls?.length ?? 0) > 0;
      if (wantsTools && state.toolRounds < MAX_TOOL_ROUNDS) return "runTools";
      return "formHypotheses";
    })
    .addEdge("runTools", "agent")
    .addEdge("formHypotheses", END);
}

export async function getVigilGraph() {
  const checkpointer = await getCheckpointer();
  return buildVigilWorkflow().compile({ checkpointer });
}
