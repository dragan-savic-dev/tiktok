"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/app/components/card";
import DonutChart from "@/app/components/donut-chart";
import {
  CommentIcon,
  EyeIcon,
  HeartIcon,
  PlayIcon,
  ShareIcon,
} from "@/app/components/icons";
import { useValueFlash } from "@/app/components/use-value-flash";
import {
  formatDuration,
  formatMultiplier,
  formatPercent,
  videoEngagement,
  videoEngagementRate,
  videoTitle,
} from "@/lib/metrics";
import { useStats } from "../../stats-context";
import { CHART_COLORS, ErrorBanner, Loading } from "../../shared";

function fmt(n: number): string {
  return n.toLocaleString("it-IT");
}

function formatDate(t?: number): string | null {
  if (!t) return null;
  return new Date(t * 1000).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Tile metrica con icona. */
function MetricTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accent: string;
}) {
  const dir = useValueFlash(value);
  const flash =
    dir === "up" ? "text-emerald-400" : dir === "down" ? "text-tt-pink" : "text-white";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between">
        <span className="truncate text-[10px] font-medium uppercase tracking-widest text-zinc-400 sm:text-xs">
          {label}
        </span>
        <span className="shrink-0" style={{ color: accent }}>
          {icon}
        </span>
      </div>
      <span className={`text-xl font-semibold transition-colors duration-300 sm:text-2xl ${flash}`}>
        {fmt(value)}
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
  const ratio = average ? value / average : 0;
  const tone = ratio >= 1 ? "text-emerald-400" : "text-tt-pink";
  const dir = useValueFlash(value);
  const flash =
    dir === "up" ? "text-emerald-400" : dir === "down" ? "text-tt-pink" : "text-white";
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 gap-y-1 text-sm sm:gap-x-3">
      <span className="truncate text-zinc-400">{label}</span>
      <span
        className={`w-16 text-right font-semibold tabular-nums transition-colors duration-300 sm:w-20 ${flash}`}
      >
        {fmt(value)}
      </span>
      <span className="w-16 text-right tabular-nums text-zinc-500 sm:w-20">
        {fmt(Math.round(average))}
      </span>
      <span className={`w-12 text-right font-semibold tabular-nums sm:w-14 ${tone}`}>
        {formatMultiplier(value, average)}
      </span>
    </div>
  );
}

export default function VideoDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { stats, error } = useStats();

  if (!stats) {
    return (
      <>
        {error && <ErrorBanner message={error} />}
        <Loading label="Carico il video…" />
      </>
    );
  }

  const { videos, totals } = stats;
  const video = videos.find((v) => v.id === id);

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
  const eng = videoEngagement(video);
  const rate = videoEngagementRate(video);

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
  ];
  const interactionsTotal = eng || 1;
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
        <div className="relative aspect-[9/16] w-32 shrink-0 self-center overflow-hidden rounded-xl bg-zinc-900 sm:w-36 sm:self-start">
          {video.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- copertina da CDN TikTok con URL a scadenza
            <img
              src={video.cover_image_url}
              alt={videoTitle(video)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-zinc-700">
              <PlayIcon className="h-10 w-10" />
            </div>
          )}
          {duration && (
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
              {duration}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
          <h1 className="text-lg font-bold text-white sm:text-xl">{videoTitle(video)}</h1>
          {video.video_description && (
            <p className="line-clamp-2 text-sm text-zinc-400">{video.video_description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {date && <span>Pubblicato il {date}</span>}
            <span>#{rankViews} per visualizzazioni</span>
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTile
          label="Spettatori"
          value={views}
          icon={<EyeIcon className="h-4 w-4" />}
          accent={CHART_COLORS.cyan}
        />
        <MetricTile
          label="Mi piace"
          value={likes}
          icon={<HeartIcon className="h-4 w-4" />}
          accent={CHART_COLORS.pink}
        />
        <MetricTile
          label="Commenti"
          value={comments}
          icon={<CommentIcon className="h-4 w-4" />}
          accent={CHART_COLORS.cyan}
        />
        <MetricTile
          label="Condivisioni"
          value={shares}
          icon={<ShareIcon className="h-4 w-4" />}
          accent={CHART_COLORS.pink}
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
                  <span className="text-3xl font-bold text-white">{formatPercent(rate, 1)}</span>
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
                  <span className="w-10 text-right tabular-nums text-zinc-500">
                    {formatPercent(i.value / interactionsTotal, 0)}
                  </span>
                  <span className="w-20 text-right font-semibold tabular-nums text-white">
                    {fmt(i.value)}
                  </span>
                </Fragment>
              ))}
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title="Intensità · ogni 1.000 visualizzazioni">
            <div className="grid grid-cols-3 gap-4">
              <Rate1k label="Mi piace" value={per1k(likes)} color={CHART_COLORS.pink} />
              <Rate1k label="Commenti" value={per1k(comments)} color={CHART_COLORS.cyan} />
              <Rate1k label="Condivisioni" value={per1k(shares)} color={CHART_COLORS.violet} />
            </div>
          </Card>

          <Card title="Confronto con la media del profilo">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] uppercase tracking-wider text-zinc-500">
                <span />
                <span className="w-16 text-right sm:w-20">Questo</span>
                <span className="w-16 text-right sm:w-20">Media</span>
                <span className="w-12 text-right sm:w-14">vs</span>
              </div>
              <CompareRow label="Visualizzazioni" value={views} average={avg.views} />
              <CompareRow label="Mi piace" value={likes} average={avg.likes} />
              <CompareRow label="Commenti" value={comments} average={avg.comments} />
              <CompareRow label="Condivisioni" value={shares} average={avg.shares} />
              <div className="mt-1 border-t border-white/5 pt-3">
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 text-sm sm:gap-x-3">
                  <span className="truncate text-zinc-400">Tasso engagement</span>
                  <span className="w-16 text-right font-semibold tabular-nums text-white sm:w-20">
                    {formatPercent(rate, 1)}
                  </span>
                  <span className="w-16 text-right tabular-nums text-zinc-500 sm:w-20">
                    {formatPercent(accountRate, 1)}
                  </span>
                  <span
                    className={`w-12 text-right font-semibold tabular-nums sm:w-14 ${
                      rate >= accountRate ? "text-emerald-400" : "text-tt-pink"
                    }`}
                  >
                    {formatMultiplier(rate, accountRate)}
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
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-bold text-white">
        {value.toLocaleString("it-IT", { maximumFractionDigits: 1 })}
      </span>
      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
    </div>
  );
}
