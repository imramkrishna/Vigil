import { z } from "zod";
import { MessagesValue, ReducedValue, StateSchema } from "@langchain/langgraph";

export const CitationSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  sourceUrl: z.string().optional(),
  snippet: z.string(),
});

export const HypothesisSchema = z.object({
  cause: z.string(),
  confidence: z.number(),
  evidence: z.string(),
});

export const ProposedActionSchema = z.object({
  kind: z.enum(["create_ticket", "post_status", "schedule_followup"]),
  title: z.string(),
  target: z.string(),
  payload: z.record(z.string(), z.unknown()),
  rationale: z.string(),
  evidenceIds: z.array(z.string()),
  idempotencyKey: z.string(),
});

export const ActionItemSchema = z.object({
  title: z.string(),
  owner: z.string(),
  priority: z.enum(["P0", "P1", "P2"]),
});

export const RetrievedChunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string(),
  chunkIndex: z.number(),
  score: z.number(),
  sourceUrl: z.string().optional(),
  title: z.string().optional(),
});

export const OpsContextSchema = z.object({
  services: z.array(z.record(z.string(), z.unknown())).default([]),
  deploys: z.array(z.record(z.string(), z.unknown())).default([]),
  pastIncidents: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const VigilState = new StateSchema({
  // Request context
  orgId: z.string(),
  threadId: z.string(),
  mode: z.enum(["ask", "incident", "postmortem"]).default("ask"),
  query: z.string().default(""),
  incidentId: z.string().optional(),
  severity: z.enum(["SEV-1", "SEV-2", "SEV-3"]).optional(),

  // Tool-calling loop (agent <-> runTools)
  messages: MessagesValue,
  toolRounds: z.number().default(0),

  // Routing hints (used to seed the agent)
  intent: z.enum(["docs", "sql", "both"]).default("both"),
  serviceHint: z.string().optional(),
  searchQuery: z.string().default(""),

  // Accumulated evidence with Reducers
  retrievedChunks: new ReducedValue(
    z.array(RetrievedChunkSchema).default(() => []),
    {
      inputSchema: z.array(RetrievedChunkSchema),
      reducer: (current, next) => {
        const seen = new Set(current.map((c) => c.id));
        return [...current, ...next.filter((c) => !seen.has(c.id))];
      },
    }
  ),
  opsContext: OpsContextSchema.default(() => ({
    services: [],
    deploys: [],
    pastIncidents: [],
  })),
  timeline: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.array(z.string()),
      reducer: (current, next) => [...current, ...next],
    }
  ),

  // Ask Copilot outputs
  answer: z.string().default(""),
  citations: new ReducedValue(
    z.array(CitationSchema).default(() => []),
    {
      inputSchema: z.array(CitationSchema),
      reducer: (current, next) => [...current, ...next],
    }
  ),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  grounded: z.boolean().default(true),
  attempts: z.number().default(0),

  // Incident Investigation & HITL Approval outputs
  hypotheses: z.array(HypothesisSchema).default(() => []),
  proposedAction: ProposedActionSchema.nullable().default(null),
  approvalId: z.string().nullable().default(null),
  approvalDecision: z.enum(["approved", "rejected"]).nullable().default(null),
  executionResult: z.record(z.string(), z.unknown()).nullable().default(null),

  // Postmortem outputs
  postmortemMarkdown: z.string().default(""),
  actionItems: z.array(ActionItemSchema).default(() => []),
});

export type OpsContext = z.infer<typeof OpsContextSchema>;
export type VigilStateType = typeof VigilState.State;
export type VigilUpdateType = typeof VigilState.Update;
export type Citation = z.infer<typeof CitationSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;
