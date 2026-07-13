import type { ReactNode } from "react";

/**
 * Anello di progresso circolare stile "Today's Sales / Daily Visitors":
 * mostra una frazione 0..1 come arco colorato. Il contenuto centrale è libero.
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
  const clamped = Math.max(0, Math.min(1, fraction));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = clamped * circumference;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={thickness}
          className="text-white"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {center}
        </div>
      )}
    </div>
  );
}
