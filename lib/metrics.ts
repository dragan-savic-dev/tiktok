import { numberLocale } from "./i18n/format";
import type { StatsResponse, VideoStats } from "./types";

/** Interazioni totali (like + commenti + condivisioni) su un video. */
export function videoEngagement(v: VideoStats): number {
  return (v.like_count ?? 0) + (v.comment_count ?? 0) + (v.share_count ?? 0);
}

/** Tasso di engagement di un video: interazioni / visualizzazioni (0..1). */
export function videoEngagementRate(v: VideoStats): number {
  return v.view_count ? videoEngagement(v) / v.view_count : 0;
}

/**
 * Share rate = condivisioni / visualizzazioni (0..1). Sul profilo @ring_escape
 * è la metrica che predice meglio gli hit: va isolata dall'engagement.
 */
export function videoShareRate(v: VideoStats): number {
  return v.view_count ? (v.share_count ?? 0) / v.view_count : 0;
}

export type ShareTier = "high" | "mid" | "low";

/** Semaforo share rate: verde ≥3% (hit), giallo 2-3% (medio), rosso <2%. */
export function shareRateTier(rate: number): ShareTier {
  if (rate >= 0.03) return "high";
  if (rate >= 0.02) return "mid";
  return "low";
}

/** Moltiplicatore rispetto a un riferimento, es. "1,8×". */
export function formatMultiplier(value: number, reference: number): string {
  if (!reference) return "—";
  const ratio = value / reference;
  return `${ratio.toLocaleString("it-IT", { maximumFractionDigits: 1 })}×`;
}

/** Durata in secondi -> "m:ss". */
export function formatDuration(seconds: number | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Nome leggibile di un video: titolo o didascalia, ma solo la prima riga e
 * senza hashtag (le didascalie TikTok sono tipo "Ring Escape - Level 300
 * #ringescape #gameplay …" → teniamo "Ring Escape - Level 300"). Ripiega su
 * data di pubblicazione e id.
 */
export function videoTitle(v: VideoStats): string {
  const raw = v.title?.trim() || v.video_description?.trim() || "";
  // Prima riga, poi taglia dal primo hashtag.
  const clean = raw.split("\n")[0].split("#")[0].trim();
  if (clean) return clean;
  if (v.create_time) {
    return new Date(v.create_time * 1000).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return `Video #${v.id.slice(-6)}`;
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

/**
 * Percentuale (0..100) con al massimo `digits` decimali. `minDigits` forza un
 * minimo di decimali (es. 2,2 → sempre "1,00%"); default 0 = compatibile.
 */
export function formatPercent(fraction: number, digits = 1, minDigits = 0): string {
  return `${(fraction * 100).toLocaleString(numberLocale(), {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: digits,
  })}%`;
}

/**
 * Numero compatto stile 12,3k / 1,2M, **troncato** (mai arrotondato per
 * eccesso): "5 Mln" compare solo al superamento reale dei 5.000.000, non a
 * 4,95M. Sotto i 1.000 mostra l'intero. Nel locale corrente.
 */
export function formatCompact(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  if (abs < 1000) return Math.trunc(value).toLocaleString(numberLocale());
  // Tronca a 1 decimale nella scala compatta (k/Mln/…) prima di formattare,
  // così Intl non arrotonda per eccesso.
  const exp = Math.min(4, Math.floor(Math.log10(abs) / 3));
  const unit = 1000 ** exp;
  const truncated = (Math.trunc((value / unit) * 10) / 10) * unit;
  return truncated.toLocaleString(numberLocale(), {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}
