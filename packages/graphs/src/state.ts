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

export const SuggestedFixSchema = z.object({
  title: z.string(),
  description: z.string(),
  commandOrPatch: z.string().optional(),
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
  logs: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const VigilState = new StateSchema({
  // Request context
  orgId: z.string(),
  threadId: z.string(),
  query: z.string().default(""),
  incidentId: z.string().optional(),
  severity: z.enum(["SEV-1", "SEV-2", "SEV-3"]).optional(),

  // Tool-calling loop (agent <-> runTools)
  messages: MessagesValue,
  toolRounds: z.number().default(0),

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
    logs: [],
  })),
  timeline: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.array(z.string()),
      reducer: (current, next) => [...current, ...next],
    }
  ),

  // Evaluation outputs
  answer: z.string().default(""),
  citations: new ReducedValue(
    z.array(CitationSchema).default(() => []),
    {
      inputSchema: z.array(CitationSchema),
      reducer: (current, next) => [...current, ...next],
    }
  ),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  hypotheses: z.array(HypothesisSchema).default(() => []),
  suggestedFixes: z.array(SuggestedFixSchema).default(() => []),
});

export type OpsContext = z.infer<typeof OpsContextSchema>;
export type VigilStateType = typeof VigilState.State;
export type VigilUpdateType = typeof VigilState.Update;
export type Citation = z.infer<typeof CitationSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type SuggestedFix = z.infer<typeof SuggestedFixSchema>;
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;
