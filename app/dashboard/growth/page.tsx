"use client";

import { useEffect, useState } from "react";
import type { HistoryDelta, HistoryResponse, DailyPoint } from "@/lib/types";
import { Card } from "@/app/components/card";
import FlashNumber from "@/app/components/flash-number";
import LineChart, { type LinePoint } from "@/app/components/line-chart";
import { DownloadIcon, TrendUpIcon } from "@/app/components/icons";
import { CHART_COLORS, Loading } from "../shared";

const RANGES = [
  { days: 7, label: "7 giorni" },
  { days: 30, label: "30 giorni" },
  { days: 90, label: "90 giorni" },
];

/** "2026-07-13" -> "13/07" */
function dayLabel(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
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

function series(daily: DailyPoint[], pick: (p: DailyPoint) => number): LinePoint[] {
  return daily.map((p) => ({ label: dayLabel(p.day), value: pick(p) }));
}

/** Scarica lo storico giornaliero come file CSV. */
function exportCsv(daily: DailyPoint[]): void {
  const header = [
    "giorno",
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
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/history?days=${days}`, { cache: "no-store" });
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

  const daily = history?.daily ?? [];
  const enoughData = daily.length >= 2;

  return (
    <div className="flex flex-col gap-5">
      {/* Selettore intervallo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Andamento reale nel tempo, dai dati salvati mentre usi l’app.
        </p>
        <div className="flex items-center gap-2">
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

      {/* Delta oggi / 7 giorni */}
      {history && (
        <div className="grid gap-4 sm:grid-cols-3">
          <DeltaStat label="Follower" delta={history.deltas.followers} />
          <DeltaStat label="Visualizzazioni" delta={history.deltas.views} />
          <DeltaStat label="Mi piace" delta={history.deltas.likes} />
        </div>
      )}

      {enoughData ? (
        <>
          <Card title="Crescita follower">
            <LineChart data={series(daily, (p) => p.followers)} color={CHART_COLORS.pink} />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Visualizzazioni nel tempo">
              <LineChart data={series(daily, (p) => p.views)} color={CHART_COLORS.cyan} />
            </Card>
            <Card title="Mi piace nel tempo">
              <LineChart data={series(daily, (p) => p.likes)} color={CHART_COLORS.violet} />
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <TrendUpIcon className="h-10 w-10 text-zinc-600" />
            <p className="max-w-md text-sm text-zinc-400">
              Sto raccogliendo i dati. Le statistiche vengono salvate mentre usi
              l’app (una foto al minuto): servono almeno due giorni diversi per
              tracciare la crescita.
            </p>
            <p className="text-xs text-zinc-600">
              {history?.count ? (
                <>
                  <FlashNumber value={history.count} /> snapshot finora — torna più tardi.
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
