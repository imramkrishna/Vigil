import type { Request, Response } from "express";
import {
  appendConversationMessage,
  generateAndUpdateChatTitle,
  getOrCreateConversation,
} from "@vigil/core";
import { getVigilGraph } from "@vigil/graphs";

// POST /api/ask — Persist user & assistant messages, auto-generate title, and run Ask Copilot graph
export async function askCopilotController(req: Request, res: Response) {
  try {
    const {
      query,
      conversationId: incomingConversationId,
      threadId: incomingThreadId,
    } = req.body as {
      query?: string;
      conversationId?: string;
      threadId?: string;
    };

    if (!query || !query.trim()) {
      res.status(400).json({ error: "query is required." });
      return;
    }

    const cleanQuery = query.trim();
    const { orgId, userId } = req.auth!;

    const conversation = await getOrCreateConversation({
      orgId,
      userId,
      conversationId: incomingConversationId,
      threadId: incomingThreadId,
      mode: "ask",
    });

    await appendConversationMessage({
      orgId,
      conversationId: conversation.id,
      role: "user",
      mode: "ask",
      content: cleanQuery,
    });

    const graph = await getVigilGraph();
    const state = await graph.invoke(
      {
        orgId,
        threadId: conversation.threadId,
        mode: "ask",
        query: cleanQuery,
      },
      {
        configurable: { thread_id: conversation.threadId },
      }
    );

    const answer = state.answer || "Completed query.";

    await appendConversationMessage({
      orgId,
      conversationId: conversation.id,
      role: "assistant",
      mode: "ask",
      content: answer,
      confidence: state.confidence,
      grounded: state.grounded,
      metadata: {
        citations: state.citations,
        timeline: state.timeline,
      },
    });

    let title = conversation.title;
    if (!title || title === "New chat") {
      title = await generateAndUpdateChatTitle({
        orgId,
        conversationId: conversation.id,
        threadId: conversation.threadId,
        userMessage: cleanQuery,
        assistantResponse: answer,
        mode: "ask",
      });
    }

    res.json({
      conversationId: conversation.id,
      title,
      threadId: conversation.threadId,
      answer,
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
}
