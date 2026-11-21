"use client";

import React from "react";
import { VigilCopilotChat } from "./chat/VigilCopilotChat";
import type { ChatTurn, Mode } from "../types/vigil";

interface AskCopilotViewProps {
  initialConversationId?: string | null;
  initialThreadId?: string;
  initialTurns?: ChatTurn[];
  initialMode?: Mode;
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
  onApprovalDecision?: (approvalId: string, decision: "approved" | "rejected") => void;
}

export function AskCopilotView({
  initialConversationId,
  initialThreadId,
  initialTurns,
  initialMode,
  loadingThread,
  resetSignal,
  sidebarToggle,
  historyCount,
  onOpenHistory,
  onNewChat,
  onConversationSync,
  onApprovalDecision,
}: AskCopilotViewProps = {}) {
  return (
    <VigilCopilotChat
      embedded
      initialConversationId={initialConversationId}
      initialThreadId={initialThreadId}
      initialTurns={initialTurns}
      initialMode={initialMode}
      loadingThread={loadingThread}
      resetSignal={resetSignal}
      sidebarToggle={sidebarToggle}
      historyCount={historyCount}
      onOpenHistory={onOpenHistory}
      onNewChat={onNewChat}
      onConversationSync={onConversationSync}
      onApprovalDecision={onApprovalDecision}
    />
  );
}
