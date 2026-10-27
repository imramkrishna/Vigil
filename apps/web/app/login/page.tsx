"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#07080a] text-white">
      <AuroraBackground />
      <main className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-4 pt-28 pb-12">
        <div className="command-launcher-glass p-7 sm:p-8">
          <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
            Welcome back
          </h1>
          <p className="mt-1.5 text-[14px] text-[#9c9c9d]">
            Log in to your Vigil workspace.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#07080a] px-3.5 py-2.5 text-[14px] outline-none placeholder:text-[#9c9c9d]/50 focus:border-[#ff6b4a]"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-[13px] font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#07080a] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#ff6b4a]"
              />
            </div>
            <button type="submit" className="keycap-download-btn mt-2 w-full !py-3">
              Log in
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-3 w-full rounded-lg border border-white/15 px-4 py-2.5 text-[14px] text-[#9c9c9d] transition-colors hover:border-white/30 hover:text-white"
          >
            Try the demo workspace
          </button>

          <p className="mt-6 text-center text-[13px] text-[#9c9c9d]">
            New to Vigil?{" "}
            <Link href="/signup" className="text-white underline decoration-[#ff6b4a] underline-offset-4">
              Create a workspace
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
