import { collectStats } from "./collect";
import { listUserTokens } from "./users";

// Ogni minuto raccoglie uno snapshot per ciascun utente il cui access token è
// ancora valido, così lo storico cresce anche ad app chiusa. Usa la stessa
// cache di /api/stats: quando l'app è aperta i dati sono già in cache e non si
// moltiplicano le chiamate a TikTok.
const INTERVAL_MS = 60_000;
const EXPIRY_MARGIN_MS = 60_000;

let started = false;

async function tick(): Promise<void> {
  const users = await listUserTokens();
  const now = Date.now();
  for (const u of users) {
    // Token scaduto (o quasi): salta. Riprenderà alla prossima visita
    // dell'utente, che rinnova e riscrive il token nello store.
    if (u.expiresAt - EXPIRY_MARGIN_MS <= now) continue;
    try {
      await collectStats(u.openId, u.accessToken);
    } catch {
      // best-effort: un utente che fallisce non blocca gli altri
    }
  }
}

/** Avvia il ciclo di raccolta. Idempotente: parte una sola volta per processo. */
export function startBackgroundCollection(): void {
  if (started) return;
  started = true;
  setInterval(() => {
    void tick();
  }, INTERVAL_MS);
}
