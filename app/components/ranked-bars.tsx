"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/metrics";
import ChartTooltip from "./chart-tooltip";

export interface RankedItem {
  label: string;
  value: number;
}

/** Classifica a barre orizzontali (Recharts), con valore in etichetta diretta. */
export default function RankedBars({
  items,
  color = "#25f4ee",
  rowHeight = 34,
}: {
  items: RankedItem[];
  color?: string;
  rowHeight?: number;
}) {
  const height = Math.max(1, items.length) * rowHeight;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={items}
        margin={{ top: 2, right: 44, bottom: 2, left: 8 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={44}
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip />} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
          <LabelList
            dataKey="value"
            position="right"
            fill="#d4d4d8"
            fontSize={11}
            formatter={(value) => formatCompact(Number(value))}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
