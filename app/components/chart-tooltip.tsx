"use client";

// Tooltip scuro condiviso per tutti i grafici Recharts: il default della
// libreria è bianco e stona col tema. Riceve i prop iniettati da <Tooltip>.
interface TooltipPayloadEntry {
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
  payload?: { color?: string; fill?: string };
}

export default function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0a0a]/95 px-3 py-2 text-xs shadow-xl">
      {label !== undefined && label !== "" && (
        <p className="mb-1 font-medium text-zinc-300">{label}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, i) => {
          const dot =
            entry.color ??
            entry.payload?.color ??
            entry.fill ??
            entry.payload?.fill ??
            "#fff";
          const showName =
            !!entry.name && entry.name !== "value" && entry.name !== "Valore";
          const num =
            typeof entry.value === "number" ? entry.value : Number(entry.value);
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: dot }}
              />
              {showName && <span className="text-zinc-400">{entry.name}</span>}
              <span className={`font-semibold text-white ${showName ? "ml-auto" : ""}`}>
                {Number.isFinite(num) ? num.toLocaleString("it-IT") : String(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
