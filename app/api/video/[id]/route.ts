import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getOpenId, getValidAccessToken } from "@/lib/session";
import { queryVideoStats, TikTokApiError } from "@/lib/tiktok";

// TTL sotto i 5s del polling del client: il singolo video aperto si aggiorna
// a ogni ciclo anche quando la lista completa (più costosa) ha TTL più lungo.
const VIDEO_TTL_MS = 4500;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accessToken = await getValidAccessToken();
  const openId = await getOpenId();
  if (!accessToken || !openId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const videos = await getOrFetch(`video:${openId}:${id}`, VIDEO_TTL_MS, () =>
      queryVideoStats(accessToken, [id]),
    );
    const video = videos[0] ?? null;
    if (!video) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ video, fetchedAt: Date.now() });
  } catch (err) {
    if (err instanceof TikTokApiError && err.isAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Errore /api/video/[id]:", err);
    return NextResponse.json({ error: "tiktok_api_error", message }, { status: 502 });
  }
}
