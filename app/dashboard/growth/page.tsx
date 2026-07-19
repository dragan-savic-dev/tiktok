"use client";

import { useEffect, useState } from "react";
import type {
  DailyPoint,
  HistoryResponse,
  HistorySnapshot,
  VideoStats,
} from "@/lib/types";
import { Card } from "@/app/components/card";
import BarChart, { type BarDatum } from "@/app/components/bar-chart";
import FlashNumber from "@/app/components/flash-number";
import LineChart, { type LinePoint } from "@/app/components/line-chart";
import { DownloadIcon, TrendUpIcon } from "@/app/components/icons";
import { formatCompact } from "@/lib/metrics";
import {
  changeSince,
  computeDelta,
  DAY_MS,
  latestValue,
  mergeSnapshots,
  toSeries,
} from "@/lib/snapshots";
import { useStats } from "../stats-context";
import { CHART_COLORS, Loading } from "../shared";
import { useT } from "@/app/components/locale-provider";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 120, label: "120 days" },
];

/** "2026-07-13" -> "13/07"; "2026-07-13 14" (bucket orario) -> "13/07 14:00" */
function bucketLabel(day: string): string {
  const [date, hour] = day.split(" ");
  const [, m, d] = date.split("-");
  return hour ? `${d}/${m} ${hour}:00` : `${d}/${m}`;
}

function formatSigned(n: number): string {
  if (n === 0) return "0";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toLocaleString("it-IT")}`;
}

function toneClass(n: number | null): string {
  if (n === null || n === 0) return "text-zinc-400";
  return n > 0 ? "text-emerald-400" : "text-tt-pink";
}

/**
 * Card metrica della Crescita: conteggio attuale + variazione sul periodo
 * selezionato (7/30/90/120 gg) e variazione di oggi.
 */
function MetricCard({
  label,
  current,
  change,
  today,
  periodLabel,
}: {
  label: string;
  /** Conteggio attuale (null = non disponibile). */
  current: number | null;
  /** Variazione sul periodo selezionato (null = storico insufficiente). */
  change: number | null;
  /** Variazione di oggi (null = storico insufficiente). */
  today: number | null;
  /** Etichetta del periodo, es. "7 giorni". */
  periodLabel: string;
}) {
  const t = useT();
  return (
    <Card title={label} bodyClassName="flex flex-col gap-2 p-4 sm:p-5">
      <span className="text-2xl font-bold text-white sm:text-3xl">
        {current === null ? "—" : <FlashNumber value={current} />}
      </span>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex items-baseline gap-1.5">
          <span className={`font-semibold ${toneClass(change)}`}>
            {change === null ? "—" : <FlashNumber value={change} format={formatSigned} />}
          </span>
          <span className="text-zinc-500">{periodLabel}</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-zinc-500">{t("today")}</span>
          <span className={`font-semibold ${toneClass(today)}`}>
            {today === null ? "—" : <FlashNumber value={today} format={formatSigned} />}
          </span>
        </span>
      </div>
    </Card>
  );
}

/** Serie del totale, saltando i bucket senza valore (es. salvati N/D). */
function seriesTotal(
  daily: DailyPoint[],
  pick: (p: DailyPoint) => number | null,
): LinePoint[] {
  return daily.flatMap((p) => {
    const v = pick(p);
    return v === null ? [] : [{ label: bucketLabel(p.day), value: v }];
  });
}

/** Serie della variazione: differenza tra bucket consecutivi. */
function seriesDelta(
  daily: DailyPoint[],
  pick: (p: DailyPoint) => number | null,
): BarDatum[] {
  const points = seriesTotal(daily, pick);
  return points.slice(1).map((p, i) => ({ label: p.label, value: p.value - points[i].value }));
}

/**
 * Rende una serie non-decrescente (running max). I "salvati" non calano nel
 * breve periodo: un tuffo è quasi sempre uno scrape sporco già registrato, così
 * lo appiattiamo in visualizzazione (la guardia alla fonte evita i futuri).
 */
function monotonic(points: LinePoint[]): LinePoint[] {
  let max = -Infinity;
  return points.map((p) => {
    max = Math.max(max, p.value);
    return { ...p, value: max };
  });
}

/** Variazione tra punti consecutivi di una serie già pronta. */
function pointsDelta(points: LinePoint[]): BarDatum[] {
  return points
    .slice(1)
    .map((p, i) => ({ label: p.label, value: p.value - points[i].value }));
}

/** Etichette dei bucket in cui è stato pubblicato un video (per i marcatori). */
function publicationMarkers(
  videos: VideoStats[],
  hourly: boolean,
  available: Set<string>,
): string[] {
  const labels = new Set<string>();
  for (const v of videos) {
    if (!v.create_time) continue;
    const d = new Date(v.create_time * 1000);
    const key = hourly
      ? `${d.toLocaleDateString("sv-SE")} ${String(d.getHours()).padStart(2, "0")}`
      : d.toLocaleDateString("sv-SE");
    const label = bucketLabel(key);
    if (available.has(label)) labels.add(label);
  }
  return [...labels];
}

/** Prossimo traguardo "tondo" di follower sopra il valore attuale. */
function nextMilestone(n: number): number {
  const steps = [
    100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000,
    500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
  ];
  for (const s of steps) if (n < s) return s;
  return Math.ceil((n + 1) / 10_000_000) * 10_000_000;
}

/** Scarica lo storico come file CSV (alla granularità mostrata). */
function exportCsv(daily: DailyPoint[]): void {
  const header = [
    "bucket",
    "seguiti",
    "follower",
    "mi_piace",
    "visualizzazioni",
    "commenti",
    "condivisioni",
    "salvati",
  ];
  const rows = daily.map((p) =>
    [p.day, p.following, p.followers, p.likes, p.views, p.comments, p.shares, p.saved ?? ""].join(
      ",",
    ),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tiktok-storico-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GrowthPage() {
  const t = useT();
  const [days, setDays] = useState(30);
  // Range a cui corrispondono i dati attualmente mostrati. Cambia SOLO quando il
  // fetch del nuovo range è pronto: così cambiando filtro la vista non passa da
  // uno stato intermedio (dati vecchi filtrati sulla finestra nuova) → niente
  // doppio scatto. `days` guida solo il pulsante attivo e la richiesta.
  const [viewDays, setViewDays] = useState(30);
  const [mode, setMode] = useState<"total" | "delta">("total");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { stats } = useStats();

  // Su 7 giorni gli snapshot al minuto permettono la granularità oraria.
  const hourly = viewDays === 7;

  useEffect(() => {
    let cancelled = false;
    const granularity = days === 7 ? "hour" : "day";
    const load = async () => {
      try {
        const res = await fetch(`/api/history?days=${days}&granularity=${granularity}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          window.location.href = "/?error=session_expired";
          return;
        }
        const body = await res.json();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!cancelled) {
          // Aggiorna dati e range della vista INSIEME: transizione unica.
          setHistory(body as HistoryResponse);
          setViewDays(days);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("Network error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Aggiorna lo storico ogni minuto (il server storicizza ogni 10 min).
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [days, t]);

  if (loading && !history) return <Loading label={t("Loading history…")} />;

  // Storico solo dal server (Neon): il client non registra più nulla in locale.
  // "Adesso" è derivato dai dati (Date.now() nel render violerebbe la purezza).
  const now = Math.max(
    stats?.fetchedAt ?? 0,
    history?.daily.at(-1)?.t ?? 0,
  );
  const merged = mergeSnapshots(history?.daily ?? [], [], now);
  const windowed = merged.filter((s) => s.t >= now - viewDays * DAY_MS);
  const daily = toSeries(windowed, hourly ? "hour" : "day");
  const count = merged.length;
  const windowMs = viewDays * DAY_MS;
  const rangeLabel = t(RANGES.find((r) => r.days === viewDays)?.label ?? "");

  // Card metriche: conteggio attuale (dai dati live, fallback all'ultimo
  // snapshot) + variazione sul periodo selezionato + variazione di oggi. Il
  // selettore 7/30/90/120 filtra quindi anche queste, non solo i grafici.
  const metricDefs: {
    label: string;
    pick: (s: HistorySnapshot) => number | null;
    current: number | null | undefined;
  }[] = [
    { label: t("Followers"), pick: (s) => s.followers, current: stats?.user.follower_count },
    { label: t("Views"), pick: (s) => s.views, current: stats?.totals.views },
    { label: t("Likes"), pick: (s) => s.likes, current: stats?.user.likes_count },
    { label: t("Comments"), pick: (s) => s.comments, current: stats?.totals.comments },
    { label: t("Shares"), pick: (s) => s.shares, current: stats?.totals.shares },
    { label: t("Saves"), pick: (s) => s.saved, current: stats?.saved },
  ];
  const metrics = metricDefs.map((m) => ({
    label: m.label,
    current: m.current ?? latestValue(merged, m.pick),
    change: changeSince(merged, m.pick, now, windowMs),
    today: computeDelta(merged, m.pick, now).today,
  }));

  const enoughData = daily.length >= 2;
  const deltaMode = mode === "delta";

  const savedSeries = monotonic(seriesTotal(daily, (p) => p.saved));
  const availableLabels = new Set(daily.map((p) => bucketLabel(p.day)));
  const markers = publicationMarkers(stats?.videos ?? [], hourly, availableLabels);

  // Proiezione del prossimo traguardo follower al ritmo degli ultimi 7 giorni.
  const followers = stats?.user.follower_count ?? null;
  const weekGain = computeDelta(merged, (s) => s.followers, now).week;
  const milestone =
    followers !== null && weekGain !== null && weekGain > 0
      ? {
          target: nextMilestone(followers),
          perDay: weekGain / 7,
          daysLeft: Math.max(
            1,
            Math.ceil((nextMilestone(followers) - followers) / (weekGain / 7)),
          ),
        }
      : null;

  /** Un grafico che segue il toggle Totale/Variazione. */
  const chart = (
    pick: (p: DailyPoint) => number | null,
    color: string,
    withMarkers = false,
  ) =>
    deltaMode ? (
      <BarChart bars={seriesDelta(daily, pick)} color={color} formatValue={formatSigned} />
    ) : (
      <LineChart
        data={seriesTotal(daily, pick)}
        color={color}
        markers={withMarkers ? markers : []}
      />
    );

  return (
    <div className="flex flex-col gap-5">
      {/* Selettore intervallo + modalità */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {t(
            "Real trend over time, recorded on the server every 10 minutes.",
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === r.days
                    ? "bg-tt-pink/20 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {t(r.label)}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                { key: "total", label: t("Total") },
                { key: "delta", label: hourly ? t("Change/hour") : t("Change/day") },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === m.key
                    ? "bg-tt-cyan/15 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportCsv(daily)}
            disabled={daily.length === 0}
            title={t("Export history as CSV")}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-tt-cyan/60 hover:text-white disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-zinc-300"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      {error && !history && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-300">
          {t("Can’t read history:")} {error}
        </p>
      )}

      {/* Conteggio attuale + variazione sul periodo selezionato per metrica */}
      {count > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <MetricCard
              key={m.label}
              label={m.label}
              current={m.current}
              change={m.change}
              today={m.today}
              periodLabel={rangeLabel}
            />
          ))}
        </div>
      )}

      {/* Proiezione prossimo traguardo follower */}
      {milestone && followers !== null && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
          <TrendUpIcon className="h-4 w-4 shrink-0 text-tt-cyan" />
          <span>
            {t("At the pace of the last 7 days (")}
            <span className="font-semibold text-emerald-400">
              +<FlashNumber value={Math.round(milestone.perDay)} />
            </span>
            {t("/day) you’ll reach")}{" "}
            <span className="font-semibold text-white">
              <FlashNumber value={milestone.target} format={formatCompact} />
            </span>{" "}
            {t("followers in about")}{" "}
            <span className="font-semibold text-white">
              <FlashNumber value={milestone.daysLeft} />
            </span>{" "}
            {t("days.")}
          </span>
        </div>
      )}

      {enoughData ? (
        <>
          <Card title={deltaMode ? t("Followers gained") : t("Follower growth")}>
            {chart((p) => p.followers, CHART_COLORS.pink)}
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title={t("Views over time")}
              action={
                !deltaMode && markers.length > 0 ? (
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    <span className="text-tt-pink">┆</span> {t("publications")}
                  </span>
                ) : undefined
              }
            >
              {chart((p) => p.views, CHART_COLORS.cyan, true)}
            </Card>
            <Card title={t("Likes over time")}>{chart((p) => p.likes, CHART_COLORS.violet)}</Card>
          </div>
          {savedSeries.length >= 2 && (
            <Card title={t("Saves over time")}>
              {deltaMode ? (
                <BarChart
                  bars={pointsDelta(savedSeries)}
                  color={CHART_COLORS.amber}
                  formatValue={formatSigned}
                />
              ) : (
                <LineChart data={savedSeries} color={CHART_COLORS.amber} />
              )}
            </Card>
          )}
        </>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <TrendUpIcon className="h-10 w-10 text-zinc-600" />
            <p className="max-w-md text-sm text-zinc-400">
              {t(
                "Collecting data: the server records a snapshot every 10 minutes; at least two different moments are needed to track growth.",
              )}
            </p>
            <p className="text-xs text-zinc-600">
              {count ? (
                <>
                  <FlashNumber value={count} />{" "}
                  {t("snapshots so far — come back later.")}
                </>
              ) : (
                t("Leave the dashboard open and come back later.")
              )}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
