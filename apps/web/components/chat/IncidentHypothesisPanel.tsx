"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Code2,
  Copy,
  Check,
  ChevronRight,
  Ticket,
  Radio,
  CalendarClock,
} from "lucide-react";
import type { Hypothesis, ProposedAction } from "../../types/vigil";

interface IncidentHypothesisPanelProps {
  hypotheses?: Hypothesis[];
  proposedAction?: ProposedAction | null;
  approvalId?: string | null;
  approvalDecision?: "pending" | "approved" | "rejected" | null;
  onDecideApproval?: (approvalId: string, decision: "approved" | "rejected") => void;
}

export const IncidentHypothesisPanel: React.FC<IncidentHypothesisPanelProps> = ({
  hypotheses = [],
  proposedAction = null,
  approvalId = null,
  approvalDecision = "pending",
  onDecideApproval,
}) => {
  const [showPayload, setShowPayload] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const handleCopyPayload = (payload: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 1800);
  };

  const getActionMeta = (kind: ProposedAction["kind"]) => {
    switch (kind) {
      case "create_ticket":
        return { icon: Ticket, label: "Create incident ticket" };
      case "post_status":
        return { icon: Radio, label: "Post status update" };
      case "schedule_followup":
        return { icon: CalendarClock, label: "Schedule follow-up" };
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {hypotheses.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#1d1f24] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <h4 className="text-[12.5px] font-medium text-[#d8dae0]">
              Root-cause hypotheses
            </h4>
            <span className="text-[11.5px] text-[#7c7e87]">
              {hypotheses.length} ranked
            </span>
          </div>

          <div className="divide-y divide-white/[0.05]">
            {hypotheses.map((h, idx) => {
              const pct = Math.round(h.confidence <= 1 ? h.confidence * 100 : h.confidence);
              return (
                <div key={idx} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`font-mono-only mt-0.5 shrink-0 text-[11.5px] font-medium ${
                          idx === 0 ? "text-[#e56b4e]" : "text-[#6b6d76]"
                        }`}
                      >
                        {idx + 1}.
                      </span>
                      <p className="text-[13.5px] font-medium leading-snug text-[#ececef]">
                        {h.cause}
                      </p>
                    </div>
                    <span className="font-mono-only shrink-0 text-[12px] tabular-nums text-[#a7a9b2]">
                      {pct}%
                    </span>
                  </div>

                  <div className="mt-2.5 ml-5 h-[3px] w-auto overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 75
                          ? "bg-[#e56b4e]"
                          : pct >= 50
                            ? "bg-amber-400/80"
                            : "bg-white/25"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <p className="mt-2 ml-5 text-[12.5px] leading-relaxed text-[#8a8c95]">
                    {h.evidence}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {proposedAction && (() => {
        const meta = getActionMeta(proposedAction.kind);
        const ActionIcon = meta.icon;
        const isPending = !approvalDecision || approvalDecision === "pending";

        return (
          <div
            className={`rounded-xl border border-white/[0.09] bg-[#1f2127] overflow-hidden border-l-2 ${
              approvalDecision === "approved"
                ? "border-l-emerald-400/80"
                : approvalDecision === "rejected"
                  ? "border-l-white/20"
                  : "border-l-[#e56b4e]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11.5px] text-[#8a8c95]">
                  <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{meta.label}</span>
                  <span className="text-[#555760]">·</span>
                  <span className="font-mono-only truncate text-[#9b9ca3]">
                    {proposedAction.target}
                  </span>
                </div>
                <h4 className="mt-1 text-[14px] font-medium text-[#ececef]">
                  {proposedAction.title}
                </h4>
              </div>

              {approvalDecision === "approved" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Approved
                </span>
              )}
              {approvalDecision === "rejected" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11.5px] font-medium text-[#94969e]">
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Rejected
                </span>
              )}
              {isPending && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e56b4e]/12 px-2.5 py-1 text-[11.5px] font-medium text-[#f7a08a]">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Needs approval
                </span>
              )}
            </div>

            <div className="px-4 py-3.5 space-y-3">
              <p className="text-[13px] leading-relaxed text-[#b5b7be]">
                {proposedAction.rationale}
              </p>

              <div className="rounded-lg border border-white/[0.06] bg-[#111216]">
                <div className="flex items-center justify-between px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setShowPayload((v) => !v)}
                    aria-expanded={showPayload}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-[#94969e] transition-colors hover:text-[#ececef]"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${
                        showPayload ? "rotate-90" : ""
                      }`}
                      aria-hidden="true"
                    />
                    <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Payload ({Object.keys(proposedAction.payload).length} fields)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyPayload(proposedAction.payload)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11.5px] text-[#8a8c95] transition-colors hover:bg-white/[0.06] hover:text-[#ececef]"
                    title="Copy JSON payload"
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {showPayload && (
                  <pre className="dash-scroll max-h-56 overflow-x-auto border-t border-white/[0.06] p-3 font-mono-only text-[11.5px] leading-relaxed text-[#c9cbd3]">
                    {JSON.stringify(proposedAction.payload, null, 2)}
                  </pre>
                )}
              </div>

              {isPending && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onDecideApproval?.(approvalId || "action_1", "rejected")
                    }
                    className="dash-btn-ghost"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onDecideApproval?.(approvalId || "action_1", "approved")
                    }
                    className="dash-btn-primary"
                  >
                    Approve &amp; execute
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
