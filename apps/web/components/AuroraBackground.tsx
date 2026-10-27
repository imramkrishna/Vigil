import React from "react";

interface AuroraBackgroundProps {
  intensity?: "full" | "subtle";
}

export function AuroraBackground({
  intensity = "full",
}: AuroraBackgroundProps) {
  const opacityClass = intensity === "subtle" ? "opacity-65" : "opacity-100";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${opacityClass}`}
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
            "radial-gradient(circle at 50% 24%, rgba(7, 8, 10, 0.08) 0%, rgba(7, 8, 10, 0.62) 64%, #07080a 94%)",
        }}
      />
    </div>
  );
}
