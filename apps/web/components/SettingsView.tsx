"use client";

import React, { useEffect, useState } from "react";
import { connectGitHubAccount, getMe } from "@/lib/api";

type Section = "profile" | "team" | "billing" | "notifications";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "billing", label: "Billing" },
  { id: "notifications", label: "Notifications" },
];

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    blurb: "For trying Vigil",
    perks: ["1 workspace", "3 members", "50 questions / month"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    blurb: "For small on-call teams",
    perks: ["Unlimited incidents", "10 members", "Unlimited questions"],
  },
  {
    id: "team",
    name: "Team",
    price: 99,
    blurb: "For larger organizations",
    perks: ["Unlimited members", "SSO & audit log", "Priority support"],
  },
];

const INVOICES = [
  { id: "INV-1042", date: "Oct 1, 2026", amount: "$29.00", status: "Paid" },
  { id: "INV-0987", date: "Sep 1, 2026", amount: "$29.00", status: "Paid" },
  { id: "INV-0931", date: "Aug 1, 2026", amount: "$29.00", status: "Paid" },
];

const INITIAL_MEMBERS = [
  { name: "You", email: "you@company.dev", role: "Admin" },
  { name: "Priya Nair", email: "priya@company.dev", role: "Lead" },
  { name: "Sam Ortiz", email: "sam@company.dev", role: "Responder" },
  { name: "Jo Park", email: "jo@company.dev", role: "Viewer" },
];

const ROLES = ["Admin", "Lead", "Responder", "Viewer"];

const NOTIFS = [
  {
    id: "incident",
    label: "New incidents",
    hint: "When a SEV-1 or SEV-2 is declared",
  },
  {
    id: "approval",
    label: "Approval requests",
    hint: "When Vigil needs your sign-off",
  },
  {
    id: "postmortem",
    label: "Postmortem ready",
    hint: "When a draft is ready to review",
  },
  {
    id: "digest",
    label: "Weekly summary",
    hint: "A Monday recap of incidents and usage",
  },
];

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dash-card p-6">
      <h3 className="text-[15px] font-semibold text-[#ececef]">{title}</h3>
      {description && (
        <p className="mt-1 text-[13px] text-[#8a8c95]">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
        checked ? "bg-[#e56b4e]" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function SettingsView() {
  const [section, setSection] = useState<Section>("profile");
  const [saved, setSaved] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("Incident lead");
  const [githubConnected, setGithubConnected] = useState(false);
  const [connectingGitHub, setConnectingGitHub] = useState(false);

  useEffect(() => {
    getMe().then((user) => {
      if (!user) return;
      if (user.name) setName(user.name);
      if (user.email) setEmail(user.email);
      setGithubConnected(Boolean(user.githubConnected));
    });
  }, []);

  const handleConnectGitHub = async () => {
    setConnectingGitHub(true);
    try {
      await connectGitHubAccount();
    } catch (err) {
      flash(
        err instanceof Error
          ? err.message
          : "Could not start GitHub authorization"
      );
      setConnectingGitHub(false);
    }
  };

  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [invite, setInvite] = useState("");

  const [plan, setPlan] = useState("pro");
  const [yearly, setYearly] = useState(false);
  const [card, setCard] = useState({
    brand: "Visa",
    last4: "4242",
    exp: "08/28",
  });
  const [editingCard, setEditingCard] = useState(false);
  const [newCard, setNewCard] = useState({ number: "", exp: "", cvc: "" });

  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    incident: true,
    approval: true,
    postmortem: true,
    digest: false,
  });

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2500);
  };

  const saveCard = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = newCard.number.replace(/\D/g, "");
    if (digits.length < 12) return;
    setCard({
      brand: digits.startsWith("4") ? "Visa" : "Card",
      last4: digits.slice(-4),
      exp: newCard.exp || "—",
    });
    setNewCard({ number: "", exp: "", cvc: "" });
    setEditingCard(false);
    flash("Payment method updated");
  };

  const addMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite.includes("@")) return;
    setMembers([
      ...members,
      { name: invite.split("@")[0] || "Member", email: invite.trim(), role: "Viewer" },
    ]);
    setInvite("");
    flash("Invite sent");
  };

  const current = PLANS.find((p) => p.id === plan)!;
  const price = (p: number) => (yearly ? Math.round(p * 0.8) : p);
  const labelClass = "mb-1.5 block text-[12.5px] font-medium text-[#b5b7be]";

  return (
    <div className="max-w-[780px] space-y-6">
      {/* Clean Horizontal Tabs */}
      <nav
        aria-label="Settings sections"
        className="flex gap-1 border-b border-white/[0.06] pb-3"
      >
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              aria-current={active ? "page" : undefined}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-white/[0.08] text-[#ececef]"
                  : "text-[#8a8c95] hover:bg-white/[0.04] hover:text-[#ececef]"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      {saved && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-[13px] text-emerald-300"
        >
          {saved}
        </div>
      )}

      {section === "profile" && (
        <div className="space-y-5">
          <Card
            title="Profile"
            description="Your identity across incidents, approvals, and postmortems."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                flash("Profile saved");
              }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <div>
                <label htmlFor="s-name" className={labelClass}>
                  Full name
                </label>
                <input
                  id="s-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="dash-input"
                />
              </div>
              <div>
                <label htmlFor="s-title" className={labelClass}>
                  Job title
                </label>
                <input
                  id="s-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Staff engineer"
                  className="dash-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="s-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="s-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.dev"
                  className="dash-input"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end pt-1">
                <button type="submit" className="dash-btn-primary">
                  Save changes
                </button>
              </div>
            </form>
          </Card>

          <Card
            title="GitHub integration"
            description="Authorize Octokit so Vigil can inspect private repositories, commits, and deploy diffs."
          >
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#141519] p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#ececef]">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-[#ececef]">
                      GitHub OAuth
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        githubConnected
                          ? "bg-emerald-500/12 text-emerald-300"
                          : "bg-white/[0.06] text-[#94969e]"
                      }`}
                    >
                      {githubConnected ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-[#8a8c95]">
                    {githubConnected
                      ? "Authorized to read private and public repositories."
                      : "Connect GitHub for private repo access (fallback covers public repos)."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnectGitHub}
                disabled={connectingGitHub}
                className={
                  githubConnected
                    ? "dash-btn-ghost shrink-0"
                    : "dash-btn-primary shrink-0"
                }
              >
                {connectingGitHub
                  ? "Redirecting…"
                  : githubConnected
                    ? "Reconnect"
                    : "Connect GitHub"}
              </button>
            </div>
          </Card>

          <Card title="Password" description="Use at least 8 characters.">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                flash("Password updated");
              }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <div>
                <label htmlFor="s-cur" className={labelClass}>
                  Current password
                </label>
                <input
                  id="s-cur"
                  type="password"
                  required
                  className="dash-input"
                />
              </div>
              <div>
                <label htmlFor="s-new" className={labelClass}>
                  New password
                </label>
                <input
                  id="s-new"
                  type="password"
                  required
                  minLength={8}
                  className="dash-input"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end pt-1">
                <button type="submit" className="dash-btn-ghost">
                  Update password
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {section === "team" && (
        <div className="space-y-5">
          <Card
            title="Invite teammate"
            description="Send an invite link to add a teammate to your organization."
          >
            <form
              onSubmit={addMember}
              className="flex flex-col gap-2.5 sm:flex-row"
            >
              <label htmlFor="s-invite" className="sr-only">
                Email address
              </label>
              <input
                id="s-invite"
                type="email"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="teammate@company.com"
                className="dash-input flex-1"
              />
              <button type="submit" className="dash-btn-primary shrink-0">
                Send invite
              </button>
            </form>
          </Card>

          <Card
            title={`Members (${members.length})`}
            description="Roles determine who can approve remediation actions."
          >
            <ul className="divide-y divide-white/[0.06]">
              {members.map((m, i) => (
                <li
                  key={m.email}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11.5px] font-medium text-[#ececef]">
                      {m.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium text-[#ececef]">
                        {m.name}
                      </div>
                      <div className="truncate text-[12px] text-[#8a8c95]">
                        {m.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <select
                      aria-label={`Role for ${m.name}`}
                      value={m.role}
                      onChange={(e) =>
                        setMembers(
                          members.map((x, j) =>
                            j === i ? { ...x, role: e.target.value } : x
                          )
                        )
                      }
                      className="dash-input !w-auto !py-1.5 !text-[12.5px]"
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMembers(members.filter((_, j) => j !== i))
                        }
                        className="cursor-pointer text-[12.5px] text-[#8a8c95] transition-colors hover:text-rose-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {section === "billing" && (
        <div className="space-y-5">
          <Card title="Plan" description={`Currently on ${current.name}.`}>
            <div className="mb-4 flex items-center gap-3 text-[13px]">
              <span className={!yearly ? "text-[#ececef]" : "text-[#8a8c95]"}>
                Monthly
              </span>
              <Toggle
                checked={yearly}
                onChange={setYearly}
                label="Bill yearly"
              />
              <span className={yearly ? "text-[#ececef]" : "text-[#8a8c95]"}>
                Yearly{" "}
                <span className="text-[#f7a08a]">save 20%</span>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLANS.map((p) => {
                const active = p.id === plan;
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col rounded-xl border p-4 ${
                      active
                        ? "border-white/[0.2] bg-white/[0.04]"
                        : "border-white/[0.07] bg-[#141519]"
                    }`}
                  >
                    <div className="text-[14px] font-semibold text-[#ececef]">
                      {p.name}
                    </div>
                    <div className="mt-1 text-[22px] font-semibold text-[#ececef]">
                      ${price(p.price)}
                      <span className="text-[12px] font-normal text-[#8a8c95]">
                        {" "}
                        /mo
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-[#8a8c95]">
                      {p.blurb}
                    </div>
                    <ul className="mt-3 space-y-1 text-[12.5px] text-[#c9cbd3]">
                      {p.perks.map((perk) => (
                        <li key={perk}>· {perk}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={active}
                      onClick={() => {
                        setPlan(p.id);
                        flash(`Switched to ${p.name}`);
                      }}
                      className={`mt-4 w-full ${
                        active ? "dash-btn-ghost" : "dash-btn-primary"
                      }`}
                    >
                      {active
                        ? "Current plan"
                        : p.price > current.price
                          ? "Upgrade"
                          : "Switch"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card
            title="Payment method"
            description="Next charge on Nov 1, 2026."
          >
            {!editingCard ? (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#141519] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-[#ececef]">
                    {card.brand}
                  </span>
                  <div>
                    <div className="font-mono-only text-[13.5px] text-[#ececef]">
                      •••• {card.last4}
                    </div>
                    <div className="text-[12px] text-[#8a8c95]">
                      Expires {card.exp}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCard(true)}
                  className="dash-btn-ghost"
                >
                  Replace
                </button>
              </div>
            ) : (
              <form onSubmit={saveCard} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label htmlFor="c-num" className={labelClass}>
                    Card number
                  </label>
                  <input
                    id="c-num"
                    inputMode="numeric"
                    required
                    value={newCard.number}
                    onChange={(e) =>
                      setNewCard({ ...newCard, number: e.target.value })
                    }
                    placeholder="1234 5678 9012 3456"
                    className="dash-input"
                  />
                </div>
                <div>
                  <label htmlFor="c-exp" className={labelClass}>
                    Expiry
                  </label>
                  <input
                    id="c-exp"
                    required
                    value={newCard.exp}
                    onChange={(e) =>
                      setNewCard({ ...newCard, exp: e.target.value })
                    }
                    placeholder="MM/YY"
                    className="dash-input"
                  />
                </div>
                <div>
                  <label htmlFor="c-cvc" className={labelClass}>
                    CVC
                  </label>
                  <input
                    id="c-cvc"
                    inputMode="numeric"
                    required
                    value={newCard.cvc}
                    onChange={(e) =>
                      setNewCard({ ...newCard, cvc: e.target.value })
                    }
                    placeholder="123"
                    className="dash-input"
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  <button type="submit" className="dash-btn-primary">
                    Save card
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCard(false)}
                    className="dash-btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </Card>

          <Card title="Invoices">
            <ul className="divide-y divide-white/[0.06]">
              {INVOICES.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-4 py-3 text-[13px]"
                >
                  <div>
                    <div className="font-medium text-[#ececef]">{inv.date}</div>
                    <div className="font-mono-only text-[11.5px] text-[#7c7e87]">
                      {inv.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[12px] text-[#8a8c95]">
                      {inv.status}
                    </span>
                    <span className="font-mono-only text-[#ececef]">
                      {inv.amount}
                    </span>
                    <button
                      type="button"
                      className="cursor-pointer text-[12.5px] text-[#b5b7be] hover:text-[#ececef]"
                    >
                      Download
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {section === "notifications" && (
        <Card
          title="Email notifications"
          description="Choose which operational events Vigil emails you about."
        >
          <ul className="divide-y divide-white/[0.06]">
            {NOTIFS.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-4 py-3.5"
              >
                <div>
                  <div className="text-[13.5px] font-medium text-[#ececef]">
                    {n.label}
                  </div>
                  <div className="text-[12.5px] text-[#8a8c95]">{n.hint}</div>
                </div>
                <Toggle
                  label={n.label}
                  checked={Boolean(notifs[n.id])}
                  onChange={(v) => setNotifs({ ...notifs, [n.id]: v })}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
