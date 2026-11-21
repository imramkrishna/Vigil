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

export function PostmortemEditorView() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [text, setText] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    listIncidents()
      .then((rows) => {
        if (!active) return;
        setIncidents(rows);
        if (rows.length > 0) {
          setSelectedId(rows[0]!.id);
        }
        setError(null);
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
  }, []);

  const selectedIncident = incidents.find((i) => i.id === selectedId);

  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    setPublished(false);
    setError(null);
    try {
      const res = await generatePostmortem(selectedId);
      if (res.postmortemMarkdown) setText(res.postmortemMarkdown);
      if (res.actionItems) setActionItems(res.actionItems);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate postmortem."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!text) return;
    const slug = selectedIncident
      ? selectedIncident.id.slice(0, 8)
      : "postmortem";
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postmortem-${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="dash-card py-14 text-center text-[13.5px] text-[#8a8c95]">
        Loading incidents…
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="dash-card py-14 text-center">
        <p className="text-[14px] font-medium text-[#d8dae0]">
          No incidents available for postmortem
        </p>
        <p className="mt-1 text-[13px] text-[#7c7e87]">
          Investigate an incident first, then generate a blameless postmortem report here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Unified Document Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold tracking-[-0.015em] text-[#ececef]">
            {selectedIncident ? selectedIncident.title : "Postmortem"}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[#8a8c95]">
            Drafted from incident timeline and verified sources.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select incident"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setPublished(false);
            }}
            className="dash-input !w-auto !py-1.5 !text-[12.5px]"
          >
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.severity} · {inc.title.slice(0, 36)}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={generating || !selectedId}
            onClick={handleGenerate}
            className="dash-btn-primary"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{generating ? "Drafting…" : "Generate"}</span>
          </button>

          {text && (
            <>
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
                className="dash-btn-ghost"
              >
                {published ? "Published" : "Publish"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[13px] text-rose-300">
          {error}
        </div>
      )}

      {/* Document Surface */}
      <div className="dash-card p-6 sm:p-8">
        {!text ? (
          <div className="py-12 text-center">
            <p className="text-[14px] font-medium text-[#d8dae0]">
              Ready to draft postmortem
            </p>
            <p className="mt-1 text-[13px] text-[#7c7e87]">
              Click &ldquo;Generate&rdquo; to compile a blameless postmortem and follow-up action items from this incident.
            </p>
          </div>
        ) : mode === "edit" ? (
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
