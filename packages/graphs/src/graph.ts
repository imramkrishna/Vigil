import type { AIMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { getCheckpointer } from "./checkpointer";
import { VigilState, type VigilStateType } from "./state";
import { MAX_TOOL_ROUNDS } from "./tools";
import {
  agent,
  awaitApproval,
  draftPostmortem,
  executeAction,
  formHypotheses,
  routeTask,
  runTools,
  synthesizeAnswer,
  verifyGrounding,
} from "./nodes";

export function buildVigilWorkflow() {
  return new StateGraph(VigilState)
    .addNode("routeTask", routeTask)
    .addNode("agent", agent)
    .addNode("runTools", runTools)
    .addNode("synthesizeAnswer", synthesizeAnswer)
    .addNode("verifyGrounding", verifyGrounding)
    .addNode("formHypotheses", formHypotheses)
    .addNode("awaitApproval", awaitApproval)
    .addNode("executeAction", executeAction)
    .addNode("draftPostmortem", draftPostmortem)
    .addEdge(START, "routeTask")
    .addConditionalEdges("routeTask", (state: VigilStateType) =>
      state.mode === "postmortem" ? "draftPostmortem" : "agent",
    )
    // Tool loop: agent -> runTools -> agent ... until it stops calling tools
    .addConditionalEdges("agent", (state: VigilStateType) => {
      const last = state.messages.at(-1) as AIMessage | undefined;
      const wantsTools = (last?.tool_calls?.length ?? 0) > 0;
      if (wantsTools && state.toolRounds < MAX_TOOL_ROUNDS) return "runTools";
      return state.mode === "incident" ? "formHypotheses" : "synthesizeAnswer";
    })
    .addEdge("runTools", "agent")
    .addEdge("synthesizeAnswer", "verifyGrounding")
    .addConditionalEdges("verifyGrounding", (state: VigilStateType) =>
      !state.grounded && state.attempts < 2 ? "synthesizeAnswer" : END,
    )
    .addConditionalEdges("formHypotheses", (state: VigilStateType) =>
      state.proposedAction && state.incidentId ? "awaitApproval" : END,
    )
    .addConditionalEdges("awaitApproval", (state: VigilStateType) =>
      state.approvalDecision === "approved" ? "executeAction" : END,
    )
    .addEdge("executeAction", END)
    .addEdge("draftPostmortem", END);
}

export async function getVigilGraph() {
  const checkpointer = await getCheckpointer();
  return buildVigilWorkflow().compile({ checkpointer });
}
