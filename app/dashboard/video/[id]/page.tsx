"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { VideoStats } from "@/lib/types";
import { Card } from "@/app/components/card";
import { useT } from "@/app/components/locale-provider";
import DonutChart from "@/app/components/donut-chart";
import FlashNumber from "@/app/components/flash-number";
import LineChart from "@/app/components/line-chart";
import {
  BookmarkIcon,
  CloseIcon,
  CommentIcon,
  EyeIcon,
  HeartIcon,
  PlayIcon,
  RefreshIcon,
  ShareIcon,
} from "@/app/components/icons";
import {
  formatDuration,
  formatPercent,
  shareRateTier,
  videoEngagementRate,
  videoShareRate,
  videoTitle,
} from "@/lib/metrics";
import { useStats } from "../../stats-context";
import { CHART_COLORS, ErrorBanner, Loading } from "../../shared";

const REFRESH_MS = 5000;

// Semaforo share rate (verde ≥3% / giallo 2-3% / rosso <2%).
const TIER_TEXT = {
  high: "text-emerald-400",
  mid: "text-amber-400",
  low: "text-tt-pink",
} as const;
const TIER_DOT = {
  high: "bg-emerald-400",
  mid: "bg-amber-400",
  low: "bg-tt-pink",
} as const;

/**
 * Contatori freschi del singolo video via /api/video/[id] (video/query, TTL
 * più corto della lista completa). Best-effort: se fallisce si resta sui dati
 * del contesto condiviso.
 */
function useFreshVideo(id: string): VideoStats | null {
  const [fresh, setFresh] = useState<VideoStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/video/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body?.video) setFresh(body.video as VideoStats);
      } catch {
        // best-effort
      }
    };
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  return fresh;
}

function formatDate(t?: number): string | null {
  if (!t) return null;
  return new Date(t * 1000).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Tile metrica con icona (sempre blu, come il resto della pagina). */
function MetricTile({
  label,
  value,
  icon,
  className = "",
  percentOfViews = null,
}: {
  label: string;
  /** null = dato non disponibile (mostra N/D). */
  value: number | null;
  icon: ReactNode;
  className?: string;
  /**
   * Frazione sul totale visualizzazioni (0..1): mostrata accanto al valore in
   * tono più chiaro. null = non mostrare (es. sulle visualizzazioni stesse).
   */
  percentOfViews?: number | null;
}) {
  const t = useT();
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="truncate text-[10px] font-medium uppercase tracking-widest text-zinc-400 sm:text-xs">
          {t(label)}
        </span>
        <span className="shrink-0 text-tt-cyan">{icon}</span>
      </div>
      <span className="flex items-baseline gap-1.5 text-xl font-semibold text-white sm:text-2xl">
        {value === null ? (
          <span className="text-zinc-500">{t("N/A")}</span>
        ) : (
          <FlashNumber value={value} />
        )}
        {value !== null && percentOfViews !== null && (
          <span className="text-sm font-medium text-zinc-500 sm:text-base">
            <FlashNumber
              value={percentOfViews}
              format={(f) => formatPercent(f, 1)}
            />
          </span>
        )}
      </span>
    </div>
  );
}

/** Riga di confronto: valore del video vs media del profilo. */
function CompareRow({
  label,
  value,
  average,
}: {
  label: string;
  value: number;
  average: number;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1 text-sm sm:gap-x-3">
      <span className="truncate text-zinc-400">{t(label)}</span>
      <span className="w-16 text-right font-semibold tabular-nums text-white sm:w-20">
        <FlashNumber value={value} />
      </span>
      <span className="w-16 text-right tabular-nums text-zinc-500 sm:w-20">
        <FlashNumber value={Math.round(average)} />
      </span>
    </div>
  );
}

export default function VideoDetailPage() {
  const t = useT();
  const params = useParams();
  const id = String(params.id);
  const { stats, error } = useStats();
  const fresh = useFreshVideo(id);
  const [playing, setPlaying] = useState(false);
  // Scraping manuale dei "salvati": override locale del valore mostrato +
  // stato del pulsante.
  const [manualSaved, setManualSaved] = useState<number | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);

  const handleScrape = async () => {
    setScraping(true);
    setScrapeMsg(null);
    try {
      const res = await fetch(`/api/video/${id}/scrape`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.message === "string" ? body.message : `HTTP ${res.status}`,
        );
      }
      if (typeof body.saved === "number") {
        setManualSaved(body.saved);
        setScrapeMsg(t("Saves updated."));
      } else {
        setScrapeMsg(t("Scraping failed, try again shortly."));
      }
    } catch (err) {
      setScrapeMsg(err instanceof Error ? err.message : t("Error during scraping"));
    } finally {
      setScraping(false);
    }
  };

  if (!stats) {
    return (
      <>
        {error && <ErrorBanner message={error} />}
        <Loading label={t("Loading the video…")} />
      </>
    );
  }

  const { videos, totals, saved: accountSaved } = stats;
  const baseVideo = videos.find((v) => v.id === id);
  // Il dato fresco (video/query) sovrascrive quello della lista; i campi che
  // conosce solo la lista (es. saved_count dallo scraping) restano.
  const video = baseVideo && fresh ? { ...baseVideo, ...fresh } : baseVideo;

  if (!video) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-zinc-400">{t("Video not found.")}</p>
        <Link
          href="/dashboard/video"
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:border-tt-cyan/60 hover:text-white"
        >
          {t("← All videos")}
        </Link>
      </div>
    );
  }

  const views = video.view_count ?? 0;
  const likes = video.like_count ?? 0;
  const comments = video.comment_count ?? 0;
  const shares = video.share_count ?? 0;
  // "Salvati" del video via scraping: può mancare (N/D). Lo scraping manuale
  // (pulsante) sovrascrive localmente il valore mostrato.
  const saved = manualSaved ?? video.saved_count ?? null;
  const rate = videoEngagementRate(video);

  // Ratio originale del video dall'API (fallback: dimensioni naturali della
  // copertina) e URL del player incorporato ufficiale.
  const ratio = video.width && video.height ? `${video.width} / ${video.height}` : null;
  const embedUrl = video.embed_link ?? `https://www.tiktok.com/embed/v2/${video.id}`;

  // Medie del profilo per il confronto.
  const count = Math.max(1, totals.videosCounted);
  const avg = {
    views: totals.views / count,
    likes: totals.likes / count,
    comments: totals.comments / count,
    shares: totals.shares / count,
  };
  const accountRate = totals.views
    ? (totals.likes + totals.comments + totals.shares) / totals.views
    : 0;
  const videoShare = videoShareRate(video);
  const accountShare = totals.views ? totals.shares / totals.views : 0;

  // Ranking per visualizzazioni.
  const rankViews =
    [...videos].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).findIndex((v) => v.id === id) +
    1;

  const interactions = [
    { label: "Likes", value: likes, color: CHART_COLORS.pink },
    { label: "Comments", value: comments, color: CHART_COLORS.cyan },
    { label: "Shares", value: shares, color: CHART_COLORS.violet },
    ...(saved !== null
      ? [{ label: "Saves", value: saved, color: CHART_COLORS.amber }]
      : []),
  ];
  const duration = formatDuration(video.duration);
  const date = formatDate(video.create_time);

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorBanner message={error} />}

      <Link
        href="/dashboard/video"
        className="inline-flex w-fit items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        {t("← All videos")}
      </Link>

      {/* Intestazione: copertina + meta */}
      <Card bodyClassName="flex flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5">
        {/* Copertina alla proporzione originale del video (width/height dall'API,
            fallback sulle dimensioni naturali dell'immagine); al click si apre
            il player TikTok incorporato. */}
        <div
          className={`relative shrink-0 self-center overflow-hidden rounded-xl bg-zinc-900 transition-all duration-300 sm:self-start ${
            playing ? "w-full max-w-xs sm:w-72" : "w-32 sm:w-36"
          }`}
          style={{ aspectRatio: ratio ?? (playing ? "9 / 16" : undefined) }}
        >
          {playing ? (
            <>
              <iframe
                src={embedUrl}
                title={videoTitle(video)}
                className="h-full w-full"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
              <button
                onClick={() => setPlaying(false)}
                aria-label={t("Close the player")}
                className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-black"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              {video.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- copertina da CDN TikTok con URL a scadenza
                <img
                  src={video.cover_image_url}
                  alt={videoTitle(video)}
                  className={ratio ? "h-full w-full object-cover" : "h-auto w-full"}
                />
              ) : (
                <div className="grid aspect-[9/16] w-full place-items-center text-zinc-700">
                  <PlayIcon className="h-10 w-10" />
                </div>
              )}
              <button
                onClick={() => setPlaying(true)}
                aria-label={t("Play the video")}
                className="group absolute inset-0 grid place-items-center transition-colors hover:bg-black/30"
              >
                <PlayIcon className="h-10 w-10 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
              </button>
              {duration && (
                <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                  {duration}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
          <h1 className="text-lg font-bold text-white sm:text-xl">{videoTitle(video)}</h1>
          <span className="w-fit rounded-full border border-tt-cyan/30 bg-tt-cyan/10 px-2.5 py-0.5 text-xs font-medium text-tt-cyan">
            #<FlashNumber value={rankViews} /> {t("by views")}
          </span>
          {video.video_description && (
            <p className="line-clamp-2 text-sm text-zinc-400">{video.video_description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {date && <span>{t("Published on")} {date}</span>}
            {duration && <span>{t("Duration")} {duration}</span>}
          </div>
          {video.share_url && (
            <a
              href={video.share_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-tt-pink px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-105"
            >
              <PlayIcon className="h-4 w-4" />
              {t("Open on TikTok")}
            </a>
          )}
        </div>
      </Card>

      {/* Metriche */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricTile
          label="Viewers"
          value={views}
          icon={<EyeIcon className="h-4 w-4" />}
          className="col-span-2 lg:col-span-1"
        />
        <MetricTile
          label="Likes"
          value={likes}
          icon={<HeartIcon className="h-4 w-4" />}
          percentOfViews={views ? likes / views : null}
        />
        <MetricTile
          label="Comments"
          value={comments}
          icon={<CommentIcon className="h-4 w-4" />}
          percentOfViews={views ? comments / views : null}
        />
        <MetricTile
          label="Shares"
          value={shares}
          icon={<ShareIcon className="h-4 w-4" />}
          percentOfViews={views ? shares / views : null}
        />
        <MetricTile
          label="Saves"
          value={saved}
          icon={<BookmarkIcon className="h-4 w-4" />}
          percentOfViews={views && saved !== null ? saved / views : null}
        />
      </div>

      {/* Scraping manuale dei "salvati" (unica metrica non esposta dall'API). */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleScrape}
          disabled={scraping}
          title={t("Reread this video's saves now from the public page (scraping)")}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-tt-cyan/60 hover:text-white disabled:opacity-50"
        >
          <RefreshIcon className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
          {scraping ? t("Refreshing saves…") : t("Refresh saves (scraping)")}
        </button>
        {scrapeMsg && <span className="text-xs text-zinc-500">{scrapeMsg}</span>}
      </div>

      {/* Coinvolgimento */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("Engagement")}>
          <div className="flex flex-col items-center gap-5">
            <DonutChart
              segments={interactions}
              center={
                <>
                  <span className="text-3xl font-bold text-white">
                    <FlashNumber value={rate} format={(f) => formatPercent(f, 1)} />
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                    {t("engagement")}
                  </span>
                </>
              }
            />
            <div className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 text-sm">
              {interactions.map((i) => (
                <Fragment key={i.label}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: i.color }}
                      aria-hidden="true"
                    />
                    <span className="text-zinc-400">{t(i.label)}</span>
                  </div>
                  <span className="w-14 text-right tabular-nums text-zinc-500">
                    <FlashNumber
                      value={views ? i.value / views : 0}
                      format={(f) => formatPercent(f, 1)}
                    />
                  </span>
                  <span className="w-20 text-right font-semibold tabular-nums text-white">
                    <FlashNumber value={i.value} />
                  </span>
                </Fragment>
              ))}
            </div>
          </div>
        </Card>

        <Card
          title={t("Compared to profile average")}
          className="lg:col-span-2"
        >
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[10px] uppercase tracking-wider text-zinc-500">
                <span />
                <span className="w-16 text-right sm:w-20">{t("This")}</span>
                <span className="w-16 text-right sm:w-20">{t("Average")}</span>
              </div>
              <CompareRow label="Views" value={views} average={avg.views} />
              <CompareRow label="Likes" value={likes} average={avg.likes} />
              <CompareRow label="Comments" value={comments} average={avg.comments} />
              <CompareRow label="Shares" value={shares} average={avg.shares} />
              {saved !== null && accountSaved !== null && (
                <CompareRow label="Saves" value={saved} average={accountSaved / count} />
              )}
              <div className="mt-1 flex flex-col gap-2 border-t border-white/5 pt-3">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 text-sm sm:gap-x-3">
                  <span className="truncate text-zinc-400">{t("Engagement")}</span>
                  <span className="w-16 text-right font-semibold tabular-nums text-white sm:w-20">
                    <FlashNumber value={rate} format={(f) => formatPercent(f, 1)} />
                  </span>
                  <span className="w-16 text-right tabular-nums text-zinc-500 sm:w-20">
                    <FlashNumber value={accountRate} format={(f) => formatPercent(f, 1)} />
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 text-sm sm:gap-x-3">
                  <span className="flex items-center gap-1.5 truncate text-zinc-400">
                    {t("Share rate")}
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[shareRateTier(videoShare)]}`}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={`w-16 text-right font-semibold tabular-nums sm:w-20 ${TIER_TEXT[shareRateTier(videoShare)]}`}
                  >
                    <FlashNumber value={videoShare} format={(f) => formatPercent(f, 2)} />
                  </span>
                  <span className="w-16 text-right tabular-nums text-zinc-500 sm:w-20">
                    <FlashNumber value={accountShare} format={(f) => formatPercent(f, 2)} />
                  </span>
                </div>
              </div>
            </div>
          </Card>
      </div>

      <VideoTrend id={id} />

      <p className="text-xs text-zinc-600">
        {t(
          "Current counters updated every 5 seconds. The trend over time is reconstructed from the snapshots the site records (the TikTok API does not expose it per individual video); it populates gradually.",
        )}
      </p>
    </div>
  );
}

interface TrendPoint {
  t: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number | null;
}

/** Serie temporale del singolo video via /api/video/[id]/history (best-effort). */
function useVideoHistory(
  id: string,
): { series: TrendPoint[]; dbEnabled: boolean } | null {
  const [state, setState] = useState<{
    series: TrendPoint[];
    dbEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/video/${id}/history?days=7`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) {
          setState({
            series: Array.isArray(body?.series) ? (body.series as TrendPoint[]) : [],
            dbEnabled: !!body?.dbEnabled,
          });
        }
      } catch {
        // best-effort
      }
    };
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  return state;
}

function TrendStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
        {t(label)}
      </span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {hint && <span className="text-xs text-zinc-600">{t(hint)}</span>}
    </div>
  );
}

/** Curve ricostruite dagli snapshot per singolo video: views e share rate. */
function VideoTrend({ id }: { id: string }) {
  const t = useT();
  const data = useVideoHistory(id);
  if (!data) return null;
  const { series, dbEnabled } = data;

  if (!dbEnabled) {
    return (
      <Card title={t("Trend over time")}>
        <p className="text-sm text-zinc-500">
          {t(
            "Configure the database to record this video's trend over time.",
          )}
        </p>
      </Card>
    );
  }
  if (series.length < 2) {
    return (
      <Card title={t("Trend over time")}>
        <p className="text-sm text-zinc-500">
          {t(
            "Collecting data: the curve appears after a few readings (one snapshot every ~5 minutes while the video is active).",
          )}
        </p>
      </Card>
    );
  }

  const fmtLabel = (t: number) =>
    new Date(t).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const viewsData = series.map((p) => ({ label: fmtLabel(p.t), value: p.views }));
  const shareData = series.map((p) => ({
    label: fmtLabel(p.t),
    value: p.views ? p.shares / p.views : 0,
  }));

  // Velocità: views nell'ultima ora (ultimo valore meno quello ~1h prima).
  const last = series[series.length - 1];
  const hourAgo = last.t - 3_600_000;
  let base = series[0];
  for (const p of series) {
    if (p.t <= hourAgo) base = p;
    else break;
  }
  const velocity = Math.max(0, last.views - base.views);
  const currentShare = last.views ? last.shares / last.views : 0;

  return (
    <Card title={t("Trend over time")}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <TrendStat
            label="Speed · last hour"
            value={<FlashNumber value={velocity} />}
            hint="views in the last hour"
          />
          <TrendStat
            label="Current share rate"
            value={
              <span className={TIER_TEXT[shareRateTier(currentShare)]}>
                <FlashNumber
                  value={currentShare}
                  format={(f) => formatPercent(f, 2)}
                />
              </span>
            }
            hint="shares / views"
          />
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("Views over time")}
          </h4>
          <LineChart data={viewsData} color={CHART_COLORS.cyan} height={180} />
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("Share rate over time")}
          </h4>
          <LineChart
            data={shareData}
            color={CHART_COLORS.pink}
            height={180}
            formatValue={(f) => formatPercent(f, 1)}
          />
        </div>
      </div>
    </Card>
  );
}

