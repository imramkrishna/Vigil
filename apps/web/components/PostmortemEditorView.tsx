"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import {
  generatePostmortem,
  listIncidents,
  type IncidentRow,
} from "@/lib/api";
import type { ActionItem } from "../types/vigil";
import { MarkdownProse } from "./chat/MarkdownProse";

const DRAFT = `## Summary
From 14:01 to 14:16 UTC, EU-West checkout requests failed with timeouts (34% error rate). A deploy lowered the database connection pool below what the workers needed.

## Impact
- Region: \`eu-west-1\`
- 1,420 checkout attempts delayed or failed
- 18% of the monthly error budget used

## Root cause
Deploy \`v2.14.8\` cut the pgBouncer pool from 40 to 15 while 64 workers kept running.

## What went well
- Vigil identified the cause within 8 seconds.
- The rollback was approved and applied in under 3 minutes.

## Action items
- Roll back \`checkout-api\` to \`v2.14.7\` (done)
- Add a CI check on pool size (\`platform-db-team\`, 5 days)
- Alert when pgBouncer waiting clients stay above 25 (\`sre-core\`, 3 days)`;

export function PostmortemEditorView() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [text, setText] = useState(DRAFT);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [generating, setGenerating] = useState(false);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listIncidents()
      .then((rows) => {
        if (rows.length > 0) {
          setIncidents(rows);
          setSelectedId(rows[0]!.id);
        }
      })
      .catch(() => {});
  }, []);

  const selectedIncident = incidents.find((i) => i.id === selectedId);

  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    setPublished(false);
    try {
      const res = await generatePostmortem(selectedId);
      if (res.postmortemMarkdown) setText(res.postmortemMarkdown);
      if (res.actionItems) setActionItems(res.actionItems);
    } catch {
      // Keep current draft if offline
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const slug = selectedIncident
      ? selectedIncident.id.slice(0, 8)
      : "inc-2048";
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postmortem-${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Unified Document Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold tracking-[-0.015em] text-[#ececef]">
            {selectedIncident
              ? `${selectedIncident.title}`
              : "INC-2048 Postmortem"}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[#8a8c95]">
            Drafted from incident timeline and verified sources.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {incidents.length > 0 && (
            <select
              aria-label="Select incident"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="dash-input !w-auto !py-1.5 !text-[12.5px]"
            >
              {incidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.severity} · {inc.title.slice(0, 36)}
                </option>
              ))}
            </select>
          )}

          {selectedId && (
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="dash-btn-ghost"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{generating ? "Drafting…" : "Generate"}</span>
            </button>
          )}

          <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5">
            {(["preview", "edit"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`cursor-pointer rounded-md px-3 py-1 text-[12.5px] font-medium capitalize transition-colors ${
                  mode === m
                    ? "bg-white/[0.1] text-[#ececef]"
                    : "text-[#8a8c95] hover:text-[#d8dae0]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy Markdown"
            title="Copy Markdown"
            className="dash-btn-ghost !px-2.5"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download Markdown"
            title="Download .md"
            className="dash-btn-ghost !px-2.5"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setPublished(true)}
            className="dash-btn-primary"
          >
            {published ? "Published" : "Publish"}
          </button>
        </div>
      </div>

      {/* Document Surface */}
      <div className="dash-card p-6 sm:p-8">
        {mode === "edit" ? (
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPublished(false);
            }}
            rows={20}
            aria-label="Postmortem Markdown"
            className="dash-scroll dash-input font-mono-only resize-y !p-4 !text-[13px] leading-relaxed"
          />
        ) : (
          <div className="mx-auto max-w-[680px]">
            <MarkdownProse content={text} />
          </div>
        )}
      </div>

      {actionItems.length > 0 && (
        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <h3 className="text-[13px] font-medium text-[#ececef]">
              Follow-up action items
            </h3>
            <span className="text-[12px] text-[#7c7e87]">
              {actionItems.length} items
            </span>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {actionItems.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-4 px-5 py-3 text-[13.5px]"
              >
                <span className="text-[#e2e3e8]">{item.title}</span>
                <span className="font-mono-only shrink-0 text-[11.5px] text-[#8a8c95]">
                  {item.priority} · @{item.owner}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
