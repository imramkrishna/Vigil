"use client";

import React, { useEffect, useState } from "react";
import { connectGitHubAccount, getMe } from "@/lib/api";
import { IntegrationsSettingsPanel } from "./ops/IntegrationsSettingsPanel";

type Section = "profile" | "integrations";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "integrations", label: "Integrations" },
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

export function SettingsView() {
  const [section, setSection] = useState<Section>("profile");
  const [saved, setSaved] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2500);
  };

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

  const labelClass = "mb-1.5 block text-[12.5px] font-medium text-[#b5b7be]";

  return (
    <div className="max-w-[780px] space-y-6">
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
            description="Your account details for this Vigil workspace."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="s-name" className={labelClass}>
                  Full name
                </label>
                <input
                  id="s-name"
                  value={name}
                  readOnly
                  className="dash-input opacity-80"
                />
              </div>
              <div>
                <label htmlFor="s-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="s-email"
                  type="email"
                  value={email}
                  readOnly
                  className="dash-input opacity-80"
                />
              </div>
            </div>
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
        </div>
      )}

      {section === "integrations" && (
        <IntegrationsSettingsPanel onNotice={flash} />
      )}
    </div>
  );
}
