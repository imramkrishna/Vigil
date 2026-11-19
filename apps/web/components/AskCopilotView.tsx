"use client";

import React from "react";
import { VigilCopilotChat } from "./chat/VigilCopilotChat";
import type { ChatTurn, Mode } from "../types/vigil";

interface AskCopilotViewProps {
  initialThreadId?: string;
  initialTurns?: ChatTurn[];
  initialMode?: Mode;
  resetSignal?: number;
  sidebarToggle?: React.ReactNode;
  historyCount?: number;
  onOpenHistory?: () => void;
  onNewChat?: () => void;
  onTurnsChange?: (
    threadId: string,
    turns: ChatTurn[],
    mode: Mode,
    replacedThreadId?: string
  ) => void;
  onApprovalDecision?: (approvalId: string, decision: "approved" | "rejected") => void;
}

export function AskCopilotView({
  initialThreadId,
  initialTurns,
  initialMode,
  resetSignal,
  sidebarToggle,
  historyCount,
  onOpenHistory,
  onNewChat,
  onTurnsChange,
  onApprovalDecision,
}: AskCopilotViewProps = {}) {
  return (
    <VigilCopilotChat
      embedded
      initialThreadId={initialThreadId}
      initialTurns={initialTurns}
      initialMode={initialMode}
      resetSignal={resetSignal}
      sidebarToggle={sidebarToggle}
      historyCount={historyCount}
      onOpenHistory={onOpenHistory}
      onNewChat={onNewChat}
      onTurnsChange={onTurnsChange}
      onApprovalDecision={onApprovalDecision}
    />
  );
}
