"use client";

import React from "react";
import { VigilCopilotChat } from "./chat/VigilCopilotChat";
import type { ChatTurn, Mode } from "../types/vigil";

interface AskCopilotViewProps {
  initialConversationId?: string | null;
  initialThreadId?: string;
  initialTurns?: ChatTurn[];
  loadingThread?: boolean;
  resetSignal?: number;
  sidebarToggle?: React.ReactNode;
  historyCount?: number;
  onOpenHistory?: () => void;
  onNewChat?: () => void;
  onConversationSync?: (params: {
    conversationId: string;
    threadId: string;
    turns: ChatTurn[];
    mode: Mode;
    title?: string;
  }) => void;
}

export function AskCopilotView({
  initialConversationId,
  initialThreadId,
  initialTurns,
  loadingThread,
  resetSignal,
  sidebarToggle,
  historyCount,
  onOpenHistory,
  onNewChat,
  onConversationSync,
}: AskCopilotViewProps = {}) {
  return (
    <VigilCopilotChat
      embedded
      initialConversationId={initialConversationId}
      initialThreadId={initialThreadId}
      initialTurns={initialTurns}
      loadingThread={loadingThread}
      resetSignal={resetSignal}
      sidebarToggle={sidebarToggle}
      historyCount={historyCount}
      onOpenHistory={onOpenHistory}
      onNewChat={onNewChat}
      onConversationSync={onConversationSync}
    />
  );
}
