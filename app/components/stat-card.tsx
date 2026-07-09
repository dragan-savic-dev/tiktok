import type { ReactNode } from "react";
import DeltaBadge from "./delta-badge";
import OdometerNumber from "./odometer-number";

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
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          {label}
        </span>
        <span className={accent === "pink" ? "text-tt-pink" : "text-tt-cyan"}>{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        {value === null ? (
          <span className="text-2xl font-semibold leading-none text-zinc-500">N/D</span>
        ) : (
          <OdometerNumber value={value} className="text-2xl font-semibold text-white" />
        )}
        <DeltaBadge delta={delta} className="mb-0.5 text-xs" />
      </div>
    </div>
  );
}
