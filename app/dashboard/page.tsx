"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  BookmarkIcon,
  CommentIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
} from "@/app/components/icons";
import { Card } from "@/app/components/card";
import DeltaBadge from "@/app/components/delta-badge";
import DonutChart from "@/app/components/donut-chart";
import Gauge from "@/app/components/gauge";
import OdometerNumber from "@/app/components/odometer-number";
import StatCard from "@/app/components/stat-card";
import { useValueFlash } from "@/app/components/use-value-flash";
import {
  engagementRate,
  formatCompact,
  formatPercent,
  perVideoAverage,
  videoTitle,
} from "@/lib/metrics";
import { useStats } from "./stats-context";
import { CHART_COLORS, ErrorBanner, Loading } from "./shared";

function HeroStat({
  label,
  value,
  delta,
  accent = "white",
}: {
  label: string;
  value: number;
  delta?: number;
  accent?: "white" | "pink" | "cyan";
}) {
  const base =
    accent === "pink" ? "text-tt-pink" : accent === "cyan" ? "text-tt-cyan" : "text-white";
  const dir = useValueFlash(value);
  const color = dir === "up" ? "text-emerald-400" : dir === "down" ? "text-tt-pink" : base;
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs">
        {label}
      </span>
      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
        <OdometerNumber
          value={value}
          className={`text-lg font-bold transition-colors duration-300 sm:text-2xl lg:text-3xl ${color}`}
        />
        <DeltaBadge delta={delta} className="mb-1 text-xs" />
      </div>
    </div>
  );
}

export default function OverviewPage() {
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
    { label: "Mi piace", value: totals.likes, color: CHART_COLORS.pink },
    { label: "Commenti", value: totals.comments, color: CHART_COLORS.cyan },
    { label: "Condivisioni", value: totals.shares, color: CHART_COLORS.violet },
    ...(saved !== null
      ? [{ label: "Salvati", value: saved, color: CHART_COLORS.amber }]
      : []),
  ];
  const interactionsTotal = interactions.reduce((s, i) => s + i.value, 0);

  const recentVideos = videos.slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorBanner message={error} />}

      {/* Donut interazioni + profilo/totali */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title="Ripartizione interazioni">
          <div className="flex flex-col items-center gap-5">
            <DonutChart
              segments={interactions}
              center={
                <>
                  <span className="text-3xl font-bold text-white">
                    {formatPercent(rate, 1)}
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
                  <span className="w-10 text-right tabular-nums text-zinc-500">
                    {interactionsTotal ? formatPercent(i.value / interactionsTotal, 0) : "0%"}
                  </span>
                  <span className="w-20 text-right font-semibold tabular-nums text-white">
                    {i.value.toLocaleString("it-IT")}
                  </span>
                </Fragment>
              ))}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2" bodyClassName="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <HeroStat
              label="Seguiti"
              value={user.following_count ?? 0}
              delta={delta((s) => s.user.following_count)}
            />
            <HeroStat
              label="Follower"
              value={user.follower_count ?? 0}
              delta={delta((s) => s.user.follower_count)}
              accent="pink"
            />
            <HeroStat
              label="Mi piace"
              value={user.likes_count ?? 0}
              delta={delta((s) => s.user.likes_count)}
              accent="cyan"
            />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
              Totali su tutti i video
            </h3>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard
                label="Visualizzazioni"
                value={totals.views}
                delta={delta((s) => s.totals.views)}
                icon={<EyeIcon className="h-4 w-4" />}
                accent="cyan"
                className="col-span-2 xl:col-span-1"
              />
              <StatCard
                label="Commenti"
                value={totals.comments}
                delta={delta((s) => s.totals.comments)}
                icon={<CommentIcon className="h-4 w-4" />}
                accent="pink"
              />
              <StatCard
                label="Condivisioni"
                value={totals.shares}
                delta={delta((s) => s.totals.shares)}
                icon={<ShareIcon className="h-4 w-4" />}
                accent="cyan"
              />
              <StatCard
                label="Salvati"
                value={saved}
                delta={delta((s) => s.saved ?? undefined)}
                icon={<BookmarkIcon className="h-4 w-4" />}
                accent="pink"
              />
            </div>
          </div>
          <p className="mt-auto text-xs text-zinc-500">
            Somma su {totals.videosCounted.toLocaleString("it-IT")} video pubblici ·
            aggiornamento ogni 5 secondi · i “salvati” sono letti dalle pagine
            pubbliche circa ogni minuto (N/D se TikTok li blocca).
          </p>
        </Card>
      </div>

      {/* Rapporti + medie */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Tasso di engagement" bodyClassName="flex items-center justify-center">
          <Gauge
            fraction={Math.min(rate / 0.15, 1)}
            color={CHART_COLORS.emerald}
            center={
              <>
                <span className="text-xl font-bold text-white">{formatPercent(rate, 1)}</span>
                <span className="text-[9px] uppercase tracking-widest text-zinc-500">
                  su visualizzazioni
                </span>
              </>
            }
          />
        </Card>
        <StatTile
          label="Media view / video"
          value={perVideoAverage(totals.views, totals.videosCounted)}
        />
        <StatTile
          label="Media like / video"
          value={perVideoAverage(totals.likes, totals.videosCounted)}
        />
        <StatTile label="Video pubblici" value={totals.videosCounted} exact />
      </div>

      {/* Ultimi video */}
      <Card
        title="Ultimi video"
        action={
          <Link
            href="/dashboard/video"
            className="text-xs font-medium text-tt-cyan transition-colors hover:text-white"
          >
            Vedi tutti →
          </Link>
        }
        bodyClassName="p-0 sm:p-0"
      >
        {recentVideos.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">Nessun video pubblico trovato.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {recentVideos.map((v, i) => (
              <li
                key={v.id}
                className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-semibold text-zinc-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    {v.share_url ? (
                      <a
                        href={v.share_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-tt-cyan"
                      >
                        {videoTitle(v)}
                      </a>
                    ) : (
                      videoTitle(v)
                    )}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <HeartIcon className="h-3 w-3 text-tt-pink" />
                      {formatCompact(v.like_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CommentIcon className="h-3 w-3 text-tt-cyan" />
                      {formatCompact(v.comment_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ShareIcon className="h-3 w-3 text-tt-pink" />
                      {formatCompact(v.share_count)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-right">
                  <EyeIcon className="h-3.5 w-3.5 text-tt-cyan" />
                  <span className="font-semibold text-white">{formatCompact(v.view_count)}</span>
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
}: {
  label: string;
  value: number;
  exact?: boolean;
}) {
  return (
    <div className="flex flex-col justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs">
        {label}
      </span>
      <span className="text-2xl font-bold text-white">
        {exact
          ? Math.round(value).toLocaleString("it-IT")
          : formatCompact(Math.round(value))}
      </span>
    </div>
  );
}
