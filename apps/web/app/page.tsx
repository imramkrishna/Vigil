import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Top Navigation Header with Vigil Logo */}
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/vigil.svg"
              alt="Vigil Logo"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">Vigil</span>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  Ops Copilot
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Acme Payments Org · responder
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-600 sm:flex dark:text-zinc-400">
            <a
              href="#ask"
              className="text-zinc-950 transition-colors hover:text-rose-600 dark:text-white dark:hover:text-rose-400"
            >
              Ask Copilot
            </a>
            <a
              href="#incidents"
              className="transition-colors hover:text-rose-600 dark:hover:text-rose-400"
            >
              Incident Room
            </a>
            <a
              href="#approvals"
              className="transition-colors hover:text-rose-600 dark:hover:text-rose-400"
            >
              Approvals Inbox
            </a>
            <a
              href="#docs"
              className="transition-colors hover:text-rose-600 dark:hover:text-rose-400"
            >
              Docs Admin
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex items-center justify-center">
            <Image
              src="/vigil.png"
              alt="Vigil Emblem"
              width={96}
              height={96}
              className="h-24 w-24 object-contain drop-shadow-sm"
              priority
            />
          </div>

          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Autonomous Engineering Operations &{" "}
            <span className="text-rose-600 dark:text-rose-400">
              Incident Copilot
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Answer operational questions with verified runbook citations, fan out
            parallel incident investigations across docs, deploys, and history,
            gate every external write behind role-based approvals, and draft
            evidence-linked postmortems.
          </p>

          <div className="mt-10 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
            <div
              id="ask"
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                01 · ASK GRAPH
              </span>
              <h2 className="mt-1 font-semibold">Cited Runbook Q&A</h2>
              <p className="mt-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                Hybrid pgvector + tsvector search with RRF reranking and live
                ops telemetry queries.
              </p>
            </div>

            <div
              id="incidents"
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                02 · INCIDENT GRAPH
              </span>
              <h2 className="mt-1 font-semibold">Parallel Triage</h2>
              <p className="mt-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                Fans out across docs, data, and history specialists with bounded
                critic verification.
              </p>
            </div>

            <div
              id="approvals"
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                03 · APPROVAL GATE
              </span>
              <h2 className="mt-1 font-semibold">Human-in-the-Loop</h2>
              <p className="mt-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                Every ticket or Slack write interrupts for responder/lead/admin
                approval and runs idempotently.
              </p>
            </div>

            <div
              id="docs"
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                04 · POSTMORTEM
              </span>
              <h2 className="mt-1 font-semibold">Evidence Drafts</h2>
              <p className="mt-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                Turns incident timelines and typed evidence into structured
                postmortems for human review.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
