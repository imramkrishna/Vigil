"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  FileText,
  Flame,
  History,
  MessageSquare,
  Pencil,
  Search,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import type { ChatThread } from "@/lib/chatHistory";
import type { Mode } from "@/types/vigil";

interface ChatHistoryViewProps {
  threads: ChatThread[];
  activeThreadId?: string;
  onSelectThread: (thread: ChatThread) => void;
  onNewChat: () => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  onClearAll: () => void;
}

type GroupLabel = "Today" | "Yesterday" | "Previous 7 days" | "Older";

function getGroupLabel(timestamp: number): GroupLabel {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (timestamp >= startOfToday) return "Today";
  if (timestamp >= startOfToday - dayMs) return "Yesterday";
  if (timestamp >= startOfToday - 7 * dayMs) return "Previous 7 days";
  return "Older";
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function stripMarkdownPreview(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/[#>*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function ChatHistoryView({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onRenameThread,
  onDeleteThread,
  onClearAll,
}: ChatHistoryViewProps) {
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | Mode>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (modeFilter !== "all" && t.mode !== modeFilter) return false;
      if (!q) return true;
      if (t.title.toLowerCase().includes(q)) return true;
      return t.turns.some((turn) => turn.content.toLowerCase().includes(q));
    });
  }, [threads, query, modeFilter]);

  const grouped = useMemo(() => {
    const order: GroupLabel[] = [
      "Today",
      "Yesterday",
      "Previous 7 days",
      "Older",
    ];
    const buckets: Record<GroupLabel, ChatThread[]> = {
      Today: [],
      Yesterday: [],
      "Previous 7 days": [],
      Older: [],
    };
    filtered.forEach((t) => {
      buckets[getGroupLabel(t.updatedAt)].push(t);
    });
    return order
      .map((label) => ({ label, items: buckets[label] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const startRename = (thread: ChatThread) => {
    setEditingId(thread.id);
    setDraftTitle(thread.title);
  };

  const commitRename = () => {
    if (editingId && draftTitle.trim()) {
      onRenameThread(editingId, draftTitle.trim());
    }
    setEditingId(null);
    setDraftTitle("");
  };

  const modeMeta = (mode: Mode) => {
    if (mode === "incident") {
      return { icon: Flame, label: "Incident", accent: "text-[#f7a08a]" };
    }
    if (mode === "postmortem") {
      return { icon: FileText, label: "Postmortem", accent: "text-[#b8bac2]" };
    }
    return { icon: MessageSquare, label: "Ask", accent: "text-[#9b9da6]" };
  };

  return (
    <div className="space-y-6">
      {/* Search, Filters & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-[380px]">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6e717c]"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chat history…"
            aria-label="Search chat history"
            className="dash-input !pl-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "ask", label: "Ask" },
                { id: "incident", label: "Incident" },
                { id: "postmortem", label: "Postmortem" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setModeFilter(f.id)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  modeFilter === f.id
                    ? "bg-white/[0.1] text-[#f2f2f4]"
                    : "text-[#8e909a] hover:text-[#ececef]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {threads.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  className="cursor-pointer rounded-lg border border-rose-500/35 bg-rose-500/15 px-3 py-1.5 text-[12.5px] font-medium text-rose-300 transition-colors hover:bg-rose-500/25"
                >
                  Confirm clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="dash-btn-ghost !py-1.5 !text-[12.5px]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="dash-btn-ghost !py-1.5 !text-[12.5px]"
              >
                Clear all
              </button>
            )
          )}

          <button
            type="button"
            onClick={onNewChat}
            className="dash-btn-primary !py-1.5 !text-[12.5px]"
          >
            <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>New chat</span>
          </button>
        </div>
      </div>

      {/* Empty States */}
      {threads.length === 0 ? (
        <div className="dash-card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-[#848791]">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-[15.5px] font-medium text-[#f2f2f4]">
            No conversations yet
          </h2>
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[#8a8c95]">
            Your chats, incident investigations, and postmortem drafts are saved here automatically so you can pick up right where you left off.
          </p>
          <button
            type="button"
            onClick={onNewChat}
            className="dash-btn-primary mt-5"
          >
            <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Start a new chat</span>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="dash-card px-6 py-14 text-center">
          <p className="text-[14px] font-medium text-[#e2e3e8]">
            No matching conversations
          </p>
          <p className="mt-1 text-[13px] text-[#8a8c95]">
            Try a different search term or clear the mode filter.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2.5 px-1 text-[12px] font-medium text-[#7f828d]">
                {group.label}
              </h2>

              <div className="dash-card divide-y divide-white/[0.06] overflow-hidden">
                {group.items.map((thread) => {
                  const meta = modeMeta(thread.mode);
                  const ModeIcon = meta.icon;
                  const lastTurn = thread.turns[thread.turns.length - 1];
                  const preview = lastTurn
                    ? stripMarkdownPreview(lastTurn.content)
                    : "";
                  const isEditing = editingId === thread.id;
                  const isActive = activeThreadId === thread.id;

                  return (
                    <div
                      key={thread.id}
                      className={`group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] ${
                        isActive ? "bg-white/[0.035]" : ""
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                        <ModeIcon
                          className={`h-4 w-4 ${meta.accent}`}
                          aria-hidden="true"
                        />
                      </div>

                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            commitRename();
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2"
                        >
                          <input
                            autoFocus
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            aria-label="Rename conversation"
                            className="dash-input !py-1.5 !text-[13.5px]"
                          />
                          <button
                            type="submit"
                            aria-label="Save title"
                            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/[0.08] text-emerald-400 hover:bg-white/[0.12]"
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            aria-label="Cancel rename"
                            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#8a8c95] hover:bg-white/[0.06] hover:text-[#f2f2f4]"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectThread(thread)}
                          className="min-w-0 flex-1 cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[14px] font-medium text-[#f2f2f4]">
                              {thread.title}
                            </span>
                            {thread.mode !== "ask" && (
                              <span
                                className={`shrink-0 rounded-md px-1.5 py-px text-[10.5px] font-medium ${
                                  thread.mode === "incident"
                                    ? "bg-[#e56b4e]/15 text-[#fba792]"
                                    : "bg-white/[0.07] text-[#b8bac2]"
                                }`}
                              >
                                {meta.label}
                              </span>
                            )}
                          </div>
                          {preview && (
                            <p className="mt-0.5 truncate text-[12.5px] text-[#848791]">
                              {preview}
                            </p>
                          )}
                        </button>
                      )}

                      {!isEditing && (
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="hidden text-right sm:block">
                            <div className="text-[12px] text-[#7f828d]">
                              {formatRelativeTime(thread.updatedAt)}
                            </div>
                            <div className="font-mono-only text-[11px] text-[#666973]">
                              {thread.turns.length}{" "}
                              {thread.turns.length === 1 ? "msg" : "msgs"}
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => startRename(thread)}
                              aria-label={`Rename ${thread.title}`}
                              title="Rename"
                              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#848791] transition-colors hover:bg-white/[0.07] hover:text-[#f2f2f4]"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteThread(thread.id)}
                              aria-label={`Delete ${thread.title}`}
                              title="Delete"
                              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#848791] transition-colors hover:bg-rose-500/12 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
