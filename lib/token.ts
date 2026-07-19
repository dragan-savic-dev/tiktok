import { refreshAccessToken, type TokenResponse } from "./tiktok";
import { getStoredToken, saveFullToken } from "./users";

// Fonte unica di verità per gli access token, lato server. Sia il cron di
// raccolta sia le route della dashboard passano da qui: così esiste UN solo
// refresh token (nello store), rinnovato in un unico punto. Niente più due
// copie (browser vs server) che, ruotando, si invaliderebbero a vicenda.

// Rinnova quando manca meno di questo margine alla scadenza dell'access token,
// così nessuna chiamata parte con un token sul punto di morire.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

// Serializza i refresh per-utente nel processo: TikTok ruota il refresh token a
// ogni rinnovo, quindi due refresh concorrenti con lo stesso token farebbero
// fallire il secondo. Su un server persistente (un solo processo) questo lock in
// memoria basta a coordinare cron e richieste del browser.
const refreshInFlight = new Map<string, Promise<TokenResponse>>();

export interface ValidToken {
  accessToken: string;
  /** Epoch ms di scadenza dell'access token. */
  expiresAt: number;
}

/** Persiste l'intero token (access + refresh) mappando la risposta OAuth. */
export async function persistToken(token: TokenResponse): Promise<void> {
  const now = Date.now();
  await saveFullToken({
    openId: token.open_id,
    accessToken: token.access_token,
    expiresAt: now + token.expires_in * 1000,
    refreshToken: token.refresh_token,
    refreshExpiresAt: now + token.refresh_expires_in * 1000,
  });
}

/**
 * Ritorna un access token valido per l'utente, rinnovandolo col refresh token
 * salvato quando serve e riscrivendo quello ruotato nello store. Ritorna null se
 * non c'è un token recuperabile (nessuna sessione, refresh assente o rifiutato).
 */
export async function getValidAccessTokenFor(
  openId: string,
): Promise<ValidToken | null> {
  const stored = await getStoredToken(openId);
  if (!stored) return null;

  if (stored.accessToken && Date.now() < stored.expiresAt - REFRESH_MARGIN_MS) {
    return { accessToken: stored.accessToken, expiresAt: stored.expiresAt };
  }
  if (!stored.refreshToken) return null;

  try {
    let pending = refreshInFlight.get(openId);
    if (!pending) {
      pending = refreshAccessToken(stored.refreshToken).finally(() =>
        refreshInFlight.delete(openId),
      );
      refreshInFlight.set(openId, pending);
    }
    const token = await pending;
    await persistToken(token);
    return {
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    };
  } catch {
    return null;
  }
}
