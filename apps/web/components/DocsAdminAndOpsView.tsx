"use client";

import React, { useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import {
  deleteDoc,
  getBudget,
  listDocs,
  uploadDocPdf,
  type BudgetStatus,
  type DocumentRow,
} from "@/lib/api";

export function DocsAdminAndOpsView() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const [liveDocs, liveBudget] = await Promise.all([
      listDocs(),
      getBudget().catch(() => null),
    ]);
    setDocs(liveDocs);
    if (liveBudget) setBudget(liveBudget);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (err) {
      setNotice({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to refresh runbooks.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([listDocs(), getBudget().catch(() => null)])
      .then(([liveDocs, liveBudget]) => {
        if (!active) return;
        setDocs(liveDocs);
        if (liveBudget) setBudget(liveBudget);
      })
      .catch((err) => {
        if (!active) return;
        setNotice({
          kind: "err",
          text: err instanceof Error ? err.message : "Failed to load runbooks.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    setUploading(true);
    setNotice(null);
    try {
      const res = await uploadDocPdf(file);
      setDocs((prev) => [
        {
          id: res.documentId,
          orgId: "current",
          name: file.name,
          sourceUrl: res.documentUrl,
          status: "pending",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNotice({
        kind: "ok",
        text: `Uploaded "${file.name}". Indexing chunks in the background.`,
      });
      setTimeout(refresh, 2500);
    } catch (err) {
      setNotice({
        kind: "err",
        text:
          err instanceof Error
            ? err.message
            : "Upload failed. Check API server.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = docs;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setNotice(null);
    try {
      await deleteDoc(id);
    } catch (err) {
      setDocs(previous);
      setNotice({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to delete document.",
      });
    }
  };

  const spent = budget ? `$${budget.spentUsd.toFixed(2)}` : "$0.00";
  const limit = budget ? `$${budget.limitUsd.toFixed(0)}` : "$250";
  const pctNum = budget ? Math.min(100, Math.max(0, budget.percentUsed)) : 0;

  const filteredDocs = docs.filter((d) =>
    d.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Compact Unified Usage Strip */}
      <div className="dash-card grid grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <div className="text-[12px] text-[#8a8c95]">Monthly LLM spend</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-[#ececef] tabular-nums">
              {spent}
            </span>
            <span className="text-[12.5px] text-[#7c7e87]">of {limit}</span>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between text-[12px] text-[#8a8c95]">
            <span>Budget utilization</span>
            <span className="font-mono-only tabular-nums text-[#b5b7be]">
              {pctNum.toFixed(1)}%
            </span>
          </div>
          <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#e56b4e] transition-all duration-300"
              style={{ width: `${Math.max(pctNum, 2)}%` }}
            />
          </div>
          <div className="mt-2 text-[11.5px] text-[#7c7e87]">
            Organization monthly cap
          </div>
        </div>

        <div className="p-5">
          <div className="text-[12px] text-[#8a8c95]">Indexed runbooks</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-[#ececef] tabular-nums">
              {docs.length}
            </span>
            <span className="text-[12.5px] text-[#7c7e87]">
              Hybrid vector + FTS
            </span>
          </div>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-2.5 text-[13px] ${
            notice.kind === "err"
              ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Unified Runbook Library */}
      <div className="dash-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b6d76]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter runbooks…"
              aria-label="Filter runbooks"
              className="dash-input !py-1.5 !pl-8 !text-[13px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="dash-btn-ghost"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="dash-btn-primary"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{uploading ? "Uploading…" : "Upload PDF"}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-14 text-center text-[13.5px] text-[#8a8c95]">
            Loading runbooks…
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-medium text-[#d8dae0]">
              {docs.length === 0 ? "No runbooks uploaded yet" : "No matching runbooks"}
            </p>
            <p className="mt-1 text-[13px] text-[#7c7e87]">
              Upload PDF runbooks or postmortems (up to 20 MB) for grounded retrieval.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {filteredDocs.map((d) => (
              <li
                key={d.id}
                className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-[#94969e]">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-[#ececef]">
                      {d.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[#8a8c95]">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          d.status === "indexed"
                            ? "bg-emerald-400"
                            : d.status === "failed"
                              ? "bg-rose-400"
                              : "bg-amber-400"
                        }`}
                      />
                      <span className="capitalize">{d.status}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  aria-label={`Delete ${d.name}`}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-[#7c7e87] transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
