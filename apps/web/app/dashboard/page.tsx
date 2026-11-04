"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { IncidentRoomView, type LiveIncidentData } from "@/components/IncidentRoomView";
import { AskCopilotView } from "@/components/AskCopilotView";
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
import type { Severity } from "@/types/vigil";

type TabId = "incident" | "ask" | "approvals" | "postmortem" | "ops" | "settings";

interface NavItem {
  id: TabId;
  label: string;
  title: string;
  description: string;
  badge?: string;
  dot?: boolean;
  icon: React.ReactNode;
}

const ico = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
    <path d={d} />
  </svg>
);

const WORKSPACE: NavItem[] = [
  {
    id: "incident",
    label: "Incidents",
    title: "Incident room",
    description: "Live investigation for your active incident.",
    dot: true,
    icon: ico("M12 9v4m0 4h.01M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"),
  },
  {
    id: "ask",
    label: "Ask Vigil",
    title: "Ask Vigil",
    description: "Get answers from your runbooks and live data, with sources.",
    icon: ico("M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"),
  },
  {
    id: "approvals",
    label: "Approvals",
    title: "Approvals",
    description: "Nothing happens until you say so.",
    badge: "2",
    icon: ico("M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"),
  },
];

const LIBRARY: NavItem[] = [
  {
    id: "postmortem",
    label: "Postmortems",
    title: "Postmortem",
    description: "Review and publish the write-up for a resolved incident.",
    icon: ico("M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z"),
  },
  {
    id: "ops",
    label: "Runbooks",
    title: "Runbooks & usage",
    description: "The knowledge Vigil uses, and what it costs to run.",
    icon: ico("M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z"),
  },
];

const SETTINGS_ITEM: NavItem = {
  id: "settings",
  label: "Settings",
  title: "Settings",
  description: "Your profile, team, billing, and notifications.",
  icon: ico("M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-2.1-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 00-2.1 1.2l-2.4-1-2 3.4 2 1.6a7.400 7.400 0 000 2.400l-2 1.600 2 3.400 2.400-1c.600.500 1.300.900 2.100 1.200l.400 2.600h4l.400-2.600c.800-.300 1.500-.700 2.100-1.200l2.400 1 2-3.400-2-1.600c.100-.400.100-.800.100-1.200z"),
};

const ALL = [...WORKSPACE, ...LIBRARY, SETTINGS_ITEM];

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-left text-[13px] font-medium transition-colors ${
        active
          ? "bg-white/[0.06] text-white"
          : "text-[#8f9093] hover:bg-white/[0.03] hover:text-white"
      }`}
    >
      <span className={active ? "text-[#ff6b4a]" : "text-[#6f7074] group-hover:text-[#b4b4b6]"}>{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="rounded-md bg-white/[0.07] px-1.5 py-px text-[11px] font-medium tabular-nums text-[#c9c9cb]">
          {item.badge}
        </span>
      )}
      {item.dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff5a4a]" />
      )}
    </button>
  );
}

function DashboardContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<TabId>("ask");
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("SEV-2");
  const [creating, setCreating] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [latestIncident, setLatestIncident] = useState<LiveIncidentData | null>(
    null
  );

  useEffect(() => {
    const t = params.get("tab") as TabId | null;
    if (t && ALL.some((x) => x.id === t)) setTab(t);
  }, [params]);

  useEffect(() => {
    getMe().then((u) => {
      if (u) setUser(u);
    });
    listApprovals("pending")
      .then((rows) => setPendingCount(rows.length))
      .catch(() => {});
  }, [tab]);

  const current = ALL.find((n) => n.id === tab) ?? ALL[0];

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;
    const cleanTitle = title.trim();
    setCreating(true);
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
    } catch {
      // Offline demo fallback
    } finally {
      setCreating(false);
      setShowNew(false);
      setTab("incident");
      setBanner(
        `Incident created: "${cleanTitle}" (${severity}). Vigil is investigating.`
      );
      setTitle("");
    }
  };

  const orgName = user?.orgName || "Acme Payments";
  const orgInitial = orgName[0]?.toUpperCase() || "A";
  const userName = user?.name || "Alex Chen";
  const userInitials =
    userName
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AC";
  const userSub = user ? `${user.role} · ${user.email}` : "Pro plan";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0b0d] text-white lg:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden h-full w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0b0d] px-3 py-4 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-3 py-1.5">
          <Image src="/vigil.svg" alt="Vigil" width={24} height={24} className="h-6 w-6 object-contain" />
          <span className="text-[16px] font-semibold tracking-[-0.02em]">Vigil</span>
        </Link>

        <div className="mt-5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/[0.04] transition-colors">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#ffb347] to-[#ff2f3a] text-[11px] font-semibold text-[#07080a]">
            {orgInitial}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-medium">{orgName}</div>
            <div className="text-[11px] text-[#77787b]">Workspace</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-3.5 w-3.5 shrink-0 text-[#6f7074]"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>
        </div>

        <button
          onClick={() => setShowNew(true)}
          className="dash-btn-primary mt-3 w-full"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5"><path d="M12 5v14M5 12h14" /></svg>
          New incident
        </button>

        <nav aria-label="Dashboard" className="mt-7 flex-1 space-y-7 overflow-y-auto">
          <div>
            <div className="dash-eyebrow px-3 pb-2">
              Workspace
            </div>
            <div className="space-y-0.5">
              {WORKSPACE.map((n) => (
                <NavButton
                  key={n.id}
                  item={
                    n.id === "approvals" && pendingCount !== null
                      ? { ...n, badge: pendingCount > 0 ? String(pendingCount) : undefined }
                      : n
                  }
                  active={tab === n.id}
                  onClick={() => setTab(n.id)}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="dash-eyebrow px-3 pb-2">
              Library
            </div>
            <div className="space-y-0.5">
              {LIBRARY.map((n) => (
                <NavButton key={n.id} item={n} active={tab === n.id} onClick={() => setTab(n.id)} />
              ))}
            </div>
          </div>
          <div>
            <div className="dash-eyebrow px-3 pb-2">
              Account
            </div>
            <div className="space-y-0.5">
              <NavButton item={SETTINGS_ITEM} active={tab === "settings"} onClick={() => setTab("settings")} />
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-3 rounded-lg border-t border-white/[0.06] px-2.5 pt-3">
          <button
            onClick={() => setTab("settings")}
            aria-label="Open settings"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-medium">
              {userInitials}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium">{userName}</div>
              <div className="truncate text-[11px] text-[#77787b]">{userSub}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/login");
            }}
            aria-label="Log out"
            className="text-[#9c9c9d] hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[240px] bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,rgba(255,107,74,0.05),transparent)]" />

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#08090b]/90 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/vigil.svg" alt="Vigil" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
              <span className="text-[15px] font-semibold">Vigil</span>
            </Link>
            <button onClick={() => setShowNew(true)} className="dash-btn-primary !px-3 !py-1.5 !text-[12.5px]">
              New incident
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2">
            {ALL.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] ${
                  tab === n.id ? "bg-white/10 text-white" : "text-[#9c9c9d]"
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </header>

        {tab === "ask" ? (
          <div className="relative z-10 h-[calc(100vh-88px)] lg:h-screen w-full overflow-hidden">
            <AskCopilotView />
          </div>
        ) : (
          <main className="relative z-10 mx-auto max-w-[1100px] px-4 py-8 sm:px-8 lg:py-10">
            <div className="mb-7 border-b border-white/[0.06] pb-6">
              <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{current.title}</h1>
              <p className="mt-1 text-[13.5px] text-[#8f9093]">{current.description}</p>
            </div>

            {banner && (
              <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#ffb347]/30 bg-[#ff2f3a]/10 px-4 py-3 text-[13px] text-[#ffb347]">
                <span>{banner}</span>
                <button onClick={() => setBanner(null)} aria-label="Dismiss" className="text-white/70 hover:text-white">
                  ✕
                </button>
              </div>
            )}

            {tab === "incident" && (
              <IncidentRoomView
                latestCreated={latestIncident}
                onNavigateApproval={() => setTab("approvals")}
              />
            )}
            {tab === "approvals" && (
              <ApprovalsInboxView currentRole={user?.role ?? "lead"} />
            )}
            {tab === "postmortem" && <PostmortemEditorView />}
            {tab === "ops" && <DocsAdminAndOpsView />}
            {tab === "settings" && <SettingsView />}
          </main>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form onSubmit={create} className="dash-card w-full max-w-[440px] p-6 shadow-2xl">
            <h3 className="text-[18px] font-semibold">New incident</h3>
            <label htmlFor="inc-title" className="mt-4 block text-[13px] font-medium">
              What&apos;s happening?
            </label>
            <input
              id="inc-title"
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Checkout errors in EU-West"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-[14px] caret-[#ff6b4a] outline-none placeholder:text-[#9c9c9d]/60 focus:border-[#ff6b4a]"
            />
            <label htmlFor="inc-sev" className="mt-4 block text-[13px] font-medium">
              Severity
            </label>
            <select
              id="inc-sev"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0b0c0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#ff6b4a]"
            >
              <option>SEV-1</option>
              <option>SEV-2</option>
              <option>SEV-3</option>
            </select>
            <div className="mt-6 flex justify-end gap-2.5">
              <button type="button" onClick={() => setShowNew(false)} className="dash-btn-ghost">
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="dash-btn-primary !px-5 !py-2 !text-[13px]"
              >
                {creating ? "Investigating…" : "Create"}
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
    <Suspense fallback={<div className="min-h-screen bg-[#0a0b0d]" />}>
      <DashboardContent />
    </Suspense>
  );
}
