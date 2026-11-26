import type { Request, Response } from "express";
import {
  CHAT_MODES,
  clearUserConversations,
  createConversation,
  deleteConversation,
  getConversationWithMessages,
  listConversations,
  updateConversationTitle,
  type ChatMode,
} from "@vigil/core";

// GET /api/chats — List all conversations for the authenticated user in the active org
export async function listChatsController(req: Request, res: Response) {
  try {
    const { orgId, userId } = req.auth!;
    const rows = await listConversations(orgId, userId);
    res.json({ conversations: rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch conversations";
    res.status(500).json({ error: message });
  }
}

// POST /api/chats — Start a new conversation row immediately and return its conversationId
export async function createChatController(req: Request, res: Response) {
  try {
    const { mode = "incident", title } = (req.body ?? {}) as {
      mode?: ChatMode;
      title?: string;
    };

    if (!CHAT_MODES.includes(mode)) {
      res.status(400).json({
        error: `Invalid mode. Choose one of: ${CHAT_MODES.join(", ")}`,
      });
      return;
    }

    const { orgId, userId } = req.auth!;
    const conversation = await createConversation({
      orgId,
      userId,
      mode,
      title,
    });

    res.status(201).json({ conversation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create conversation";
    res.status(500).json({ error: message });
  }
}

// GET /api/chats/:id — Fetch a single conversation and all its messages
export async function getChatController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const conversationId = String(req.params.id ?? "");

    const data = await getConversationWithMessages(orgId, conversationId);
    if (!data) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    res.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load conversation";
    res.status(500).json({ error: message });
  }
}

// PATCH /api/chats/:id — Rename a conversation
export async function renameChatController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const conversationId = String(req.params.id ?? "");
    const { title } = req.body as { title?: string };

    if (!title || !title.trim()) {
      res.status(400).json({ error: "title is required." });
      return;
    }

    const updated = await updateConversationTitle({
      orgId,
      conversationId,
      title,
    });

    if (!updated) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    res.json({ conversation: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to rename conversation";
    res.status(500).json({ error: message });
  }
}

// DELETE /api/chats/:id — Delete a single conversation (cascades to messages)
export async function deleteChatController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const conversationId = String(req.params.id ?? "");

    const ok = await deleteConversation(orgId, conversationId);
    if (!ok) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    res.json({ deleted: true, id: conversationId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete conversation";
    res.status(500).json({ error: message });
  }
}

// DELETE /api/chats — Clear all conversations for the authenticated user in the active org
export async function clearChatsController(req: Request, res: Response) {
  try {
    const { orgId, userId } = req.auth!;
    await clearUserConversations(orgId, userId);
    res.json({ cleared: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clear conversations";
    res.status(500).json({ error: message });
  }
}
