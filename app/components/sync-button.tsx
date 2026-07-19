"use client";

import { useCallback, useEffect, useState } from "react";
import { readLocalSnapshots, syncLocalSnapshots } from "@/lib/local-history";
import { RefreshIcon } from "./icons";
import { useT } from "./locale-provider";

// Pulsante GLOBALE di sync (header dashboard). Confronta lo storico locale
// (localStorage) con lo stato del DB e compare solo quando il locale ha dati
// non ancora nel DB. Al click carica gli snapshot mancanti (idempotente) e
// avvisa la pagina Crescita di ricaricarsi.

interface Status {
  dbEnabled: boolean;
  firstAt: number | null;
  lastT: number | null;
  count: number;
}

const CHECK_INTERVAL_MS = 60_000;
// Tolleranza sull'ultimo timestamp: ad app aperta locale e DB crescono insieme,
// non vogliamo che il pulsante lampeggi per pochi secondi di scarto.
const NEW_TOLERANCE_MS = 90_000;

/** Ci sono snapshot locali non ancora nel DB? */
function computeHasNew(status: Status): boolean {
  if (!status.dbEnabled) return false;
  const local = readLocalSnapshots();
  if (local.length === 0) return false;
  if (status.count === 0) return true;
  const localMax = local[local.length - 1]?.t ?? 0;
  const localMin = local[0]?.t ?? 0;
  const newerTail =
    status.lastT !== null && localMax > status.lastT + NEW_TOLERANCE_MS;
  const olderHead =
    status.firstAt !== null && localMin < status.firstAt - 1000;
  return newerTail || olderHead;
}

export default function SyncButton() {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/history/status", { cache: "no-store" });
      if (!res.ok) return;
      const status = (await res.json()) as Status;
      setEnabled(status.dbEnabled);
      setHasNew(computeHasNew(status));
    } catch {
      // best-effort: se lo status fallisce, il pulsante resta com'è
    }
  }, []);

  useEffect(() => {
    // check() aggiorna lo stato dopo un fetch (fonte esterna, post-await): non è
    // un setState sincrono nel corpo dell'effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check();
    const id = setInterval(() => {
      if (!document.hidden) check();
    }, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  // Il messaggio "+N nel DB" sparisce dopo qualche secondo.
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  const handleSync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const { imported } = await syncLocalSnapshots();
      setMsg(imported > 0 ? `+${imported} ${t("to DB")}` : t("already up to date"));
      // Avvisa la pagina Crescita (se aperta) di ricaricare lo storico.
      window.dispatchEvent(new CustomEvent("tt:history-synced"));
      await check();
    } catch {
      setMsg(t("sync error"));
    } finally {
      setSyncing(false);
    }
  };

  // Compare solo quando c'è qualcosa da fare (o mentre lo fa / lo ha appena fatto).
  if (!enabled || (!hasNew && !syncing && !msg)) return null;

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      title={t("Sync to the database the snapshots saved on this device")}
      className="flex items-center gap-1.5 rounded-full border border-tt-cyan/40 bg-tt-cyan/10 px-3 py-1.5 text-xs font-medium text-tt-cyan transition-colors hover:bg-tt-cyan/20 disabled:opacity-50"
    >
      <RefreshIcon className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">
        {syncing ? t("Syncing…") : msg ?? t("Sync")}
      </span>
      {hasNew && !syncing && !msg && (
        <span className="h-1.5 w-1.5 rounded-full bg-tt-pink" aria-hidden="true" />
      )}
    </button>
  );
}
