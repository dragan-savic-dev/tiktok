"use client";

import type { ReactNode } from "react";
import DeltaBadge from "./delta-badge";
import OdometerNumber from "./odometer-number";
import { useValueFlash } from "./use-value-flash";

export default function StatCard({
  label,
  value,
  delta,
  icon,
  accent = "cyan",
  className = "",
}: {
  label: string;
  /** null = dato non disponibile (mostra N/D). */
  value: number | null;
  delta?: number;
  icon: ReactNode;
  accent?: "cyan" | "pink";
  className?: string;
}) {
  const dir = useValueFlash(value ?? 0);
  const flash =
    dir === "up" ? "text-emerald-400" : dir === "down" ? "text-tt-pink" : "text-white";
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-medium uppercase tracking-widest text-zinc-400 sm:text-xs">
          {label}
        </span>
        <span className={`shrink-0 ${accent === "pink" ? "text-tt-pink" : "text-tt-cyan"}`}>
          {icon}
        </span>
      </div>
      <div>
        {/* Badge in absolute: appare di fianco al numero senza mandarlo a capo. */}
        <span className="relative inline-flex items-end">
          {value === null ? (
            <span className="text-lg font-semibold leading-none text-zinc-500 sm:text-2xl">
              N/D
            </span>
          ) : (
            <OdometerNumber
              value={value}
              className={`text-lg font-semibold transition-colors duration-300 sm:text-2xl ${flash}`}
            />
          )}
          <DeltaBadge
            delta={delta}
            className="absolute bottom-0.5 left-full ml-1.5 whitespace-nowrap text-xs"
          />
        </span>
      </div>
    </div>
  );
}
