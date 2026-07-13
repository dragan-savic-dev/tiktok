import { useId } from "react";
import { formatCompact } from "@/lib/metrics";

export interface LinePoint {
  label: string;
  value: number;
}

/**
 * Grafico ad area/linea stile "Total Productivity" del riferimento, in SVG
 * puro (nessuna libreria). Scala automaticamente su min/max, disegna griglia
 * orizzontale, riempimento a gradiente e un pallino sull'ultimo punto.
 */
export default function LineChart({
  data,
  color = "#25f4ee",
  height = 220,
  formatValue = formatCompact,
  className = "",
}: {
  data: LinePoint[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}) {
  const gradientId = useId();
  const W = 640;
  const H = height;
  const pad = { top: 16, right: 18, bottom: 28, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const values = data.map((d) => d.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    // Serie piatta: apri una finestra così la linea non sta sul bordo.
    const bump = Math.abs(max) || 1;
    min -= bump;
    max += bump;
  } else {
    const margin = (max - min) * 0.1;
    min -= margin;
    max += margin;
  }

  const x = (i: number) =>
    pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L${x(data.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)}` +
    ` L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;

  // 4 linee di griglia orizzontali con etichetta valore.
  const gridLines = Array.from({ length: 4 }, (_, i) => {
    const v = min + ((max - min) * i) / 3;
    return { v, y: y(v) };
  });

  // Mostra al massimo ~6 etichette X per non affollare.
  const step = Math.max(1, Math.ceil(data.length / 6));
  const last = data.length - 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full ${className}`}
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={g.y}
            y2={g.y}
            stroke="currentColor"
            strokeOpacity={0.07}
            className="text-white"
          />
          <text
            x={pad.left - 8}
            y={g.y + 3}
            textAnchor="end"
            className="fill-zinc-500"
            fontSize="11"
          >
            {formatValue(g.v)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {data.length > 0 && (
        <circle cx={x(last)} cy={y(data[last].value)} r={4} fill={color} />
      )}

      {data.map((d, i) =>
        i % step === 0 || i === last ? (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-zinc-500"
            fontSize="11"
          >
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
