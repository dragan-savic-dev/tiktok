"use client";

import type { ReactNode } from "react";
import { Cell, Pie, PieChart } from "recharts";

export interface DonutSegment {
  label: string;
  value: number;
  /** Colore CSS del segmento (es. "#25f4ee"). */
  color: string;
}

/**
 * Anello a segmenti su Recharts a dimensione fissa (`size`). Il contenuto
 * centrale (`center`) è sovrapposto in overlay. Un piccolo margine tiene il
 * bordo esterno staccato dal viewport dell'SVG per non tagliarlo.
 */
export default function DonutChart({
  segments,
  size = 200,
  thickness = 22,
  center,
  className = "",
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
  className?: string;
}) {
  const mid = size / 2;
  const outer = mid - 6;
  const inner = Math.max(0, outer - thickness);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={segments}
          dataKey="value"
          nameKey="label"
          cx={mid}
          cy={mid}
          innerRadius={inner}
          outerRadius={outer}
          paddingAngle={1}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={false}
        >
          {segments.map((s) => (
            <Cell key={s.label} fill={s.color} />
          ))}
        </Pie>
      </PieChart>
      {center && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {center}
        </div>
      )}
    </div>
  );
}
