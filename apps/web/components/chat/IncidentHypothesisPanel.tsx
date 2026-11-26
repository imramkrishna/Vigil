"use client";

import React, { useState } from "react";
import { Copy, Check, Wrench } from "lucide-react";
import type { Hypothesis, SuggestedFix } from "../../types/vigil";

interface IncidentHypothesisPanelProps {
  hypotheses?: Hypothesis[];
  suggestedFixes?: SuggestedFix[];
}

export const IncidentHypothesisPanel: React.FC<IncidentHypothesisPanelProps> = ({
  hypotheses = [],
  suggestedFixes = [],
}) => {
  const [copiedFixIdx, setCopiedFixIdx] = useState<number | null>(null);

  const handleCopyCommand = (idx: number, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedFixIdx(idx);
    setTimeout(() => setCopiedFixIdx(null), 1800);
  };

  if (hypotheses.length === 0 && suggestedFixes.length === 0) {
    return null;
  }

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
              const pct = Math.round(
                h.confidence <= 1 ? h.confidence * 100 : h.confidence
              );
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

      {suggestedFixes.length > 0 && (
        <div className="rounded-xl border border-white/[0.09] border-l-2 border-l-[#e56b4e] bg-[#1f2127] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-[#e56b4e]" aria-hidden="true" />
              <h4 className="text-[12.5px] font-medium text-[#ececef]">
                Suggested fixes
              </h4>
            </div>
            <span className="text-[11.5px] text-[#7c7e87]">
              {suggestedFixes.length}{" "}
              {suggestedFixes.length === 1 ? "fix" : "fixes"}
            </span>
          </div>

          <div className="divide-y divide-white/[0.05]">
            {suggestedFixes.map((fix, idx) => {
              const priorityBadge =
                fix.priority === "P0"
                  ? "bg-rose-500/15 text-rose-300"
                  : fix.priority === "P1"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-white/[0.07] text-[#b5b7be]";

              return (
                <div key={idx} className="px-4 py-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <h5 className="text-[13.5px] font-medium text-[#ececef]">
                      {fix.title}
                    </h5>
                    <span
                      className={`font-mono-only shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${priorityBadge}`}
                    >
                      {fix.priority}
                    </span>
                  </div>

                  <p className="text-[12.5px] leading-relaxed text-[#a7a9b2]">
                    {fix.description}
                  </p>

                  {fix.commandOrPatch && (
                    <div className="rounded-lg border border-white/[0.07] bg-[#111216] overflow-hidden">
                      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
                        <span className="font-mono-only text-[11px] text-[#7c7e87]">
                          Command / Patch
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyCommand(idx, fix.commandOrPatch!)
                          }
                          className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11px] text-[#8a8c95] transition-colors hover:bg-white/[0.06] hover:text-[#ececef]"
                        >
                          {copiedFixIdx === idx ? (
                            <>
                              <Check
                                className="h-3 w-3 text-emerald-400"
                                aria-hidden="true"
                              />
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
                      <pre className="dash-scroll overflow-x-auto p-3 font-mono-only text-[11.5px] leading-relaxed text-[#d4d6dc]">
                        {fix.commandOrPatch}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
