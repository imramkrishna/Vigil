"use client";

import React, { useState } from "react";
import { ChevronRight, Terminal, Search, ShieldCheck, Cpu, Check } from "lucide-react";

interface AgentTimelineTraceProps {
  timeline?: string[];
  isRunning?: boolean;
  defaultExpanded?: boolean;
}

export const AgentTimelineTrace: React.FC<AgentTimelineTraceProps> = ({
  timeline = [],
  isRunning = false,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if ((!timeline || timeline.length === 0) && !isRunning) {
    return null;
  }

  const getStepIcon = (step: string) => {
    const s = step.toLowerCase();
    if (s.includes("classif") || s.includes("intent")) {
      return <Cpu className="h-3.5 w-3.5 text-[#7c7e87]" aria-hidden="true" />;
    }
    if (s.includes("tool") || s.includes("fetch") || s.includes("deploy") || s.includes("logs")) {
      return <Terminal className="h-3.5 w-3.5 text-[#7c7e87]" aria-hidden="true" />;
    }
    if (s.includes("search") || s.includes("runbook") || s.includes("rag")) {
      return <Search className="h-3.5 w-3.5 text-[#7c7e87]" aria-hidden="true" />;
    }
    if (s.includes("ground") || s.includes("verif") || s.includes("valid")) {
      return <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" aria-hidden="true" />;
    }
    return <Check className="h-3.5 w-3.5 text-[#7c7e87]" aria-hidden="true" />;
  };

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-[12.5px] font-medium text-[#8a8c95] transition-colors hover:bg-white/[0.04] hover:text-[#d8dae0]"
      >
        {isRunning && (
          <span className="h-1.5 w-1.5 rounded-full bg-[#e56b4e] animate-pulse" aria-hidden="true" />
        )}
        <span>
          {isRunning
            ? "Investigating…"
            : `Ran ${timeline.length} ${timeline.length === 1 ? "step" : "steps"}`}
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 text-[#6b6d76] transition-transform duration-150 ${
            isExpanded ? "rotate-90 text-[#94969e]" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div className="dash-rise mt-1.5 ml-1.5 border-l border-white/[0.08] pl-3.5 py-1">
          <ol className="space-y-2">
            {timeline.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[#9b9ca3]"
              >
                <span className="mt-0.5 shrink-0">{getStepIcon(step)}</span>
                <span className="min-w-0 break-words">
                  {step
                    .split(/(tools:[^,\n]+|service=[^\s,)]+|intent=[^\s,)]+)/gi)
                    .map((part, pIdx) => {
                      if (
                        part.startsWith("service=") ||
                        part.startsWith("intent=") ||
                        part.startsWith("tools:")
                      ) {
                        return (
                          <code
                            key={pIdx}
                            className="font-mono-only rounded bg-white/[0.05] px-1 py-px text-[11.5px] text-[#dcdde3]"
                          >
                            {part}
                          </code>
                        );
                      }
                      return <span key={pIdx}>{part}</span>;
                    })}
                </span>
              </li>
            ))}
          </ol>

          {isRunning && (
            <div className="mt-2 flex items-center gap-2 text-[12px] text-[#7c7e87]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e56b4e] animate-pulse" />
              <span>Synthesizing tool outputs…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
