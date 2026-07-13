"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StatsResponse } from "@/lib/types";
import {
  BookmarkIcon,
  CommentIcon,
  EyeIcon,
  ShareIcon,
  TikTokIcon,
} from "@/app/components/icons";
import DeltaBadge from "@/app/components/delta-badge";
import InstallButton from "@/app/components/install-button";
import LiveIndicator from "@/app/components/live-indicator";
import OdometerNumber from "@/app/components/odometer-number";
import ProfileHeader from "@/app/components/profile-header";
import StatCard from "@/app/components/stat-card";

const POLL_MS = 5000;
const STORAGE_KEY = "tiktok-live-stats:last";

export default function DashboardClient() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [previous, setPrevious] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const lastRef = useRef<StatsResponse | null>(null);
  // Il valore in lastRef proviene dalla cache: non usarlo per calcolare i delta.
  const lastFromCacheRef = useRef(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?error=session_expired";
        return;
      }
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.message === "string" ? body.message : `HTTP ${res.status}`);
      }
      setPrevious(lastFromCacheRef.current ? null : lastRef.current);
      lastFromCacheRef.current = false;
      lastRef.current = body as StatsResponse;
      setStats(body as StatsResponse);
      setError(null);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(body));
      } catch {
        // localStorage non disponibile (modalità privata / quota): ignora
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di rete");
    } finally {
      setTick((t) => t + 1);
    }
  }, []);

  // Idrata subito con i dati salvati per evitare il loader di 5 secondi al rientro.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as StatsResponse;
        lastRef.current = parsed;
        lastFromCacheRef.current = true;
        setStats(parsed);
      }
    } catch {
      // dati salvati non validi: ignora e attendi il fetch
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(() => {
      if (!document.hidden) fetchStats();
    }, POLL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) fetchStats();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchStats]);

  const delta = (pick: (s: StatsResponse) => number | undefined): number | undefined => {
    if (!stats || !previous) return undefined;
    const now = pick(stats);
    const before = pick(previous);
    if (now === undefined || before === undefined) return undefined;
    return now - before;
  };

  const followerDelta = delta((s) => s.user.follower_count);
  const followingDelta = delta((s) => s.user.following_count);
  const profileLikesDelta = delta((s) => s.user.likes_count);

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:overflow-hidden">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-white">
            <TikTokIcon className="h-5 w-5" />
            <span>TikTok Live Stats</span>
          </div>
          <div className="flex items-center gap-4">
            <LiveIndicator tick={tick} error={!!error} />
            <InstallButton compact />
            <a
              href="/api/auth/logout"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Esci
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-center gap-6 px-6 pb-6 pt-10 sm:pt-6">
        {error && (
          <p className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-300">
            Errore nell’aggiornamento: {error} — nuovo tentativo tra 5 secondi.
          </p>
        )}

        {!stats ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-tt-cyan" />
            <p className="text-sm">Carico le tue statistiche…</p>
          </div>
        ) : (
          <>
            <ProfileHeader user={stats.user} />

            <section className="flex flex-row items-end justify-center gap-8 sm:gap-14">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs sm:tracking-[0.3em]">
                  Seguiti
                </span>
                {/* Badge in absolute: appare di fianco senza spostare il numero centrato */}
                <div className="relative">
                  <OdometerNumber
                    value={stats.user.following_count ?? 0}
                    className="text-2xl font-bold text-white sm:text-4xl"
                  />
                  <DeltaBadge
                    delta={followingDelta}
                    className="absolute left-full top-1/2 ml-2 -translate-y-1/2 text-xs sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs sm:tracking-[0.3em]">
                  Follower
                </span>
                <div className="relative">
                  <OdometerNumber
                    value={stats.user.follower_count ?? 0}
                    className="text-2xl font-bold text-white sm:text-4xl"
                  />
                  <DeltaBadge
                    delta={followerDelta}
                    className="absolute left-full top-1/2 ml-2 -translate-y-1/2 text-xs sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs sm:tracking-[0.3em]">
                  Mi piace
                </span>
                <div className="relative">
                  <OdometerNumber
                    value={stats.user.likes_count ?? 0}
                    className="text-2xl font-bold text-white sm:text-4xl"
                  />
                  <DeltaBadge
                    delta={profileLikesDelta}
                    className="absolute left-full top-1/2 ml-2 -translate-y-1/2 text-xs sm:text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="flex w-full flex-col gap-3">
              <h2 className="text-center text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 sm:text-xs sm:tracking-[0.3em]">
                Totali su tutti i video
              </h2>
              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Visualizzazioni"
                  value={stats.totals.views}
                  delta={delta((s) => s.totals.views)}
                  icon={<EyeIcon className="h-4 w-4" />}
                />
                <StatCard
                  label="Commenti"
                  value={stats.totals.comments}
                  delta={delta((s) => s.totals.comments)}
                  icon={<CommentIcon className="h-4 w-4" />}
                />
                <StatCard
                  label="Condivisioni"
                  value={stats.totals.shares}
                  delta={delta((s) => s.totals.shares)}
                  icon={<ShareIcon className="h-4 w-4" />}
                  accent="pink"
                />
                <StatCard
                  label="Salvati"
                  value={stats.saved}
                  delta={delta((s) => s.saved ?? undefined)}
                  icon={<BookmarkIcon className="h-4 w-4" />}
                />
              </div>
              <p className="text-center text-xs text-zinc-500">
                Somma su {stats.totals.videosCounted.toLocaleString("it-IT")} video pubblici ·
                aggiornamento ogni 5 secondi · i “salvati” sono letti dalle pagine
                pubbliche dei video circa ogni minuto (N/D se TikTok li blocca)
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
