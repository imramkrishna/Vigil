"use client";

import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Code2,
  Copy,
  Check,
  ShieldAlert,
  Ticket,
  Radio,
  CalendarClock,
  Zap,
} from 'lucide-react';
import type { Hypothesis, ProposedAction } from '../../types/vigil';

interface IncidentHypothesisPanelProps {
  hypotheses?: Hypothesis[];
  proposedAction?: ProposedAction | null;
  approvalId?: string | null;
  approvalDecision?: 'pending' | 'approved' | 'rejected' | null;
  onDecideApproval?: (approvalId: string, decision: 'approved' | 'rejected') => void;
}

export const IncidentHypothesisPanel: React.FC<IncidentHypothesisPanelProps> = ({
  hypotheses = [],
  proposedAction = null,
  approvalId = null,
  approvalDecision = 'pending',
  onDecideApproval,
}) => {
  const [showPayload, setShowPayload] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const handleCopyPayload = (payload: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const getActionIcon = (kind: ProposedAction['kind']) => {
    switch (kind) {
      case 'create_ticket':
        return <Ticket className="w-4 h-4 text-zinc-400" />;
      case 'post_status':
        return <Radio className="w-4 h-4 text-zinc-400" />;
      case 'schedule_followup':
        return <CalendarClock className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getActionBadgeLabel = (kind: ProposedAction['kind']) => {
    switch (kind) {
      case 'create_ticket':
        return 'Create Incident Ticket';
      case 'post_status':
        return 'Broadcast Statuspage Update';
      case 'schedule_followup':
        return 'Schedule Triage & Postmortem';
    }
  };

  return (
    <div className="my-3 space-y-3.5">
      {/* 1. Ranked Root-Cause Hypotheses */}
      {hypotheses.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#121216]/95 backdrop-blur-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-[#f04438]/10 text-[#f04438] border border-[#f04438]/20">
                <AlertOctagon className="w-3.5 h-3.5" />
              </span>
              <h4 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
                Ranked Root-Cause Hypotheses
              </h4>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              Bayesian Likelihood
            </span>
          </div>

          <div className="space-y-3">
            {hypotheses.map((h, idx) => {
              const percentage = Math.round(h.confidence * 100);
              const isTop = idx === 0;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border transition-all ${
                    isTop
                      ? 'bg-[#181820] border-[#f04438]/40 shadow-[0_0_15px_-4px_rgba(240,68,56,0.15)]'
                      : 'bg-[#141418] border-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                          isTop
                            ? 'bg-[#f04438] text-white'
                            : 'bg-white/10 text-zinc-400'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <p className="text-xs font-medium text-zinc-100 leading-snug">
                        {h.cause}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span
                        className={`text-xs font-mono font-bold ${
                          percentage >= 75
                            ? 'text-[#f04438]'
                            : percentage >= 50
                            ? 'text-amber-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentage >= 75
                          ? 'bg-gradient-to-r from-orange-500 to-[#f04438]'
                          : percentage >= 50
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : 'bg-zinc-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {/* Evidence Text */}
                  <div className="text-[11px] font-mono text-zinc-400 bg-black/30 p-2 rounded border border-white/[0.03] leading-relaxed">
                    <span className="text-zinc-500 font-semibold select-none">Evidence: </span>
                    {h.evidence}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Human-in-the-Loop (HITL) Interrupt Approval Card */}
      {proposedAction && (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-[#1c1815] to-[#141212] p-4 shadow-lg ring-1 ring-amber-500/20">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <ShieldAlert className="w-4 h-4 animate-pulse" />
              </span>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                  HITL Interrupt Required
                </span>
                <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  {proposedAction.title}
                </h4>
              </div>
            </div>

            {/* Decision Status Badges */}
            {approvalDecision === 'approved' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Approved & Executed
              </span>
            )}
            {approvalDecision === 'rejected' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Action Rejected
              </span>
            )}
            {(!approvalDecision || approvalDecision === 'pending') && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25">
                <Clock className="w-3.5 h-3.5" />
                Pending Operator Approval
              </span>
            )}
          </div>

          {/* Action Details Grid */}
          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
              <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[10px] uppercase font-mono">Action Type</span>
                <span className="font-medium text-zinc-200 flex items-center gap-1.5 mt-0.5">
                  {getActionIcon(proposedAction.kind)}
                  {getActionBadgeLabel(proposedAction.kind)}
                </span>
              </div>
              <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                <span className="text-zinc-500 block text-[10px] uppercase font-mono">Target Destination</span>
                <span className="font-mono text-zinc-200 mt-0.5 block truncate">
                  {proposedAction.target}
                </span>
              </div>
            </div>

            <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
              <span className="text-zinc-500 block text-[10px] uppercase font-mono mb-0.5">Safety & Rationale</span>
              <p className="text-zinc-300 leading-relaxed text-[11.5px]">
                {proposedAction.rationale}
              </p>
            </div>

            {/* Expandable JSON Payload */}
            <div className="rounded-lg border border-white/5 bg-black/40 overflow-hidden">
              <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
                <button
                  type="button"
                  onClick={() => setShowPayload(!showPayload)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-mono text-[11px]">
                    Payload ({Object.keys(proposedAction.payload).length} keys)
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {showPayload ? '(Collapse)' : '(Inspect)'}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[140px]">
                    key: {proposedAction.idempotencyKey.slice(0, 10)}...
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyPayload(proposedAction.payload)}
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                    title="Copy Payload JSON"
                  >
                    {copiedPayload ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {showPayload && (
                <pre className="p-3 font-mono text-[11px] text-emerald-300 bg-black/60 overflow-x-auto max-h-56">
                  {JSON.stringify(proposedAction.payload, null, 2)}
                </pre>
              )}
            </div>

            {/* Approval Decision Controls */}
            {(!approvalDecision || approvalDecision === 'pending') && (
              <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => onDecideApproval?.(approvalId || 'action_1', 'rejected')}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5 text-zinc-400" />
                  Reject Action
                </button>

                <button
                  type="button"
                  onClick={() => onDecideApproval?.(approvalId || 'action_1', 'approved')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-red-600 via-[#f04438] to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-md shadow-[#f04438]/25 border border-[#ff6b5b]/40 transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Zap className="w-3.5 h-3.5 text-zinc-400" />
                  Approve & Execute
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
