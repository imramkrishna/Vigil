import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import {
  getPastIncidents,
  getRecentDeploys,
  getServiceByName,
  hybridSearch,
} from "@vigil/core";
import type { RetrievedChunk } from "./state";

type Row = Record<string, unknown>;

export const MAX_TOOL_ROUNDS = 4;

/**
 * Builds the agent's tools for one organization.
 * `orgId` is bound here (never chosen by the model), so a tool can only read
 * its own tenant's data. Everything the tools find is also saved in `collected`
 * so the graph can keep it in state for citations.
 */
export function createVigilTools(orgId: string) {
  const collected = {
    chunks: [] as RetrievedChunk[],
    services: [] as Row[],
    deploys: [] as Row[],
    pastIncidents: [] as Row[],
  };

  const searchRunbooks = tool(
    async ({ query }) => {
      const results = await hybridSearch(orgId, query, 5);
      const chunks = results.map((r) => ({
        id: r.id,
        documentId: r.documentId,
        content: r.content,
        chunkIndex: r.chunkIndex,
        score: r.score,
        sourceUrl: r.metadata?.sourceUrl,
        title: r.metadata?.title ?? r.metadata?.documentName,
      }));
      collected.chunks.push(...chunks);
      if (chunks.length === 0) return "No matching runbook or doc passages found.";
      return JSON.stringify(
        chunks.map(({ id, title, sourceUrl, content }) => ({ id, title, sourceUrl, content })),
      );
    },
    {
      name: "search_runbooks",
      description:
        "Search the organization's runbooks, architecture docs and postmortems (hybrid semantic + keyword). Use for procedures, how-tos and documented ownership/escalation rules.",
      schema: z.object({
        query: z.string().min(1).describe("Keyword-rich search query"),
      }),
    },
  );

  const lookupService = tool(
    async ({ name }) => {
      const rows = await getServiceByName(orgId, name);
      collected.services.push(...(rows as unknown as Row[]));
      if (rows.length === 0) return `No service matching "${name}".`;
      return JSON.stringify(rows);
    },
    {
      name: "lookup_service",
      description: "Look up a service's tier, owner and Slack channel by (partial) name.",
      schema: z.object({ name: z.string().min(1) }),
    },
  );

  const getDeploys = tool(
    async ({ service, limit }) => {
      const rows = await getRecentDeploys(orgId, service, limit ?? 5);
      collected.deploys.push(...(rows as unknown as Row[]));
      if (rows.length === 0) return "No recent deploys found.";
      return JSON.stringify(rows);
    },
    {
      name: "get_recent_deploys",
      description:
        "List recent deploys (sha, author, config diff, status). Omit `service` to see deploys across all services. Use when looking for a change that could have caused a problem.",
      schema: z.object({
        service: z.string().optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
  );

  const findPastIncidents = tool(
    async ({ service, keyword }) => {
      const rows = await getPastIncidents(orgId, { service, keyword, limit: 5 });
      collected.pastIncidents.push(...(rows as unknown as Row[]));
      if (rows.length === 0) return "No similar past incidents found.";
      return JSON.stringify(rows);
    },
    {
      name: "find_past_incidents",
      description:
        "Find past incidents with root cause, resolution and time to resolve. Filter by service and/or a symptom keyword.",
      schema: z.object({
        service: z.string().optional(),
        keyword: z.string().optional(),
      }),
    },
  );

  const tools: StructuredToolInterface[] = [
    searchRunbooks,
    lookupService,
    getDeploys,
    findPastIncidents,
  ];
  return { tools, collected };
}
