import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getOpenId, getValidAccessToken } from "@/lib/session";
import {
  TikTokApiError,
  aggregateStats,
  getAllVideoStats,
  getUserInfo,
} from "@/lib/tiktok";
import type { StatsResponse } from "@/lib/types";

// TTL sotto i 5s del polling, così ogni ciclo del client trova dati freschi
// ma più tab aperte condividono la stessa chiamata a TikTok.
const USER_TTL_MS = 4500;

// L'aggregato costa ceil(video_count/20) richieste a /v2/video/list/: con
// tanti video si allunga il TTL per restare lontani dal limite di 600 req/min.
function videoTtlMs(videoCount: number): number {
  const pages = Math.max(1, Math.ceil(videoCount / 20));
  if (pages <= 3) return 4500;
  if (pages <= 10) return 15_000;
  return 30_000;
}

export async function GET() {
  const accessToken = await getValidAccessToken();
  const openId = await getOpenId();
  if (!accessToken || !openId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const user = await getOrFetch(`user:${openId}`, USER_TTL_MS, () =>
      getUserInfo(accessToken),
    );
    const totals = await getOrFetch(
      `videos:${openId}`,
      videoTtlMs(user.video_count ?? 0),
      async () => aggregateStats(await getAllVideoStats(accessToken)),
    );

    const payload: StatsResponse = { user, totals, fetchedAt: Date.now() };
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof TikTokApiError && err.isAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Errore /api/stats:", err);
    return NextResponse.json(
      { error: "tiktok_api_error", message },
      { status: 502 },
    );
  }
}
