"use client";

import { Card } from "@/app/components/card";
import BarChart from "@/app/components/bar-chart";
import DonutChart from "@/app/components/donut-chart";
import FlashNumber from "@/app/components/flash-number";
import RankedBars from "@/app/components/ranked-bars";
import {
  engagementRate,
  formatCompact,
  formatPercent,
  topVideosBy,
  videoEngagement,
} from "@/lib/metrics";
import { useStats } from "../stats-context";
import { CHART_COLORS, ErrorBanner, Loading } from "../shared";

const RECENT_COUNT = 14;
const TOP_COUNT = 8;

export default function AnalyticsPage() {
  const { stats, error } = useStats();

  if (!stats) {
    return (
      <>
        {error && <ErrorBanner message={error} />}
        <Loading />
      </>
    );
  }

  const { videos, totals, saved } = stats;

  // Ultimi N video, dal più recente: proxy visivo dell'andamento (non è una
  // serie storica reale — quella richiederebbe salvare gli snapshot nel tempo).
  const recent = videos.slice(0, RECENT_COUNT);
  const viewBars = recent.map((v, i) => ({
    label: `#${i + 1}`,
    value: v.view_count ?? 0,
  }));
  const engagementBars = recent.map((v, i) => ({
    label: `#${i + 1}`,
    value: videoEngagement(v),
  }));

  const topByViews = topVideosBy(videos, (v) => v.view_count ?? 0, TOP_COUNT);

  // Concentrazione: quanta parte delle view arriva dai 10 video migliori.
  const top10Views = topVideosBy(videos, (v) => v.view_count ?? 0, 10).reduce(
    (s, v) => s + (v.view_count ?? 0),
    0,
  );
  const concentration = totals.views ? top10Views / totals.views : 0;

  const interactions = [
    { label: "Mi piace", value: totals.likes, color: CHART_COLORS.pink },
    { label: "Commenti", value: totals.comments, color: CHART_COLORS.cyan },
    { label: "Condivisioni", value: totals.shares, color: CHART_COLORS.violet },
    ...(saved !== null
      ? [{ label: "Salvati", value: saved, color: CHART_COLORS.amber }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorBanner message={error} />}

      <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-zinc-500">
        Questi grafici fotografano lo stato <strong className="text-zinc-300">attuale</strong> di
        ogni video. Per l’andamento nel tempo (crescita giornaliera, picchi) vai
        alla sezione <strong className="text-zinc-300">Crescita</strong>.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Visualizzazioni · ultimi ${recent.length} video`}>
          <BarChart bars={viewBars} color={CHART_COLORS.cyan} />
        </Card>
        <Card title={`Interazioni · ultimi ${recent.length} video`}>
          <BarChart bars={engagementBars} color={CHART_COLORS.pink} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Ripartizione interazioni">
          <div className="flex flex-col items-center gap-4">
            <DonutChart
              size={170}
              segments={interactions}
              center={
                <>
                  <span className="text-2xl font-bold text-white">
                    <FlashNumber
                      value={engagementRate(stats)}
                      format={(f) => formatPercent(f, 1)}
                    />
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500">
                    engagement
                  </span>
                </>
              }
            />
          </div>
        </Card>

        <Card title={`Top ${topByViews.length} video per visualizzazioni`} className="lg:col-span-2">
          {topByViews.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessun video disponibile.</p>
          ) : (
            <RankedBars
              color={CHART_COLORS.pink}
              items={topByViews.map((v, i) => ({
                label: `#${i + 1}`,
                value: v.view_count ?? 0,
              }))}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat
          label="Interazioni totali"
          value={totals.likes + totals.comments + totals.shares}
          format={formatCompact}
        />
        <MiniStat
          label="Miglior video (view)"
          value={topByViews[0]?.view_count ?? 0}
          format={formatCompact}
        />
        <MiniStat
          label="View dai top 10"
          value={concentration}
          format={(f) => formatPercent(f, 0)}
          hint="quanta parte delle visualizzazioni arriva dai 10 video migliori"
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  format,
  hint,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs">
        {label}
      </span>
      <span className="text-2xl font-bold text-white">
        <FlashNumber value={value} format={format} />
      </span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  );
}
