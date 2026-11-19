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
  FileText,
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
import { PostmortemArtifactCard } from "./PostmortemArtifactCard";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { MarkdownProse } from "./MarkdownProse";
import { ServicePlatformModal } from "../ops/ServicePlatformModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface VigilCopilotChatProps {
  initialThreadId?: string;
  initialTurns?: ChatTurn[];
  initialMode?: Mode;
  embedded?: boolean;
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
  onSendMessage?: (turn: ChatTurn) => void;
  onApprovalDecision?: (approvalId: string, decision: "approved" | "rejected") => void;
  onServiceRegistered?: (service: ServiceRegistrationPayload) => void;
  onExportZip?: () => void;
}

const STARTER_PROMPTS = [
  {
    label: "Investigate 502s",
    hint: "Trace checkout-api deploys & logs",
    query:
      "Why is checkout-api returning 502s after the latest deploy? Check commit diffs and live logs.",
    mode: "incident" as Mode,
    sev: "SEV-1" as Severity,
    icon: Flame,
  },
  {
    label: "Payment rollback",
    hint: "Pull steps from indexed runbooks",
    query:
      "What is the exact rollback procedure and command in our payment service runbook?",
    mode: "ask" as Mode,
    sev: "SEV-2" as Severity,
    icon: BookOpen,
  },
  {
    label: "Draft postmortem",
    hint: "Timeline, root cause & follow-ups",
    query:
      "Draft a blameless postmortem for INC-2026-8841 with timeline, root cause, and action items.",
    mode: "postmortem" as Mode,
    sev: "SEV-1" as Severity,
    icon: FileText,
  },
];

export const VigilCopilotChat: React.FC<VigilCopilotChatProps> = ({
  initialThreadId = "vigil_thr_981a2f",
  initialTurns = [],
  initialMode = "ask",
  embedded = false,
  resetSignal = 0,
  sidebarToggle,
  historyCount = 0,
  onOpenHistory,
  onNewChat,
  onTurnsChange,
  onSendMessage,
  onApprovalDecision,
  onServiceRegistered,
  onExportZip,
}) => {
  const [threadId, setThreadId] = useState(initialThreadId);
  const [mode, setMode] = useState<Mode>(initialMode);
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
  const prevThreadIdRef = useRef<string>(initialThreadId);

  const lastResetRef = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== lastResetRef.current) {
      lastResetRef.current = resetSignal;
      setThreadId(`vigil_thr_${Math.random().toString(36).substring(2, 9)}`);
      setTurns([]);
      setIsGenerating(false);
      setMode("ask");
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
              message: String(d.message ?? diff.message ?? `Deploy to ${d.service ?? "service"}`),
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

  useEffect(() => {
    if (turns.length === 0) return;
    const replacedId =
      prevThreadIdRef.current !== threadId
        ? prevThreadIdRef.current
        : undefined;
    prevThreadIdRef.current = threadId;
    onTurnsChange?.(threadId, turns, mode, replacedId);
  }, [threadId, turns, mode, onTurnsChange]);

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
    const newId = `vigil_thr_${Math.random().toString(36).substring(2, 9)}`;
    prevThreadIdRef.current = newId;
    setThreadId(newId);
    setTurns([]);
    setIsGenerating(false);
  };

  const handleApproval = async (approvalId: string, decision: "approved" | "rejected") => {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.approvalId === approvalId || (!t.approvalId && t.proposedAction)) {
          return { ...t, approvalDecision: decision };
        }
        return t;
      })
    );
    onApprovalDecision?.(approvalId, decision);

    try {
      const res = await fetch(`${API_BASE}/api/approvals/${approvalId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          setTurns((prev) => [
            ...prev,
            {
              id: `asst_res_${Date.now()}`,
              role: "assistant",
              mode: "incident",
              createdAt: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              content: data.answer,
              timeline: data.timeline,
            },
          ]);
        }
      }
    } catch {
      // Backend offline — local state already updated
    }
  };

  const handleUserPromptSubmit = async (
    content: string,
    _attachments?: Array<{ name: string; size: number; type: string }>,
    overrideMode?: Mode,
    overrideSeverity?: Severity
  ) => {
    const activeMode = overrideMode ?? mode;
    const activeSeverity = overrideSeverity ?? severity;

    const userTurn: ChatTurn = {
      id: `usr_${Date.now()}`,
      role: "user",
      mode: activeMode,
      content,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setTurns((prev) => [...prev, userTurn]);
    setIsGenerating(true);

    try {
      if (activeMode === "ask") {
        const res = await fetch(`${API_BASE}/api/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ query: content, threadId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.threadId) setThreadId(data.threadId);
          const liveTurn: ChatTurn = {
            id: `asst_${Date.now()}`,
            role: "assistant",
            mode: "ask",
            createdAt: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            content: data.answer || "Completed query.",
            citations: data.citations || [],
            confidence: data.confidence || "high",
            grounded: data.grounded ?? true,
            timeline: data.timeline || [],
          };
          setTurns((prev) => [...prev, liveTurn]);
          setIsGenerating(false);
          onSendMessage?.(liveTurn);
          return;
        }
      } else if (activeMode === "incident") {
        const res = await fetch(`${API_BASE}/api/incidents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: content.slice(0, 100),
            severity: activeSeverity,
            symptomSummary: content,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.threadId) setThreadId(data.threadId);
          const liveTurn: ChatTurn = {
            id: `asst_${Date.now()}`,
            role: "assistant",
            mode: "incident",
            createdAt: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            content: data.answer || "Incident investigation paused at approval gate.",
            citations: data.citations || [],
            confidence: data.confidence || "high",
            grounded: true,
            timeline: data.timeline || [],
            hypotheses: data.hypotheses || [],
            proposedAction: data.proposedAction || undefined,
            approvalId: data.incident?.id,
            approvalDecision: data.proposedAction ? "pending" : undefined,
          };
          setTurns((prev) => [...prev, liveTurn]);
          setIsGenerating(false);
          onSendMessage?.(liveTurn);
          return;
        }
      } else if (activeMode === "postmortem") {
        const listRes = await fetch(`${API_BASE}/api/incidents`, {
          credentials: "include",
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const latestIncident = listData.incidents?.[0];
          if (latestIncident?.id) {
            const pmRes = await fetch(
              `${API_BASE}/api/incidents/${latestIncident.id}/postmortem`,
              { method: "POST", credentials: "include" }
            );
            if (pmRes.ok) {
              const pmData = await pmRes.json();
              if (pmData.threadId) setThreadId(pmData.threadId);
              const liveTurn: ChatTurn = {
                id: `asst_${Date.now()}`,
                role: "assistant",
                mode: "postmortem",
                createdAt: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                content: `Generated blameless postmortem for **${latestIncident.title}** (${latestIncident.severity}).`,
                confidence: "high",
                grounded: true,
                timeline: pmData.timeline || [],
                postmortemMarkdown: pmData.postmortemMarkdown,
                actionItems: pmData.actionItems || [],
              };
              setTurns((prev) => [...prev, liveTurn]);
              setIsGenerating(false);
              onSendMessage?.(liveTurn);
              return;
            }
          }
        }
      }
    } catch {
      // Fall back to interactive demo response when API is unreachable
    }

    await new Promise((r) => setTimeout(r, 700));

    let assistantTurn: ChatTurn;

    if (
      activeMode === "incident" ||
      content.toLowerCase().includes("502") ||
      content.toLowerCase().includes("fail")
    ) {
      assistantTurn = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        mode: "incident",
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        confidence: "high",
        grounded: true,
        timeline: [
          `Classified intent=investigate (service=checkout-api, severity=${activeSeverity})`,
          'Called tools: fetch_recent_deploys(service="checkout-api", limit=3)',
          "Fetched live error logs: Cloud Run container 502 Bad Gateway spike (+340% over baseline)",
          "Extracted trace id: 4a9f81bc-0e12-4d2b-98f1-394f71a098c2",
          'RAG search against payment-runbook-v4.pdf: query="circuit breaker timeout & pool exhaustion"',
          "Verified grounding: 3 sources cited (confidence=0.94)",
          "Synthesized ranked hypotheses and staged rollback approval",
        ],
        citations: [
          {
            sourceId: "RUNBOOK-PAY-V4#sec-rollback",
            title: "Payment Gateway Rollback Runbook",
            sourceUrl: "https://docs.vigil.internal/runbooks/checkout-rollback.pdf",
            snippet:
              "When downstream Stripe webhook latency spikes above 2500ms, set POOL_TIMEOUT_MS=5000 and roll back to the previous stable container tag (sha-8f2a1b).",
          },
          {
            sourceId: "GIT-PR#4912",
            title: "PR #4912: PgBouncer pool migration",
            sourceUrl: "https://github.com/org/checkout-api/pull/4912",
            snippet:
              "Merge commit 9b8f2c3 changed max_connections from 80 to 20 without updating transaction timeout thresholds.",
          },
          {
            sourceId: "DATADOG-LOG-STREAM#991",
            title: "checkout-api Live Tail (us-central1)",
            snippet:
              "FATAL [pool] Connection pool exhausted: 20/20 active leases, 412 queued callers timed out waiting for connection (502 Gateway Timeout).",
          },
        ],
        hypotheses: [
          {
            cause:
              "PgBouncer connection pool saturation triggered by commit 9b8f2c3 (reduced pool size to 20)",
            confidence: 0.94,
            evidence:
              "Database lease timeout logs coincide exactly with 04:10:00Z deployment tag v2.4.1.",
          },
          {
            cause:
              "Upstream Stripe API webhook latency holding connections open > 3000ms",
            confidence: 0.62,
            evidence:
              "Average response time on /v1/charge increased from 180ms to 2400ms.",
          },
          {
            cause: "Container CPU throttling on Cloud Run during auto-scale event",
            confidence: 0.28,
            evidence:
              "CPU utilization reached 78% but container count scaled from 4 to 12 as expected.",
          },
        ],
        proposedAction: {
          kind: "create_ticket",
          title: `Roll back checkout-api to v2.4.0 & notify team (${activeSeverity})`,
          target: "Slack #incidents-payments · Jira PAY-4091",
          rationale:
            "Rolling back to commit 8f2a1b immediately restores connection pool capacity to 80 while the payment team investigates the pool configuration.",
          evidenceIds: ["RUNBOOK-PAY-V4#sec-rollback", "GIT-PR#4912"],
          idempotencyKey: `action_rollback_${Date.now()}`,
          payload: {
            service: "checkout-api",
            currentTag: "v2.4.1-9b8f2c3",
            rollbackTag: "v2.4.0-8f2a1b",
            severity: activeSeverity,
            notifyChannels: ["#incidents-payments", "#eng-all"],
            autoRollbackGcpTraffic: true,
          },
        },
        approvalId: `appr_${Date.now()}`,
        approvalDecision: "pending",
        content: `### Incident summary (${activeSeverity})

I cross-checked **Cloud Run live logs**, **recent Git deploys**, and your **payment runbook**.

**Primary finding:** The 502 Bad Gateway errors on \`checkout-api\` are caused by database connection pool exhaustion following deploy \`v2.4.1\` (commit \`9b8f2c3\`), which reduced pool leases from 80 to 20 without enabling transaction pooling.

Review the ranked causes and proposed rollback below.`,
      };
    } else if (activeMode === "postmortem") {
      assistantTurn = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        mode: "postmortem",
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        confidence: "high",
        grounded: true,
        timeline: [
          "Collected telemetry logs from Cloud Run (03:45 - 04:30 UTC)",
          "Queried incident channel #incidents-payments",
          "Compiled timeline markers (detection 04:11 UTC, mitigation 04:24 UTC)",
          "Generated blameless postmortem report with 4 follow-up tasks",
        ],
        content: `I drafted a blameless postmortem for **INC-2026-8841** (\`checkout-api\` connection pool exhaustion). Review the preview, check off follow-up tasks, or copy the raw Markdown below.`,
        postmortemMarkdown: `# Incident Postmortem: checkout-api Pool Exhaustion (INC-2026-8841)

**Date:** 2026-11-04 · **Severity:** SEV-1 · **Duration:** 14 minutes · **Owner:** @payments-core

## Executive summary
Between 04:10 UTC and 04:24 UTC, users experienced intermittent 502 Bad Gateway responses when finalizing checkout carts. Approximately 4.2% of checkout attempts failed before traffic was rolled back to release \`v2.4.0\`.

## Root cause
Deploy \`v2.4.1\` reduced database pool allocation from 80 connections to 20. Under peak traffic, all leases saturated within 90 seconds.

## Timeline
- **04:10 UTC:** Automated deploy promoted \`v2.4.1\` to Cloud Run.
- **04:11 UTC:** Synthetic canary failed 5/5 checks on \`/v1/charge\`.
- **04:12 UTC:** Vigil detected 502 anomaly spike (+340%) and alerted \`#incidents-payments\`.
- **04:15 UTC:** Vigil isolated commit \`9b8f2c3\` and staged a rollback approval.
- **04:16 UTC:** On-call lead approved rollback.
- **04:24 UTC:** Cloud Run routed 100% of traffic back to \`v2.4.0\`; error rate normalized to 0.01%.

## Impact
- Total 502 responses: 1,420
- Impacted active checkout sessions: 312
- Estimated delayed revenue: $18,400 (retried post-mitigation)`,
        actionItems: [
          {
            title: "Add synthetic load test step to CI checking pool exhaustion under 500 RPS",
            owner: "alex.dev",
            priority: "P0",
          },
          {
            title: "Configure automated Cloud Run rollback when canary error rate exceeds 1%",
            owner: "sarah.sre",
            priority: "P1",
          },
          {
            title: "Update payment-runbook-v4.pdf with PgBouncer connection sizing table",
            owner: "milo.lead",
            priority: "P1",
          },
          {
            title: "Review PostgreSQL lease timeout defaults across payment workers",
            owner: "david.infra",
            priority: "P2",
          },
        ],
      };
    } else {
      assistantTurn = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        mode: "ask",
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        confidence: "high",
        grounded: true,
        timeline: [
          "Classified query intent=ask (service lookup)",
          "Searched indexed runbooks for payment rollback steps",
          "Verified matching excerpt in payment-runbook-v4.pdf",
        ],
        citations: [
          {
            sourceId: "RUNBOOK-PAY-V4#sec-3",
            title: "Payment Services Emergency Manual",
            sourceUrl: "https://docs.vigil.internal/runbooks/checkout-rollback.pdf",
            snippet:
              "To roll back checkout-api safely without dropping active sessions, run: gcloud run services update-traffic checkout-api --to-revisions=PREV=100 --region=us-central1",
          },
        ],
        content: `Based on **payment-runbook-v4.pdf** (Section 3: Emergency Rollback):

To roll back \`checkout-api\` to the previous healthy revision without dropping active sessions:

\`\`\`bash
gcloud run services update-traffic checkout-api \\
  --to-revisions=checkout-api-00042-rev=100 \\
  --region=us-central1
\`\`\`

**Operational notes:**
1. **Traffic migration:** Cloud Run immediately routes 100% of new ingress to the prior revision while draining existing connections over 30s.
2. **Database migrations:** Schema versions \`v2.4.0\` and \`v2.4.1\` are backwards-compatible; no schema rollback is needed.
3. **Cache flush:** Run \`curl -X POST /internal/cache/flush\` only if Redis key formats changed.`,
      };
    }

    setTurns((prev) => [...prev, assistantTurn]);
    setIsGenerating(false);
    onSendMessage?.(assistantTurn);
  };

  const isEmpty = turns.length === 0;
  const emptyHeading =
    mode === "incident"
      ? "What incident are we investigating?"
      : mode === "postmortem"
        ? "Ready to draft a postmortem?"
        : "How can Vigil help today?";

  return (
    <div
      className={`relative flex ${
        embedded ? "h-full" : "h-screen"
      } w-full overflow-hidden bg-[#17181b] text-[#ececef]`}
    >
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        {/* Minimal Claude/ChatGPT-style Top Bar */}
        <header className="z-20 flex h-[54px] shrink-0 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            {sidebarToggle}
            <span className="text-[14.5px] font-medium tracking-[-0.01em] text-[#f2f2f4]">
              Vigil
            </span>
            {!isEmpty && (
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
                title="View chat history"
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
                title="New chat"
              >
                <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden md:inline">New chat</span>
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

        {isEmpty ? (
          /* Centered Claude/ChatGPT Empty State */
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
                  {emptyHeading}
                </h1>
              </div>

              <PromptComposer
                currentMode={mode}
                onChangeMode={setMode}
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
                        setMode(p.mode);
                        setSeverity(p.sev);
                        handleUserPromptSubmit(p.query, undefined, p.mode, p.sev);
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
          /* Active Conversation Stream + Bottom Composer */
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

                        {(turn.hypotheses || turn.proposedAction) && (
                          <IncidentHypothesisPanel
                            hypotheses={turn.hypotheses}
                            proposedAction={turn.proposedAction}
                            approvalId={turn.approvalId}
                            approvalDecision={turn.approvalDecision}
                            onDecideApproval={handleApproval}
                          />
                        )}

                        {turn.postmortemMarkdown && (
                          <PostmortemArtifactCard
                            postmortemMarkdown={turn.postmortemMarkdown}
                            actionItems={turn.actionItems}
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
                  <div className="dash-fade flex items-center gap-3.5">
                    <div className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] sm:flex">
                      <Image
                        src="/vigil.svg"
                        alt="Vigil"
                        width={16}
                        height={16}
                        className="h-4 w-4 object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-[13.5px] text-[#9b9da6]">
                      <span className="h-2 w-2 rounded-full bg-[#e56b4e] animate-pulse" />
                      <span>
                        {mode === "incident"
                          ? "Investigating telemetry & runbooks…"
                          : mode === "postmortem"
                            ? "Drafting postmortem…"
                            : "Thinking…"}
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </main>

            <footer className="shrink-0 bg-gradient-to-t from-[#17181b] via-[#17181b] to-transparent px-4 pt-2 pb-4 sm:px-6">
              <PromptComposer
                currentMode={mode}
                onChangeMode={setMode}
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
          onServiceRegistered?.(service);
          try {
            const res = await fetch(`${API_BASE}/api/ops/services`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(service),
            });
            return res.ok;
          } catch {
            return true;
          }
        }}
      />
    </div>
  );
};
