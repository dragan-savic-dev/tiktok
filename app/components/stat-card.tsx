import type { ReactNode } from "react";
import OdometerNumber from "./odometer-number";

export default function StatCard({
  label,
  value,
  delta,
  icon,
  accent = "cyan",
}: {
  label: string;
  value: number;
  delta?: number;
  icon: ReactNode;
  accent?: "cyan" | "pink";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          {label}
        </span>
        <span className={accent === "pink" ? "text-tt-pink" : "text-tt-cyan"}>{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <OdometerNumber value={value} className="text-3xl font-semibold text-white" />
        {delta !== undefined && delta !== 0 && (
          <span
            className={`pb-0.5 text-xs font-semibold ${
              delta > 0 ? "text-emerald-400" : "text-tt-pink"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta.toLocaleString("it-IT")}
          </span>
        )}
      </div>
    </div>
  );
}
