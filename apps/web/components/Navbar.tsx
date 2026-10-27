"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightIcon, GitHubIcon, GITHUB_URL } from "@/components/Icons";

export function TerminalPromptGlyph({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.25 5.25L6.5 8l-3.25 2.75M8.25 11h4.5"
      />
    </svg>
  );
}

const AUTHENTICATED_PREFIXES = ["/dashboard", "/workspace", "/console"];

export function Navbar() {
  const pathname = usePathname();

  // Do not render floating marketing pill navbar on dashboard or user-authenticated routes
  if (
    pathname &&
    AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return null;
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-5 z-50 mx-auto flex max-w-[1440px] justify-center px-4 sm:px-6">
      <nav
        aria-label="Primary navigation"
        className="floating-pill-nav pointer-events-auto flex w-full max-w-[900px] items-center justify-between rounded-full px-4 py-2"
      >
        {/* Left: Warm Logo Glyph + White Wordmark */}
        <Link href="/" className="flex items-center gap-2.5 pl-1">
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
        </Link>

        {/* Center: Muted #9c9c9d 14px/500 Inter Links */}
        <div className="hidden items-center gap-7 text-[14px] font-medium text-[#9c9c9d] md:flex">
          <Link
            href="/#features"
            className="transition-colors hover:text-white"
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="transition-colors hover:text-white"
          >
            How it works
          </Link>
        </div>

        {/* Right: Muted 'Log in' + Near-White 'Open Console' Keycap Pill */}
        <div className="flex items-center gap-3.5">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Vigil on GitHub"
            className="text-[#9c9c9d] transition-colors hover:text-white"
          >
            <GitHubIcon className="h-[19px] w-[19px]" />
          </a>
          <Link
            href="/login"
            className="hidden text-[14px] font-medium text-[#9c9c9d] transition-colors hover:text-white sm:inline-block"
          >
            Log in
          </Link>
          <Link href="/signup" className="nav-download-pill">
            <span>Get started</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
