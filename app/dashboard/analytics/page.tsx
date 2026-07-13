"use client";

import { Card } from "@/app/components/card";
import BarChart from "@/app/components/bar-chart";
import DonutChart from "@/app/components/donut-chart";
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
  const maxTopViews = Math.max(1, ...topByViews.map((v) => v.view_count ?? 0));

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
        I grafici usano le statistiche <strong className="text-zinc-300">attuali</strong> di
        ogni video. Per veri andamenti nel tempo (crescita giornaliera, picchi)
        servirebbe salvare gli snapshot lato server: è il prossimo passo naturale.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Visualizzazioni · ultimi ${recent.length} video`}>
          <div className="h-52">
            <BarChart bars={viewBars} color={CHART_COLORS.cyan} />
          </div>
        </Card>
        <Card title={`Interazioni · ultimi ${recent.length} video`}>
          <div className="h-52">
            <BarChart bars={engagementBars} color={CHART_COLORS.pink} />
          </div>
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
                    {formatPercent(engagementRate(stats), 1)}
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
            <ul className="flex flex-col gap-3">
              {topByViews.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right text-xs font-semibold text-zinc-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <a
                        href={v.share_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-zinc-300 hover:text-tt-cyan"
                      >
                        Video #{v.id.slice(-6)}
                      </a>
                      <span className="shrink-0 font-semibold text-white">
                        {formatCompact(v.view_count)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${((v.view_count ?? 0) / maxTopViews) * 100}%`,
                          background: `linear-gradient(to right, ${CHART_COLORS.pink}, ${CHART_COLORS.cyan})`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat
          label="Interazioni totali"
          value={formatCompact(totals.likes + totals.comments + totals.shares)}
        />
        <MiniStat
          label="Miglior video (view)"
          value={formatCompact(topByViews[0]?.view_count ?? 0)}
        />
        <MiniStat
          label="View dai top 10"
          value={formatPercent(concentration, 0)}
          hint="quanta parte delle visualizzazioni arriva dai 10 video migliori"
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs">
        {label}
      </span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  );
}
