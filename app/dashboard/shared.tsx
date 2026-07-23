"use client";

import { useT } from "@/app/components/locale-provider";

/** Palette dei grafici: brand TikTok + accenti coerenti col tema scuro. */
export const CHART_COLORS = {
  cyan: "#25f4ee",
  pink: "#fe2c55",
  violet: "#a855f7",
  amber: "#fbbf24",
  emerald: "#34d399",
  blue: "#60a5fa",
} as const;

/**
 * Colore canonico per metrica: stessa metrica → stesso colore ovunque (grafici
 * account e per-video), così la lettura resta coerente tra le pagine.
 */
export const METRIC_COLORS = {
  followers: CHART_COLORS.pink,
  views: CHART_COLORS.cyan,
  likes: CHART_COLORS.violet,
  comments: CHART_COLORS.emerald,
  shares: CHART_COLORS.blue,
  saved: CHART_COLORS.amber,
} as const;

/**
 * Intervalli temporali dei grafici andamento: base 7 giorni, fino a 1 anno.
 * `label` è anche la chiave i18n. Condivisi da Crescita e dettaglio video.
 */
export const TREND_RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
] as const;

/** Sotto questa soglia (giorni) la serie è a granularità oraria, sopra giornaliera. */
export const HOURLY_MAX_DAYS = 7;

/** Pillole di selezione dell'intervallo (7g / 1M / 3M / 6M / 12M). */
export function RangePicker({
  days,
  onChange,
}: {
  days: number;
  onChange: (days: number) => void;
}) {
  const t = useT();
  return (
    <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
      {TREND_RANGES.map((r) => (
        <button
          key={r.days}
          onClick={() => onChange(r.days)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            days === r.days
              ? "bg-tt-pink/20 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          {t(r.label)}
        </button>
      ))}
    </div>
  );
}

/** Pillole Totale / Variazione (l'etichetta variazione dipende dalla granularità). */
export function ModePicker({
  mode,
  onChange,
  hourly,
}: {
  mode: "total" | "delta";
  onChange: (mode: "total" | "delta") => void;
  /** true = bucket orari: la variazione è per ora, altrimenti per giorno. */
  hourly: boolean;
}) {
  const t = useT();
  const options = [
    { key: "total", label: t("Total") },
    { key: "delta", label: hourly ? t("Change/hour") : t("Change/day") },
  ] as const;
  return (
    <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
      {options.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === m.key
              ? "bg-tt-cyan/15 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** Spinner a tutta area, identico a quello della dashboard originale. */
export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-zinc-500">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-tt-cyan" />
      <p className="text-sm">{label ?? t("Loading your stats…")}</p>
    </div>
  );
}

/** Banner d'errore non bloccante (i dati in cache restano visibili). */
export function ErrorBanner({ message }: { message: string }) {
  const t = useT();
  return (
    <p className="mb-4 w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-300">
      {t("Update error:")} {message} — {t("retrying in 5 seconds.")}
    </p>
  );
}
