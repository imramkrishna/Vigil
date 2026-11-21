"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  History,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Settings,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import {
  IncidentRoomView,
  type LiveIncidentData,
} from "@/components/IncidentRoomView";
import { AskCopilotView } from "@/components/AskCopilotView";
import { ChatHistoryView } from "@/components/ChatHistoryView";
import { ApprovalsInboxView } from "@/components/ApprovalsInboxView";
import { PostmortemEditorView } from "@/components/PostmortemEditorView";
import { DocsAdminAndOpsView } from "@/components/DocsAdminAndOpsView";
import { SettingsView } from "@/components/SettingsView";
import {
  createIncident,
  getMe,
  listApprovals,
  signOut,
  type AuthUser,
} from "@/lib/api";
import {
  clearChatThreads,
  deleteChatThread,
  renameChatThread,
  upsertChatThread,
  useChatHistory,
  type ChatThread,
} from "@/lib/chatHistory";
import type { ChatTurn, Mode, Severity } from "@/types/vigil";

type TabId =
  | "ask"
  | "history"
  | "incident"
  | "approvals"
  | "postmortem"
  | "ops"
  | "settings";

interface NavItem {
  id: TabId;
  label: string;
  title: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  dot?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "history",
    label: "Chat history",
    title: "Chat history",
    icon: History,
  },
  {
    id: "incident",
    label: "Incidents",
    title: "Incidents",
    icon: AlertCircle,
    dot: true,
  },
  {
    id: "approvals",
    label: "Approvals",
    title: "Approvals",
    icon: CheckCircle2,
  },
  {
    id: "postmortem",
    label: "Postmortems",
    title: "Postmortems",
    icon: FileText,
  },
  {
    id: "ops",
    label: "Runbooks",
    title: "Runbooks & usage",
    icon: BookOpen,
  },
];

const ALL_TABS: TabId[] = [
  "ask",
  "history",
  "incident",
  "approvals",
  "postmortem",
  "ops",
  "settings",
];

const VIEW_TITLES: Record<TabId, string> = {
  ask: "Vigil",
  history: "Chat history",
  incident: "Incidents",
  approvals: "Approvals",
  postmortem: "Postmortems",
  ops: "Runbooks & usage",
  settings: "Settings",
};

function makeThreadId() {
  return `vigil_thr_${Math.random().toString(36).substring(2, 9)}`;
}

function DashboardContent() {
  const router = useRouter();
  const params = useSearchParams();
  const urlTabParam = params.get("tab") as TabId | null;
  const validUrlTab =
    urlTabParam && ALL_TABS.includes(urlTabParam) ? urlTabParam : null;

  const [tab, setTab] = useState<TabId>(validUrlTab ?? "ask");
  const [syncedUrlTab, setSyncedUrlTab] = useState<TabId | null>(validUrlTab);
  if (validUrlTab !== syncedUrlTab) {
    setSyncedUrlTab(validUrlTab);
    if (validUrlTab) setTab(validUrlTab);
  }

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const historyScope = user?.userId || "local";
  const threads = useChatHistory(historyScope);

  const [activeChatId, setActiveChatId] = useState<string>("vigil_thr_981a2f");
  const [activeInitialTurns, setActiveInitialTurns] = useState<ChatTurn[]>([]);
  const [activeInitialMode, setActiveInitialMode] = useState<Mode>("ask");
  const [chatInstanceKey, setChatInstanceKey] = useState(0);

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("SEV-2");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [latestIncident, setLatestIncident] = useState<LiveIncidentData | null>(
    null
  );

  const refreshPendingApprovals = useCallback(() => {
    listApprovals("pending")
      .then((rows) => setPendingCount(rows.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    getMe().then((u) => {
      if (!active) return;
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);
      setAuthChecked(true);
      refreshPendingApprovals();
    });
    return () => {
      active = false;
    };
  }, [router, refreshPendingApprovals]);

  useEffect(() => {
    if (!authChecked) return;
    refreshPendingApprovals();
  }, [tab, authChecked, refreshPendingApprovals]);

  useEffect(() => {
    if (!showNew) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNew(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showNew]);

  const handleTurnsChange = useCallback(
    (
      threadId: string,
      turns: ChatTurn[],
      mode: Mode,
      replacedThreadId?: string
    ) => {
      if (turns.length === 0) return;
      setActiveChatId(threadId);
      upsertChatThread(historyScope, {
        id: threadId,
        turns,
        mode,
        replacedId: replacedThreadId,
      });
    },
    [historyScope]
  );

  const handleSelectTab = (next: TabId) => {
    setTab(next);
    setMobileMenuOpen(false);
  };

  const handleNewChat = useCallback(() => {
    const freshId = makeThreadId();
    setActiveChatId(freshId);
    setActiveInitialTurns([]);
    setActiveInitialMode("ask");
    setChatInstanceKey((k) => k + 1);
    setTab("ask");
    setMobileMenuOpen(false);
  }, []);

  const handleSelectThread = useCallback((thread: ChatThread) => {
    setActiveChatId(thread.id);
    setActiveInitialTurns(thread.turns);
    setActiveInitialMode(thread.mode);
    setChatInstanceKey((k) => k + 1);
    setTab("ask");
    setMobileMenuOpen(false);
  }, []);

  const handleRenameThread = useCallback(
    (id: string, nextTitle: string) => {
      renameChatThread(historyScope, id, nextTitle);
    },
    [historyScope]
  );

  const handleDeleteThread = useCallback(
    (id: string) => {
      deleteChatThread(historyScope, id);
      if (activeChatId === id) {
        const freshId = makeThreadId();
        setActiveChatId(freshId);
        setActiveInitialTurns([]);
        setActiveInitialMode("ask");
        setChatInstanceKey((k) => k + 1);
      }
    },
    [historyScope, activeChatId]
  );

  const handleClearHistory = useCallback(() => {
    clearChatThreads(historyScope);
    const freshId = makeThreadId();
    setActiveChatId(freshId);
    setActiveInitialTurns([]);
    setActiveInitialMode("ask");
    setChatInstanceKey((k) => k + 1);
  }, [historyScope]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;
    const cleanTitle = title.trim();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await createIncident({
        title: cleanTitle,
        severity,
        symptomSummary: cleanTitle,
      });
      setLatestIncident({
        incident: res.incident,
        hypotheses: res.hypotheses,
        timeline: res.timeline,
        answer: res.answer,
      });
      refreshPendingApprovals();
      setShowNew(false);
      setTab("incident");
      setBanner(`Investigating "${cleanTitle}" (${severity}).`);
      setTitle("");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create incident."
      );
    } finally {
      setCreating(false);
    }
  };

  const displayName = user?.name || "Account";
  const displaySub = user?.email || "Settings & preferences";
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "V";

  const sidebarToggleButton = (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open navigation menu"
        className="mr-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#9b9da6] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4] lg:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Expand sidebar"
          title="Open sidebar"
          className="mr-1 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#9b9da6] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4] lg:flex"
        >
          <PanelLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const recentSidebarThreads = threads.slice(0, 8);

  const sidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-[#121316]">
      {/* Brand + Collapse Header */}
      <div className="flex h-[54px] shrink-0 items-center justify-between px-3.5">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/[0.04]"
        >
          <Image
            src="/vigil.svg"
            alt="Vigil"
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
          <span className="text-[14.5px] font-semibold tracking-[-0.015em] text-[#f2f2f4]">
            Vigil
          </span>
        </Link>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#8a8c95] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse sidebar"
            title="Close sidebar"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#8a8c95] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4]"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Primary Action: New Chat */}
      <div className="px-2.5 pt-1 pb-2.5">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[13.5px] font-medium text-[#ececef] transition-colors hover:border-white/[0.13] hover:bg-white/[0.06]"
        >
          <SquarePen className="h-4 w-4 shrink-0 text-[#e56b4e]" aria-hidden="true" />
          <span>New chat</span>
        </button>
      </div>

      {/* Navigation + Persistent Recent Chats */}
      <nav
        aria-label="Dashboard navigation"
        className="dash-scroll flex-1 overflow-y-auto px-2.5 space-y-0.5"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          const badgeCount =
            item.id === "approvals"
              ? pendingCount
              : item.id === "history"
                ? threads.length
                : 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={`group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors ${
                active
                  ? "bg-white/[0.08] text-[#f2f2f4]"
                  : "text-[#9b9da6] hover:bg-white/[0.04] hover:text-[#f2f2f4]"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active
                    ? "text-[#f2f2f4]"
                    : "text-[#7c7f8a] group-hover:text-[#cfd1d8]"
                }`}
                aria-hidden={true}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {badgeCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-px font-mono-only text-[11px] font-medium tabular-nums ${
                    item.id === "approvals"
                      ? "bg-[#e56b4e]/15 text-[#fba792]"
                      : "bg-white/[0.07] text-[#9b9da6]"
                  }`}
                >
                  {badgeCount}
                </span>
              )}
              {item.dot && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#e56b4e]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            setShowNew(true);
          }}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#8a8c95] transition-colors hover:bg-white/[0.04] hover:text-[#f2f2f4]"
        >
          <Plus className="h-4 w-4 shrink-0 text-[#7c7f8a]" aria-hidden="true" />
          <span>Declare incident</span>
        </button>

        {/* Recent Chats Section (always clean, synced with localStorage) */}
        <div className="mt-4 border-t border-white/[0.06] pt-3.5">
          <div className="flex items-center justify-between px-2.5 pb-1.5">
            <span className="text-[11px] font-medium text-[#6e717c]">
              Recent chats
            </span>
            {threads.length > 0 && (
              <button
                type="button"
                onClick={() => handleSelectTab("history")}
                className="cursor-pointer text-[11px] text-[#7c7f8a] transition-colors hover:text-[#ececef]"
              >
                All
              </button>
            )}
          </div>

          {recentSidebarThreads.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[12px] text-[#5e616b]">
              Your chats will appear here.
            </p>
          ) : (
            <div className="space-y-0.5">
              {recentSidebarThreads.map((t) => {
                const isCurrent = tab === "ask" && activeChatId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`group flex items-center rounded-lg transition-colors ${
                      isCurrent
                        ? "bg-white/[0.08] text-[#f2f2f4]"
                        : "text-[#9b9da6] hover:bg-white/[0.04] hover:text-[#f2f2f4]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectThread(t)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-[13px]"
                    >
                      <MessageSquare
                        className="h-3.5 w-3.5 shrink-0 text-[#6e717c]"
                        aria-hidden="true"
                      />
                      <span className="truncate">{t.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteThread(t.id)}
                      aria-label={`Delete chat ${t.title}`}
                      className="mr-1 cursor-pointer rounded p-1 text-[#6e717c] opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-[#ececef] group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Clean Footer: User Account + Settings + Sign out */}
      <div className="shrink-0 border-t border-white/[0.06] p-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleSelectTab("settings")}
            aria-label="Open settings"
            className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
              tab === "settings" ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.1] text-[11px] font-medium text-[#f2f2f4]">
              {userInitials}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium text-[#ececef]">
                {displayName}
              </div>
              <div className="truncate text-[11px] text-[#7c7f8a]">
                {displaySub}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("settings")}
            aria-label="Settings"
            title="Settings"
            className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors ${
              tab === "settings"
                ? "bg-white/[0.08] text-[#f2f2f4]"
                : "text-[#7c7f8a] hover:bg-white/[0.05] hover:text-[#f2f2f4]"
            }`}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/login");
            }}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#7c7f8a] transition-colors hover:bg-white/[0.05] hover:text-[#f2f2f4]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  if (!authChecked || !user) {
    return (
      <div className="dash-surface flex h-screen w-full items-center justify-center bg-[#17181b] text-[13px] text-[#8a8c95]">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="dash-surface flex h-screen w-full overflow-hidden">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden h-full shrink-0 overflow-hidden border-r border-white/[0.06] transition-[width] duration-200 ease-out lg:block ${
          sidebarOpen ? "w-[252px]" : "w-0 border-r-0"
        }`}
      >
        <div className="h-full w-[252px]">{sidebarContent(false)}</div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-[268px] border-r border-white/[0.08] shadow-2xl">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#17181b]">
        {/* Keep Chat mounted while switching tabs so active conversation is never lost */}
        <div
          className={
            tab === "ask" ? "h-full w-full overflow-hidden" : "hidden"
          }
        >
          <AskCopilotView
            key={chatInstanceKey}
            initialThreadId={activeChatId}
            initialTurns={activeInitialTurns}
            initialMode={activeInitialMode}
            sidebarToggle={sidebarToggleButton}
            historyCount={threads.length}
            onOpenHistory={() => handleSelectTab("history")}
            onNewChat={handleNewChat}
            onTurnsChange={handleTurnsChange}
            onApprovalDecision={() => refreshPendingApprovals()}
          />
        </div>

        {tab !== "ask" && (
          <>
            <header className="flex h-[54px] shrink-0 items-center justify-between border-b border-white/[0.06] px-4 sm:px-6">
              <div className="flex items-center gap-2 min-w-0">
                {sidebarToggleButton}
                <h1 className="truncate text-[14.5px] font-medium text-[#f2f2f4]">
                  {VIEW_TITLES[tab]}
                </h1>
              </div>

              {tab === "incident" && (
                <button
                  type="button"
                  onClick={() => setShowNew(true)}
                  className="dash-btn-primary !py-1.5 !px-3 !text-[12.5px]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>New incident</span>
                </button>
              )}
            </header>

            <main className="dash-scroll flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[960px] px-4 py-7 sm:px-8">
                {banner && (
                  <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#e56b4e]/25 bg-[#e56b4e]/10 px-4 py-2.5 text-[13px] text-[#fba792]">
                    <span>{banner}</span>
                    <button
                      type="button"
                      onClick={() => setBanner(null)}
                      aria-label="Dismiss notification"
                      className="cursor-pointer rounded p-1 text-[#fba792]/70 hover:bg-white/[0.06] hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {tab === "history" && (
                  <ChatHistoryView
                    threads={threads}
                    activeThreadId={activeChatId}
                    onSelectThread={handleSelectThread}
                    onNewChat={handleNewChat}
                    onRenameThread={handleRenameThread}
                    onDeleteThread={handleDeleteThread}
                    onClearAll={handleClearHistory}
                  />
                )}
                {tab === "incident" && (
                  <IncidentRoomView
                    latestCreated={latestIncident}
                    onNavigateApproval={() => setTab("approvals")}
                    onNavigatePostmortem={() => setTab("postmortem")}
                  />
                )}
                {tab === "approvals" && (
                  <ApprovalsInboxView
                    currentRole={user?.role ?? "lead"}
                    onDecisionComplete={refreshPendingApprovals}
                  />
                )}
                {tab === "postmortem" && <PostmortemEditorView />}
                {tab === "ops" && <DocsAdminAndOpsView />}
                {tab === "settings" && <SettingsView />}
              </div>
            </main>
          </>
        )}
      </div>

      {/* Clean New Incident Modal */}
      {showNew && (
        <div
          className="dash-fade fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNew(false);
          }}
        >
          <form
            onSubmit={create}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-incident-title"
            className="dash-pop w-full max-w-[440px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#1d1f24] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-4">
              <div>
                <h3
                  id="new-incident-title"
                  className="text-[15.5px] font-semibold text-[#f2f2f4]"
                >
                  Declare incident
                </h3>
                <p className="mt-0.5 text-[12.5px] text-[#94969e]">
                  Vigil will check runbooks, recent deploys, and logs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                aria-label="Close modal"
                className="-mr-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#94969e] transition-colors hover:bg-white/[0.06] hover:text-[#f2f2f4]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label
                  htmlFor="inc-title"
                  className="mb-1.5 block text-[12.5px] font-medium text-[#c2c4cc]"
                >
                  What&apos;s happening?
                </label>
                <input
                  id="inc-title"
                  autoFocus
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Checkout errors in eu-west-1"
                  className="dash-input"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#c2c4cc]">
                  Severity
                </span>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/[0.07] bg-[#141519] p-1">
                  {(["SEV-1", "SEV-2", "SEV-3"] as Severity[]).map((s) => {
                    const active = severity === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeverity(s)}
                        className={`font-mono-only cursor-pointer rounded-lg py-1.5 text-[12px] font-medium transition-colors ${
                          active
                            ? s === "SEV-1"
                              ? "bg-rose-500/20 text-rose-300"
                              : s === "SEV-2"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-white/[0.11] text-[#f2f2f4]"
                            : "text-[#8e909a] hover:text-[#f2f2f4]"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
              {createError && (
                <p className="mr-auto text-[12px] text-rose-400">
                  {createError}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setShowNew(false);
                }}
                className="dash-btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="dash-btn-primary"
              >
                {creating ? "Investigating…" : "Start investigation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#17181b]" />}>
      <DashboardContent />
    </Suspense>
  );
}
