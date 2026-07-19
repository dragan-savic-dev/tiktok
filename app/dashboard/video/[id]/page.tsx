"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { VideoStats } from "@/lib/types";
import { Card } from "@/app/components/card";
import DonutChart from "@/app/components/donut-chart";
import FlashNumber from "@/app/components/flash-number";
import {
  BookmarkIcon,
  CloseIcon,
  CommentIcon,
  EyeIcon,
  HeartIcon,
  PlayIcon,
  ShareIcon,
} from "@/app/components/icons";
import {
  formatDuration,
  formatPercent,
  videoEngagementRate,
  videoTitle,
} from "@/lib/metrics";
import { useStats } from "../../stats-context";
import { CHART_COLORS, ErrorBanner, Loading } from "../../shared";

const REFRESH_MS = 5000;

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
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="truncate text-[10px] font-medium uppercase tracking-widest text-zinc-400 sm:text-xs">
          {label}
        </span>
        <span className="shrink-0 text-tt-cyan">{icon}</span>
      </div>
      <span className="flex items-baseline gap-1.5 text-xl font-semibold text-white sm:text-2xl">
        {value === null ? (
          <span className="text-zinc-500">N/D</span>
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
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1 text-sm sm:gap-x-3">
      <span className="truncate text-zinc-400">{label}</span>
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
  const params = useParams();
  const id = String(params.id);
  const { stats, error } = useStats();
  const fresh = useFreshVideo(id);
  const [playing, setPlaying] = useState(false);

  if (!stats) {
    return (
      <>
        {error && <ErrorBanner message={error} />}
        <Loading label="Carico il video…" />
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
        <p className="text-zinc-400">Video non trovato.</p>
        <Link
          href="/dashboard/video"
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:border-tt-cyan/60 hover:text-white"
        >
          ← Tutti i video
        </Link>
      </div>
    );
  }

  const views = video.view_count ?? 0;
  const likes = video.like_count ?? 0;
  const comments = video.comment_count ?? 0;
  const shares = video.share_count ?? 0;
  // "Salvati" del video via scraping: può mancare (N/D).
  const saved = video.saved_count ?? null;
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

  // Ranking per visualizzazioni.
  const rankViews =
    [...videos].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).findIndex((v) => v.id === id) +
    1;

  const per1k = (n: number) => (views ? (n / views) * 1000 : 0);

  const interactions = [
    { label: "Mi piace", value: likes, color: CHART_COLORS.pink },
    { label: "Commenti", value: comments, color: CHART_COLORS.cyan },
    { label: "Condivisioni", value: shares, color: CHART_COLORS.violet },
    ...(saved !== null
      ? [{ label: "Salvati", value: saved, color: CHART_COLORS.amber }]
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
        ← Tutti i video
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
                aria-label="Chiudi il player"
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
                aria-label="Riproduci il video"
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
            #<FlashNumber value={rankViews} /> per visualizzazioni
          </span>
          {video.video_description && (
            <p className="line-clamp-2 text-sm text-zinc-400">{video.video_description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {date && <span>Pubblicato il {date}</span>}
            {duration && <span>Durata {duration}</span>}
          </div>
          {video.share_url && (
            <a
              href={video.share_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-tt-pink px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-105"
            >
              <PlayIcon className="h-4 w-4" />
              Apri su TikTok
            </a>
          )}
        </div>
      </Card>

      {/* Metriche */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricTile
          label="Spettatori"
          value={views}
          icon={<EyeIcon className="h-4 w-4" />}
          className="col-span-2 lg:col-span-1"
        />
        <MetricTile
          label="Mi piace"
          value={likes}
          icon={<HeartIcon className="h-4 w-4" />}
          percentOfViews={views ? likes / views : null}
        />
        <MetricTile
          label="Commenti"
          value={comments}
          icon={<CommentIcon className="h-4 w-4" />}
          percentOfViews={views ? comments / views : null}
        />
        <MetricTile
          label="Condivisioni"
          value={shares}
          icon={<ShareIcon className="h-4 w-4" />}
          percentOfViews={views ? shares / views : null}
        />
        <MetricTile
          label="Salvati"
          value={saved}
          icon={<BookmarkIcon className="h-4 w-4" />}
          percentOfViews={views && saved !== null ? saved / views : null}
        />
      </div>

      {/* Coinvolgimento */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Coinvolgimento">
          <div className="flex flex-col items-center gap-5">
            <DonutChart
              segments={interactions}
              center={
                <>
                  <span className="text-3xl font-bold text-white">
                    <FlashNumber value={rate} format={(f) => formatPercent(f, 1)} />
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                    engagement
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
                    <span className="text-zinc-400">{i.label}</span>
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

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title="Intensità · ogni 1.000 visualizzazioni">
            {views >= 1000 ? (
              <div
                className={`grid gap-4 ${
                  saved !== null ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
                }`}
              >
                <Rate1k label="Mi piace" value={per1k(likes)} color={CHART_COLORS.pink} />
                <Rate1k label="Commenti" value={per1k(comments)} color={CHART_COLORS.cyan} />
                <Rate1k label="Condivisioni" value={per1k(shares)} color={CHART_COLORS.violet} />
                {saved !== null && (
                  <Rate1k label="Salvati" value={per1k(saved)} color={CHART_COLORS.amber} />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 py-6 text-center">
                <p className="text-sm text-zinc-400">
                  Disponibile al raggiungimento di 1.000 visualizzazioni.
                </p>
                <p className="text-xs text-zinc-600">
                  Mancano <FlashNumber value={1000 - views} /> visualizzazioni.
                </p>
              </div>
            )}
          </Card>

          <Card title="Confronto con la media del profilo">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[10px] uppercase tracking-wider text-zinc-500">
                <span />
                <span className="w-16 text-right sm:w-20">Questo</span>
                <span className="w-16 text-right sm:w-20">Media</span>
              </div>
              <CompareRow label="Visualizzazioni" value={views} average={avg.views} />
              <CompareRow label="Mi piace" value={likes} average={avg.likes} />
              <CompareRow label="Commenti" value={comments} average={avg.comments} />
              <CompareRow label="Condivisioni" value={shares} average={avg.shares} />
              {saved !== null && accountSaved !== null && (
                <CompareRow label="Salvati" value={saved} average={accountSaved / count} />
              )}
              <div className="mt-1 border-t border-white/5 pt-3">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 text-sm sm:gap-x-3">
                  <span className="truncate text-zinc-400">Engagement</span>
                  <span className="w-16 text-right font-semibold tabular-nums text-white sm:w-20">
                    <FlashNumber value={rate} format={(f) => formatPercent(f, 1)} />
                  </span>
                  <span className="w-16 text-right tabular-nums text-zinc-500 sm:w-20">
                    <FlashNumber value={accountRate} format={(f) => formatPercent(f, 1)} />
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <p className="text-xs text-zinc-600">
        Statistiche attuali del video (aggiornate ogni 5 secondi). TikTok non
        espone dati di audience o andamento nel tempo per singolo video tramite
        la Display API.
      </p>
    </div>
  );
}

function Rate1k({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-2xl font-bold text-white">
        <FlashNumber
          value={value}
          format={(n) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 })}
        />
      </span>
      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
    </div>
  );
}
