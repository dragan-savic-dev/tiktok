"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/metrics";
import ChartTooltip from "./chart-tooltip";

export interface LinePoint {
  label: string;
  value: number;
}

/** Grafico ad area su Recharts (serie temporale). */
export default function LineChart({
  data,
  color = "#25f4ee",
  height = 220,
  formatValue = formatCompact,
  markers = [],
  className = "",
}: {
  data: LinePoint[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
  /** Etichette (asse X) su cui disegnare una linea verticale, es. pubblicazioni. */
  markers?: string[];
  className?: string;
}) {
  const gid = `area-${useId().replace(/:/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={formatValue}
          // Non parte da zero: sui totali cumulativi la variazione resterebbe
          // schiacciata su una linea piatta.
          domain={["auto", "auto"]}
        />
        <Tooltip
          content={<ChartTooltip formatValue={formatValue} />}
          cursor={{ stroke: "rgba(255,255,255,0.25)", strokeDasharray: "3 3" }}
        />
        {markers.map((m) => (
          <ReferenceLine
            key={m}
            x={m}
            stroke="#fe2c55"
            strokeDasharray="3 3"
            strokeOpacity={0.7}
          />
        ))}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gid})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
