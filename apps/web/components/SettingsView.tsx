"use client";

import React, { useState } from "react";

type Section = "profile" | "team" | "billing" | "notifications";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "billing", label: "Billing" },
  { id: "notifications", label: "Notifications" },
];

const PLANS = [
  { id: "free", name: "Free", price: 0, blurb: "For trying Vigil", perks: ["1 workspace", "3 members", "50 questions / month"] },
  { id: "pro", name: "Pro", price: 29, blurb: "For small on-call teams", perks: ["Unlimited incidents", "10 members", "Unlimited questions"] },
  { id: "team", name: "Team", price: 99, blurb: "For larger organizations", perks: ["Unlimited members", "SSO & audit log", "Priority support"] },
];

const INVOICES = [
  { id: "INV-1042", date: "Oct 1, 2026", amount: "$29.00", status: "Paid" },
  { id: "INV-0987", date: "Sep 1, 2026", amount: "$29.00", status: "Paid" },
  { id: "INV-0931", date: "Aug 1, 2026", amount: "$29.00", status: "Paid" },
];

const INITIAL_MEMBERS = [
  { name: "Alex Chen", email: "alex@acme-payments.dev", role: "Admin" },
  { name: "Priya Nair", email: "priya@acme-payments.dev", role: "Lead" },
  { name: "Sam Ortiz", email: "sam@acme-payments.dev", role: "Responder" },
  { name: "Jo Park", email: "jo@acme-payments.dev", role: "Viewer" },
];

const ROLES = ["Admin", "Lead", "Responder", "Viewer"];

const NOTIFS = [
  { id: "incident", label: "New incidents", hint: "When a SEV-1 or SEV-2 is declared" },
  { id: "approval", label: "Approval requests", hint: "When Vigil needs your sign-off" },
  { id: "postmortem", label: "Postmortem ready", hint: "When a draft is ready to review" },
  { id: "digest", label: "Weekly summary", hint: "A Monday recap of incidents and usage" },
];

const field =
  "mt-1.5 w-full rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-[14px] caret-[#ff6b4a] outline-none placeholder:text-[#9c9c9d]/60 focus:border-[#ff6b4a]";

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
    <section className="command-launcher-glass p-6">
      <h3 className="text-[16px] font-semibold">{title}</h3>
      {description && <p className="mt-1 text-[13px] text-[#9c9c9d]">{description}</p>}
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
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-gradient-to-r from-[#ffb347] to-[#ff6b4a]" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function SettingsView() {
  const [section, setSection] = useState<Section>("profile");
  const [saved, setSaved] = useState<string | null>(null);

  // Profile
  const [name, setName] = useState("Alex Chen");
  const [email, setEmail] = useState("alex@acme-payments.dev");
  const [title, setTitle] = useState("Incident lead");
  const [workspace, setWorkspace] = useState("Acme Payments");

  // Team
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [invite, setInvite] = useState("");

  // Billing
  const [plan, setPlan] = useState("pro");
  const [yearly, setYearly] = useState(false);
  const [card, setCard] = useState({ brand: "Visa", last4: "4242", exp: "08/28" });
  const [editingCard, setEditingCard] = useState(false);
  const [newCard, setNewCard] = useState({ number: "", exp: "", cvc: "" });

  // Notifications
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
    setCard({ brand: digits.startsWith("4") ? "Visa" : "Card", last4: digits.slice(-4), exp: newCard.exp || "—" });
    setNewCard({ number: "", exp: "", cvc: "" });
    setEditingCard(false);
    flash("Payment method updated");
  };

  const addMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite.includes("@")) return;
    setMembers([...members, { name: invite.split("@")[0], email: invite.trim(), role: "Viewer" }]);
    setInvite("");
    flash("Invite sent");
  };

  const current = PLANS.find((p) => p.id === plan)!;
  const price = (p: number) => (yearly ? Math.round(p * 0.8) : p);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[180px_1fr]">
      {/* Section nav */}
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            aria-current={section === s.id ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors ${
              section === s.id
                ? "bg-white/[0.07] text-white"
                : "text-[#9c9c9d] hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 max-w-[760px] space-y-6">
        {saved && (
          <div role="status" className="rounded-xl border border-[#ffb347]/30 bg-[#ff2f3a]/10 px-4 py-2.5 text-[13px] text-[#ffb347]">
            {saved}
          </div>
        )}

        {section === "profile" && (
          <>
            <Card title="Your profile" description="How you appear to your teammates.">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#ffb347] to-[#ff2f3a] text-[18px] font-semibold text-[#07080a]">
                  {name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <button className="rounded-lg border border-white/15 px-3.5 py-2 text-[13px] text-[#9c9c9d] hover:text-white">
                  Change photo
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  flash("Profile saved");
                }}
                className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <div>
                  <label htmlFor="s-name" className="block text-[13px] font-medium">Full name</label>
                  <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
                </div>
                <div>
                  <label htmlFor="s-title" className="block text-[13px] font-medium">Job title</label>
                  <input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="s-email" className="block text-[13px] font-medium">Email</label>
                  <input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className="keycap-download-btn !px-5 !py-2 !text-[13px]">Save changes</button>
                </div>
              </form>
            </Card>

            <Card title="Workspace" description="Shown in the sidebar and in notifications.">
              <label htmlFor="s-ws" className="block text-[13px] font-medium">Workspace name</label>
              <input id="s-ws" value={workspace} onChange={(e) => setWorkspace(e.target.value)} className={field} />
              <button onClick={() => flash("Workspace updated")} className="keycap-download-btn mt-4 !px-5 !py-2 !text-[13px]">
                Save
              </button>
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
                  <label htmlFor="s-cur" className="block text-[13px] font-medium">Current password</label>
                  <input id="s-cur" type="password" required className={field} />
                </div>
                <div>
                  <label htmlFor="s-new" className="block text-[13px] font-medium">New password</label>
                  <input id="s-new" type="password" required minLength={8} className={field} />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className="rounded-lg border border-white/15 px-4 py-2 text-[13px] hover:bg-white/10">
                    Update password
                  </button>
                </div>
              </form>
            </Card>
          </>
        )}

        {section === "team" && (
          <>
            <Card title="Invite a teammate" description="They'll get an email to join Acme Payments.">
              <form onSubmit={addMember} className="flex flex-col gap-2.5 sm:flex-row">
                <label htmlFor="s-invite" className="sr-only">Email address</label>
                <input
                  id="s-invite"
                  type="email"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder="teammate@company.com"
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-[14px] caret-[#ff6b4a] outline-none placeholder:text-[#9c9c9d]/60 focus:border-[#ff6b4a]"
                />
                <button type="submit" className="keycap-download-btn !px-5 !py-2.5 !text-[13px]">Send invite</button>
              </form>
            </Card>

            <Card title={`Members (${members.length})`} description="Roles control who can approve actions.">
              <ul className="divide-y divide-white/[0.06]">
                {members.map((m, i) => (
                  <li key={m.email} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-medium">
                        {m.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium">{m.name}</div>
                        <div className="truncate text-[12px] text-[#9c9c9d]">{m.email}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <select
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        onChange={(e) =>
                          setMembers(members.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))
                        }
                        className="rounded-lg border border-white/15 bg-[#0b0c0f] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#ff6b4a]"
                      >
                        {ROLES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      {i > 0 && (
                        <button
                          onClick={() => setMembers(members.filter((_, j) => j !== i))}
                          className="text-[12.5px] text-[#9c9c9d] hover:text-[#ff6b4a]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {section === "billing" && (
          <>
            <Card title="Plan" description={`You're on the ${current.name} plan.`}>
              <div className="mb-4 flex items-center gap-3 text-[13px]">
                <span className={!yearly ? "text-white" : "text-[#9c9c9d]"}>Monthly</span>
                <Toggle checked={yearly} onChange={setYearly} label="Bill yearly" />
                <span className={yearly ? "text-white" : "text-[#9c9c9d]"}>
                  Yearly <span className="text-[#ffb347]">save 20%</span>
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PLANS.map((p) => {
                  const active = p.id === plan;
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-col rounded-xl border p-4 ${
                        active ? "launcher-row-active border-[#ff6b4a]/50" : "border-white/10 bg-white/[0.02]"
                      }`}
                    >
                      <div className="text-[14px] font-semibold">{p.name}</div>
                      <div className="mt-1 text-[24px] font-semibold">
                        ${price(p.price)}
                        <span className="text-[12px] font-normal text-[#9c9c9d]"> /mo</span>
                      </div>
                      <div className="mt-1 text-[12px] text-[#9c9c9d]">{p.blurb}</div>
                      <ul className="mt-3 space-y-1 text-[12.5px] text-white/85">
                        {p.perks.map((perk) => (
                          <li key={perk}>· {perk}</li>
                        ))}
                      </ul>
                      <button
                        disabled={active}
                        onClick={() => {
                          setPlan(p.id);
                          flash(`Switched to ${p.name}`);
                        }}
                        className={`mt-auto rounded-lg px-3 py-2 text-[13px] font-medium ${
                          active
                            ? "mt-4 cursor-default bg-white/10 text-[#9c9c9d]"
                            : "mt-4 border border-white/15 text-white hover:bg-white/10"
                        }`}
                      >
                        {active ? "Current plan" : p.price > current.price ? "Upgrade" : "Switch"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Payment method" description="Used for your subscription. Next charge on Nov 1, 2026.">
              {!editingCard ? (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-white/10 px-2 py-1 text-[11px] font-semibold">{card.brand}</span>
                    <div>
                      <div className="font-mono-only text-[14px]">•••• {card.last4}</div>
                      <div className="text-[12px] text-[#9c9c9d]">Expires {card.exp}</div>
                    </div>
                  </div>
                  <button onClick={() => setEditingCard(true)} className="rounded-lg border border-white/15 px-3.5 py-1.5 text-[13px] hover:bg-white/10">
                    Replace
                  </button>
                </div>
              ) : (
                <form onSubmit={saveCard} className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label htmlFor="c-num" className="block text-[13px] font-medium">Card number</label>
                    <input id="c-num" inputMode="numeric" required value={newCard.number} onChange={(e) => setNewCard({ ...newCard, number: e.target.value })} placeholder="1234 5678 9012 3456" className={field} />
                  </div>
                  <div>
                    <label htmlFor="c-exp" className="block text-[13px] font-medium">Expiry</label>
                    <input id="c-exp" required value={newCard.exp} onChange={(e) => setNewCard({ ...newCard, exp: e.target.value })} placeholder="MM/YY" className={field} />
                  </div>
                  <div>
                    <label htmlFor="c-cvc" className="block text-[13px] font-medium">CVC</label>
                    <input id="c-cvc" inputMode="numeric" required value={newCard.cvc} onChange={(e) => setNewCard({ ...newCard, cvc: e.target.value })} placeholder="123" className={field} />
                  </div>
                  <div className="col-span-2 flex gap-2.5">
                    <button type="submit" className="keycap-download-btn !px-5 !py-2 !text-[13px]">Save card</button>
                    <button type="button" onClick={() => setEditingCard(false)} className="rounded-lg border border-white/15 px-4 py-2 text-[13px] text-[#9c9c9d] hover:text-white">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </Card>

            <Card title="Invoices">
              <ul className="divide-y divide-white/[0.06]">
                {INVOICES.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-4 py-3 text-[13.5px]">
                    <div>
                      <div className="font-medium">{inv.date}</div>
                      <div className="font-mono-only text-[11.5px] text-[#9c9c9d]">{inv.id}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[12px] text-[#9c9c9d]">{inv.status}</span>
                      <span className="font-mono-only">{inv.amount}</span>
                      <button className="text-[#ffb347] hover:underline">Download</button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Cancel subscription" description="You'll keep access until the end of this billing period.">
              <button onClick={() => flash("Cancellation scheduled for Nov 1")} className="rounded-lg border border-[#ff2f3a]/40 px-4 py-2 text-[13px] text-[#ff6b4a] hover:bg-[#ff2f3a]/10">
                Cancel plan
              </button>
            </Card>
          </>
        )}

        {section === "notifications" && (
          <Card title="Email notifications" description="Choose what Vigil emails you about.">
            <ul className="divide-y divide-white/[0.06]">
              {NOTIFS.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div>
                    <div className="text-[14px] font-medium">{n.label}</div>
                    <div className="text-[12.5px] text-[#9c9c9d]">{n.hint}</div>
                  </div>
                  <Toggle
                    label={n.label}
                    checked={notifs[n.id]}
                    onChange={(v) => setNotifs({ ...notifs, [n.id]: v })}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
