import type { TikTokUser, VideoStats, VideoTotals } from "./types";

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";

export const OAUTH_SCOPES =
  "user.info.basic,user.info.profile,user.info.stats,video.list";

const USER_FIELDS = [
  "open_id",
  "avatar_url",
  "avatar_large_url",
  "display_name",
  "username",
  "is_verified",
  "profile_deep_link",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
].join(",");

const VIDEO_FIELDS = [
  "id",
  "share_url",
  "view_count",
  "like_count",
  "comment_count",
  "share_count",
].join(",");

// /v2/video/list/ ritorna al massimo 20 video a pagina; 50 pagine = 1000
// video, oltre i quali smettiamo per non bruciare il rate limit (600 req/min).
const VIDEO_PAGE_SIZE = 20;
const MAX_VIDEO_PAGES = 50;

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
  token_type: string;
}

export class TikTokApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TikTokApiError";
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.code.includes("access_token");
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile d'ambiente mancante: ${name} (vedi .env.example)`);
  }
  return value;
}

export function appUrl(): string {
  return requireEnv("APP_URL").replace(/\/+$/, "");
}

export function redirectUri(): string {
  return `${appUrl()}/api/auth/callback`;
}

// PKCE è obbligatorio: TikTok rifiuta l'autorizzazione senza code_challenge.
// Attenzione: TikTok vuole lo SHA256 in esadecimale, non in base64url come
// nello standard RFC 7636. code_challenge_method supportato: solo "S256".
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  // base64url usa solo caratteri "unreserved", validi per il code_verifier.
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildAuthUrl(state: string, codeChallenge: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_key", requireEnv("TIKTOK_CLIENT_KEY"));
  url.searchParams.set("scope", OAUTH_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// L'endpoint OAuth usa un formato errore diverso dalla Display API:
// { error, error_description, log_id } con i token al top level.
async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: requireEnv("TIKTOK_CLIENT_KEY"),
      client_secret: requireEnv("TIKTOK_CLIENT_SECRET"),
      ...params,
    }),
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new TikTokApiError(
      body.error_description ?? `Errore OAuth TikTok (HTTP ${res.status})`,
      body.error ?? String(res.status),
      res.status,
    );
  }
  return body as TokenResponse;
}

export function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: codeVerifier,
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function revokeToken(accessToken: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: requireEnv("TIKTOK_CLIENT_KEY"),
      client_secret: requireEnv("TIKTOK_CLIENT_SECRET"),
      token: accessToken,
    }),
    cache: "no-store",
  });
}

interface DisplayEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; log_id?: string };
}

function assertDisplayOk(res: Response, body: DisplayEnvelope<unknown>): void {
  const code = body.error?.code ?? "";
  if (res.ok && (code === "" || code === "ok")) return;
  throw new TikTokApiError(
    body.error?.message || `Errore Display API TikTok (HTTP ${res.status})`,
    code || String(res.status),
    res.status,
  );
}

export async function getUserInfo(accessToken: string): Promise<TikTokUser> {
  const res = await fetch(`${USER_INFO_URL}?fields=${USER_FIELDS}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body: DisplayEnvelope<{ user: TikTokUser }> = await res.json();
  assertDisplayOk(res, body);
  return body.data!.user;
}

export async function getAllVideoStats(accessToken: string): Promise<VideoStats[]> {
  const videos: VideoStats[] = [];
  let cursor: number | undefined;

  for (let page = 0; page < MAX_VIDEO_PAGES; page++) {
    const res = await fetch(`${VIDEO_LIST_URL}?fields=${VIDEO_FIELDS}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        cursor === undefined
          ? { max_count: VIDEO_PAGE_SIZE }
          : { max_count: VIDEO_PAGE_SIZE, cursor },
      ),
      cache: "no-store",
    });
    const body: DisplayEnvelope<{
      videos?: VideoStats[];
      cursor?: number;
      has_more?: boolean;
    }> = await res.json();
    assertDisplayOk(res, body);

    videos.push(...(body.data?.videos ?? []));
    if (!body.data?.has_more) break;
    cursor = body.data.cursor;
  }

  return videos;
}

export function aggregateStats(videos: VideoStats[]): VideoTotals {
  return videos.reduce<VideoTotals>(
    (totals, video) => ({
      views: totals.views + (video.view_count ?? 0),
      likes: totals.likes + (video.like_count ?? 0),
      comments: totals.comments + (video.comment_count ?? 0),
      shares: totals.shares + (video.share_count ?? 0),
      videosCounted: totals.videosCounted + 1,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0, videosCounted: 0 },
  );
}
