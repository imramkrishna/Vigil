"use client";

import { useState } from "react";

interface Approval {
  id: string;
  title: string;
  target: string;
  why: string;
  details: [string, string][];
  status: "pending" | "approved" | "rejected";
}

const INITIAL: Approval[] = [
  {
    id: "a1",
    title: "Create ticket: roll back checkout-api",
    target: "Jira",
    why: "Deploy 7f3a91c raised the connection pool beyond the database limit. Rolling back restores capacity.",
    details: [
      ["Project", "PAY-INFRA"],
      ["Priority", "P1"],
      ["Assignee", "oncall-payments"],
    ],
    status: "pending",
  },
  {
    id: "a2",
    title: "Post update to #incidents-payments",
    target: "Slack",
    why: "Lets support and merchant teams know the cause is found and a rollback is underway.",
    details: [
      ["Channel", "#incidents-payments"],
      ["Message", "INC-2048: checkout errors traced to DB pool exhaustion. Rolling back."],
    ],
    status: "pending",
  },
  {
    id: "a3",
    title: "Add CI check for pool size",
    target: "Follow-up tracker",
    why: "Prevents future config changes from exceeding database connection limits.",
    details: [
      ["Owner", "platform-db-team"],
      ["Due", "5 days"],
    ],
    status: "approved",
  },
];

export function ApprovalsInboxView({
  currentRole = "lead",
}: {
  currentRole?: "viewer" | "responder" | "lead" | "admin";
}) {
  const [items, setItems] = useState(INITIAL);
  const [selectedId, setSelectedId] = useState("a1");
  const selected = items.find((i) => i.id === selectedId) ?? items[0];
  const canDecide = currentRole !== "viewer" && selected.status === "pending";

  const decide = (status: "approved" | "rejected") =>
    setItems((prev) => prev.map((i) => (i.id === selected.id ? { ...i, status } : i)));

  const badge = (s: Approval["status"]) =>
    s === "pending"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
      : s === "approved"
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
        : "border-[#ff5a4a]/30 bg-[#ff5a4a]/10 text-[#ff8a78]";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-2">
        <h2 className="dash-eyebrow">
          {items.filter((i) => i.status === "pending").length} waiting for you
        </h2>
        {items.map((i) => (
          <button
            key={i.id}
            onClick={() => setSelectedId(i.id)}
            className={`w-full rounded-xl border p-4 text-left transition-colors ${
              i.id === selected.id
                ? "dash-row-active"
                : "border-white/[0.07] bg-[#0d0e11] hover:border-white/15"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#9c9c9d]">{i.target}</span>
              <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${badge(i.status)}`}>
                {i.status}
              </span>
            </div>
            <div className="mt-2 text-[14.5px] font-medium">{i.title}</div>
          </button>
        ))}
      </div>

      <div className="dash-card p-6 lg:col-span-3">
        <div className="dash-eyebrow">{selected.target}</div>
        <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">{selected.title}</h3>

        <div className="mt-5">
          <div className="dash-eyebrow">Why Vigil suggests this</div>
          <p className="mt-1 text-[14px] leading-relaxed">{selected.why}</p>
        </div>

        <dl className="mt-5 divide-y divide-white/[0.05] rounded-xl border border-white/[0.07] bg-black/25">
          {selected.details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
              <dt className="text-[#77787b]">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>

        {currentRole === "viewer" && (
          <p className="mt-4 text-[12.5px] text-[#ffb347]">Viewers can't approve actions.</p>
        )}

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            disabled={!canDecide}
            onClick={() => decide("rejected")}
            className="dash-btn-ghost"
          >
            Reject
          </button>
          <button
            disabled={!canDecide}
            onClick={() => decide("approved")}
            className="dash-btn-primary"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
