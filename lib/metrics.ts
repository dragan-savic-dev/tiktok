import type { StatsResponse, VideoStats } from "./types";

/** Interazioni totali (like + commenti + condivisioni) su un video. */
export function videoEngagement(v: VideoStats): number {
  return (v.like_count ?? 0) + (v.comment_count ?? 0) + (v.share_count ?? 0);
}

/**
 * Engagement rate = interazioni / visualizzazioni. È la metrica standard che
 * i creator guardano: quanto il pubblico reagisce rispetto a quanto guarda.
 * Ritorna una frazione 0..1 (moltiplica per 100 per la percentuale).
 */
export function engagementRate(stats: StatsResponse): number {
  const { views, likes, comments, shares } = stats.totals;
  if (!views) return 0;
  return (likes + comments + shares) / views;
}

/** Media per video di una metrica aggregata (0 se non ci sono video). */
export function perVideoAverage(total: number, videoCount: number): number {
  if (!videoCount) return 0;
  return total / videoCount;
}

/** I video ordinati per una metrica, decrescente. Non muta l'array originale. */
export function topVideosBy(
  videos: VideoStats[],
  pick: (v: VideoStats) => number,
  limit?: number,
): VideoStats[] {
  const sorted = [...videos].sort((a, b) => pick(b) - pick(a));
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Percentuale (0..100) formattata con al massimo `digits` decimali. */
export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}%`;
}

/** Numero compatto stile 12,3k / 1,2M per etichette strette. */
export function formatCompact(value: number | null): string {
  if (value === null || value === undefined) return "N/D";
  return value.toLocaleString("it-IT", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}
