"use client";

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartTooltip from "./chart-tooltip";

export interface BarDatum {
  label: string;
  value: number;
}

/** Istogramma verticale su Recharts. Altezza autonoma via prop `height`. */
export default function BarChart({
  bars,
  color = "#25f4ee",
  height = 208,
  className = "",
}: {
  bars: BarDatum[];
  color?: string;
  height?: number;
  className?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <RBarChart data={bars} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis hide />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip />} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
      </RBarChart>
    </ResponsiveContainer>
  );
}
