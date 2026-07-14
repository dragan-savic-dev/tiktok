"use client";

import { useEffect, useState } from "react";
import type {
  DailyPoint,
  HistoryDelta,
  HistoryResponse,
  HistorySnapshot,
  VideoStats,
} from "@/lib/types";
import { Card } from "@/app/components/card";
import BarChart, { type BarDatum } from "@/app/components/bar-chart";
import FlashNumber from "@/app/components/flash-number";
import LineChart, { type LinePoint } from "@/app/components/line-chart";
import { DownloadIcon, TrendUpIcon } from "@/app/components/icons";
import { readLocalSnapshots } from "@/lib/local-history";
import { formatCompact } from "@/lib/metrics";
import { computeDelta, DAY_MS, mergeSnapshots, toSeries } from "@/lib/snapshots";
import { useStats } from "../stats-context";
import { CHART_COLORS, Loading } from "../shared";

const RANGES = [
  { days: 7, label: "7 giorni" },
  { days: 30, label: "30 giorni" },
  { days: 90, label: "90 giorni" },
  { days: 120, label: "120 giorni" },
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

function DeltaStat({ label, delta }: { label: string; delta: HistoryDelta }) {
  return (
    <Card title={label} bodyClassName="flex items-end justify-between gap-4 p-4 sm:p-5">
      <div className="flex flex-col">
        <span className={`text-2xl font-bold ${toneClass(delta.today)}`}>
          {delta.today === null ? (
            "—"
          ) : (
            <FlashNumber value={delta.today} format={formatSigned} />
          )}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">oggi</span>
      </div>
      <div className="flex flex-col items-end">
        <span className={`text-lg font-semibold ${toneClass(delta.week)}`}>
          {delta.week === null ? (
            "—"
          ) : (
            <FlashNumber value={delta.week} format={formatSigned} />
          )}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">7 giorni</span>
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
  const [days, setDays] = useState(30);
  const [mode, setMode] = useState<"total" | "delta">("total");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [localSnaps, setLocalSnaps] = useState<HistorySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { stats } = useStats();

  // Su 7 giorni gli snapshot al minuto permettono la granularità oraria.
  const hourly = days === 7;

  useEffect(() => {
    let cancelled = false;
    const granularity = days === 7 ? "hour" : "day";
    const load = async () => {
      // Storico locale (localStorage): sopravvive anche quando il server è
      // serverless e il suo filesystem viene riciclato.
      setLocalSnaps(readLocalSnapshots());
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
          setHistory(body as HistoryResponse);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Errore di rete");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Aggiorna lo storico ogni minuto (cadenza a cui nascono nuovi snapshot).
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [days]);

  if (loading && !history) return <Loading label="Carico lo storico…" />;

  // Unione delle due fonti: snapshot del server (quando il suo storico esiste)
  // e snapshot locali del browser. Serie e delta si calcolano sul totale.
  // "Adesso" è derivato dai dati (Date.now() nel render violerebbe la purezza).
  const now = Math.max(
    stats?.fetchedAt ?? 0,
    history?.daily.at(-1)?.t ?? 0,
    localSnaps.at(-1)?.t ?? 0,
  );
  const merged = mergeSnapshots(history?.daily ?? [], localSnaps, now);
  const windowed = merged.filter((s) => s.t >= now - days * DAY_MS);
  const daily = toSeries(windowed, hourly ? "hour" : "day");
  const count = merged.length;
  const deltas = {
    followers: computeDelta(merged, (s) => s.followers, now),
    views: computeDelta(merged, (s) => s.views, now),
    likes: computeDelta(merged, (s) => s.likes, now),
    comments: computeDelta(merged, (s) => s.comments, now),
    shares: computeDelta(merged, (s) => s.shares, now),
    saved: computeDelta(merged, (s) => s.saved, now),
  };

  const enoughData = daily.length >= 2;
  const deltaMode = mode === "delta";

  const savedSeries = seriesTotal(daily, (p) => p.saved);
  const availableLabels = new Set(daily.map((p) => bucketLabel(p.day)));
  const markers = publicationMarkers(stats?.videos ?? [], hourly, availableLabels);

  // Proiezione del prossimo traguardo follower al ritmo degli ultimi 7 giorni.
  const followers = stats?.user.follower_count ?? null;
  const weekGain = deltas.followers.week;
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
          Andamento reale nel tempo: gli snapshot si salvano nel tuo browser
          mentre usi l’app.
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
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                { key: "total", label: "Totale" },
                { key: "delta", label: hourly ? "Variazione/ora" : "Variazione/giorno" },
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
            title="Esporta lo storico in CSV"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-tt-cyan/60 hover:text-white disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-zinc-300"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      {error && !history && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-300">
          Non riesco a leggere lo storico: {error}
        </p>
      )}

      {/* Delta oggi / 7 giorni su tutte le metriche */}
      {count > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DeltaStat label="Follower" delta={deltas.followers} />
          <DeltaStat label="Visualizzazioni" delta={deltas.views} />
          <DeltaStat label="Mi piace" delta={deltas.likes} />
          <DeltaStat label="Commenti" delta={deltas.comments} />
          <DeltaStat label="Condivisioni" delta={deltas.shares} />
          <DeltaStat label="Salvati" delta={deltas.saved} />
        </div>
      )}

      {/* Proiezione prossimo traguardo follower */}
      {milestone && followers !== null && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
          <TrendUpIcon className="h-4 w-4 shrink-0 text-tt-cyan" />
          <span>
            Al ritmo degli ultimi 7 giorni (
            <span className="font-semibold text-emerald-400">
              +<FlashNumber value={Math.round(milestone.perDay)} />
            </span>
            /giorno) raggiungi{" "}
            <span className="font-semibold text-white">
              <FlashNumber value={milestone.target} format={formatCompact} />
            </span>{" "}
            follower tra circa{" "}
            <span className="font-semibold text-white">
              <FlashNumber value={milestone.daysLeft} />
            </span>{" "}
            giorni.
          </span>
        </div>
      )}

      {enoughData ? (
        <>
          <Card title={deltaMode ? "Follower guadagnati" : "Crescita follower"}>
            {chart((p) => p.followers, CHART_COLORS.pink)}
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title="Visualizzazioni nel tempo"
              action={
                !deltaMode && markers.length > 0 ? (
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    <span className="text-tt-pink">┆</span> pubblicazioni
                  </span>
                ) : undefined
              }
            >
              {chart((p) => p.views, CHART_COLORS.cyan, true)}
            </Card>
            <Card title="Mi piace nel tempo">{chart((p) => p.likes, CHART_COLORS.violet)}</Card>
          </div>
          {savedSeries.length >= 2 && (
            <Card title="Salvati nel tempo">
              {chart((p) => p.saved, CHART_COLORS.amber)}
            </Card>
          )}
        </>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <TrendUpIcon className="h-10 w-10 text-zinc-600" />
            <p className="max-w-md text-sm text-zinc-400">
              Sto raccogliendo i dati. Le statistiche vengono salvate nel tuo
              browser (e sul server) mentre usi l’app, una foto al minuto:
              servono almeno due momenti diversi per tracciare la crescita.
            </p>
            <p className="text-xs text-zinc-600">
              {count ? (
                <>
                  <FlashNumber value={count} /> snapshot finora — torna più tardi.
                </>
              ) : (
                "Lascia aperta la dashboard e torna più tardi."
              )}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
