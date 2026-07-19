"use client";

import { useT } from "./locale-provider";

// Circonferenza del cerchio r=8 nel viewBox 20x20 (2*PI*8), usata dal
// keyframe .animate-ring in globals.css per l'anello di progresso dei 5s.
const RING_CIRCUMFERENCE = 50.265;

export default function LiveIndicator({ tick, error }: { tick: number; error: boolean }) {
  const t = useT();
  const dotColor = error ? "bg-amber-400" : "bg-tt-pink";

  return (
    <div className="flex items-center gap-2.5" title={t("Auto-refresh every 5 seconds")}>
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`}
        />
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`} />
      </span>
      <span className="text-xs font-bold tracking-[0.2em] text-zinc-300">
        {error ? t("RETRYING") : t("LIVE")}
      </span>
      {/* key={tick}: rimonta l'SVG a ogni fetch così l'animazione riparte da zero */}
      <svg key={tick} viewBox="0 0 20 20" className="h-4 w-4 -rotate-90">
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="2.5"
          className="text-zinc-400"
        />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={RING_CIRCUMFERENCE}
          className="animate-ring text-tt-cyan"
        />
      </svg>
    </div>
  );
}
