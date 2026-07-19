"use client";

import { numberLocale } from "@/lib/i18n/format";

// Tipizzazione locale e minimale delle props che Recharts passa al contenuto
// custom del Tooltip: evita di dipendere dai tipi interni della libreria.
interface TooltipPayloadEntry {
  name?: string | number;
  value?: string | number;
  dataKey?: string | number;
  color?: string;
}

/** Tooltip scuro a tema, condiviso da tutti i grafici Recharts della piattaforma. */
export default function ChartTooltip({
  active,
  payload,
  label,
  formatValue = (n) => n.toLocaleString(numberLocale()),
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadEntry>;
  label?: string | number;
  formatValue?: (n: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#141414]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      {label !== undefined && label !== "" && (
        <p className="mb-0.5 font-medium text-zinc-400">{label}</p>
      )}
      {payload.map((entry, i) => {
        // Per i grafici a serie singola il nome coincide col dataKey ("value"):
        // in quel caso si mostra solo il numero.
        const name =
          entry.name !== undefined && entry.name !== entry.dataKey ? String(entry.name) : null;
        return (
          <p key={i} className="flex items-center gap-1.5 font-semibold text-white">
            {entry.color && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
            )}
            {name && <span className="font-normal text-zinc-400">{name}</span>}
            {formatValue(Number(entry.value ?? 0))}
          </p>
        );
      })}
    </div>
  );
}
