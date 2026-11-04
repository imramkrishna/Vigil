"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  deleteDoc,
  getBudget,
  listDocs,
  uploadDocPdf,
  type BudgetStatus,
  type DocumentRow,
} from "@/lib/api";

const FALLBACK_DOCS: DocumentRow[] = [
  {
    id: "demo-1",
    orgId: "demo",
    name: "pgBouncer saturation runbook.pdf",
    sourceUrl: "runbooks/pgbouncer-saturation.pdf",
    status: "indexed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-2",
    orgId: "demo",
    name: "Checkout API 504 triage guide.pdf",
    sourceUrl: "runbooks/checkout-api-504.pdf",
    status: "indexed",
    createdAt: new Date().toISOString(),
  },
];

export function DocsAdminAndOpsView() {
  const [docs, setDocs] = useState<DocumentRow[]>(FALLBACK_DOCS);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      const [liveDocs, liveBudget] = await Promise.all([
        listDocs().catch(() => null),
        getBudget().catch(() => null),
      ]);
      if (liveDocs && liveDocs.length > 0) setDocs(liveDocs);
      if (liveBudget) setBudget(liveBudget);
    } catch {
      // Keep fallback data when offline
    }
  };

  useEffect(() => {
    refresh();
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
      setNotice(`Uploaded "${file.name}". Worker is indexing chunks in the background.`);
      setTimeout(refresh, 2500);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Upload failed. Check API server."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      await deleteDoc(id);
    } catch {
      // Local state already updated
    }
  };

  const spent = budget ? `$${budget.spentUsd.toFixed(2)}` : "$0.00";
  const limit = budget ? `of $${budget.limitUsd.toFixed(0)} budget` : "of $250 budget";
  const pct = budget ? `${budget.percentUsed.toFixed(1)}%` : "0%";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="dash-card p-5">
          <div className="text-[12px] text-[#9c9c9d]">Spend this month</div>
          <div className="mt-1 text-[26px] font-semibold">{spent}</div>
          <div className="text-[12px] text-[#9c9c9d]">{limit}</div>
        </div>
        <div className="dash-card p-5">
          <div className="text-[12px] text-[#9c9c9d]">Budget used</div>
          <div className="mt-1 text-[26px] font-semibold">{pct}</div>
          <div className="text-[12px] text-[#9c9c9d]">Monthly tenant cap</div>
        </div>
        <div className="dash-card p-5">
          <div className="text-[12px] text-[#9c9c9d]">Indexed runbooks</div>
          <div className="mt-1 text-[26px] font-semibold">{docs.length}</div>
          <div className="text-[12px] text-[#9c9c9d]">Hybrid vector + FTS</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="dash-card flex flex-col justify-between p-6 lg:col-span-2">
          <div>
            <h3 className="text-[16px] font-semibold">Upload PDF runbook</h3>
            <p className="mt-1 text-[13px] text-[#9c9c9d]">
              Upload a PDF runbook, architecture doc, or postmortem. Vigil chunks and embeds it into pgvector via BullMQ.
            </p>

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
              className="mt-5 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center transition-colors hover:border-white/30 hover:bg-white/[0.04]"
            >
              <span className="text-[13.5px] font-medium text-white">
                {uploading ? "Uploading to S3…" : "Choose a .pdf file"}
              </span>
              <span className="text-[12px] text-[#77787b]">
                Max 20 MB · PDF documents
              </span>
            </button>

            {notice && (
              <p className="mt-3 text-[12.5px] text-emerald-400">{notice}</p>
            )}
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="dash-btn-primary mt-5 w-full"
          >
            {uploading ? "Uploading…" : "Upload PDF runbook"}
          </button>
        </div>

        <div className="dash-card p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold">
              Your runbooks ({docs.length})
            </h3>
            <button
              type="button"
              onClick={refresh}
              className="text-[12px] text-[#8f9093] hover:text-white"
            >
              Refresh
            </button>
          </div>
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-zinc-100">
                    {d.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[#8f9093]">
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
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  className="text-[12px] text-zinc-500 transition-colors hover:text-rose-400"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
