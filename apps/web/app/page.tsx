"use client";

import { useState } from "react";
import Image from "next/image";

interface LauncherRow {
  id: string;
  label: string;
  monoArg: string;
  shortcut: string;
  queryText: string;
  icon: "triage" | "approve" | "docs" | "postmortem";
}

const LAUNCHER_ROWS: LauncherRow[] = [
  {
    id: "triage",
    label: "Triage live incident",
    monoArg: "payments-service --send-specialists",
    shortcut: "Cmd+Enter",
    queryText: "triage payments-service",
    icon: "triage",
  },
  {
    id: "approve",
    label: "Approve gated write",
    monoArg: "rollback 7f3a91c (#app_881)",
    shortcut: "Cmd+B",
    queryText: "approve rollback 7f3a91c",
    icon: "approve",
  },
  {
    id: "docs",
    label: "Query runbooks & ops DB",
    monoArg: "~/runbooks/payments --hybrid-rrf",
    shortcut: "Cmd+O",
    queryText: "query ~/runbooks/payments",
    icon: "docs",
  },
  {
    id: "postmortem",
    label: "Draft cited postmortem",
    monoArg: "INC-2048 --verify-evidence",
    shortcut: "Cmd+K",
    queryText: "postmortem INC-2048",
    icon: "postmortem",
  },
];

function AppleGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M11.182 8.47c-.015-1.547 1.264-2.295 1.322-2.331-.723-1.056-1.845-1.2-2.241-1.216-.943-.097-1.856.564-2.336.564-.488 0-1.226-.552-2.02-.536-1.032.016-1.995.611-2.526 1.543-1.088 1.884-.278 4.666.768 6.192.518.748 1.124 1.584 1.922 1.554.777-.031 1.068-.498 2.006-.498.932 0 1.199.498 2.012.481.834-.013 1.36-.755 1.868-1.506.592-.862.834-1.701.846-1.744-.019-.008-1.606-.617-1.621-2.503zM9.66 3.91c.423-.52.711-1.236.632-1.959-.612.026-1.362.411-1.801.925-.388.45-.734 1.184-.641 1.89.684.053 1.385-.343 1.81-.856z" />
    </svg>
  );
}

function WindowsGlyph({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M1.5 2.65L7.1 1.88v5.5H1.5V2.65zm6.35-.88L14.5.8v6.58H7.85V1.77zM1.5 8.12h5.6v5.52L1.5 12.86V8.12zm6.35 0H14.5v6.58l-6.65-.94V8.12z" />
    </svg>
  );
}

function RowGlyph({ type }: { type: LauncherRow["icon"] }) {
  if (type === "triage") {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-white"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M1.75 8h2.5l1.75-4 3.5 8 1.75-4h3"
        />
      </svg>
    );
  }
  if (type === "approve") {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-[#9c9c9d]"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 1.75l5 2v4.1c0 3.15-2.13 5.75-5 6.4-2.87-.65-5-3.25-5-6.4v-4.1l5-2z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.75 8.1l1.5 1.5 3.1-3.1"
        />
      </svg>
    );
  }
  if (type === "docs") {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-[#9c9c9d]"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.75 3.25h4a1.25 1.25 0 011.25 1.25v8.25a1 1 0 00-1-1h-4.25v-8.5zm10.5 0h-4A1.25 1.25 0 008 4.5v8.25a1 1 0 011-1h4.25v-8.5z"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-[#9c9c9d]"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 2.25h5.5L12.75 5.5v8.25H4V2.25z"
      />
      <path strokeLinecap="round" d="M6 8.25h4M6 10.75h4" />
    </svg>
  );
}

export default function Home() {
  const [selectedRowId, setSelectedRowId] = useState<string>("triage");

  const activeRow =
    LAUNCHER_ROWS.find((row) => row.id === selectedRowId) ?? LAUNCHER_ROWS[0];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#07080a] text-white">
      {/* ====================================================================
          LIVING WARM AURORA BACKGROUND (Pure CSS @keyframes + Grain + Vignette)
          ==================================================================== */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Diagonal Warm Light-Blades (Crimson #ff2f3a -> Coral #ff6b4a -> Amber #ffb347) */}
        <div className="aurora-blade aurora-blade-1" />
        <div className="aurora-blade aurora-blade-2" />
        <div className="aurora-blade aurora-blade-3" />
        <div className="aurora-blade aurora-blade-4" />

        {/* Subtle SVG feTurbulence Film-Grain */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.18] mix-blend-overlay">
          <filter id="vigil-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.82"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#vigil-grain)" />
        </svg>

        {/* Radial Vignette into #07080a Ground */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 28%, rgba(7, 8, 10, 0.06) 0%, rgba(7, 8, 10, 0.56) 62%, #07080a 92%)",
          }}
        />
      </div>

      {/* ====================================================================
          (1) FLOATING TRANSLUCENT PILL NAV NEAR TOP-CENTER
          ==================================================================== */}
      <header className="relative z-20 mx-auto flex max-w-[1440px] justify-center px-6 pt-6">
        <nav
          aria-label="Primary navigation"
          className="floating-pill-nav flex w-full max-w-[780px] items-center justify-between rounded-full px-4 py-2"
        >
          {/* Left: Warm Logo Glyph + White Wordmark */}
          <a href="#" className="flex items-center gap-2.5 pl-1">
            <Image
              src="/vigil.svg"
              alt="Vigil logo"
              width={22}
              height={22}
              className="h-5.5 w-5.5 object-contain"
              priority
            />
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Vigil
            </span>
          </a>

          {/* Center: Muted #9c9c9d 14px/500 Inter Links */}
          <div className="hidden items-center gap-7 text-[14px] font-medium text-[#9c9c9d] md:flex">
            <a href="#product" className="transition-colors hover:text-white">
              Product
            </a>
            <a href="#docs" className="transition-colors hover:text-white">
              Docs
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              Pricing
            </a>
            <a
              href="#changelog"
              className="transition-colors hover:text-white"
            >
              Changelog
            </a>
            <a href="#blog" className="transition-colors hover:text-white">
              Blog
            </a>
          </div>

          {/* Right: Muted 'Log in' + Small Near-White 'Download' Pill with OS Glyph */}
          <div className="flex items-center gap-4">
            <a
              href="#login"
              className="hidden text-[14px] font-medium text-[#9c9c9d] transition-colors hover:text-white sm:inline-block"
            >
              Log in
            </a>
            <a href="#download" className="nav-download-pill">
              <AppleGlyph className="h-3.5 w-3.5" />
              <span>Download</span>
            </a>
          </div>
        </nav>
      </header>

      {/* ====================================================================
          HERO CONTENT + COMMAND-BAR LAUNCHER MOCKUP (1440px VIEWPORT)
          ==================================================================== */}
      <main className="relative z-10 mx-auto flex max-w-[1440px] flex-col items-center px-6 pt-11 pb-16">
        {/* (2) Small Eyebrow Chip */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-[13px] font-medium text-[#9c9c9d] backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b4a]" />
          <span>v2.0 — now with an AI incident command bar</span>
        </div>

        {/* (3) Two-Line 64px/600 White H1 with ONE Warm-Gradient Accent Word */}
        <h1 className="hero-headline mt-5 max-w-[880px] text-center">
          Every incident resolved,
          <br />
          one <span className="warm-accent-word">keystroke</span> away.
        </h1>

        {/* (4) 18px/400 Muted-White Subtitle (~2 lines, max ~640px) */}
        <p className="mt-5 max-w-[640px] text-center text-[18px] font-normal leading-[1.55] tracking-[0.2px] text-[#9c9c9d]">
          Vigil investigates team runbooks and deploy telemetry in parallel,
          gates every external write behind role-based approval, and drafts
          cited postmortems.
        </p>

        {/* (5) Row of Two Tactile KEYCAP-RAISED OS Download Buttons */}
        <div
          id="download"
          className="mt-8 flex w-full max-w-[440px] flex-col items-center justify-center gap-3.5 sm:w-auto sm:max-w-none sm:flex-row"
        >
          <a
            href="#download-mac"
            className="keycap-download-btn w-full sm:w-auto"
          >
            <AppleGlyph className="h-4 w-4 shrink-0" />
            <span>Download for Mac</span>
          </a>

          <a
            href="#download-windows"
            className="keycap-download-btn w-full sm:w-auto"
          >
            <WindowsGlyph className="h-3.5 w-3.5 shrink-0" />
            <span>Download for Windows</span>
          </a>
        </div>

        {/* (6) GeistMono 12px #9c9c9d Install Caption */}
        <p className="font-mono-only mt-3.5 text-center text-[12px] text-[#9c9c9d]">
          brew install vigil — Install via homebrew or winget
        </p>

        {/* ==================================================================
            (7) DARK-GLASS COMMAND-BAR / LAUNCHER MOCKUP (~14px radius)
            ================================================================== */}
        <section
          aria-label="Vigil AI Command Bar"
          className="command-launcher-glass mt-10 w-full max-w-[680px] overflow-hidden"
        >
          {/* Top Row: Search Glyph + Typed Query + Blinking Warm Caret + 'Command' Mode Pill */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-[#9c9c9d]"
              >
                <circle cx="7" cy="7" r="4.75" />
                <path strokeLinecap="round" d="M10.6 10.6L14 14" />
              </svg>

              <div className="flex items-center text-[14px] font-normal text-white">
                <span>{activeRow.queryText}</span>
                <span className="warm-caret ml-0.5" aria-hidden="true" />
              </div>
            </div>

            <span className="rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[12px] font-medium text-[#9c9c9d]">
              Command
            </span>
          </div>

          {/* Middle: Four Result Rows (First/Selected Row Tinted from Warm Aurora) */}
          <div className="divide-y divide-white/[0.05] py-1.5">
            {LAUNCHER_ROWS.map((row) => {
              const isSelected = row.id === activeRow.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedRowId(row.id)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                    isSelected ? "launcher-row-active" : "launcher-row-idle"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <RowGlyph type={row.icon} />
                    <div className="flex flex-wrap items-baseline gap-2 truncate">
                      <span
                        className={`text-[14px] ${
                          isSelected
                            ? "font-medium text-white"
                            : "font-normal text-white/90"
                        }`}
                      >
                        {row.label}
                      </span>
                      <span className="font-mono-only truncate text-[12px] text-[#9c9c9d]">
                        {row.monoArg}
                      </span>
                    </div>
                  </div>

                  <kbd className="font-mono-only shortcut-chip shrink-0">
                    {row.shortcut}
                  </kbd>
                </button>
              );
            })}
          </div>

          {/* Footer Strip: Mono Hints + Brand Mark */}
          <div className="flex items-center justify-between border-t border-white/10 bg-black/25 px-4 py-2.5">
            <span className="font-mono-only text-[11px] text-[#9c9c9d]">
              ↑/↓ navigate · enter open · esc dismiss
            </span>

            <div className="flex items-center gap-1.5">
              <Image
                src="/vigil.svg"
                alt=""
                width={15}
                height={15}
                className="h-3.5 w-3.5 object-contain opacity-90"
              />
              <span className="text-[12px] font-medium text-[#9c9c9d]">
                Vigil
              </span>
            </div>
          </div>
        </section>

        {/* ==================================================================
            (9) SINGLE CENTERED GHOST PILL ('Learn more ->') AT THE BOTTOM
            ================================================================== */}
        <div className="mt-7 flex justify-center">
          <a href="#learn-more" className="ghost-pill-link">
            <span>Learn more</span>
            <span aria-hidden="true">-&gt;</span>
          </a>
        </div>
      </main>

      {/* ====================================================================
          (8) SMALL FLOATING DARK 'FEATURED ON PRODUCT HUNT' BADGE BOTTOM-RIGHT
          ==================================================================== */}
      <aside
        aria-label="Featured on Product Hunt"
        className="floating-pill-nav fixed right-6 bottom-6 z-20 hidden items-center gap-3 rounded-xl px-3.5 py-2.5 lg:flex"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05]">
          <Image
            src="/vigil.png"
            alt=""
            width={18}
            height={18}
            className="h-4.5 w-4.5 object-contain"
          />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] font-medium tracking-wide text-[#9c9c9d] uppercase">
            Featured on Product Hunt
          </div>
          <div className="mt-0.5 text-[12px] font-semibold text-white">
            #1 Product of the Day
          </div>
        </div>
      </aside>
    </div>
  );
}
