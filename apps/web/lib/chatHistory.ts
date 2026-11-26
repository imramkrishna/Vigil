"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  clearChats,
  deleteChat,
  getChat,
  listChats,
  renameChat,
  type ConversationMessageRow,
  type ConversationRow,
} from "./api";
import type { ChatTurn, Mode } from "../types/vigil";

export interface ChatThread {
  /** Database conversation UUID */
  id: string;
  /** LangGraph checkpoint thread_id */
  threadId: string;
  title: string;
  mode: Mode;
  turns: ChatTurn[];
  messageCount: number;
  lastMessagePreview?: string | null;
  messagesLoaded?: boolean;
  createdAt: number;
  updatedAt: number;
}

const EMPTY_THREADS: ChatThread[] = [];

const listeners = new Set<() => void>();
let threadsState: ChatThread[] = EMPTY_THREADS;

function notifyAll() {
  listeners.forEach((fn) => fn());
}

function setThreads(next: ChatThread[]) {
  threadsState = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
  notifyAll();
}

export function mapMessageToTurn(msg: ConversationMessageRow): ChatTurn {
  const meta = msg.metadata ?? {};
  return {
    id: msg.id,
    role: msg.role,
    mode: "incident",
    content: msg.content,
    createdAt: new Date(msg.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    confidence: msg.confidence ?? undefined,
    grounded: msg.grounded ?? undefined,
    timeline: meta.timeline,
    citations: meta.citations,
    hypotheses: meta.hypotheses,
    suggestedFixes: meta.suggestedFixes,
  };
}

function mapConversationRow(
  row: ConversationRow,
  existing?: ChatThread
): ChatThread {
  return {
    id: row.id,
    threadId: row.threadId,
    title: row.title || "New evaluation",
    mode: "incident",
    turns: existing?.turns ?? [],
    messageCount: row.messageCount ?? existing?.turns.length ?? 0,
    lastMessagePreview: row.lastMessagePreview ?? existing?.lastMessagePreview,
    messagesLoaded: existing?.messagesLoaded ?? false,
    createdAt: new Date(row.createdAt).getTime(),
    updatedAt: new Date(row.updatedAt).getTime(),
  };
}

export async function loadChatThreads(): Promise<ChatThread[]> {
  try {
    const rows = await listChats();
    const existingById = new Map(threadsState.map((t) => [t.id, t]));
    const next = rows.map((row) =>
      mapConversationRow(row, existingById.get(row.id))
    );
    setThreads(next);
    return next;
  } catch {
    return threadsState;
  }
}

export async function loadChatThreadMessages(
  conversationId: string
): Promise<ChatThread | null> {
  const { conversation, messages } = await getChat(conversationId);
  const turns = messages.map(mapMessageToTurn);
  const loaded: ChatThread = {
    id: conversation.id,
    threadId: conversation.threadId,
    title: conversation.title || "New evaluation",
    mode: "incident",
    turns,
    messageCount: Math.max(conversation.messageCount, turns.length),
    lastMessagePreview: conversation.lastMessagePreview,
    messagesLoaded: true,
    createdAt: new Date(conversation.createdAt).getTime(),
    updatedAt: new Date(conversation.updatedAt).getTime(),
  };

  const others = threadsState.filter((t) => t.id !== loaded.id);
  setThreads([loaded, ...others]);
  return loaded;
}

export function upsertChatThread(params: {
  id: string;
  threadId: string;
  turns: ChatTurn[];
  mode: Mode;
  title?: string;
}) {
  const now = Date.now();
  const existing = threadsState.find((t) => t.id === params.id);
  const lastTurn = params.turns[params.turns.length - 1];
  const preview = lastTurn?.content
    ? lastTurn.content
        .replace(/```[\s\S]*?```/g, "[code]")
        .replace(/[#>*`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140)
    : existing?.lastMessagePreview;

  const nextThread: ChatThread = {
    id: params.id,
    threadId: params.threadId,
    title: params.title?.trim() || existing?.title || "New chat",
    mode: params.mode,
    turns: params.turns,
    messageCount: Math.max(params.turns.length, existing?.messageCount ?? 0),
    lastMessagePreview: preview,
    messagesLoaded: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  setThreads([nextThread, ...threadsState.filter((t) => t.id !== params.id)]);
}

export async function renameChatThread(id: string, nextTitle: string) {
  const clean = nextTitle.trim();
  if (!clean) return;
  const previous = threadsState;
  setThreads(
    threadsState.map((t) => (t.id === id ? { ...t, title: clean } : t))
  );
  try {
    await renameChat(id, clean);
  } catch {
    setThreads(previous);
  }
}

export async function deleteChatThread(id: string) {
  const previous = threadsState;
  setThreads(threadsState.filter((t) => t.id !== id));
  try {
    await deleteChat(id);
  } catch {
    setThreads(previous);
  }
}

export async function clearChatThreads() {
  const previous = threadsState;
  setThreads(EMPTY_THREADS);
  try {
    await clearChats();
  } catch {
    setThreads(previous);
  }
}

export function resetChatHistoryCache() {
  threadsState = EMPTY_THREADS;
  notifyAll();
}

export function useChatHistory(): ChatThread[] {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => threadsState, []);
  const getServerSnapshot = useCallback(() => EMPTY_THREADS, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
