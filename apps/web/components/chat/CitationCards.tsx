"use client";

import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, FileText, ExternalLink, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import type { Citation, Confidence } from '../../types/vigil';

interface CitationCardsProps {
  citations?: Citation[];
  confidence?: Confidence;
  grounded?: boolean;
}

export const CitationCards: React.FC<CitationCardsProps> = ({
  citations = [],
  confidence = 'high',
  grounded = true,
}) => {
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);

  if (!citations || citations.length === 0) {
    return null;
  }

  const getConfidenceBadge = (level: Confidence) => {
    switch (level) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            High Confidence
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Medium Confidence
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Low Confidence
          </span>
        );
    }
  };

  return (
    <div className="mt-3 pt-2.5 border-t border-white/[0.08] text-xs">
      {/* Top Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {grounded ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Grounded in Sources
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-zinc-400" />
              Needs Review
            </span>
          )}

          {getConfidenceBadge(confidence)}
        </div>

        <span className="text-[11px] text-zinc-500 font-mono">
          {citations.length} cited {citations.length === 1 ? 'artifact' : 'artifacts'}
        </span>
      </div>

      {/* Citations Grid */}
      <div className="flex flex-wrap gap-2">
        {citations.map((c) => {
          const isSelected = activeSnippetId === c.sourceId;
          const isPdf = c.sourceUrl?.endsWith('.pdf') || c.sourceId.includes('.pdf') || c.title.toLowerCase().includes('runbook');

          return (
            <div key={c.sourceId} className="flex-1 min-w-[200px] max-w-full">
              <button
                type="button"
                onClick={() => setActiveSnippetId(isSelected ? null : c.sourceId)}
                className={`w-full text-left p-2 rounded-lg border transition-all text-xs flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#1e1e26] border-[#e07a67]/50 shadow-md ring-1 ring-[#e07a67]/20'
                    : 'bg-[#131317] hover:bg-[#18181f] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-shrink-0 w-6 h-6 rounded bg-white/[0.05] flex items-center justify-center text-zinc-400">
                    {isPdf ? (
                      <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-200 truncate text-[11.5px]">{c.title}</p>
                    <p className="font-mono text-[10px] text-zinc-500 truncate">{c.sourceId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-zinc-500 flex-shrink-0">
                  {c.sourceUrl && (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Open source URL"
                      className="p-1 hover:text-zinc-200 hover:bg-white/10 rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {isSelected ? (
                    <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </div>
              </button>

              {/* Expanded Snippet Popover */}
              {isSelected && (
                <div className="mt-1.5 p-3 rounded-lg bg-[#0e0e12] border border-[#e07a67]/30 shadow-lg text-[11.5px] animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/[0.06]">
                    <span className="text-[10.5px] uppercase tracking-wider font-semibold text-zinc-400">
                      Verified Passage
                    </span>
                    {c.sourceUrl && (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#e07a67] hover:underline flex items-center gap-1 font-mono"
                      >
                        Source Document <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <blockquote className="italic text-zinc-300 font-mono text-[11px] leading-relaxed bg-black/40 p-2 rounded border-l-2 border-[#e07a67]">
                    "{c.snippet}"
                  </blockquote>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
