"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/card";
import BarChart, { type BarDatum } from "@/app/components/bar-chart";
import FlashNumber from "@/app/components/flash-number";
import { useT } from "@/app/components/locale-provider";
import {
  formatCompact,
  formatPercent,
  topVideosBy,
  videoEngagement,
  videoEngagementRate,
  videoTitle,
} from "@/lib/metrics";
import type { VideoStats } from "@/lib/types";
import { useStats } from "../stats-context";
import { CHART_COLORS, ErrorBanner, Loading } from "../shared";

const RECENT_COUNT = 14;
const TOP_COUNT = 8;

// getDay(): 0 = domenica; riportato a 0 = lunedì per leggere Lun→Dom.
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
// Fasce orarie di pubblicazione da 2 ore (0–2, 2–4, … 22–24).
const HOUR_BUCKETS = Array.from({ length: 12 }, (_, i) => ({
  label: `${i * 2}–${i * 2 + 2}`,
  from: i * 2,
  to: i * 2 + 2,
}));

/**
 * Scaglioni di durata da 10 secondi, generati fino alla durata massima
 * presente (tetto a 60s, oltre si raggruppa in ">60s").
 */
function durationBuckets(maxDuration: number): { label: string; from: number; to: number }[] {
  const top = Math.min(Math.max(10, Math.ceil(maxDuration / 10) * 10), 60);
  const buckets = [];
  for (let from = 0; from < top; from += 10) {
    buckets.push({ label: `${from}–${from + 10}s`, from, to: from + 10 });
  }
  if (maxDuration > 60) buckets.push({ label: ">60s", from: 60, to: Infinity });
  return buckets;
}

/** Etichetta breve del giorno di pubblicazione (dd/MM), per gli istogrammi. */
function publishLabel(v: VideoStats): string {
  if (!v.create_time) return "—";
  return new Date(v.create_time * 1000).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Media di una metrica sui video che cadono nel bucket (0 se vuoto). */
function averageWhere(
  videos: VideoStats[],
  inBucket: (v: VideoStats) => boolean,
  pick: (v: VideoStats) => number,
): number {
  const matched = videos.filter(inBucket);
  if (matched.length === 0) return 0;
  return matched.reduce((s, v) => s + pick(v), 0) / matched.length;
}

type TopMetric = "views" | "engagement" | "saved";

const TOP_METRICS: {
  key: TopMetric;
  label: string;
  pick: (v: VideoStats) => number;
  format: (n: number) => string;
  color: string;
}[] = [
  {
    key: "views",
    label: "Views",
    pick: (v) => v.view_count ?? 0,
    format: formatCompact,
    color: CHART_COLORS.cyan,
  },
  {
    key: "engagement",
    label: "Engagement",
    pick: videoEngagementRate,
    format: (f) => formatPercent(f, 1),
    color: CHART_COLORS.pink,
  },
  {
    key: "saved",
    label: "Saves / 1,000",
    pick: (v) =>
      v.view_count && v.saved_count != null ? (v.saved_count / v.view_count) * 1000 : 0,
    format: (n) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 }),
    color: CHART_COLORS.amber,
  },
];

/** Classifica video come lista HTML: titoli cliccabili, barre proporzionali. */
function TopVideoList({ videos }: { videos: VideoStats[] }) {
  const t = useT();
  const [metric, setMetric] = useState<TopMetric>("views");
  const hasSaved = videos.some((v) => v.saved_count != null);
  const metrics = TOP_METRICS.filter((m) => m.key !== "saved" || hasSaved);
  const current = metrics.find((m) => m.key === metric) ?? metrics[0];

  const top = topVideosBy(videos, current.pick, TOP_COUNT);
  const max = current.pick(top[0] ?? ({} as VideoStats)) || 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 self-start rounded-full border border-white/10 bg-white/[0.03] p-1">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              current.key === m.key
                ? "bg-tt-cyan/15 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {t(m.label)}
          </button>
        ))}
      </div>
      <ol className="flex flex-col gap-2.5">
        {top.map((v, i) => {
          const value = current.pick(v);
          return (
            <li key={v.id} className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-semibold text-zinc-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/video/${v.id}`}
                  className="block truncate text-sm font-medium text-white hover:text-tt-cyan"
                  title={videoTitle(v)}
                >
                  {videoTitle(v)}
                </Link>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.max(2, (value / max) * 100)}%`,
                      backgroundColor: current.color,
                    }}
                  />
                </div>
              </div>
              <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-white">
                <FlashNumber value={value} format={current.format} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function AnalyticsPage() {
  const t = useT();
  const { stats, error } = useStats();

  if (!stats) {
    return (
      <>
        {error && <ErrorBanner message={error} />}
        <Loading />
      </>
    );
  }

  const { videos, totals } = stats;

  // Ultimi N video in ordine cronologico (il più vecchio a sinistra), così il
  // tempo scorre da sinistra a destra come in ogni serie temporale.
  const recent = videos.slice(0, RECENT_COUNT).reverse();
  const viewBars: BarDatum[] = recent.map((v) => ({
    label: publishLabel(v),
    value: v.view_count ?? 0,
  }));
  const engagementBars: BarDatum[] = recent.map((v) => ({
    label: publishLabel(v),
    value: videoEngagement(v),
  }));

  // "Quando pubblicare": media view per giorno della settimana e fascia oraria
  // di pubblicazione (fuso orario del browser).
  const dated = videos.filter((v) => v.create_time);
  const weekdayBars: BarDatum[] = WEEKDAYS.map((label, i) => ({
    label: t(label),
    value: averageWhere(
      dated,
      (v) => (new Date(v.create_time! * 1000).getDay() + 6) % 7 === i,
      (v) => v.view_count ?? 0,
    ),
  }));
  const hourBars: BarDatum[] = HOUR_BUCKETS.map((b) => ({
    label: b.label,
    value: averageWhere(
      dated,
      (v) => {
        const h = new Date(v.create_time! * 1000).getHours();
        return h >= b.from && h < b.to;
      },
      (v) => v.view_count ?? 0,
    ),
  }));

  // Heatmap giorno × fascia oraria: view medie per slot di pubblicazione.
  const heatCells = WEEKDAYS.map((_, di) =>
    HOUR_BUCKETS.map((b) =>
      averageWhere(
        dated,
        (v) => {
          const d = new Date(v.create_time! * 1000);
          return (
            (d.getDay() + 6) % 7 === di &&
            d.getHours() >= b.from &&
            d.getHours() < b.to
          );
        },
        (v) => v.view_count ?? 0,
      ),
    ),
  );
  const heatMax = Math.max(1, ...heatCells.flat());

  // Durata × performance: view medie per scaglioni di 10 secondi.
  const timed = videos.filter((v) => v.duration && v.duration > 0);
  const maxDuration = timed.reduce((max, v) => Math.max(max, v.duration!), 0);
  const durationBars: BarDatum[] = durationBuckets(maxDuration).map((b) => ({
    label: b.label,
    value: averageWhere(
      timed,
      (v) => v.duration! >= b.from && v.duration! < b.to,
      (v) => v.view_count ?? 0,
    ),
  }));

  const topByViews = topVideosBy(videos, (v) => v.view_count ?? 0, 10);
  const bestVideo = topByViews[0];

  // Concentrazione: quanta parte delle view arriva dai 10 video migliori.
  const top10Views = topByViews.reduce((s, v) => s + (v.view_count ?? 0), 0);
  const concentration = totals.views ? top10Views / totals.views : 0;

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorBanner message={error} />}

      <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-zinc-500">
        {t(
          "These charts capture the current state of each video. For the trend over time (daily growth, peaks) see the Growth section.",
        )}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`${t("Views · last")} ${recent.length} ${t("videos")}`}>
          <BarChart bars={viewBars} color={CHART_COLORS.cyan} />
        </Card>
        <Card title={`${t("Interactions · last")} ${recent.length} ${t("videos")}`}>
          <BarChart bars={engagementBars} color={CHART_COLORS.pink} />
        </Card>
      </div>

      {/* Quando pubblicare: performance media per momento di pubblicazione */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("Average views by publish day")} className="lg:col-span-2">
          <BarChart bars={weekdayBars} color={CHART_COLORS.violet} height={180} />
        </Card>
        <Card title={t("Average views by time slot")}>
          <BarChart bars={hourBars} color={CHART_COLORS.amber} height={180} />
        </Card>
      </div>

      <Card title={t("When to post · day × hour heatmap")}>
        <Heatmap cells={heatCells} max={heatMax} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("Average views by duration")}>
          <BarChart bars={durationBars} color={CHART_COLORS.emerald} height={180} />
        </Card>
        <Card title={`${t("Top")} ${TOP_COUNT} ${t("videos")}`} className="lg:col-span-2">
          {videos.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("No videos available.")}</p>
          ) : (
            <TopVideoList videos={videos} />
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat
          label="Total interactions"
          value={totals.likes + totals.comments + totals.shares}
          format={formatCompact}
        />
        <MiniStat
          label="Best video (views)"
          value={bestVideo?.view_count ?? 0}
          format={formatCompact}
          href={bestVideo ? `/dashboard/video/${bestVideo.id}` : undefined}
          hint={bestVideo ? videoTitle(bestVideo) : undefined}
        />
        <MiniStat
          label="Views from top 10"
          value={concentration}
          format={(f) => formatPercent(f, 0)}
          hint={t("how much of the views comes from the 10 best videos")}
        />
      </div>
    </div>
  );
}

/** Heatmap giorno × fascia oraria: verde intenso = slot con più view medie. */
function Heatmap({ cells, max }: { cells: number[][]; max: number }) {
  const t = useT();
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px] max-w-2xl">
        <div className="grid grid-cols-[2.5rem_repeat(12,1fr)] gap-1 text-[10px] text-zinc-500">
          <span />
          {HOUR_BUCKETS.map((b) => (
            <span key={b.label} className="text-center tabular-nums">
              {b.from}
            </span>
          ))}
        </div>
        {cells.map((row, di) => (
          <div
            key={WEEKDAYS[di]}
            className="mt-1 grid grid-cols-[2.5rem_repeat(12,1fr)] items-center gap-1"
          >
            <span className="text-[10px] text-zinc-500">{t(WEEKDAYS[di])}</span>
            {row.map((v, hi) => {
              const intensity = v > 0 ? 0.12 + 0.88 * (v / max) : 0;
              return (
                <div
                  key={HOUR_BUCKETS[hi].label}
                  title={`${t(WEEKDAYS[di])} ${HOUR_BUCKETS[hi].label}: ${formatCompact(
                    Math.round(v),
                  )} ${t("avg views")}`}
                  className="h-8 rounded-[4px] border border-white/5 sm:h-9"
                  style={{
                    backgroundColor:
                      v > 0
                        ? `rgba(37,244,238,${intensity})`
                        : "rgba(255,255,255,0.02)",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  format,
  hint,
  href,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  hint?: string;
  href?: string;
}) {
  const t = useT();
  const hintNode = hint ? (
    href ? (
      <Link href={href} className="truncate text-xs text-zinc-500 hover:text-tt-cyan">
        {hint} →
      </Link>
    ) : (
      <span className="text-xs text-zinc-500">{hint}</span>
    )
  ) : null;

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs">
        {t(label)}
      </span>
      <span className="text-2xl font-bold text-white">
        <FlashNumber value={value} format={format} />
      </span>
      {hintNode}
    </div>
  );
}
