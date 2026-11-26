"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  Copy,
  Check,
  Server,
  BookOpen,
  SquarePen,
  Flame,
  Terminal,
  Layers,
  History,
} from "lucide-react";
import type {
  ChatTurn,
  Mode,
  Severity,
  Citation,
  ServiceRegistrationPayload,
} from "../../types/vigil";
import { PromptComposer } from "./PromptComposer";
import { AgentTimelineTrace } from "./AgentTimelineTrace";
import { CitationCards } from "./CitationCards";
import { IncidentHypothesisPanel } from "./IncidentHypothesisPanel";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { MarkdownProse } from "./MarkdownProse";
import { ServicePlatformModal } from "../ops/ServicePlatformModal";
import { VigilLoader } from "../VigilLoader";
import { createChat } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface VigilCopilotChatProps {
  initialConversationId?: string | null;
  initialThreadId?: string;
  initialTurns?: ChatTurn[];
  loadingThread?: boolean;
  embedded?: boolean;
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
  onSendMessage?: (turn: ChatTurn) => void;
  onServiceRegistered?: (service: ServiceRegistrationPayload) => void;
  onExportZip?: () => void;
}

const STARTER_PROMPTS = [
  {
    label: "Investigate 502s",
    hint: "Trace recent deploy diffs & live logs",
    query:
      "Why is checkout-api returning 502s after the latest deploy? Check commit diffs, live logs, and runbooks for a fix.",
    sev: "SEV-1" as Severity,
    icon: Flame,
  },
  {
    label: "Crash after deploy",
    hint: "Inspect error logs & rollback steps",
    query:
      "Our latest deployment is crashing on startup. Inspect live error logs and recent commits, and suggest the safest rollback or patch.",
    sev: "SEV-1" as Severity,
    icon: Terminal,
  },
  {
    label: "Latency spike",
    hint: "Correlate config changes & runbooks",
    query:
      "Latency spiked right after our last push. Check recent deploy diffs, service logs, and runbooks for root cause and fixes.",
    sev: "SEV-2" as Severity,
    icon: Layers,
  },
];

export const VigilCopilotChat: React.FC<VigilCopilotChatProps> = ({
  initialConversationId = null,
  initialThreadId = "",
  initialTurns = [],
  loadingThread = false,
  embedded = false,
  resetSignal = 0,
  sidebarToggle,
  historyCount = 0,
  onOpenHistory,
  onNewChat,
  onConversationSync,
  onSendMessage,
  onServiceRegistered,
  onExportZip,
}) => {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId
  );
  const [threadId, setThreadId] = useState(initialThreadId);
  const [severity, setSeverity] = useState<Severity>("SEV-1");
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedThreadId, setCopiedThreadId] = useState(false);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [liveDeployDiffs, setLiveDeployDiffs] = useState<
    Array<{ commit: string; author: string; message: string; diffStat: string }>
  >([]);

  const lastResetRef = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== lastResetRef.current) {
      lastResetRef.current = resetSignal;
      setConversationId(null);
      setThreadId("");
      setTurns([]);
      setIsGenerating(false);
    }
  }, [resetSignal]);

  useEffect(() => {
    if (!isEvidenceOpen) return;
    fetch(`${API_BASE}/api/ops/deploys`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.deploys) return;
        setLiveDeployDiffs(
          data.deploys.slice(0, 8).map((d: Record<string, unknown>) => {
            const diff = (d.configDiff ?? {}) as Record<string, unknown>;
            const stats = diff.stats as { additions?: number; deletions?: number } | undefined;
            return {
              commit: String(d.sha ?? "").slice(0, 7),
              author: String(d.author ?? "unknown"),
              message: String(
                d.message ?? diff.message ?? `Deploy to ${d.service ?? "service"}`
              ),
              diffStat: stats
                ? `+${stats.additions ?? 0} -${stats.deletions ?? 0}`
                : "+1 -1",
            };
          })
        );
      })
      .catch(() => {});
  }, [isEvidenceOpen]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, isGenerating]);

  const allCitations: Citation[] = React.useMemo(() => {
    const list: Citation[] = [];
    turns.forEach((t) => {
      if (t.citations) {
        t.citations.forEach((c) => {
          if (!list.some((existing) => existing.sourceId === c.sourceId)) {
            list.push(c);
          }
        });
      }
    });
    return list;
  }, [turns]);

  const handleCopyThreadId = () => {
    navigator.clipboard.writeText(threadId);
    setCopiedThreadId(true);
    setTimeout(() => setCopiedThreadId(false), 1800);
  };

  const handleCopyTurn = (turnId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTurnId(turnId);
    setTimeout(() => setCopiedTurnId(null), 1800);
  };

  const handleNewThread = () => {
    if (onNewChat) {
      onNewChat();
      return;
    }
    setConversationId(null);
    setThreadId("");
    setTurns([]);
    setIsGenerating(false);
  };

  const handleUserPromptSubmit = async (
    content: string,
    _attachments?: Array<{ name: string; size: number; type: string }>,
    overrideSeverity?: Severity
  ) => {
    const activeSeverity = overrideSeverity ?? severity;

    const userTurn: ChatTurn = {
      id: `usr_${Date.now()}`,
      role: "user",
      mode: "incident",
      content,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const nextWithUser = [...turns, userTurn];
    setTurns(nextWithUser);
    setIsGenerating(true);

    try {
      let activeConvId = conversationId;
      let activeThreadId = threadId;
      if (!activeConvId) {
        const created = await createChat({ mode: "incident" });
        activeConvId = created.id;
        activeThreadId = created.threadId;
        setConversationId(created.id);
        setThreadId(created.threadId);
        onConversationSync?.({
          conversationId: created.id,
          threadId: created.threadId,
          turns: nextWithUser,
          mode: "incident",
          title: created.title,
        });
      }

      const res = await fetch(`${API_BASE}/api/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: content.slice(0, 100),
          severity: activeSeverity,
          symptomSummary: content,
          conversationId: activeConvId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      const resolvedConvId = data.conversationId || activeConvId;
      const resolvedThreadId = data.threadId || activeThreadId;
      if (resolvedConvId) setConversationId(resolvedConvId);
      if (resolvedThreadId) setThreadId(resolvedThreadId);

      const liveTurn: ChatTurn = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        mode: "incident",
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        content:
          data.answer ||
          "Evaluation completed. Review the ranked root causes and suggested fixes below.",
        citations: data.citations || [],
        confidence: data.confidence || "high",
        grounded: true,
        timeline: data.timeline || [],
        hypotheses: data.hypotheses || [],
        suggestedFixes: data.suggestedFixes || [],
      };
      const updatedTurns = [...nextWithUser, liveTurn];
      setTurns(updatedTurns);
      if (resolvedConvId) {
        onConversationSync?.({
          conversationId: resolvedConvId,
          threadId: resolvedThreadId,
          turns: updatedTurns,
          mode: "incident",
          title: data.title,
        });
      }
      onSendMessage?.(liveTurn);
    } catch (err) {
      const errorTurn: ChatTurn = {
        id: `asst_err_${Date.now()}`,
        role: "assistant",
        mode: "incident",
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        content: `**Error:** ${
          err instanceof Error
            ? err.message
            : "Could not reach the Vigil API server. Make sure the API server is running and you are signed in."
        }`,
      };
      setTurns((prev) => [...prev, errorTurn]);
    } finally {
      setIsGenerating(false);
    }
  };

  const isEmpty = turns.length === 0;

  return (
    <div
      className={`relative flex ${
        embedded ? "h-full" : "h-screen"
      } w-full overflow-hidden bg-[#17181b] text-[#ececef]`}
    >
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-[54px] shrink-0 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            {sidebarToggle}
            <span className="text-[14.5px] font-medium tracking-[-0.01em] text-[#f2f2f4]">
              Vigil
            </span>
            {!isEmpty && threadId && (
              <button
                type="button"
                onClick={handleCopyThreadId}
                title="Copy thread ID"
                className="hidden sm:inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 font-mono-only text-[11px] text-[#7f828d] transition-colors hover:bg-white/[0.05] hover:text-[#cfd1d8]"
              >
                <span className="max-w-[130px] truncate">{threadId}</span>
                {copiedThreadId ? (
                  <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[#9b9da6] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4]"
                title="View evaluation history"
              >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">History</span>
                {historyCount > 0 && (
                  <span className="rounded-full bg-white/[0.07] px-1.5 py-px font-mono-only text-[10.5px] text-[#b8bac2]">
                    {historyCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsServiceModalOpen(true)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[#9b9da6] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4]"
              title="Add or configure service"
            >
              <Server className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Services</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEvidenceOpen((v) => !v)}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors ${
                isEvidenceOpen
                  ? "bg-white/[0.09] text-[#f2f2f4]"
                  : "text-[#9b9da6] hover:bg-white/[0.06] hover:text-[#f2f2f4]"
              }`}
              title="Toggle evidence drawer"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Evidence</span>
              {allCitations.length > 0 && (
                <span className="rounded-full bg-[#e56b4e]/20 px-1.5 py-px font-mono-only text-[10.5px] font-medium text-[#fba792]">
                  {allCitations.length}
                </span>
              )}
            </button>

            {!isEmpty && (
              <button
                type="button"
                onClick={handleNewThread}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[#9b9da6] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4]"
                title="New evaluation"
              >
                <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden md:inline">New evaluation</span>
              </button>
            )}

            {onExportZip && (
              <button
                type="button"
                onClick={onExportZip}
                className="dash-btn-ghost ml-1 !py-1.5 !text-[12px]"
              >
                Export .ZIP
              </button>
            )}
          </div>
        </header>

        {loadingThread ? (
          <main className="flex flex-1 items-center justify-center">
            <VigilLoader variant="section" label="Loading evaluation…" />
          </main>
        ) : isEmpty ? (
          <main className="dash-scroll flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-16 sm:px-6">
            <div className="dash-fade w-full max-w-[740px]">
              <div className="mb-8 flex flex-col items-center text-center">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035]">
                  <Image
                    src="/vigil.svg"
                    alt="Vigil"
                    width={24}
                    height={24}
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <h1 className="text-[25px] font-medium tracking-[-0.025em] text-[#f2f2f4] sm:text-[30px]">
                  What deployment failure are we evaluating?
                </h1>
              </div>

              <PromptComposer
                severity={severity}
                onChangeSeverity={setSeverity}
                onSubmit={(content, files) => handleUserPromptSubmit(content, files)}
                isGenerating={isGenerating}
                showDisclaimer={false}
              />

              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {STARTER_PROMPTS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setSeverity(p.sev);
                        handleUserPromptSubmit(p.query, undefined, p.sev);
                      }}
                      className="group flex cursor-pointer items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-left transition-all hover:border-white/[0.15] hover:bg-white/[0.05]"
                    >
                      <Icon
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#848791] transition-colors group-hover:text-[#e56b4e]"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#e2e3e8] group-hover:text-[#f2f2f4]">
                          {p.label}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-[#7f828d]">
                          {p.hint}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </main>
        ) : (
          <>
            <main className="dash-scroll flex-1 overflow-y-auto px-4 pt-4 pb-8 sm:px-6">
              <div className="mx-auto w-full max-w-[740px] space-y-8">
                {turns.map((turn) => {
                  const isUser = turn.role === "user";

                  if (isUser) {
                    return (
                      <div key={turn.id} className="dash-rise flex justify-end">
                        <div className="max-w-[85%] rounded-2xl bg-[#26282e] px-4 py-2.5 text-[14.5px] leading-relaxed text-[#f2f2f4] sm:max-w-[78%]">
                          <p className="whitespace-pre-wrap break-words">{turn.content}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <article key={turn.id} className="dash-rise flex items-start gap-3.5">
                      <div className="mt-0.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] sm:flex">
                        <Image
                          src="/vigil.svg"
                          alt="Vigil"
                          width={16}
                          height={16}
                          className="h-4 w-4 object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        {turn.timeline && turn.timeline.length > 0 && (
                          <AgentTimelineTrace
                            timeline={turn.timeline}
                            defaultExpanded={false}
                          />
                        )}

                        <MarkdownProse content={turn.content} />

                        {((turn.hypotheses && turn.hypotheses.length > 0) ||
                          (turn.suggestedFixes && turn.suggestedFixes.length > 0)) && (
                          <IncidentHypothesisPanel
                            hypotheses={turn.hypotheses}
                            suggestedFixes={turn.suggestedFixes}
                          />
                        )}

                        {turn.citations && turn.citations.length > 0 && (
                          <CitationCards
                            citations={turn.citations}
                            confidence={turn.confidence || "high"}
                            grounded={turn.grounded ?? true}
                          />
                        )}

                        <div className="mt-2.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyTurn(turn.id, turn.content)}
                            aria-label="Copy response"
                            title="Copy response"
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-[#7f828d] transition-colors hover:bg-white/[0.06] hover:text-[#ececef]"
                          >
                            {copiedTurnId === turn.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {isGenerating && (
                  <div className="dash-fade py-1">
                    <VigilLoader
                      variant="inline"
                      label="Evaluating deploys, live logs & runbooks…"
                    />
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </main>

            <footer className="shrink-0 bg-gradient-to-t from-[#17181b] via-[#17181b] to-transparent px-4 pt-2 pb-4 sm:px-6">
              <PromptComposer
                severity={severity}
                onChangeSeverity={setSeverity}
                onSubmit={(content, files) => handleUserPromptSubmit(content, files)}
                isGenerating={isGenerating}
                showDisclaimer={true}
              />
            </footer>
          </>
        )}
      </div>

      <EvidenceDrawer
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
        citations={allCitations}
        deployDiffs={liveDeployDiffs}
      />

      <ServicePlatformModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        onRegisterService={async (service) => {
          try {
            const res = await fetch(`${API_BASE}/api/ops/services`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(service),
            });
            if (res.ok) {
              onServiceRegistered?.(service);
              return true;
            }
          } catch {
            // handled by modal
          }
          return false;
        }}
      />
    </div>
  );
};
