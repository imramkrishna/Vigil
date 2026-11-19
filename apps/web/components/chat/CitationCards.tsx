"use client";

import React, { useState } from "react";
import { ShieldCheck, AlertTriangle, FileText, ExternalLink, BookOpen } from "lucide-react";
import type { Citation, Confidence } from "../../types/vigil";

interface CitationCardsProps {
  citations?: Citation[];
  confidence?: Confidence;
  grounded?: boolean;
}

export const CitationCards: React.FC<CitationCardsProps> = ({
  citations = [],
  confidence = "high",
  grounded = true,
}) => {
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);

  if (!citations || citations.length === 0) {
    return null;
  }

  const activeCitation = citations.find((c) => c.sourceId === activeSnippetId) ?? null;

  const confidenceLabel =
    confidence === "high"
      ? "High confidence"
      : confidence === "medium"
        ? "Medium confidence"
        : "Low confidence";

  return (
    <div className="mt-4 pt-3 border-t border-white/[0.06]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#8a8c95] mr-1">
          {grounded ? (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400/80" aria-hidden="true" />
          )}
          <span>{grounded ? "Verified" : "Needs review"}</span>
          <span className="text-[#555760]">·</span>
          <span className="text-[#7c7e87]">{confidenceLabel}</span>
        </span>

        {citations.map((c, idx) => {
          const isSelected = activeSnippetId === c.sourceId;
          const isPdf =
            c.sourceUrl?.endsWith(".pdf") ||
            c.sourceId.includes(".pdf") ||
            c.title.toLowerCase().includes("runbook");

          return (
            <button
              key={c.sourceId}
              type="button"
              onClick={() => setActiveSnippetId(isSelected ? null : c.sourceId)}
              aria-expanded={isSelected}
              className={`inline-flex max-w-[260px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                isSelected
                  ? "border-white/[0.22] bg-white/[0.09] text-[#ececef]"
                  : "border-white/[0.08] bg-white/[0.025] text-[#a7a9b2] hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-[#ececef]"
              }`}
            >
              <span className="font-mono-only text-[10.5px] text-[#7c7e87]">
                {idx + 1}
              </span>
              {isPdf ? (
                <BookOpen className="h-3 w-3 shrink-0 text-[#8a8c95]" aria-hidden="true" />
              ) : (
                <FileText className="h-3 w-3 shrink-0 text-[#8a8c95]" aria-hidden="true" />
              )}
              <span className="truncate">{c.title}</span>
            </button>
          );
        })}
      </div>

      {activeCitation && (
        <div className="dash-rise mt-2.5 rounded-xl border border-white/[0.08] bg-[#1d1f24] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-[#ececef]">
                {activeCitation.title}
              </div>
              <div className="font-mono-only truncate text-[11px] text-[#7c7e87]">
                {activeCitation.sourceId}
              </div>
            </div>
            {activeCitation.sourceUrl && (
              <a
                href={activeCitation.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[#a7a9b2] transition-colors hover:bg-white/[0.06] hover:text-[#ececef]"
              >
                <span>Open</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
          <p className="mt-2.5 border-l-2 border-[#e56b4e]/60 pl-3 text-[13px] leading-relaxed text-[#b8bac2]">
            {activeCitation.snippet}
          </p>
        </div>
      )}
    </div>
  );
};
