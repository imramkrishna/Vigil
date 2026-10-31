import { ToolMessage, type AIMessage } from "@langchain/core/messages";
import { createVigilTools } from "../tools";
import type { VigilStateType, VigilUpdateType } from "../state";

/** Merge new rows into existing ones, skipping rows with an id we already have. */
function mergeById<T extends Record<string, unknown>>(current: T[], next: T[]): T[] {
  const seen = new Set(current.map((row) => String(row.id ?? JSON.stringify(row))));
  return [...current, ...next.filter((row) => !seen.has(String(row.id ?? JSON.stringify(row))))];
}

/** Runs the tool calls requested by the last AI message and records what they found. */
export async function runTools(state: VigilStateType): Promise<VigilUpdateType> {
  const last = state.messages.at(-1) as AIMessage | undefined;
  const toolCalls = last?.tool_calls ?? [];
  const { tools, collected } = createVigilTools(state.orgId);

  const results = await Promise.all(
    toolCalls.map(async (call) => {
      const selected = tools.find((t) => t.name === call.name);
      if (!selected) {
        return new ToolMessage({
          content: `Unknown tool: ${call.name}`,
          tool_call_id: call.id ?? call.name,
          name: call.name,
          status: "error",
        });
      }
      try {
        const output = await selected.invoke(call.args);
        return new ToolMessage({
          content: typeof output === "string" ? output : JSON.stringify(output),
          tool_call_id: call.id ?? call.name,
          name: call.name,
        });
      } catch (error) {
        // Let the model see the failure and adapt instead of crashing the graph.
        const message = error instanceof Error ? error.message : String(error);
        return new ToolMessage({
          content: `Tool ${call.name} failed: ${message}`,
          tool_call_id: call.id ?? call.name,
          name: call.name,
          status: "error",
        });
      }
    }),
  );

  return {
    messages: results,
    toolRounds: state.toolRounds + 1,
    retrievedChunks: collected.chunks,
    opsContext: {
      services: mergeById(state.opsContext.services, collected.services),
      deploys: mergeById(state.opsContext.deploys, collected.deploys),
      pastIncidents: mergeById(state.opsContext.pastIncidents, collected.pastIncidents),
      logs: mergeById(state.opsContext.logs, collected.logs),
    },
    timeline: [`Called tools: ${toolCalls.map((c) => c.name).join(", ") || "none"}`],
  };
}
