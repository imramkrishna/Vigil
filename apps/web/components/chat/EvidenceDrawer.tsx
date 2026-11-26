"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  RefreshCw,
  Radio,
} from "lucide-react";
import { fetchServiceLogs, listServices } from "@/lib/api";
import type { Citation, ServiceLogEntry } from "../../types/vigil";

type Log = {
  timestamp: string;
  level: "ERROR" | "WARN" | "INFO" | "FATAL" | "DEBUG";
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
type TimeWindow = "live" | "15m" | "1h" | "6h";

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citations: Citation[];
  liveLogs?: Log[];
  deployDiffs?: Deploy[];
}

const LEVEL_STYLES: Record<string, { bar: string; text: string }> = {
  FATAL: { bar: "bg-rose-500", text: "text-rose-300" },
  ERROR: { bar: "bg-rose-400/80", text: "text-rose-300" },
  WARN: { bar: "bg-amber-400/80", text: "text-amber-300" },
  INFO: { bar: "bg-white/20", text: "text-[#94969e]" },
  DEBUG: { bar: "bg-white/15", text: "text-[#7c7e87]" },
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

function mapServiceLog(entry: ServiceLogEntry): Log {
  return {
    timestamp: new Date(entry.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    level: entry.level.toUpperCase() as Log["level"],
    message: entry.message,
    traceId: entry.traceId,
  };
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  isOpen,
  onClose,
  citations,
  liveLogs = [],
  deployDiffs = [],
}) => {
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<string | null>(null);

  // Live & timestamp-range logs state
  const [services, setServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [windowMode, setWindowMode] = useState<TimeWindow>("live");
  const [levelFilter, setLevelFilter] = useState<
    "" | "error" | "warn" | "info" | "fatal"
  >("");
  const [keyword, setKeyword] = useState("");
  const [fetchedLogs, setFetchedLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const logQueryGeneration = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    listServices()
      .then((rows) => {
        const names = rows
          .map((r) => String(r.name ?? "").trim())
          .filter(Boolean);
        setServices(names);
        setSelectedService((prev) => prev || names[0] || "");
      })
      .catch(() => {});

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const fetchLogsOnce = useCallback(async () => {
    if (!selectedService) return;
    const now = Date.now();
    const minutesMap: Record<Exclude<TimeWindow, "live">, number> = {
      "15m": 15,
      "1h": 60,
      "6h": 360,
    };
    const entries =
      windowMode === "live"
        ? await fetchServiceLogs({
            service: selectedService,
            live: true,
            lines: 30,
            level: levelFilter || undefined,
            keyword: keyword.trim() || undefined,
          })
        : await fetchServiceLogs({
            service: selectedService,
            startTime: new Date(
              now - minutesMap[windowMode] * 60_000
            ).toISOString(),
            endTime: new Date(now).toISOString(),
            level: levelFilter || undefined,
            keyword: keyword.trim() || undefined,
            limit: 50,
          });
    return entries.map(mapServiceLog);
  }, [selectedService, windowMode, levelFilter, keyword]);

  const runLogsQuery = useCallback(async (manual = false) => {
    if (!selectedService) return;
    const generation = ++logQueryGeneration.current;
    setLoadingLogs(manual);
    setLogsError(null);
    try {
      const mapped = await fetchLogsOnce();
      if (generation !== logQueryGeneration.current) return;
      if (mapped) setFetchedLogs(mapped);
    } catch (err) {
      if (generation === logQueryGeneration.current) {
        setLogsError(
          err instanceof Error ? err.message : "Failed to fetch logs."
        );
      }
    } finally {
      if (generation === logQueryGeneration.current) {
        setLoadingLogs(false);
      }
    }
  }, [selectedService, fetchLogsOnce]);

  const loadLogs = useCallback(() => runLogsQuery(true), [runLogsQuery]);

  // Fetch on parameter change & poll every 6s in live mode when drawer is open
  useEffect(() => {
    if (!isOpen || !selectedService) return;

    const run = () => {
      void runLogsQuery();
    };

    run();
    if (windowMode !== "live") {
      return () => {
        logQueryGeneration.current += 1;
      };
    }
    const interval = setInterval(run, 6000);
    return () => {
      logQueryGeneration.current += 1;
      clearInterval(interval);
    };
  }, [isOpen, selectedService, windowMode, runLogsQuery]);

  if (!isOpen) return null;

  const displayedLogs = selectedService ? fetchedLogs : liveLogs;
  const total = citations.length + displayedLogs.length + deployDiffs.length;
  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "all", label: "All", n: total },
    { id: "sources", label: "Sources", n: citations.length },
    { id: "logs", label: "Logs", n: displayedLogs.length },
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
        className="dash-slide fixed inset-y-0 right-0 z-40 flex h-full w-full max-w-[380px] flex-col border-l border-white/[0.06] bg-[#121316] lg:static lg:z-20 lg:w-[380px] lg:shrink-0"
      >
        <div className="flex h-[54px] shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
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

        {/* Live & Timestamp Log Controls (shown in Logs or All when services exist) */}
        {(tab === "logs" || (tab === "all" && services.length > 0)) && (
          <div className="shrink-0 space-y-2 border-b border-white/[0.05] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <select
                aria-label="Select service for logs"
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="dash-input !py-1.5 !text-[12px] flex-1"
              >
                {services.length === 0 ? (
                  <option value="">No services registered</option>
                ) : (
                  services.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={loadLogs}
                disabled={loadingLogs || !selectedService}
                aria-label="Refresh logs"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/[0.08] text-[#9b9da6] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4] disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loadingLogs ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            {tab === "logs" && (
              <div className="flex flex-wrap items-center gap-1.5">
                {(["live", "15m", "1h", "6h"] as TimeWindow[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWindowMode(w)}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      windowMode === w
                        ? w === "live"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/[0.1] text-[#f2f2f4]"
                        : "bg-white/[0.03] text-[#8a8c95] hover:text-[#ececef]"
                    }`}
                  >
                    {w === "live" && (
                      <Radio className="h-2.5 w-2.5" aria-hidden="true" />
                    )}
                    <span>{w === "live" ? "Live" : `Last ${w}`}</span>
                  </button>
                ))}

                <select
                  aria-label="Filter log level"
                  value={levelFilter}
                  onChange={(e) =>
                    setLevelFilter(
                      e.target.value as "" | "error" | "warn" | "info" | "fatal"
                    )
                  }
                  className="ml-auto rounded-md border border-white/[0.08] bg-[#141519] px-2 py-1 text-[11px] text-[#c9cbd3] outline-none"
                >
                  <option value="">All levels</option>
                  <option value="fatal">Fatal</option>
                  <option value="error">Error</option>
                  <option value="warn">Warn</option>
                  <option value="info">Info</option>
                </select>
              </div>
            )}

            {tab === "logs" && (
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Filter logs by keyword…"
                aria-label="Filter logs by keyword"
                className="dash-input !py-1.5 !text-[12px]"
              />
            )}

            {logsError && (
              <p className="text-[11.5px] text-rose-300">{logsError}</p>
            )}
          </div>
        )}

        <div className="dash-scroll flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {total === 0 && (
            <div className="flex flex-col items-center gap-3 pt-14 text-center px-4">
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

          {show("logs") && displayedLogs.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <h4 className="text-[12px] font-medium text-[#8a8c95]">Logs</h4>
                <span className="text-[11px] tabular-nums text-[#6b6d76]">
                  {displayedLogs.length}
                </span>
              </div>
              <div className="space-y-2">
                {displayedLogs.map((l, i) => {
                  const id = `l-${i}`;
                  const expanded = open === id;
                  const style = LEVEL_STYLES[l.level] ?? LEVEL_STYLES.INFO;
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
                        className={`absolute inset-y-0 left-0 w-[2.5px] ${style.bar}`}
                        aria-hidden="true"
                      />
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="font-mono-only text-[#7c7e87]">
                          {l.timestamp}
                        </span>
                        <span className={`font-mono-only font-medium ${style.text}`}>
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
                <h4 className="text-[12px] font-medium text-[#8a8c95]">
                  Recent deploys
                </h4>
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
                          {removed && (
                            <span className="ml-1.5 text-rose-400">−{removed}</span>
                          )}
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
