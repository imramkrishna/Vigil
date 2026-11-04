"use client";

import { useEffect, useState } from "react";
import { listIncidents, type IncidentRow } from "@/lib/api";
import type { Hypothesis } from "../types/vigil";

const STEPS = [
  { label: "Triage", key: "investigating" },
  { label: "Investigate", key: "investigating" },
  { label: "Rank causes", key: "investigating" },
  { label: "Awaiting approval", key: "awaiting_approval" },
  { label: "Resolve", key: "resolved" },
];

const EVIDENCE: Record<string, { source: string; text: string }> = {
  ev_01: {
    source: "Deploy history",
    text: "Deploy 7f3a91c raised DB_POOL_MAX from 40 to 120 across 4 replicas (480 connections, limit 300).",
  },
  ev_02: {
    source: "Runbook: payments",
    text: "When pool exhaustion appears with pgBouncer above 85%, check recent pool changes and roll back the deploy.",
  },
  ev_03: {
    source: "Past incident INC-1812",
    text: "Same failure 92 days ago after replica scaling. Fixed by rollback in 4 minutes.",
  },
};

const DEFAULT_CAUSES = [
  {
    title: "Deploy 7f3a91c exceeded the database connection limit",
    confidence: 94,
    evidence: ["ev_01", "ev_02", "ev_03"],
    action: "Roll back payments-service",
  },
  {
    title: "Lock contention in ledger-worker",
    confidence: 21,
    evidence: ["ev_01"],
    action: "Keep monitoring",
  },
];

export interface LiveIncidentData {
  incident: IncidentRow;
  hypotheses?: Hypothesis[];
  timeline?: string[];
  answer?: string;
}

export function IncidentRoomView({
  onNavigateApproval,
  latestCreated,
}: {
  onNavigateApproval?: () => void;
  onNavigatePostmortem?: () => void;
  latestCreated?: LiveIncidentData | null;
}) {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openEv, setOpenEv] = useState("ev_01");
  const [note, setNote] = useState("");
  const [timeline, setTimeline] = useState([
    { time: "21:42", text: "Alert classified as SEV-1." },
    { time: "21:42", text: "Checked runbooks, metrics, and past incidents." },
    { time: "21:42", text: "Ranked 2 likely causes." },
    { time: "21:42", text: "Waiting for approval on 2 actions." },
  ]);

  useEffect(() => {
    listIncidents()
      .then((rows) => {
        if (rows.length > 0) {
          setIncidents(rows);
          setSelectedId((prev) => prev ?? rows[0]!.id);
        }
      })
      .catch(() => {});
  }, [latestCreated]);

  useEffect(() => {
    if (latestCreated?.timeline && latestCreated.timeline.length > 0) {
      const now = new Date().toTimeString().slice(0, 5);
      setTimeline(latestCreated.timeline.map((t) => ({ time: now, text: t })));
    }
  }, [latestCreated]);

  const activeIncident =
    (latestCreated?.incident?.id === selectedId
      ? latestCreated?.incident
      : incidents.find((i) => i.id === selectedId)) ??
    latestCreated?.incident ??
    incidents[0];

  const liveHypotheses =
    latestCreated &&
    (!selectedId || latestCreated.incident.id === selectedId) &&
    latestCreated.hypotheses &&
    latestCreated.hypotheses.length > 0
      ? latestCreated.hypotheses.map((h) => ({
          title: h.cause,
          confidence: Math.round(
            h.confidence <= 1 ? h.confidence * 100 : h.confidence
          ),
          evidence: ["ev_01"],
          action: h.evidence,
        }))
      : DEFAULT_CAUSES;

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setTimeline((t) => [
      ...t,
      { time: new Date().toTimeString().slice(0, 5), text: `Note: ${note.trim()}` },
    ]);
    setNote("");
  };

  const title =
    activeIncident?.title ||
    "Payments service is running out of database connections";
  const severity = activeIncident?.severity || "SEV-1";
  const shortId = activeIncident?.id
    ? `INC-${activeIncident.id.slice(0, 6).toUpperCase()}`
    : "INC-2048";
  const status = activeIncident?.status || "awaiting_approval";

  return (
    <div className="space-y-6">
      {incidents.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {incidents.slice(0, 6).map((inc) => (
            <button
              key={inc.id}
              type="button"
              onClick={() => setSelectedId(inc.id)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors ${
                inc.id === activeIncident?.id
                  ? "dash-row-active text-white"
                  : "border-white/[0.07] bg-[#0d0e11] text-[#8f9093] hover:text-white"
              }`}
            >
              <span className="font-mono-only mr-1.5 text-[11px] text-[#77787b]">
                {inc.severity}
              </span>
              {inc.title.slice(0, 36)}
            </button>
          ))}
        </div>
      )}

      <div className="dash-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[12px] text-[#9c9c9d]">
              <span className="rounded-md border border-[#ff5a4a]/30 bg-[#ff5a4a]/10 px-2 py-0.5 text-[11px] font-semibold text-[#ff8a78]">
                {severity}
              </span>
              <span className="font-mono-only">{shortId}</span>
            </div>
            <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.02em]">
              {title}
            </h2>
          </div>
          {onNavigateApproval && (
            <button onClick={onNavigateApproval} className="dash-btn-primary">
              Review approvals
            </button>
          )}
        </div>

        <ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STEPS.map((s, idx) => {
            const isResolved = status === "resolved";
            const isActive =
              (status === "awaiting_approval" && idx === 3) ||
              (status === "investigating" && idx === 1) ||
              (status === "resolved" && idx === 4);
            const isDone =
              isResolved ||
              (status === "awaiting_approval" && idx < 3) ||
              (status === "investigating" && idx < 1);
            return (
              <li
                key={s.label}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] ${
                  isActive
                    ? "dash-row-active text-white"
                    : isDone
                      ? "border-white/[0.07] bg-white/[0.02] text-[#c9c9cb]"
                      : "border-white/[0.06] text-[#6f7074]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isActive
                      ? "bg-[#ff6b4a]"
                      : isDone
                        ? "bg-emerald-400/80"
                        : "bg-white/15"
                  }`}
                />
                {s.label}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <h3 className="dash-eyebrow">Likely causes</h3>
          {liveHypotheses.map((c, i) => (
            <div key={c.title} className="dash-card p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[15px] font-medium">
                  {i + 1}. {c.title}
                </p>
                <span className="font-mono-only shrink-0 text-[13px] text-[#c9c9cb]">
                  {c.confidence}%
                </span>
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ff9a5a] to-[#e07a67]"
                  style={{ width: `${c.confidence}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#9c9c9d]">
                <div className="flex items-center gap-1.5">
                  <span>Sources:</span>
                  {c.evidence.map((id) => (
                    <button
                      key={id}
                      onClick={() => setOpenEv(id)}
                      className={`font-mono-only rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                        openEv === id
                          ? "bg-white/[0.12] text-white"
                          : "border border-white/10 text-[#9c9c9d] hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
                <span className="truncate max-w-[320px]">{c.action}</span>
              </div>
            </div>
          ))}

          <div className="dash-card p-5">
            <div className="dash-eyebrow">
              {EVIDENCE[openEv]?.source ?? "Evidence"}
            </div>
            <p className="mt-1 text-[14px] leading-relaxed">
              {latestCreated?.answer || EVIDENCE[openEv]?.text}
            </p>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="dash-card p-5">
            <h3 className="dash-eyebrow">Timeline</h3>
            <ul className="mt-3 space-y-2.5">
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-3 text-[13px]">
                  <span className="font-mono-only text-[#9c9c9d]">{t.time}</span>
                  <span className="text-white/90">{t.text}</span>
                </li>
              ))}
            </ul>
            <form onSubmit={addNote} className="mt-4 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note…"
                aria-label="Add a note"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] caret-[#ff6b4a] outline-none placeholder:text-[#9c9c9d] focus:border-[#ff6b4a]"
              />
              <button type="submit" className="dash-btn-ghost">
                Add
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
