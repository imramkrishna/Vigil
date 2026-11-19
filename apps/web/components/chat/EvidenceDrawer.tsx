"use client";

import React, { useEffect, useState } from "react";
import { X, Copy, Check, ExternalLink, BookOpen } from "lucide-react";
import type { Citation } from "../../types/vigil";

type Log = {
  timestamp: string;
  level: "ERROR" | "WARN" | "INFO";
  message: string;
  traceId?: string;
};
type Deploy = {
  commit: string;
  author: string;
  message: string;
  diffStat: string;
};
type Tab = "all" | "sources" | "logs" | "deploys";

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citations: Citation[];
  liveLogs?: Log[];
  deployDiffs?: Deploy[];
}

const LEVEL: Record<Log["level"], { bar: string; text: string }> = {
  ERROR: { bar: "bg-rose-400/80", text: "text-rose-300" },
  WARN: { bar: "bg-amber-400/80", text: "text-amber-300" },
  INFO: { bar: "bg-white/20", text: "text-[#94969e]" },
};

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="cursor-pointer rounded p-1 text-[#7c7e87] opacity-0 transition-all hover:bg-white/[0.08] hover:text-[#ececef] group-hover:opacity-100 focus-visible:opacity-100"
    >
      {done ? (
        <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  );
};

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  isOpen,
  onClose,
  citations,
  liveLogs = [],
  deployDiffs = [],
}) => {
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const total = citations.length + liveLogs.length + deployDiffs.length;
  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "all", label: "All", n: total },
    { id: "sources", label: "Sources", n: citations.length },
    { id: "logs", label: "Logs", n: liveLogs.length },
    { id: "deploys", label: "Deploys", n: deployDiffs.length },
  ];
  const show = (t: Tab) => tab === "all" || tab === t;
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  const rowClass =
    "group relative w-full cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]";

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-label="Evidence panel"
        className="dash-slide fixed inset-y-0 right-0 z-40 flex h-full w-full max-w-[360px] flex-col border-l border-white/[0.06] bg-[#121316] lg:static lg:z-20 lg:w-[360px] lg:shrink-0"
      >
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[13.5px] font-medium text-[#ececef]">Evidence</h3>
            {total > 0 && (
              <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] tabular-nums text-[#a7a9b2]">
                {total}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence panel"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#8a8c95] transition-colors hover:bg-white/[0.06] hover:text-[#ececef]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-white/[0.05] px-3 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                tab === t.id
                  ? "bg-white/[0.08] text-[#ececef]"
                  : "text-[#8a8c95] hover:bg-white/[0.04] hover:text-[#d8dae0]"
              }`}
            >
              <span>{t.label}</span>
              <span className="text-[11px] tabular-nums text-[#6b6d76]">{t.n}</span>
            </button>
          ))}
        </div>

        <div className="dash-scroll flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {total === 0 && (
            <div className="flex flex-col items-center gap-3 pt-16 text-center px-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-[#7c7e87]">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13.5px] font-medium text-[#d8dae0]">
                  No evidence yet
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#7c7e87]">
                  Runbook excerpts, live logs, and deploy diffs will appear here as Vigil investigates.
                </p>
              </div>
            </div>
          )}

          {show("sources") && citations.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <h4 className="text-[12px] font-medium text-[#8a8c95]">Sources</h4>
                <span className="text-[11px] tabular-nums text-[#6b6d76]">
                  {citations.length}
                </span>
              </div>
              <div className="space-y-2">
                {citations.map((c) => {
                  const id = `s-${c.sourceId}`;
                  const expanded = open === id;
                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(id);
                        }
                      }}
                      className={rowClass}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-[#ececef]">
                          {c.title}
                        </span>
                        {c.sourceUrl && (
                          <a
                            href={c.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Open source"
                            className="shrink-0 rounded p-1 text-[#7c7e87] transition-colors hover:bg-white/[0.08] hover:text-[#ececef]"
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                      <p
                        className={`mt-1.5 border-l-2 border-[#e56b4e]/50 pl-2.5 text-[12.5px] leading-relaxed text-[#9b9ca3] ${
                          expanded ? "" : "line-clamp-2"
                        }`}
                      >
                        {c.snippet}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {show("logs") && liveLogs.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <h4 className="text-[12px] font-medium text-[#8a8c95]">Logs</h4>
                <span className="text-[11px] tabular-nums text-[#6b6d76]">
                  {liveLogs.length}
                </span>
              </div>
              <div className="space-y-2">
                {liveLogs.map((l, i) => {
                  const id = `l-${i}`;
                  const expanded = open === id;
                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(id);
                        }
                      }}
                      className={`${rowClass} overflow-hidden pl-4`}
                    >
                      <span
                        className={`absolute inset-y-0 left-0 w-[2.5px] ${LEVEL[l.level].bar}`}
                        aria-hidden="true"
                      />
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="font-mono-only text-[#7c7e87]">{l.timestamp}</span>
                        <span className={`font-mono-only font-medium ${LEVEL[l.level].text}`}>
                          {l.level}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-[12.5px] leading-relaxed text-[#d8dae0] ${
                          expanded ? "" : "line-clamp-2"
                        }`}
                      >
                        {l.message}
                      </p>
                      {expanded && l.traceId && (
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-[#0d0e11] px-2.5 py-1.5">
                          <span className="font-mono-only truncate text-[11px] text-[#7c7e87]">
                            {l.traceId}
                          </span>
                          <CopyButton value={l.traceId} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {show("deploys") && deployDiffs.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <h4 className="text-[12px] font-medium text-[#8a8c95]">Recent deploys</h4>
                <span className="text-[11px] tabular-nums text-[#6b6d76]">
                  {deployDiffs.length}
                </span>
              </div>
              <div className="space-y-2">
                {deployDiffs.map((d) => {
                  const added = d.diffStat.match(/\+(\d+)/)?.[1];
                  const removed = d.diffStat.match(/-(\d+)/)?.[1];
                  return (
                    <div key={d.commit} className={rowClass}>
                      <p className="text-[13px] leading-relaxed text-[#ececef]">
                        {d.message}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[12px] text-[#7c7e87]">
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="font-mono-only rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-[#c9cbd3]">
                            {d.commit}
                          </span>
                          <CopyButton value={d.commit} />
                          <span className="truncate">· {d.author}</span>
                        </span>
                        <span className="font-mono-only shrink-0 tabular-nums text-[11.5px]">
                          {added && <span className="text-emerald-400">+{added}</span>}
                          {removed && <span className="ml-1.5 text-rose-400">−{removed}</span>}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
};
