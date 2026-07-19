"use client";

import { useT } from "@/app/components/locale-provider";

/** Palette dei grafici: brand TikTok + accenti coerenti col tema scuro. */
export const CHART_COLORS = {
  cyan: "#25f4ee",
  pink: "#fe2c55",
  violet: "#a855f7",
  amber: "#fbbf24",
  emerald: "#34d399",
} as const;

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
