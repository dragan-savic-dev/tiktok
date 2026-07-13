import type { ReactNode } from "react";

export interface DonutSegment {
  label: string;
  value: number;
  /** Colore CSS del segmento (es. "#25f4ee"). */
  color: string;
}

/**
 * Anello a segmenti stile "Total Revenue": ogni fetta è un arco calcolato via
 * stroke-dasharray. Al centro può stare qualsiasi contenuto (numero grande).
 * SVG a mano come il resto del progetto: nessuna libreria di charting.
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
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  // Piccolo distacco tra le fette per leggibilità (in unità di circonferenza).
  const gap = total > 0 && segments.length > 1 ? circumference * 0.006 : 0;

  let offset = 0;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={thickness}
          className="text-white"
        />
        {total > 0 &&
          segments.map((s, i) => {
            const fraction = Math.max(0, s.value) / total;
            const length = Math.max(0, fraction * circumference - gap);
            const dash = `${length} ${circumference - length}`;
            const circle = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += fraction * circumference;
            return circle;
          })}
      </svg>
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {center}
        </div>
      )}
    </div>
  );
}
