import { collectStats } from "./collect";
import { listUserTokens } from "./users";

// Raccoglie uno snapshot per ciascun utente il cui access token è ancora valido,
// così lo storico cresce anche ad app chiusa. Usa la stessa cache di /api/stats:
// quando l'app è aperta i dati sono già in cache e non si moltiplicano le
// chiamate a TikTok.
//
// Due modalità:
//   - Locale/VPS (processo persistente): setInterval ogni minuto.
//   - Vercel (serverless): l'interval non è affidabile → ci pensa un Vercel Cron
//     che chiama /api/cron/collect (vedi vercel.json). Qui l'interval viene
//     saltato per non sprecare timer su istanze effimere.
const INTERVAL_MS = 60_000;
const EXPIRY_MARGIN_MS = 60_000;

let started = false;

/** Raccoglie per tutti gli utenti con token valido. Ritorna un piccolo esito. */
export async function collectAllUsers(): Promise<{
  collected: number;
  skipped: number;
}> {
  const users = await listUserTokens();
  const now = Date.now();
  let collected = 0;
  let skipped = 0;
  for (const u of users) {
    // Token scaduto (o quasi): salta. Riprenderà alla prossima visita
    // dell'utente, che rinnova e riscrive il token nello store.
    if (u.expiresAt - EXPIRY_MARGIN_MS <= now) {
      skipped++;
      continue;
    }
    try {
      await collectStats(u.openId, u.accessToken);
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
 * raccolta ad app chiusa la fa il cron.
 */
export function startBackgroundCollection(): void {
  if (started) return;
  if (process.env.VERCEL) return; // su Vercel usa il cron, non l'interval
  started = true;
  setInterval(() => {
    void collectAllUsers();
  }, INTERVAL_MS);
}
