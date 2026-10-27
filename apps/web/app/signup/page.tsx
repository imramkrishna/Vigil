"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function SignupPage() {
  const router = useRouter();
  const [team, setTeam] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  const fieldClass =
    "mt-1.5 w-full rounded-lg border border-white/15 bg-[#07080a] px-3.5 py-2.5 text-[14px] outline-none placeholder:text-[#9c9c9d]/50 focus:border-[#ff6b4a]";

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#07080a] text-white">
      <AuroraBackground />
      <main className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-4 pt-28 pb-12">
        <div className="command-launcher-glass p-7 sm:p-8">
          <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
            Create your workspace
          </h1>
          <p className="mt-1.5 text-[14px] text-[#9c9c9d]">
            Start with a sample incident already loaded.
          </p>

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div>
              <label htmlFor="team" className="block text-[13px] font-medium">
                Team name
              </label>
              <input id="team" required value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Acme Payments" className={fieldClass} />
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
            <button type="submit" className="keycap-download-btn mt-2 w-full !py-3">
              Create workspace
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
