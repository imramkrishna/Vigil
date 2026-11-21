"use client";

import React, { useId } from "react";
import Image from "next/image";

export interface VigilLoaderProps {
  /**
   * - "fullscreen": centered full-viewport loader for route transitions and auth guards
   * - "section": centered card/panel loader for dashboard tabs and data tables
   * - "inline": compact row loader for chat generation or inline status
   */
  variant?: "fullscreen" | "section" | "inline";
  label?: string;
  className?: string;
}

function LogoMark({ size }: { size: "sm" | "md" | "lg" }) {
  const gradId = useId();
  const dims =
    size === "lg"
      ? { box: "h-16 w-16", img: 28, stroke: 2.5 }
      : size === "md"
        ? { box: "h-12 w-12", img: 22, stroke: 2.5 }
        : { box: "h-7 w-7", img: 14, stroke: 3 };

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${dims.box}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        className="absolute inset-0 h-full w-full animate-spin"
        style={{ animationDuration: "0.95s" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffb347" />
            <stop offset="55%" stopColor="#e56b4e" />
            <stop offset="100%" stopColor="#e56b4e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle
          cx="24"
          cy="24"
          r="21"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={dims.stroke}
        />
        <circle
          cx="24"
          cy="24"
          r="21"
          stroke={`url(#${gradId})`}
          strokeWidth={dims.stroke}
          strokeLinecap="round"
          strokeDasharray="62 72"
        />
      </svg>
      <Image
        src="/vigil.svg"
        alt=""
        width={dims.img}
        height={dims.img}
        priority={size === "lg"}
        className="vigil-breathe relative z-10 object-contain"
      />
    </span>
  );
}

export function VigilLoader({
  variant = "section",
  label,
  className = "",
}: VigilLoaderProps) {
  if (variant === "inline") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={label || "Loading"}
        className={`inline-flex items-center gap-2.5 text-[13px] text-[#9b9da6] ${className}`}
      >
        <LogoMark size="sm" />
        {label && <span>{label}</span>}
      </div>
    );
  }

  if (variant === "fullscreen") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={label || "Loading Vigil"}
        className={`dash-fade flex min-h-screen w-full flex-col items-center justify-center gap-3.5 bg-[#111215] text-[#ececef] ${className}`}
      >
        <LogoMark size="lg" />
        {label && (
          <p className="text-[13px] font-medium tracking-[-0.01em] text-[#8a8c95]">
            {label}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
      className={`dash-fade flex flex-col items-center justify-center gap-3 py-14 text-center ${className}`}
    >
      <LogoMark size="md" />
      {label && (
        <p className="text-[13px] text-[#8a8c95]">{label}</p>
      )}
    </div>
  );
}
