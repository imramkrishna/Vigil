"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuroraBackground } from "@/components/AuroraBackground";
import { getMe, signInWithGitHub, signUpEmail } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [team, setTeam] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMe().then((user) => {
      if (!active) return;
      if (user) {
        router.replace("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signUpEmail(team, email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create workspace."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setGithubLoading(true);
    setError(null);
    try {
      await signInWithGitHub();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start GitHub authentication."
      );
      setGithubLoading(false);
    }
  };

  const fieldClass =
    "mt-1.5 w-full rounded-lg border border-white/15 bg-[#07080a] px-3.5 py-2.5 text-[14px] outline-none placeholder:text-[#9c9c9d]/50 focus:border-[#ff6b4a]";

  if (checkingAuth) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-[#07080a] text-white">
        <AuroraBackground />
        <div className="relative z-10 text-[13px] text-[#9c9c9d]">
          Checking session…
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#07080a] text-white">
      <AuroraBackground />
      <main className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-4 pt-28 pb-12">
        <div className="command-launcher-glass p-7 sm:p-8">
          <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
            Create your workspace
          </h1>
          <p className="mt-1.5 text-[14px] text-[#9c9c9d]">
            Set up your engineering operations workspace.
          </p>

          <button
            type="button"
            onClick={handleGitHubSignIn}
            disabled={githubLoading || loading}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.08] disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            {githubLoading ? "Redirecting to GitHub…" : "Continue with GitHub"}
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11.5px] uppercase tracking-wider text-[#9c9c9d]">
              or email
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="team" className="block text-[13px] font-medium">
                Team name
              </label>
              <input id="team" required value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Your engineering team" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium">
                Work email
              </label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="password" className="block text-[13px] font-medium">
                Password
              </label>
              <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
            </div>
            {error && (
              <p className="text-[12.5px] text-rose-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || githubLoading}
              className="keycap-download-btn mt-2 w-full !py-3"
            >
              {loading ? "Creating workspace…" : "Create workspace"}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-[#9c9c9d]">
            Already have an account?{" "}
            <Link href="/login" className="text-white underline decoration-[#ff6b4a] underline-offset-4">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
