"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import { listIncidents, type IncidentRow } from "@/lib/api";
import type { Hypothesis } from "../types/vigil";

const STEPS = [
  { label: "Triage", key: "investigating" },
  { label: "Investigate", key: "investigating" },
  { label: "Rank causes", key: "investigating" },
  { label: "Approval", key: "awaiting_approval" },
  { label: "Resolved", key: "resolved" },
];

export interface LiveIncidentData {
  incident: IncidentRow;
  hypotheses?: Hypothesis[];
  timeline?: string[];
  answer?: string;
}

export function IncidentRoomView({
  onNavigateApproval,
  onNavigatePostmortem,
  latestCreated,
}: {
  onNavigateApproval?: () => void;
  onNavigatePostmortem?: () => void;
  latestCreated?: LiveIncidentData | null;
}) {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<Array<{ time: string; text: string }>>([]);

  useEffect(() => {
    let active = true;
    listIncidents()
      .then((rows) => {
        if (!active) return;
        setIncidents(rows);
        setError(null);
        if (latestCreated?.incident?.id) {
          setSelectedId(latestCreated.incident.id);
        } else if (rows.length > 0) {
          setSelectedId((prev) => prev ?? rows[0]!.id);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Failed to load incidents."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [latestCreated]);

  const activeIncident =
    (latestCreated?.incident?.id === selectedId
      ? latestCreated?.incident
      : incidents.find((i) => i.id === selectedId)) ??
    latestCreated?.incident ??
    incidents[0] ??
    null;

  const isLatestSelected =
    Boolean(latestCreated) &&
    activeIncident?.id === latestCreated?.incident?.id;

  const baseTimeline =
    isLatestSelected && latestCreated?.timeline && latestCreated.timeline.length > 0
      ? latestCreated.timeline.map((t) => ({
          time: activeIncident?.openedAt
            ? new Date(activeIncident.openedAt).toTimeString().slice(0, 5)
            : "Now",
          text: t,
        }))
      : activeIncident
        ? [
            {
              time: new Date(activeIncident.openedAt).toTimeString().slice(0, 5),
              text: `Incident opened (${activeIncident.severity}) — status: ${activeIncident.status.replace("_", " ")}.`,
            },
          ]
        : [];

  const timeline = [...baseTimeline, ...notes];

  const liveHypotheses =
    isLatestSelected &&
    latestCreated?.hypotheses &&
    latestCreated.hypotheses.length > 0
      ? latestCreated.hypotheses.map((h) => ({
          title: h.cause,
          confidence: Math.round(
            h.confidence <= 1 ? h.confidence * 100 : h.confidence
          ),
          evidence: h.evidence,
        }))
      : [];

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setNotes((t) => [
      ...t,
      {
        time: new Date().toTimeString().slice(0, 5),
        text: note.trim(),
      },
    ]);
    setNote("");
  };

  if (loading && !activeIncident) {
    return (
      <div className="dash-card py-14 text-center text-[13.5px] text-[#8a8c95]">
        Loading incidents…
      </div>
    );
  }

  if (error && !activeIncident) {
    return (
      <div className="dash-card py-14 text-center">
        <p className="text-[14px] font-medium text-rose-300">{error}</p>
      </div>
    );
  }

  if (!activeIncident) {
    return (
      <div className="dash-card py-14 text-center">
        <p className="text-[14px] font-medium text-[#d8dae0]">
          No incidents declared yet
        </p>
        <p className="mt-1 text-[13px] text-[#7c7e87]">
          Click &ldquo;New incident&rdquo; above or switch Ask Vigil to Incident mode to start an investigation.
        </p>
      </div>
    );
  }

  const title = activeIncident.title;
  const severity = activeIncident.severity;
  const shortId = `INC-${activeIncident.id.slice(0, 6).toUpperCase()}`;
  const status = activeIncident.status as string;

  const sevStyle =
    severity === "SEV-1"
      ? "bg-rose-500/12 text-rose-300"
      : severity === "SEV-2"
        ? "bg-amber-500/12 text-amber-300"
        : "bg-white/[0.07] text-[#c9cbd3]";

  return (
    <div className="space-y-6">
      {incidents.length > 1 && (
        <div className="dash-scroll flex items-center gap-2 overflow-x-auto pb-1">
          {incidents.slice(0, 8).map((inc) => {
            const active = inc.id === activeIncident.id;
            return (
              <button
                key={inc.id}
                type="button"
                onClick={() => setSelectedId(inc.id)}
                className={`shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors ${
                  active
                    ? "border-white/[0.2] bg-white/[0.08] text-[#ececef]"
                    : "border-white/[0.06] bg-transparent text-[#8a8c95] hover:border-white/[0.12] hover:text-[#ececef]"
                }`}
              >
                <span className="font-mono-only mr-1.5 text-[11px] text-[#7c7e87]">
                  {inc.severity}
                </span>
                {inc.title.slice(0, 38)}
              </button>
            );
          })}
        </div>
      )}

      {/* Incident Overview Card */}
      <section className="dash-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono-only rounded-md px-2 py-0.5 text-[11px] font-medium ${sevStyle}`}
              >
                {severity}
              </span>
              <span className="font-mono-only text-[12px] text-[#7c7e87]">
                {shortId}
              </span>
            </div>
            <h2 className="mt-2 text-[19px] font-semibold tracking-[-0.02em] text-[#ececef]">
              {title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigatePostmortem && (
              <button
                type="button"
                onClick={onNavigatePostmortem}
                className="dash-btn-ghost"
              >
                Postmortem
              </button>
            )}
            {onNavigateApproval && (
              <button
                type="button"
                onClick={onNavigateApproval}
                className="dash-btn-primary"
              >
                <span>Review approvals</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Clean Step Progress Bar */}
        <ol className="mt-6 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-5 sm:grid-cols-5">
          {STEPS.map((s, idx) => {
            const isResolved = status === "resolved";
            const isMonitoring = status === "monitoring" || status === "mitigating";
            const isActive =
              (status === "awaiting_approval" && idx === 3) ||
              (status === "investigating" && idx === 1) ||
              (isMonitoring && idx === 3) ||
              (isResolved && idx === 4);
            const isDone =
              isResolved ||
              (status === "awaiting_approval" && idx < 3) ||
              (isMonitoring && idx < 4) ||
              (status === "investigating" && idx < 1);

            return (
              <li key={s.label} className="flex items-center gap-2.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                    isActive
                      ? "bg-[#e56b4e]/20 text-[#f7a08a] ring-1 ring-[#e56b4e]/50"
                      : isDone
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/[0.05] text-[#656770]"
                  }`}
                >
                  {isDone ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span
                  className={`text-[12.5px] ${
                    isActive
                      ? "font-medium text-[#ececef]"
                      : isDone
                        ? "text-[#b5b7be]"
                        : "text-[#6b6d76]"
                  }`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Hypotheses & Summary */}
        <div className="space-y-4 lg:col-span-7">
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
              <h3 className="text-[13px] font-medium text-[#ececef]">
                Likely causes
              </h3>
              <span className="text-[12px] text-[#7c7e87]">
                {liveHypotheses.length} ranked
              </span>
            </div>

            {liveHypotheses.length === 0 ? (
              <div className="p-5 text-[13px] text-[#8a8c95]">
                No ranked hypotheses attached to this incident view yet. Check Approvals or Ask Vigil for investigation details.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {liveHypotheses.map((c, i) => (
                  <div key={c.title} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-[14px] font-medium leading-snug text-[#ececef]">
                        <span className="font-mono-only mr-2 text-[12px] text-[#7c7e87]">
                          {i + 1}.
                        </span>
                        {c.title}
                      </p>
                      <span className="font-mono-only shrink-0 text-[12.5px] tabular-nums text-[#b5b7be]">
                        {c.confidence}%
                      </span>
                    </div>

                    <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full ${
                          c.confidence >= 70 ? "bg-[#e56b4e]" : "bg-white/25"
                        }`}
                        style={{ width: `${c.confidence}%` }}
                      />
                    </div>

                    {c.evidence && (
                      <p className="mt-3 text-[12.5px] leading-relaxed text-[#8a8c95]">
                        {c.evidence}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isLatestSelected && latestCreated?.answer && (
            <div className="dash-card p-5">
              <div className="text-[12px] font-medium text-[#8a8c95]">
                Investigation summary
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#d8dae0]">
                {latestCreated.answer}
              </p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="lg:col-span-5">
          <div className="dash-card flex flex-col p-5">
            <h3 className="text-[13px] font-medium text-[#ececef]">
              Activity timeline
            </h3>

            <ul className="mt-4 space-y-3 border-l border-white/[0.08] pl-4">
              {timeline.map((t, i) => (
                <li key={i} className="relative text-[13px] leading-relaxed">
                  <span
                    className="absolute -left-[20.5px] top-2 h-1.5 w-1.5 rounded-full bg-white/25"
                    aria-hidden="true"
                  />
                  <span className="font-mono-only mr-2 text-[11.5px] text-[#7c7e87]">
                    {t.time}
                  </span>
                  <span className="text-[#d4d6dc]">{t.text}</span>
                </li>
              ))}
            </ul>

            <form
              onSubmit={addNote}
              className="mt-5 flex gap-2 border-t border-white/[0.06] pt-4"
            >
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an investigation note…"
                aria-label="Add an investigation note"
                className="dash-input !py-2 !text-[13px]"
              />
              <button
                type="submit"
                disabled={!note.trim()}
                className="dash-btn-ghost shrink-0 !px-3"
                aria-label="Add note"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
