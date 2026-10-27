"use client";

import { useState } from "react";

const PRESETS = [
  {
    question: "Who owns the payments service and how do we roll it back?",
    answer:
      "Payments is owned by the Core Checkout Squad (on-call: @priya-sre, channel #payments-ops). To roll back, run `kubectl rollout undo deployment/payments-service -n prod`, then confirm pgBouncer usage drops below 70%.",
    sources: [
      { doc: "architecture-services.md", text: "Owner: Core Checkout Squad (@priya-sre)" },
      { doc: "runbook-payments-01.md", text: "Rollback: kubectl rollout undo deployment/payments-service" },
    ],
  },
  {
    question: "How many deploys to payments-service happened last week?",
    answer:
      "There were 7 deploys in the past 7 days: 6 succeeded and 1 was rolled back. The latest (7f3a91c, 18 minutes ago) changed DB_POOL_MAX from 40 to 120.",
    sources: [{ doc: "Deploy history", text: "7 deploys between Oct 20 and Oct 27" }],
  },
  {
    question: "What is the root password for the production customer vault?",
    answer:
      "I can't help with that. Runbooks and metrics don't contain credentials, and Vigil only reads operational data. See the secret manager runbook for rotation steps.",
    sources: [{ doc: "security-governance.md", text: "Secrets live only in the platform secret manager." }],
  },
];

export function AskCopilotView() {
  const [active, setActive] = useState(PRESETS[0]);
  const [query, setQuery] = useState(PRESETS[0].question);
  const [rated, setRated] = useState<string | null>(null);

  const pick = (p: (typeof PRESETS)[number]) => {
    setActive(p);
    setQuery(p.question);
    setRated(null);
  };

  return (
    <div className="space-y-5">
      <div className="command-launcher-glass flex items-center gap-3 px-5 py-3.5">
        <span className="font-mono-only text-[#ff6b4a]">›</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Ask a question"
          className="w-full bg-transparent text-[15px] caret-[#ff6b4a] outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.question}
            onClick={() => pick(p)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${
              p === active
                ? "bg-[#e6e6e6] font-medium text-[#2f3031]"
                : "border border-white/15 text-[#9c9c9d] hover:text-white"
            }`}
          >
            {p.question.length > 36 ? p.question.slice(0, 36) + "…" : p.question}
          </button>
        ))}
      </div>

      <div className="command-launcher-glass p-6">
        <p className="text-[15px] leading-relaxed">{active.answer}</p>

        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="text-[12px] text-[#9c9c9d]">Sources</div>
          <ul className="mt-2 space-y-2">
            {active.sources.map((s) => (
              <li key={s.doc} className="text-[13px]">
                <span className="font-medium">{s.doc}</span>
                <span className="text-[#9c9c9d]"> — {s.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex items-center gap-2 text-[12px] text-[#9c9c9d]">
          <span>Was this helpful?</span>
          {["Yes", "No"].map((r) => (
            <button
              key={r}
              onClick={() => setRated(r)}
              className="rounded border border-white/15 px-2.5 py-0.5 text-white hover:bg-white/10"
            >
              {rated === r ? `✓ ${r}` : r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
