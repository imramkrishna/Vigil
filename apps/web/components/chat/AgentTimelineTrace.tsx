"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Activity, Terminal, CheckCircle2, Cpu, Search, ShieldCheck } from 'lucide-react';

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

  if (!timeline || timeline.length === 0) {
    if (!isRunning) return null;
  }

  // Parse step category to render contextual icons
  const getStepIcon = (step: string) => {
    const s = step.toLowerCase();
    if (s.includes('classif') || s.includes('intent')) {
      return <Cpu className="w-3.5 h-3.5 text-zinc-400" />;
    }
    if (s.includes('tool') || s.includes('fetch') || s.includes('deploy') || s.includes('logs')) {
      return <Terminal className="w-3.5 h-3.5 text-zinc-400" />;
    }
    if (s.includes('search') || s.includes('runbook') || s.includes('rag')) {
      return <Search className="w-3.5 h-3.5 text-zinc-400" />;
    }
    if (s.includes('ground') || s.includes('verif') || s.includes('valid')) {
      return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
    }
    return <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />;
  };

  return (
    <div className="my-2.5 rounded-xl border border-white/10 bg-[#121216]/90 backdrop-blur-md overflow-hidden transition-all shadow-sm">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center">
            {isRunning ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e07a67] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#e07a67]"></span>
              </span>
            ) : (
              <Activity className="w-3.5 h-3.5 text-zinc-400 group-hover:scale-110 transition-transform" />
            )}
          </div>
          <span className="text-xs font-medium text-zinc-300">
            {isRunning ? 'Working…' : 'Show steps'}
          </span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.06] text-zinc-400 border border-white/5">
            {timeline.length} {timeline.length === 1 ? 'step' : 'steps'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 text-xs">
          <span className="text-[11px] text-zinc-500">{isExpanded ? 'Hide' : 'Inspect'}</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 transition-transform text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 transition-transform text-zinc-400" />
          )}
        </div>
      </button>

      {/* Expanded Step Log */}
      {isExpanded && (
        <div className="px-3.5 pb-3 pt-1 border-t border-white/[0.06] bg-[#0c0c0e]/60">
          <div className="space-y-2 mt-2">
            {timeline.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs group/item">
                <div className="mt-0.5 flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.04] border border-white/5">
                  {getStepIcon(step)}
                </div>
                <div className="flex-1 min-w-0 font-mono text-[11.5px] leading-relaxed text-zinc-300 break-words bg-black/20 px-2 py-1.5 rounded-lg border border-white/[0.03]">
                  <span className="text-zinc-600 select-none mr-2">[{idx + 1}]</span>
                  {/* Highlight tool names or parameter tokens */}
                  {step.split(/(tools:[^,\n]+|service=[^\s,)]+|intent=[^\s,)]+|true|false)/gi).map((part, pIdx) => {
                    if (part.startsWith('service=') || part.startsWith('intent=')) {
                      return <span key={pIdx} className="text-[#e07a67] font-semibold">{part}</span>;
                    }
                    if (part.startsWith('tools:')) {
                      return <span key={pIdx} className="text-amber-400 font-semibold">{part}</span>;
                    }
                    if (part === 'true') {
                      return <span key={pIdx} className="text-emerald-400 font-semibold">{part}</span>;
                    }
                    if (part === 'false') {
                      return <span key={pIdx} className="text-rose-400 font-semibold">{part}</span>;
                    }
                    return <span key={pIdx}>{part}</span>;
                  })}
                </div>
              </div>
            ))}

            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono italic pl-7 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e07a67] animate-pulse"></span>
                Synthesizing tool outputs and verifying safety constraints...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
