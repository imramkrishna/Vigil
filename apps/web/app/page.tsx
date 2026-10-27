"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuroraBackground } from "@/components/AuroraBackground";

interface CommandRow {
  id: string;
  label: string;
  argChip: string;
  category: string;
  shortcut: string;
  dashboardTab: string;
  previewSummary: string;
}

const COMMAND_ROWS: CommandRow[] = [
  {
    id: "triage",
    label: "Triage Incident & Fan-Out Specialists",
    argChip: "INC-2048 • SEV-1",
    category: "Incident Graph",
    shortcut: "⌘ ↵",
    dashboardTab: "incident",
    previewSummary:
      "Parallel Send() to docs, data, and history specialists • 3 Evidence citations verified • H1 confidence 94%",
  },
  {
    id: "approve",
    label: "Approve Remediation: Rollback checkout-api v2.14.8",
    argChip: "interrupt() • role: lead",
    category: "Approval Gate",
    shortcut: "⌘ A",
    dashboardTab: "approvals",
    previewSummary:
      "Paused at approval_gate • Idempotency key act_inc2048_01_ticket • Requires responder, lead, or admin",
  },
  {
    id: "crag",
    label: "Search Hybrid Runbooks: pgBouncer Pool Saturation",
    argChip: "RRF: 0.94 • vector+tsv",
    category: "Ask Graph",
    shortcut: "⌘ K",
    dashboardTab: "ask",
    previewSummary:
      "pgvector HNSW + PostgreSQL tsvector GIN fused via Reciprocal Rank Fusion (k=60) + CRAG relevance grading",
  },
  {
    id: "sql",
    label: "Query Read-Only Ops Metrics: EU-West 504 Latency",
    argChip: "SELECTONLY • 5s cap",
    category: "Ops Tool",
    shortcut: "⌘ D",
    dashboardTab: "ask",
    previewSummary:
      "AST-validated SELECT query inside READ ONLY transaction • p99 latency 4,820ms • cl_waiting=148",
  },
  {
    id: "postmortem",
    label: "Synthesize Blameless Postmortem Draft",
    argChip: "6 sections • [ev_01..03]",
    category: "Postmortem Graph",
    shortcut: "⌘ P",
    dashboardTab: "postmortem",
    previewSummary:
      "Auto-compiles timeline, root cause, and action_log ledger into editable Markdown paused at review interrupt",
  },
];

const FEATURES = [
  {
    title: "Find the cause fast",
    body: "Vigil checks your runbooks, metrics, and past incidents in parallel and ranks the likely root causes.",
    detail: "Docs + Metrics + History",
  },
  {
    title: "Every answer has sources",
    body: "Each claim links back to the runbook, query, or incident it came from. Nothing is made up.",
    detail: "Cited [ev_01] [ev_02] [ev_03]",
  },
  {
    title: "You approve every action",
    body: "Tickets and Slack posts wait for a teammate's approval. Vigil never writes anything on its own.",
    detail: "Role-based approvals",
  },
];

const HYPOTHESES = [
  { cause: "pgBouncer pool exhausted after v2.14.8 deploy", confidence: 94, sources: "ev_01 ev_02 ev_03" },
  { cause: "Slow ledger reconciliation queries holding locks", confidence: 31, sources: "ev_01" },
];

const STEPS = [
  { n: "01", title: "Alert fires", body: "Declare an incident or let Vigil pick it up." },
  { n: "02", title: "Vigil investigates", body: "Docs, data, and history are searched at once." },
  { n: "03", title: "You approve", body: "Review the suggested fixes and approve in one click." },
  { n: "04", title: "Postmortem drafted", body: "A cited summary is ready to edit when you resolve." },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [queryText, setQueryText] = useState<string>(
    "triage INC-2048 eu-west checkout 504s"
  );

  const activeRow = COMMAND_ROWS[selectedIndex] ?? COMMAND_ROWS[0];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#07080a] text-white">
      <AuroraBackground />

      {/* ====================================================================
          HERO SECTION (unchanged)
         ==================================================================== */}
      <section className="relative z-10 mx-auto flex max-w-[1440px] flex-col items-center px-4 pt-24 pb-16 sm:px-8 sm:pt-28">
        <h1 className="hero-headline max-w-[920px] text-center">
          Autonomous incident triage,{" "}
          <span className="warm-accent-word">grounded</span> in every runbook.
        </h1>

        <p className="mt-4 max-w-[640px] text-center text-[17px] sm:text-[18px] font-normal leading-[1.55] text-[#9c9c9d]">
          Vigil coordinates parallel docs, metrics, and history specialists in
          one command bar—pausing at role-gated human approvals before any
          external write.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3.5">
          <Link href="/dashboard" className="keycap-download-btn">
            <span>Launch Incident Room</span>
          </Link>

          <Link href="/signup" className="keycap-download-btn">
            <span>Start Free Workspace</span>
          </Link>
        </div>

        <div className="font-mono-only mt-3 flex flex-wrap items-center justify-center gap-2 text-center text-[12px] text-[#9c9c9d]">
          <span>docker compose up -d &amp;&amp; pnpm db:setup</span>
          <span className="text-white/30">—</span>
          <Link
            href="/login"
            className="text-white/85 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
          >
            Sign in to Seeded Acme Payments Org
          </Link>
        </div>

        {/* Dark-Glass Command-Bar Launcher */}
        <div className="relative mt-8 w-full max-w-[740px]">
          <div className="command-launcher-glass overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
              <span className="font-mono-only text-[#ff6b4a]">›</span>

              <div className="flex flex-1 items-center">
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      router.push(`/dashboard?tab=${activeRow.dashboardTab}`);
                    }
                  }}
                  aria-label="Vigil command bar input"
                  className="w-full bg-transparent text-[14px] font-normal text-white caret-[#ff6b4a] placeholder-[#9c9c9d] outline-none"
                />
              </div>

              <span className="font-mono-only hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[#ff6b4a]/30 bg-[#ff2f3a]/10 px-2 py-0.5 text-[11px] text-[#ffb347]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b4a]" />
                org: acme-payments
              </span>
            </div>

            <div className="divide-y divide-white/[0.05] py-1">
              {COMMAND_ROWS.map((row, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={row.id}
                    onClick={() => setSelectedIndex(idx)}
                    onDoubleClick={() =>
                      router.push(`/dashboard?tab=${row.dashboardTab}`)
                    }
                    className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition-colors ${
                      isSelected ? "launcher-row-active" : "launcher-row-idle"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`truncate text-[13.5px] ${
                          isSelected
                            ? "font-medium text-white"
                            : "font-normal text-white/85"
                        }`}
                      >
                        {row.label}
                      </span>

                      <span className="font-mono-only hidden md:inline-block rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-[#9c9c9d]">
                        {row.argChip}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="hidden sm:inline text-[12px] text-[#9c9c9d]">
                        {row.category}
                      </span>
                      <span className="shortcut-chip font-mono-only">
                        {row.shortcut}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/35 px-4 py-2 text-[11.5px] text-[#9c9c9d]">
              <div className="flex items-center gap-2 truncate">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffb347]" />
                <span className="truncate">{activeRow.previewSummary}</span>
              </div>
              <Link
                href={`/dashboard?tab=${activeRow.dashboardTab}`}
                className="font-mono-only shrink-0 text-[11px] text-[#ffb347] hover:underline"
              >
                Open in Console →
              </Link>
            </div>
          </div>

          <div className="floating-pill-nav mt-3 flex items-center justify-between rounded-xl px-3.5 py-2.5 lg:absolute lg:-right-24 lg:-bottom-3 lg:mt-0 lg:w-[235px]">
            <div className="flex items-center gap-2.5">
              <div>
                <div className="text-[12px] font-medium leading-tight text-white">
                  Groundedness 0.96
                </div>
                <div className="font-mono-only text-[10.5px] text-[#9c9c9d]">
                  100% Action Gate Safety
                </div>
              </div>
            </div>
            <span className="h-2 w-2 rounded-full bg-[#ff6b4a] shadow-[0_0_8px_#ff6b4a]" />
          </div>
        </div>

        <div className="mt-8">
          <a href="#features" className="ghost-pill-link">
            <span>See how it works</span>
            <span aria-hidden="true" className="text-white/70">
              ↓
            </span>
          </a>
        </div>
      </section>

      {/* ====================================================================
          SIMPLIFIED SECTIONS
         ==================================================================== */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-[1100px] scroll-mt-24 border-t border-white/10 px-4 py-20 sm:px-8"
      >
        <h2 className="text-center text-[30px] font-semibold tracking-[-0.025em] sm:text-[36px]">
          Built to be trusted at 3 a.m.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="command-launcher-glass flex flex-col p-6">
              <h3 className="text-[18px] font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#9c9c9d]">
                {f.body}
              </p>
              <div className="font-mono-only mt-auto border-t border-white/10 pt-3 text-[11.5px] text-[#ffb347]">
                {f.detail}
              </div>
            </div>
          ))}
        </div>

        {/* Product at a glance */}
        <div className="command-launcher-glass mx-auto mt-10 max-w-[760px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
            <div>
              <div className="text-[14px] font-semibold">INC-2048 · Checkout 504s in EU-West</div>
              <div className="mt-0.5 text-[12px] text-[#9c9c9d]">Investigated in 8s</div>
            </div>
            <span className="font-mono-only rounded bg-[#ff2f3a]/20 px-2 py-0.5 text-[11px] text-[#ffb347]">
              SEV-1
            </span>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {HYPOTHESES.map((h) => (
              <div key={h.cause} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px]">{h.cause}</div>
                  <div className="font-mono-only mt-0.5 text-[11px] text-[#9c9c9d]">{h.sources}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:block">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#ffb347] to-[#ff2f3a]"
                      style={{ width: `${h.confidence}%` }}
                    />
                  </div>
                  <span className="font-mono-only text-[12px] text-white">{h.confidence}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/30 px-5 py-3">
            <div className="text-[13px] text-[#9c9c9d]">
              Waiting for approval: <span className="text-white">Roll back checkout-api to v2.14.7</span>
            </div>
            <span className="shrink-0 rounded-md bg-[#e6e6e6] px-3 py-1 text-[12px] font-medium text-[#2f3031]">
              Approve
            </span>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="relative z-10 mx-auto max-w-[1100px] scroll-mt-24 px-4 py-20 sm:px-8"
      >
        <h2 className="text-center text-[30px] font-semibold tracking-[-0.025em] sm:text-[36px]">
          How it works
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="border-t border-white/10 pt-4">
              <div className="font-mono-only text-[12px] text-[#ffb347]">
                {s.n}
              </div>
              <h3 className="mt-2 text-[16px] font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[#9c9c9d]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-[1100px] px-4 py-24 text-center sm:px-8">
        <h2 className="text-[30px] font-semibold tracking-[-0.025em] sm:text-[36px]">
          Try it on a sample incident.
        </h2>
        <p className="mt-3 text-[15px] text-[#9c9c9d]">
          No setup needed. The demo workspace is pre-filled.
        </p>
        <div className="mt-7 flex justify-center">
          <Link href="/dashboard" className="keycap-download-btn">
            Open Console
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 text-[13px] text-[#9c9c9d] sm:px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/vigil.svg"
              alt="Vigil"
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
            <span className="font-medium text-white">Vigil</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-white">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-white">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
