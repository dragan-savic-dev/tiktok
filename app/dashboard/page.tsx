"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  BookmarkIcon,
  CommentIcon,
  EyeIcon,
  HeartIcon,
  PlayIcon,
  ShareIcon,
} from "@/app/components/icons";
import { Card } from "@/app/components/card";
import DeltaBadge from "@/app/components/delta-badge";
import DonutChart from "@/app/components/donut-chart";
import FlashNumber from "@/app/components/flash-number";
import { useT } from "@/app/components/locale-provider";
import StatCard from "@/app/components/stat-card";
import {
  engagementRate,
  formatCompact,
  formatPercent,
  perVideoAverage,
  shareRateTier,
  topVideosBy,
  videoShareRate,
  videoTitle,
} from "@/lib/metrics";
import { useStats } from "./stats-context";
import { CHART_COLORS, ErrorBanner, Loading } from "./shared";

// Semaforo share rate (verde ≥3% / giallo 2-3% / rosso <2%).
const TIER: Record<"high" | "mid" | "low", string> = {
  high: "text-emerald-400",
  mid: "text-amber-400",
  low: "text-tt-pink",
};

function HeroStat({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta?: number;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs">
        {label}
      </span>
      <div>
        {/* Badge in absolute: appare di fianco al numero senza mandarlo a capo. */}
        <span className="relative inline-flex items-end text-white">
          <FlashNumber
            value={value}
            className="text-lg font-bold sm:text-2xl lg:text-3xl"
          />
          <DeltaBadge
            delta={delta}
            className="absolute bottom-1 left-full ml-1.5 whitespace-nowrap text-xs"
          />
        </span>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const t = useT();
  const { stats, error, delta } = useStats();

  if (!stats) {
    return (
      <>
        {error && <ErrorBanner message={error} />}
        <Loading />
      </>
    );
  }

  const { user, totals, saved, videos } = stats;
  const rate = engagementRate(stats);

  const interactions = [
    { label: t("Likes"), value: totals.likes, color: CHART_COLORS.pink },
    { label: t("Comments"), value: totals.comments, color: CHART_COLORS.cyan },
    { label: t("Shares"), value: totals.shares, color: CHART_COLORS.violet },
    ...(saved !== null
      ? [{ label: t("Saves"), value: saved, color: CHART_COLORS.amber }]
      : []),
  ];
  const interactionsTotal = interactions.reduce((s, i) => s + i.value, 0);

  const recentVideos = videos.slice(0, 10);

  // Video in evidenza: il migliore per views + la classifica per share rate
  // (la metrica-stella). Per lo share rate si escludono i video con pochissime
  // views (rumore), con fallback all'elenco completo se restano vuoti.
  const bestVideo = topVideosBy(videos, (v) => v.view_count ?? 0, 1)[0];
  const eligible = videos.filter((v) => (v.view_count ?? 0) >= 1000);
  const topShare = topVideosBy(eligible.length ? eligible : videos, videoShareRate, 5);

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorBanner message={error} />}

      {/* Donut interazioni + profilo/totali */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("Interaction breakdown")}>
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
                    <span className="text-zinc-400">{i.label}</span>
                  </div>
                  <span className="w-10 text-right tabular-nums text-zinc-500">
                    <FlashNumber
                      value={interactionsTotal ? i.value / interactionsTotal : 0}
                      format={(f) => formatPercent(f, 0)}
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

        <Card className="lg:col-span-2" bodyClassName="flex flex-col gap-4 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <HeroStat
              label={t("Following")}
              value={user.following_count ?? 0}
              delta={delta((s) => s.user.following_count)}
            />
            <HeroStat
              label={t("Followers")}
              value={user.follower_count ?? 0}
              delta={delta((s) => s.user.follower_count)}
            />
            {/* Mi piace: su mobile scende tra i totali (sotto); torna qui da lg. */}
            <div className="hidden lg:block">
              <HeroStat
                label={t("Likes")}
                value={user.likes_count ?? 0}
                delta={delta((s) => s.user.likes_count)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
              {t("Totals across all videos")}
            </h3>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard
                label={t("Views")}
                value={totals.views}
                delta={delta((s) => s.totals.views)}
                icon={<EyeIcon className="h-4 w-4" />}
                accent="cyan"
                className="col-span-2 lg:col-span-1"
              />
              {/* Mi piace su mobile raggruppato coi totali; da lg torna tra i KPI. */}
              <div className="lg:hidden">
                <StatCard
                  label={t("Likes")}
                  value={user.likes_count ?? 0}
                  delta={delta((s) => s.user.likes_count)}
                  icon={<HeartIcon className="h-4 w-4" />}
                  accent="cyan"
                />
              </div>
              <StatCard
                label={t("Comments")}
                value={totals.comments}
                delta={delta((s) => s.totals.comments)}
                icon={<CommentIcon className="h-4 w-4" />}
                accent="cyan"
              />
              <StatCard
                label={t("Shares")}
                value={totals.shares}
                delta={delta((s) => s.totals.shares)}
                icon={<ShareIcon className="h-4 w-4" />}
                accent="cyan"
              />
              <StatCard
                label={t("Saves")}
                value={saved}
                delta={delta((s) => s.saved ?? undefined)}
                icon={<BookmarkIcon className="h-4 w-4" />}
                accent="cyan"
              />
            </div>
          </div>
          <p className="mt-auto text-xs text-zinc-500">
            {t("Sum across")} <FlashNumber value={totals.videosCounted} />{" "}
            {t(
              "public videos · updated every 5 seconds · “saves” are read from the public pages about once a minute (N/A if TikTok blocks them).",
            )}
          </p>
        </Card>
      </div>

      {/* Medie per video */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label={t("Avg view / video")}
          value={perVideoAverage(totals.views, totals.videosCounted)}
        />
        <StatTile
          label={t("Avg like / video")}
          value={perVideoAverage(totals.likes, totals.videosCounted)}
        />
        <StatTile
          label={t("Avg share rate")}
          value={totals.views ? totals.shares / totals.views : 0}
          format={(f) => formatPercent(f, 2)}
        />
        <StatTile label={t("Public videos")} value={totals.videosCounted} exact />
      </div>

      {/* Video in evidenza: miglior video + classifica share rate */}
      {videos.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {bestVideo && (
            <Card title={t("Best video")}>
              <div className="flex gap-4">
                <Link href={`/dashboard/video/${bestVideo.id}`} className="shrink-0">
                  {bestVideo.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- cover da CDN TikTok con URL a scadenza
                    <img
                      src={bestVideo.cover_image_url}
                      alt={videoTitle(bestVideo)}
                      className="h-28 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="grid h-28 w-20 place-items-center rounded-lg bg-white/5">
                      <PlayIcon className="h-6 w-6 text-zinc-600" />
                    </div>
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Link
                    href={`/dashboard/video/${bestVideo.id}`}
                    className="line-clamp-2 font-semibold text-white hover:text-tt-cyan"
                    title={videoTitle(bestVideo)}
                  >
                    {videoTitle(bestVideo)}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-300">
                    <span className="flex items-center gap-1">
                      <EyeIcon className="h-3.5 w-3.5 text-tt-cyan" />
                      <FlashNumber value={bestVideo.view_count ?? 0} format={formatCompact} />
                    </span>
                    <span className="flex items-center gap-1">
                      <HeartIcon className="h-3.5 w-3.5 text-tt-pink" />
                      <FlashNumber value={bestVideo.like_count ?? 0} format={formatCompact} />
                    </span>
                    <span className="flex items-center gap-1">
                      <ShareIcon className="h-3.5 w-3.5 text-tt-cyan" />
                      <FlashNumber value={bestVideo.share_count ?? 0} format={formatCompact} />
                    </span>
                    <span
                      className={`flex items-center gap-1.5 font-semibold ${TIER[shareRateTier(videoShareRate(bestVideo))]}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      <FlashNumber
                        value={videoShareRate(bestVideo)}
                        format={(f) => formatPercent(f, 1)}
                      />
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/video/${bestVideo.id}`}
                    className="mt-auto w-fit text-xs font-medium text-tt-cyan hover:text-white"
                  >
                    {t("Details")} →
                  </Link>
                </div>
              </div>
            </Card>
          )}

          <Card title={t("Top by share rate")}>
            {topShare.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("No videos available.")}</p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {topShare.map((v, i) => (
                  <li key={v.id} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-semibold text-zinc-400">
                      {i + 1}
                    </span>
                    <Link
                      href={`/dashboard/video/${v.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-white hover:text-tt-cyan"
                      title={videoTitle(v)}
                    >
                      {videoTitle(v)}
                    </Link>
                    <span
                      className={`flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums ${TIER[shareRateTier(videoShareRate(v))]}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      <FlashNumber value={videoShareRate(v)} format={(f) => formatPercent(f, 1)} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}

      {/* Ultimi video */}
      <Card
        title={t("Latest videos")}
        action={
          <Link
            href="/dashboard/video"
            className="text-xs font-medium text-tt-cyan transition-colors hover:text-white"
          >
            {t("See all")} →
          </Link>
        }
        bodyClassName=""
      >
        {recentVideos.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">{t("No public videos found.")}</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {recentVideos.map((v, i) => (
              <li
                key={v.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-semibold text-zinc-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    <Link href={`/dashboard/video/${v.id}`} className="hover:text-tt-cyan">
                      {videoTitle(v)}
                    </Link>
                  </p>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <HeartIcon className="h-3 w-3 text-tt-pink" />
                      <FlashNumber value={v.like_count ?? 0} format={formatCompact} />
                    </span>
                    <span className="flex items-center gap-1">
                      <CommentIcon className="h-3 w-3 text-tt-cyan" />
                      <FlashNumber value={v.comment_count ?? 0} format={formatCompact} />
                    </span>
                    <span className="flex items-center gap-1">
                      <ShareIcon className="h-3 w-3 text-tt-pink" />
                      <FlashNumber value={v.share_count ?? 0} format={formatCompact} />
                    </span>
                    {v.saved_count != null && (
                      <span className="flex items-center gap-1">
                        <BookmarkIcon className="h-3 w-3 text-tt-cyan" />
                        <FlashNumber value={v.saved_count} format={formatCompact} />
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-right">
                  <EyeIcon className="h-3.5 w-3.5 text-tt-cyan" />
                  <span className="font-semibold text-white">
                    <FlashNumber value={v.view_count ?? 0} format={formatCompact} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  exact = false,
  format,
}: {
  label: string;
  value: number;
  exact?: boolean;
  /** Formatter custom (es. percentuale): se presente, il valore non viene arrotondato. */
  format?: (n: number) => string;
}) {
  return (
    <div className="flex flex-col justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs">
        {label}
      </span>
      <span className="text-2xl font-bold text-white">
        <FlashNumber
          value={format ? value : Math.round(value)}
          format={format ?? (exact ? undefined : (n) => formatCompact(n))}
        />
      </span>
    </div>
  );
}
