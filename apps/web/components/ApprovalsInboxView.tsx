"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { decideApproval, listApprovals, type ApprovalRow } from "@/lib/api";

interface ApprovalItem {
  id: string;
  title: string;
  target: string;
  why: string;
  details: [string, string][];
  status: "pending" | "approved" | "rejected";
}

function mapApprovalRow(r: ApprovalRow): ApprovalItem {
  const entries = Object.entries(r.action?.payload ?? {}).map(
    ([k, v]) =>
      [k, typeof v === "string" ? v : JSON.stringify(v)] as [string, string]
  );
  return {
    id: r.id,
    title: r.action?.title || "Proposed remediation action",
    target: r.action?.target || r.action?.kind || "Ops",
    why: r.action?.rationale || "Grounded in incident investigation evidence.",
    details: entries.length > 0 ? entries : [["Incident", r.incidentId]],
    status: r.decision,
  };
}

export function ApprovalsInboxView({
  currentRole = "lead",
  onDecisionComplete,
}: {
  currentRole?: "viewer" | "responder" | "lead" | "admin";
  onDecisionComplete?: () => void;
}) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "decided">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listApprovals()
      .then((rows) => {
        if (!active) return;
        const mapped = rows.map(mapApprovalRow);
        setItems(mapped);
        setSelectedId(mapped[0]?.id ?? null);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Failed to load approvals."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = items.filter((item) => {
    if (filter === "pending") return item.status === "pending";
    if (filter === "decided") return item.status !== "pending";
    return true;
  });

  const selected =
    filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? items[0] ?? null;
  const pendingCount = items.filter((i) => i.status === "pending").length;
  const canDecide =
    currentRole !== "viewer" && selected?.status === "pending" && !submitting;

  const decide = async (status: "approved" | "rejected") => {
    if (!selected) return;
    setSubmitting(true);
    setFeedback(null);
    setError(null);
    const prevStatus = selected.status;
    setItems((prev) =>
      prev.map((i) => (i.id === selected.id ? { ...i, status } : i))
    );
    try {
      const res = await decideApproval(selected.id, status);
      if (res.answer) {
        setFeedback(res.answer);
      } else {
        setFeedback(
          status === "approved"
            ? "Action approved and executed."
            : "Action rejected."
        );
      }
      onDecisionComplete?.();
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.id === selected.id ? { ...i, status: prevStatus } : i))
      );
      setError(
        err instanceof Error ? err.message : "Failed to submit decision."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = (s: ApprovalItem["status"]) => {
    if (s === "pending") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e56b4e]/12 px-2 py-0.5 text-[11px] font-medium text-[#f7a08a]">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Pending
        </span>
      );
    }
    if (s === "approved") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-[#94969e]">
        <XCircle className="h-3 w-3" aria-hidden="true" />
        Rejected
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5">
          {(
            [
              { id: "all", label: `All (${items.length})` },
              { id: "pending", label: `Pending (${pendingCount})` },
              {
                id: "decided",
                label: `Decided (${items.length - pendingCount})`,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`cursor-pointer rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors ${
                filter === f.id
                  ? "bg-white/[0.1] text-[#ececef]"
                  : "text-[#8a8c95] hover:text-[#d8dae0]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="text-[12.5px] text-[#7c7e87]">
          Actions never execute without explicit sign-off.
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[13px] text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="dash-card py-14 text-center text-[13.5px] text-[#8a8c95]">
          Loading approvals…
        </div>
      ) : filtered.length === 0 ? (
        <div className="dash-card py-14 text-center">
          <p className="text-[14px] font-medium text-[#d8dae0]">
            No approvals in this view
          </p>
          <p className="mt-1 text-[13px] text-[#7c7e87]">
            Pending remediation requests from Vigil will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-5">
            {filtered.map((i) => {
              const active = selected?.id === i.id;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(i.id);
                    setFeedback(null);
                  }}
                  className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? "border-white/[0.18] bg-[#24262c]"
                      : "border-white/[0.06] bg-[#1d1f24] hover:border-white/[0.12] hover:bg-[#22242a]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-[#8a8c95]">{i.target}</span>
                    {renderStatus(i.status)}
                  </div>
                  <div className="mt-2 text-[14px] font-medium leading-snug text-[#ececef]">
                    {i.title}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="dash-card flex flex-col justify-between p-6 lg:col-span-7">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] font-medium text-[#8a8c95]">
                    {selected.target}
                  </span>
                  {renderStatus(selected.status)}
                </div>

                <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-[#ececef]">
                  {selected.title}
                </h3>

                <div className="mt-5">
                  <div className="text-[12px] font-medium text-[#7c7e87]">
                    Rationale
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#d4d6dc]">
                    {selected.why}
                  </p>
                </div>

                <dl className="mt-5 divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] bg-[#141519]">
                  {selected.details.map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-4 px-4 py-2.5 text-[13px]"
                    >
                      <dt className="shrink-0 text-[#7c7e87]">{k}</dt>
                      <dd className="text-right text-[#d8dae0] break-words">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>

                {feedback && (
                  <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-300">
                    {feedback}
                  </p>
                )}

                {currentRole === "viewer" && (
                  <p className="mt-4 text-[12.5px] text-amber-300/90">
                    Viewers have read-only access and cannot decide approvals.
                  </p>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/[0.06] pt-4">
                <button
                  type="button"
                  disabled={!canDecide}
                  onClick={() => decide("rejected")}
                  className="dash-btn-ghost"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={!canDecide}
                  onClick={() => decide("approved")}
                  className="dash-btn-primary"
                >
                  {submitting ? "Executing…" : "Approve & execute"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
