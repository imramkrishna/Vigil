"use client";

import { useState } from "react";

const INITIAL = [
  { title: "pgBouncer saturation runbook", path: "runbooks/pgbouncer-saturation.md" },
  { title: "Checkout API 504 triage guide", path: "runbooks/checkout-api-504.md" },
  { title: "Payment webhook idempotency", path: "architecture/payment-idempotency.md" },
  { title: "INC-1892 Redis pool postmortem", path: "postmortems/inc-1892.md" },
];

const STATS = [
  { label: "Spend this month", value: "$48", hint: "of $250 budget" },
  { label: "Avg answer time", value: "2.1s", hint: "Ask" },
  { label: "Avg investigation", value: "8.4s", hint: "Incidents" },
];

export function DocsAdminAndOpsView() {
  const [docs, setDocs] = useState(INITIAL);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (docs.some((d) => d.title.toLowerCase() === title.trim().toLowerCase())) {
      setNotice("Already added. Nothing changed.");
      return;
    }
    setDocs([
      { title: title.trim(), path: `runbooks/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md` },
      ...docs,
    ]);
    setTitle("");
    setContent("");
    setNotice("Added. Vigil can now use it in answers.");
  };

  const field =
    "mt-1.5 w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[13.5px] caret-[#ff6b4a] outline-none placeholder:text-[#9c9c9d]/60 focus:border-[#ff6b4a]";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.label} className="command-launcher-glass p-5">
            <div className="text-[12px] text-[#9c9c9d]">{s.label}</div>
            <div className="mt-1 text-[26px] font-semibold">{s.value}</div>
            <div className="text-[12px] text-[#9c9c9d]">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <form onSubmit={add} className="command-launcher-glass p-6 lg:col-span-2">
          <h3 className="text-[16px] font-semibold">Add a runbook</h3>
          <p className="mt-1 text-[13px] text-[#9c9c9d]">
            Paste a runbook or postmortem so Vigil can cite it.
          </p>
          <label htmlFor="rb-title" className="mt-4 block text-[13px] font-medium">
            Title
          </label>
          <input id="rb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kafka lag recovery" className={field} />
          <label htmlFor="rb-body" className="mt-4 block text-[13px] font-medium">
            Content
          </label>
          <textarea id="rb-body" rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste markdown here…" className={field} />
          {notice && <p className="mt-3 text-[12.5px] text-[#ffb347]">{notice}</p>}
          <button type="submit" className="keycap-download-btn mt-4 w-full !py-2.5 !text-[13px]">
            Add runbook
          </button>
        </form>

        <div className="command-launcher-glass p-6 lg:col-span-3">
          <h3 className="text-[16px] font-semibold">Your runbooks ({docs.length})</h3>
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {docs.map((d) => (
              <li key={d.path} className="py-3">
                <div className="text-[14px] font-medium">{d.title}</div>
                <div className="font-mono-only mt-0.5 text-[11.5px] text-[#9c9c9d]">{d.path}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
