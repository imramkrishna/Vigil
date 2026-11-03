import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { getVigilGraph } from "@vigil/graphs";
import { requireAuth } from "../middleware/require-auth";

export const askRouter = Router();

// POST /api/ask — Run Ask Copilot graph
askRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, threadId: incomingThreadId } = req.body as {
      query?: string;
      threadId?: string;
    };

    if (!query || !query.trim()) {
      res.status(400).json({ error: "query is required." });
      return;
    }

    const { orgId } = req.auth!;
    const threadId = incomingThreadId?.trim() || `ask-${crypto.randomUUID()}`;

    const graph = await getVigilGraph();
    const state = await graph.invoke(
      {
        orgId,
        threadId,
        mode: "ask",
        query: query.trim(),
      },
      {
        configurable: { thread_id: threadId },
      }
    );

    res.json({
      threadId,
      answer: state.answer,
      citations: state.citations,
      confidence: state.confidence,
      grounded: state.grounded,
      timeline: state.timeline,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run Ask Copilot";
    res.status(500).json({ error: message });
  }
});
