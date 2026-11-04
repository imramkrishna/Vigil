"use client";

import { useEffect, useState } from "react";
import {
  generatePostmortem,
  listIncidents,
  type IncidentRow,
} from "@/lib/api";
import type { ActionItem } from "../types/vigil";

const DRAFT = `## Summary
From 14:01 to 14:16 UTC, EU-West checkout requests failed with timeouts (34% error rate). A deploy lowered the database connection pool below what the workers needed.

## Impact
- Region: eu-west-1
- 1,420 checkout attempts delayed or failed
- 18% of the monthly error budget used

## Root cause
Deploy v2.14.8 cut the pgBouncer pool from 40 to 15 while 64 workers kept running.

## What went well
- Vigil identified the cause within 8 seconds.
- The rollback was approved and applied in under 3 minutes.

## Action items
- Roll back checkout-api to v2.14.7 (done)
- Add a CI check on pool size (platform-db-team, 5 days)
- Alert when pgBouncer waiting clients stay above 25 (sre-core, 3 days)`;

export function PostmortemEditorView() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [text, setText] = useState(DRAFT);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [generating, setGenerating] = useState(false);
  const [published, setPublished] = useState(false);

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
      if (res.postmortemMarkdown) {
        setText(res.postmortemMarkdown);
      }
      if (res.actionItems) {
        setActionItems(res.actionItems);
      }
    } catch {
      // Keep current draft if offline
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
            {selectedIncident
              ? `${selectedIncident.title} postmortem`
              : "INC-2048 postmortem"}
          </h2>
          <p className="mt-0.5 text-[13px] text-[#9c9c9d]">
            Drafted from the timeline and sources. Edit anything before publishing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {incidents.length > 0 && (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0d0e11] px-3 py-1.5 text-[12.5px] text-zinc-200 outline-none"
            >
              {incidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.severity} · {inc.title.slice(0, 40)}
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
              {generating ? "Drafting…" : "Generate with Vigil"}
            </button>
          )}
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(["preview", "edit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 text-[12.5px] font-medium capitalize ${
                  mode === m ? "bg-white/15 text-white" : "text-[#9c9c9d] hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPublished(true)}
            className="dash-btn-primary !px-4 !py-2 !text-[13px]"
          >
            {published ? "Published" : "Publish"}
          </button>
        </div>
      </div>

      <div className="dash-card p-6">
        {mode === "edit" ? (
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPublished(false);
            }}
            rows={20}
            aria-label="Postmortem text"
            className="font-mono-only w-full resize-y rounded-lg border border-white/10 bg-[#07080a] p-4 text-[13px] leading-relaxed caret-[#ff6b4a] outline-none focus:border-[#ff6b4a]"
          />
        ) : (
          <div className="max-w-[720px] space-y-3 text-[14px] leading-relaxed text-[#d4d4d5]">
            {text.split("\n\n").map((block, i) =>
              block.startsWith("## ") ? (
                <h3 key={i} className="pt-2 text-[16px] font-semibold text-white">
                  {block.slice(3)}
                </h3>
              ) : (
                <p key={i} className="whitespace-pre-line">
                  {block}
                </p>
              )
            )}
          </div>
        )}
      </div>

      {actionItems.length > 0 && (
        <div className="dash-card p-5">
          <h3 className="dash-eyebrow">Action items</h3>
          <ul className="mt-3 divide-y divide-white/[0.05]">
            {actionItems.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-4 py-2.5 text-[13px]"
              >
                <span className="text-zinc-200">{item.title}</span>
                <span className="font-mono-only shrink-0 text-[11.5px] text-zinc-400">
                  {item.priority} · {item.owner}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
