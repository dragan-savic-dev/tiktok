import { collectStats } from "./collect";
import { getValidAccessTokenFor } from "./token";
import { listUserTokens } from "./users";

// Raccoglie uno snapshot per ciascun utente, così lo storico cresce anche ad app
// chiusa. Usa la stessa cache di /api/stats: quando l'app è aperta i dati sono
// già in cache e non si moltiplicano le chiamate a TikTok.
//
// Due modalità:
//   - Server persistente (VPS/Hetzner): setInterval interno, cadenza da
//     COLLECT_INTERVAL_MS (default 10 min). Metti 0 per disabilitarlo e usare
//     invece un cron esterno che chiama /api/cron/collect.
//   - Vercel (serverless): l'interval non è affidabile → ci pensa un Vercel Cron
//     che chiama /api/cron/collect (vedi vercel.json). Qui l'interval è saltato.
const DEFAULT_INTERVAL_MS = 10 * 60_000; // 10 minuti

let started = false;
let running = false;

/**
 * Raccoglie per tutti gli utenti con token recuperabile. Rinnova l'access token
 * lato server quando serve (via lib/token.ts), quindi non salta più gli utenti
 * col token scaduto finché il refresh token è valido. Ritorna un piccolo esito.
 */
export async function collectAllUsers(): Promise<{
  collected: number;
  skipped: number;
}> {
  const users = await listUserTokens();
  let collected = 0;
  let skipped = 0;
  for (const u of users) {
    const token = await getValidAccessTokenFor(u.openId);
    if (!token) {
      // Nessun token valido né rinnovabile (es. refresh assente o revocato):
      // riprende alla prossima visita/login dell'utente.
      skipped++;
      continue;
    }
    try {
      await collectStats(u.openId, token.accessToken);
      collected++;
    } catch {
      // best-effort: un utente che fallisce non blocca gli altri
      skipped++;
    }
  }
  return { collected, skipped };
}

/**
 * Avvia il ciclo di raccolta in-process. Idempotente. Su Vercel è un no-op: la
 * raccolta ad app chiusa la fa il cron. Con COLLECT_INTERVAL_MS=0 è disabilitato
 * (si usa un cron esterno).
 */
export function startBackgroundCollection(): void {
  if (started) return;
  if (process.env.VERCEL) return; // su Vercel usa il cron, non l'interval

  const raw = process.env.COLLECT_INTERVAL_MS;
  const interval = raw === undefined || raw === "" ? DEFAULT_INTERVAL_MS : Number(raw);
  if (!Number.isFinite(interval) || interval <= 0) return; // 0/non valido = disabilitato

  started = true;
  const tick = async () => {
    if (running) return; // niente sovrapposizioni: salta se il giro precedente è ancora attivo
    running = true;
    try {
      await collectAllUsers();
    } finally {
      running = false;
    }
  };
  setInterval(() => void tick(), interval);
}
