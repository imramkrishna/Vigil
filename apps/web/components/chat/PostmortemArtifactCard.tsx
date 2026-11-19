"use client";

import React, { useState } from "react";
import { FileText, Copy, Check, Download } from "lucide-react";
import type { ActionItem } from "../../types/vigil";
import { MarkdownProse } from "./MarkdownProse";

interface PostmortemArtifactCardProps {
  postmortemMarkdown?: string;
  actionItems?: ActionItem[];
  title?: string;
  incidentId?: string;
  onToggleActionItem?: (index: number) => void;
}

export const PostmortemArtifactCard: React.FC<PostmortemArtifactCardProps> = ({
  postmortemMarkdown = "",
  actionItems = [],
  title = "Postmortem report",
  incidentId = "INC-2026-8841",
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "actions" | "raw">("preview");
  const [completedItems, setCompletedItems] = useState<Record<number, boolean>>({});

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(postmortemMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([postmortemMarkdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `postmortem-${incidentId.toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleItem = (idx: number) => {
    setCompletedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const priorityClass = (p: ActionItem["priority"]) => {
    if (p === "P0") return "bg-rose-500/12 text-rose-300";
    if (p === "P1") return "bg-amber-500/12 text-amber-300";
    return "bg-white/[0.06] text-[#a7a9b2]";
  };

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1d1f24]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[#c9cbd3]">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[13.5px] font-medium text-[#ececef]">
              {title}
            </h3>
            <span className="font-mono-only text-[11px] text-[#7c7e87]">
              {incidentId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5">
            {(
              [
                { id: "preview", label: "Preview" },
                { id: "actions", label: `Tasks (${actionItems.length})` },
                { id: "raw", label: "Markdown" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  activeTab === t.id
                    ? "bg-white/[0.1] text-[#ececef]"
                    : "text-[#8a8c95] hover:text-[#d8dae0]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyMarkdown}
            aria-label="Copy Markdown"
            title="Copy Markdown"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#94969e] transition-colors hover:bg-white/[0.06] hover:text-[#ececef]"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            aria-label="Download Markdown"
            title="Download .md"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#94969e] transition-colors hover:bg-white/[0.06] hover:text-[#ececef]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === "preview" && (
          <div className="dash-scroll max-h-[380px] overflow-y-auto pr-1">
            <MarkdownProse content={postmortemMarkdown} compact />
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-1">
            <div className="mb-2 flex items-center justify-between text-[12px] text-[#7c7e87]">
              <span>Follow-up tasks</span>
              <span className="font-mono-only tabular-nums">
                {Object.values(completedItems).filter(Boolean).length}/{actionItems.length} done
              </span>
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {actionItems.map((item, idx) => {
                const isDone = Boolean(completedItems[idx]);
                return (
                  <li
                    key={idx}
                    className={`flex items-start gap-3 py-2.5 transition-opacity ${
                      isDone ? "opacity-50" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(idx)}
                      aria-label={`Mark "${item.title}" ${isDone ? "incomplete" : "complete"}`}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
                        isDone
                          ? "border-emerald-500 bg-emerald-500 text-[#0d0e11]"
                          : "border-white/20 bg-transparent hover:border-white/40"
                      }`}
                    >
                      {isDone && <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[13px] leading-snug ${
                          isDone ? "line-through text-[#7c7e87]" : "text-[#e2e3e8]"
                        }`}
                      >
                        {item.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11.5px]">
                        <span
                          className={`font-mono-only rounded px-1.5 py-px text-[10.5px] font-medium ${priorityClass(item.priority)}`}
                        >
                          {item.priority}
                        </span>
                        <span className="font-mono-only text-[#7c7e87]">
                          @{item.owner}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activeTab === "raw" && (
          <pre className="dash-scroll max-h-[380px] overflow-auto rounded-lg bg-[#141519] p-3.5 font-mono-only text-[12px] leading-relaxed text-[#c9cbd3]">
            {postmortemMarkdown}
          </pre>
        )}
      </div>
    </div>
  );
};
