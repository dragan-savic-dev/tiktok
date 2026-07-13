"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { StatsResponse } from "@/lib/types";

const POLL_MS = 5000;
const STORAGE_KEY = "tiktok-live-stats:last";

type Picker = (s: StatsResponse) => number | undefined;

interface StatsContextValue {
  stats: StatsResponse | null;
  previous: StatsResponse | null;
  error: string | null;
  tick: number;
  /** Differenza tra l'ultimo poll e quello precedente (undefined se non calcolabile). */
  delta: (pick: Picker) => number | undefined;
}

const StatsContext = createContext<StatsContextValue | null>(null);

export function useStats(): StatsContextValue {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error("useStats va usato dentro <StatsProvider>");
  return ctx;
}

export default function StatsProvider({ children }: { children: React.ReactNode }) {
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- idratazione una tantum da localStorage dopo il mount (SSR-safe)
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

  const delta = useCallback(
    (pick: Picker): number | undefined => {
      if (!stats || !previous) return undefined;
      const now = pick(stats);
      const before = pick(previous);
      if (now === undefined || before === undefined) return undefined;
      return now - before;
    },
    [stats, previous],
  );

  return (
    <StatsContext.Provider value={{ stats, previous, error, tick, delta }}>
      {children}
    </StatsContext.Provider>
  );
}
