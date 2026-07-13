"use client";

import type { ReactNode } from "react";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

/**
 * Gauge circolare su Recharts (RadialBar) a dimensione fissa. `fraction` 0..1
 * riempie l'arco; il PolarAngleAxis con dominio [0,100] mappa il valore
 * all'angolo.
 */
export default function Gauge({
  fraction,
  size = 120,
  thickness = 10,
  color = "#25f4ee",
  center,
  className = "",
}: {
  fraction: number;
  size?: number;
  thickness?: number;
  color?: string;
  center?: ReactNode;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  const outer = size / 2;
  const inner = Math.max(0, outer - thickness);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <RadialBarChart
        width={size}
        height={size}
        cx={outer}
        cy={outer}
        innerRadius={inner}
        outerRadius={outer}
        startAngle={90}
        endAngle={-270}
        data={[{ value: pct, fill: color }]}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar
          dataKey="value"
          background={{ fill: "rgba(255,255,255,0.08)" }}
          cornerRadius={thickness / 2}
          isAnimationActive={false}
        />
      </RadialBarChart>
      {center && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {center}
        </div>
      )}
    </div>
  );
}
