"use client";

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Flame,
  Plus,
  Copy,
  Check,
  Server,
  BookOpen,
  ArrowRight,
  Shield,
  Zap,
  Activity,
  Layers,
  Terminal,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Bot,
  User,
} from 'lucide-react';
import type {
  ChatTurn,
  Mode,
  Severity,
  Citation,
  Hypothesis,
  ProposedAction,
  ActionItem,
  ServiceRegistrationPayload,
} from '../../types/vigil';
import { PromptComposer } from './PromptComposer';
import { AgentTimelineTrace } from './AgentTimelineTrace';
import { CitationCards } from './CitationCards';
import { IncidentHypothesisPanel } from './IncidentHypothesisPanel';
import { PostmortemArtifactCard } from './PostmortemArtifactCard';
import { EvidenceDrawer } from './EvidenceDrawer';
import { ServicePlatformModal } from '../ops/ServicePlatformModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface VigilCopilotChatProps {
  initialThreadId?: string;
  initialTurns?: ChatTurn[];
  initialMode?: Mode;
  embedded?: boolean;
  onSendMessage?: (turn: ChatTurn) => void;
  onApprovalDecision?: (approvalId: string, decision: 'approved' | 'rejected') => void;
  onServiceRegistered?: (service: ServiceRegistrationPayload) => void;
  onExportZip?: () => void;
}

export const VigilCopilotChat: React.FC<VigilCopilotChatProps> = ({
  initialThreadId = 'vigil_thr_981a2f',
  initialTurns = [],
  initialMode = 'ask',
  embedded = false,
  onSendMessage,
  onApprovalDecision,
  onServiceRegistered,
  onExportZip,
}) => {
  const [threadId, setThreadId] = useState(initialThreadId);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [severity, setSeverity] = useState<Severity>('SEV-1');
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedThreadId, setCopiedThreadId] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [turns, isGenerating]);

  // Aggregate all citations across turns for the EvidenceDrawer
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
    setTimeout(() => setCopiedThreadId(false), 2000);
  };

  const handleNewThread = () => {
    const newId = `vigil_thr_${Math.random().toString(36).substring(2, 9)}`;
    setThreadId(newId);
    setTurns([]);
    setIsGenerating(false);
  };

  const handleApproval = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.approvalId === approvalId || (!t.approvalId && t.proposedAction)) {
          return {
            ...t,
            approvalDecision: decision,
          };
        }
        return t;
      })
    );
    onApprovalDecision?.(approvalId, decision);

    try {
      const res = await fetch(`${API_BASE}/api/approvals/${approvalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          setTurns((prev) => [
            ...prev,
            {
              id: `asst_res_${Date.now()}`,
              role: 'assistant',
              mode: 'incident',
              createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  // Agent Response Dispatcher (calls backend API first, falls back to demo simulation if offline)
  const handleUserPromptSubmit = async (
    content: string,
    _attachments?: Array<{ name: string; size: number; type: string }>
  ) => {
    const userTurn: ChatTurn = {
      id: `usr_${Date.now()}`,
      role: 'user',
      mode,
      content,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTurns((prev) => [...prev, userTurn]);
    setIsGenerating(true);

    try {
      if (mode === 'ask') {
        const res = await fetch(`${API_BASE}/api/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query: content, threadId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.threadId) setThreadId(data.threadId);
          const liveTurn: ChatTurn = {
            id: `asst_${Date.now()}`,
            role: 'assistant',
            mode: 'ask',
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: data.answer || 'Completed query.',
            citations: data.citations || [],
            confidence: data.confidence || 'high',
            grounded: data.grounded ?? true,
            timeline: data.timeline || [],
          };
          setTurns((prev) => [...prev, liveTurn]);
          setIsGenerating(false);
          onSendMessage?.(liveTurn);
          return;
        }
      } else if (mode === 'incident') {
        const res = await fetch(`${API_BASE}/api/incidents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: content.slice(0, 100),
            severity,
            symptomSummary: content,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.threadId) setThreadId(data.threadId);
          const liveTurn: ChatTurn = {
            id: `asst_${Date.now()}`,
            role: 'assistant',
            mode: 'incident',
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: data.answer || 'Incident investigation paused at approval gate.',
            citations: data.citations || [],
            confidence: data.confidence || 'high',
            grounded: true,
            timeline: data.timeline || [],
            hypotheses: data.hypotheses || [],
            proposedAction: data.proposedAction || undefined,
            approvalId: data.incident?.id,
            approvalDecision: data.proposedAction ? 'pending' : undefined,
          };
          setTurns((prev) => [...prev, liveTurn]);
          setIsGenerating(false);
          onSendMessage?.(liveTurn);
          return;
        }
      }
    } catch {
      // Fall back to rich interactive demo response below when API is unreachable
    }

    // Simulate Agent Reasoning & Multi-step Execution
    await new Promise((r) => setTimeout(r, 800));

    let assistantTurn: ChatTurn;

    if (mode === 'incident' || content.toLowerCase().includes('502') || content.toLowerCase().includes('fail')) {
      assistantTurn = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        mode: 'incident',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: 'high',
        grounded: true,
        timeline: [
          'Classified intent=investigate (service=checkout-api, severity=' + severity + ')',
          'Called tools: fetch_recent_deploys(service="checkout-api", limit=3)',
          'Fetched live error logs: Cloud Run container 502 Bad Gateway spike (+340% over baseline)',
          'Extracted trace id: 4a9f81bc-0e12-4d2b-98f1-394f71a098c2',
          'RAG search against payment-runbook-v4.pdf: query="circuit breaker timeout & pool exhaustion"',
          'Verified grounding: 3 sources cited (confidence=0.94)',
          'Synthesized ranked hypotheses and prepared HITL traffic mitigation action',
        ],
        citations: [
          {
            sourceId: 'RUNBOOK-PAY-V4#sec-rollback',
            title: 'Payment Gateway Rollback & Circuit Breaker Runbook',
            sourceUrl: 'https://docs.vigil.internal/runbooks/checkout-rollback.pdf',
            snippet: 'When downstream Stripe webhook latency spikes above 2500ms, set POOL_TIMEOUT_MS=5000 and roll back to the previous stable container tag (sha-8f2a1b).',
          },
          {
            sourceId: 'GIT-PR#4912',
            title: 'PR #4912: Migrate checkout connection pool to PgBouncer',
            sourceUrl: 'https://github.com/org/checkout-api/pull/4912',
            snippet: 'Merge commit 9b8f2c3 changed max_connections from 80 to 20 without updating transaction timeout thresholds.',
          },
          {
            sourceId: 'DATADOG-LOG-STREAM#991',
            title: 'checkout-api Live Tail (Cloud Run us-central1)',
            snippet: 'FATAL 2026-11-04T04:12:01Z [pool] Connection pool exhausted: 20/20 active leases, 412 queued callers timed out waiting for connection (502 Gateway Timeout).',
          },
        ],
        hypotheses: [
          {
            cause: 'PgBouncer connection pool saturation triggered by commit 9b8f2c3 (reduced pool size to 20)',
            confidence: 0.94,
            evidence: 'Database lease timeout logs coincide exactly with 04:10:00Z deployment tag v2.4.1.',
          },
          {
            cause: 'Upstream Stripe API webhook latency degradation holding connections open > 3000ms',
            confidence: 0.62,
            evidence: 'Average response time on /v1/charge increased from 180ms to 2400ms.',
          },
          {
            cause: 'Container CPU throttling on Cloud Run during auto-scale event',
            confidence: 0.28,
            evidence: 'CPU utilization reached 78% but container count scaled from 4 to 12 as expected.',
          },
        ],
        proposedAction: {
          kind: 'create_ticket',
          title: `Initiate Immediate Rollback & Post Incident Notification (${severity})`,
          target: 'Slack: #incidents-payments & Jira: PAY-4091',
          rationale: 'Rollback to commit 8f2a1b will immediately restore connection pool capacity to 80 while the payment engineering team investigates transaction leak.',
          evidenceIds: ['RUNBOOK-PAY-V4#sec-rollback', 'GIT-PR#4912'],
          idempotencyKey: `action_rollback_${Date.now()}`,
          payload: {
            service: 'checkout-api',
            currentTag: 'v2.4.1-9b8f2c3',
            rollbackTag: 'v2.4.0-8f2a1b',
            severity,
            notifyChannels: ['#incidents-payments', '#eng-all'],
            autoRollbackGcpTraffic: true,
          },
        },
        approvalId: `appr_${Date.now()}`,
        approvalDecision: 'pending',
        content: `### Incident Diagnostic Summary (${severity})
I have completed autonomous cross-correlation across **Cloud Run live logs**, **Git commits**, and our **verified payment runbooks**.

**Primary Finding**: The 502 Bad Gateway errors on \`checkout-api\` are caused by database connection pool starvation following deploy \`v2.4.1\` (commit \`9b8f2c3\`). The connection pool capacity was restricted to 20 leases without enabling PgBouncer transaction pooling.

I have staged an **immediate rollback action** and broadcast draft below for your approval.`,
      };
    } else if (mode === 'postmortem') {
      assistantTurn = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        mode: 'postmortem',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: 'high',
        grounded: true,
        timeline: [
          'Collected telemetry logs from Cloud Run (03:45 - 04:30 UTC)',
          'Queried PagerDuty & Slack incident channel #incidents-payments',
          'Compiled timeline markers (T0 detection: 04:11 UTC, T1 mitigation: 04:24 UTC)',
          'Generated structured blameless postmortem artifact with 4 preventative action items',
        ],
        content: `I have compiled the formal blameless postmortem report for **INC-2026-8841 (checkout-api connection exhaustion)**. You can review the formatted preview, inspect the action items table, or copy the raw Markdown report.`,
        postmortemMarkdown: `# Incident Postmortem: checkout-api Connection Pool Starvation (INC-2026-8841)
**Date:** 2026-11-04 | **Severity:** SEV-1 | **Duration:** 14 minutes | **Owner:** @payments-core

## Executive Summary
Between 04:10 UTC and 04:24 UTC, users experienced intermittent 502 Bad Gateway responses when attempting to finalize checkout carts. Approximately 4.2% of cart checkout attempts failed before traffic was rolled back to container release v2.4.0.

## Root Cause
Deploy \`v2.4.1\` contained a misconfigured connection pooling parameter reducing database pool allocation from 80 connections to 20. Under peak shopping traffic, all leases were saturated within 90 seconds.

## Timeline of Events
- **04:10 UTC:** Automated deployment pipeline promoted v2.4.1 to Cloud Run.
- **04:11 UTC:** Synthetic canary probe failed 5/5 healthchecks on \`/v1/charge\`.
- **04:12 UTC:** Vigil Autonomous Copilot detected 502 anomaly spike (+340%) and alerted \`#incidents-payments\`.
- **04:15 UTC:** Vigil isolated commit 9b8f2c3 and requested operator approval for traffic rollback.
- **04:16 UTC:** Operator approved rollback via Vigil HITL interface.
- **04:24 UTC:** Cloud Run 100% routed back to v2.4.0; error rates normalized to 0.01%.

## Blast Radius & Impact
- Total 502 responses: 1,420
- Impacted active checkout sessions: 312
- Estimated revenue delayed: $18,400 (retried successfully post-mitigation)`,
        actionItems: [
          {
            title: 'Add synthetic load test step to CI checking pool exhaustion under 500 RPS',
            owner: 'alex.dev',
            priority: 'P0',
          },
          {
            title: 'Configure automated Cloud Run rollback threshold on canary error rate > 1%',
            owner: 'sarah.sre',
            priority: 'P1',
          },
          {
            title: 'Update payment-runbook-v4.pdf with PgBouncer connection sizing table',
            owner: 'milo.lead',
            priority: 'P1',
          },
          {
            title: 'Conduct architecture review of PostgreSQL lease timeout defaults',
            owner: 'david.infra',
            priority: 'P2',
          },
        ],
      };
    } else {
      assistantTurn = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        mode: 'ask',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: 'high',
        grounded: true,
        timeline: [
          'Classified query intent=ask (service lookup)',
          'Searched indexed runbooks for payment procedures',
          'Retrieved matching excerpt from payment-runbook-v4.pdf',
        ],
        citations: [
          {
            sourceId: 'RUNBOOK-PAY-V4#sec-3',
            title: 'Payment Services Emergency Operations Manual',
            sourceUrl: 'https://docs.vigil.internal/runbooks/checkout-rollback.pdf',
            snippet: 'To roll back checkout-api safely without dropping active sessions, run: gcloud run services update-traffic checkout-api --to-revisions=PREV=100 --region=us-central1',
          },
        ],
        content: `Based on **payment-runbook-v4.pdf (Section 3: Emergency Rollback)**:

To roll back \`checkout-api\` immediately to the previous healthy revision:
\`\`\`bash
gcloud run services update-traffic checkout-api \\
  --to-revisions=checkout-api-00042-rev=100 \\
  --region=us-central1
\`\`\`

**Key Operational Considerations:**
1. **Traffic Migration:** Cloud Run will instantly reroute 100% of new ingress to the prior revision while draining existing connections over 30s.
2. **Database Migrations:** The schema version between \`v2.4.0\` and \`v2.4.1\` is backwards-compatible; no database rollback is needed.
3. **Cache Invalidation:** Run \`curl -X POST /internal/cache/flush\` if Redis key formats changed.`,
      };
    }

    setTurns((prev) => [...prev, assistantTurn]);
    setIsGenerating(false);
    onSendMessage?.(assistantTurn);
  };

  // Quick Starter Prompts matching screenshot style
  const starterPrompts = [
    {
      title: 'Checkout-API 502s Anomaly',
      query: 'Why is checkout-api returning 502s after the latest deploy? Check commit diffs and live logs.',
      mode: 'incident' as Mode,
      badge: 'Active Incident',
      sev: 'SEV-1' as Severity,
    },
    {
      title: 'Payment Runbook Rollback Procedure',
      query: 'What is the exact rollback procedure and command in our payment service runbook?',
      mode: 'ask' as Mode,
      badge: 'Runbook RAG',
      sev: 'SEV-2' as Severity,
    },
    {
      title: 'Draft Postmortem Report',
      query: 'Draft a blameless postmortem for INC-2026-8841 with timeline, root cause, and action items.',
      mode: 'postmortem' as Mode,
      badge: 'Artifact Gen',
      sev: 'SEV-1' as Severity,
    },
  ];

  return (
    <div className={`relative flex ${embedded ? 'h-full' : 'h-screen'} w-full bg-[#08080a] text-zinc-100 overflow-hidden font-sans`}>
      {/* Main Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Top App Header Bar */}
        <header className="h-14 border-b border-white/[0.08] px-4 md:px-6 flex items-center justify-between bg-[#0e0e12]/80 backdrop-blur-xl z-20">
          {/* Left: Thread ID */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Active Thread Pill */}
            <div className="flex items-center gap-1.5 bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/5 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-zinc-400 truncate max-w-[120px] md:max-w-[180px]">
                {threadId}
              </span>
              <button
                type="button"
                onClick={handleCopyThreadId}
                className="text-zinc-500 hover:text-zinc-300 ml-0.5 p-0.5 transition-colors"
                title="Copy Thread ID"
              >
                {copiedThreadId ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Register Service button */}
            <button
              type="button"
              onClick={() => setIsServiceModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-white/[0.06] text-zinc-300 hover:text-white border border-white/10 text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Configure Ops Services"
            >
              <Server className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Services</span>
            </button>

            {/* Evidence Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                isEvidenceOpen
                  ? 'bg-white/[0.08] border-white/20 text-white'
                  : 'bg-transparent hover:bg-white/[0.06] border-white/10 text-zinc-300 hover:text-white'
              }`}
              title="Toggle Evidence & Citations Drawer"
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Evidence</span>
              {allCitations.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#f04438] text-white text-[10px] font-mono font-bold">
                  {allCitations.length}
                </span>
              )}
            </button>

            {/* New Thread */}
            <button
              type="button"
              onClick={handleNewThread}
              className="p-1.5 md:px-2.5 md:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-medium transition-colors flex items-center gap-1"
              title="Start New Thread"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">New Thread</span>
            </button>

            {/* Export ZIP */}
            {onExportZip && (
              <button
                type="button"
                onClick={onExportZip}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors flex items-center gap-1.5"
                title="Download Clean Modular React+TS Components as ZIP for Next.js"
              >
                <span>Export .ZIP</span>
              </button>
            )}
          </div>
        </header>

        {/* Chat Body Stream */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {turns.length === 0 ? (
            /* Empty State matching the screenshot's central aesthetic */
            <div className="max-w-2xl mx-auto pt-8 md:pt-16 pb-6 text-center space-y-6 animate-in fade-in duration-300">
              {/* Official Vigil Logo & Greeting */}
              <div className="flex flex-col items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center shadow-[0_0_25px_rgba(240,68,56,0.25)]">
                  <Image src="/vigil.svg" alt="Vigil" width={28} height={28} className="w-7 h-7 object-contain" />
                </div>
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
                  What are we investigating?
                </h2>
              </div>

              <p className="text-sm md:text-base text-zinc-400 max-w-lg mx-auto leading-relaxed">
                Autonomous engineering operations copilot for live cloud telemetry, root-cause hypothesis ranking, and human-in-the-loop action execution.
              </p>

              {/* Operational Quick-Start Cards */}
              <div className="grid grid-cols-1 gap-3 text-left pt-4">
                <span className="text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium px-1">
                  Quick Diagnostic Starters
                </span>
                {starterPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMode(p.mode);
                      setSeverity(p.sev);
                      handleUserPromptSubmit(p.query);
                    }}
                    className="p-3.5 rounded-2xl border border-white/[0.08] bg-[#121217]/80 hover:bg-[#181820] hover:border-white/20 transition-all group flex items-center justify-between text-left shadow-sm hover:shadow-md"
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                          {p.title}
                        </span>
                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1">{p.query}</p>
                    </div>

                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-[#f04438] transition-all flex-shrink-0">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Stream of Turns */
            <div className="max-w-4xl mx-auto space-y-6">
              {turns.map((turn) => {
                const isUser = turn.role === 'user';

                return (
                  <div
                    key={turn.id}
                    className={`flex gap-3 md:gap-4 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Image src="/vigil.svg" alt="Vigil" width={16} height={16} className="w-4 h-4 object-contain" />
                      </div>
                    )}

                    <div
                      className={`max-w-[90%] md:max-w-[85%] rounded-2xl transition-all ${
                        isUser
                          ? 'bg-[#1e1e26] border border-white/10 p-3.5 text-zinc-100 shadow-sm'
                          : 'bg-[#121217]/95 border border-white/[0.08] p-4 text-zinc-200 shadow-md backdrop-blur-md'
                      }`}
                    >
                      {/* Message Meta */}
                      <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-white/[0.04] text-[11px] font-mono text-zinc-500">
                        <span className="font-semibold text-zinc-400">
                          {isUser ? 'Operator' : 'Vigil Copilot'}
                        </span>
                        <span>{turn.createdAt}</span>
                      </div>

                      {/* Content Prose */}
                      <div className="text-xs md:text-sm leading-relaxed space-y-2 whitespace-pre-wrap">
                        {turn.content}
                      </div>

                      {/* Collapsible Agent Timeline Trace */}
                      {turn.timeline && turn.timeline.length > 0 && (
                        <AgentTimelineTrace
                          timeline={turn.timeline}
                          defaultExpanded={false}
                        />
                      )}

                      {/* Grounded Citations & Verification Badges */}
                      {turn.citations && turn.citations.length > 0 && (
                        <CitationCards
                          citations={turn.citations}
                          confidence={turn.confidence || 'high'}
                          grounded={turn.grounded ?? true}
                        />
                      )}

                      {/* Incident Hypothesis & HITL Approval Panel */}
                      {(turn.hypotheses || turn.proposedAction) && (
                        <IncidentHypothesisPanel
                          hypotheses={turn.hypotheses}
                          proposedAction={turn.proposedAction}
                          approvalId={turn.approvalId}
                          approvalDecision={turn.approvalDecision}
                          onDecideApproval={handleApproval}
                        />
                      )}

                      {/* Postmortem Artifact Card */}
                      {turn.postmortemMarkdown && (
                        <PostmortemArtifactCard
                          postmortemMarkdown={turn.postmortemMarkdown}
                          actionItems={turn.actionItems}
                        />
                      )}
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-lg bg-[#272732] border border-white/10 flex items-center justify-center text-zinc-300 flex-shrink-0 mt-1">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isGenerating && (
                <div className="flex gap-3 md:gap-4 items-start animate-in fade-in">
                  <div className="w-7 h-7 rounded-lg bg-[#f04438] flex items-center justify-center text-white flex-shrink-0 animate-pulse">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-2xl bg-[#121217] border border-white/10 text-xs font-mono text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#f04438] animate-ping" />
                    <span>Analyzing telemetry, diffing recent deploys, and searching runbooks...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Bottom Floating Command Bar (Matching screenshot) */}
        <footer className="p-3 md:p-5 bg-gradient-to-t from-[#08080a] via-[#08080a]/90 to-transparent">
          <PromptComposer
            currentMode={mode}
            onChangeMode={setMode}
            severity={severity}
            onChangeSeverity={setSeverity}
            onSubmit={handleUserPromptSubmit}
            isGenerating={isGenerating}
          />
        </footer>
      </div>

      {/* Collapsible Right-hand Evidence & Citations Drawer */}
      <EvidenceDrawer
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
        citations={allCitations}
        liveLogs={[
          {
            timestamp: '04:12:01 UTC',
            level: 'ERROR',
            message: 'Connection pool exhausted: 20/20 active leases, 412 queued callers timed out',
            traceId: '4a9f81bc-0e12-4d2b-98f1-394f71a098c2',
          },
          {
            timestamp: '04:11:45 UTC',
            level: 'WARN',
            message: 'P99 Latency on /v1/charge crossed SLA threshold: 2420ms (> 800ms)',
            traceId: '98fa21cb-4412-1102-12aa-001239840192',
          },
        ]}
        deployDiffs={[
          {
            commit: '9b8f2c3',
            author: 'alex.dev',
            message: 'feat: restrict PgBouncer pool sizing for container isolation',
            diffStat: '+12 -4 lines (database.config.ts)',
          },
          {
            commit: '8f2a1b',
            author: 'sarah.sre',
            message: 'chore: bump base node image & configure gcloud healthcheck',
            diffStat: '+4 -2 lines (Dockerfile)',
          },
        ]}
      />

      {/* Service & Live Log Configuration Modal */}
      <ServicePlatformModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        onRegisterService={async (service) => {
          onServiceRegistered?.(service);
          try {
            const res = await fetch(`${API_BASE}/api/ops/services`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
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
