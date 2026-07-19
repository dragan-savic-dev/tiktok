import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getOpenId, getValidAccessToken } from "@/lib/session";
import { queryVideoStats, TikTokApiError } from "@/lib/tiktok";
import { scrapeVideoSaved } from "@/lib/tiktok-scrape";

// Scraping ON-DEMAND dei "salvati" (collectCount) di un singolo video, innescato
// dal pulsante manuale nella pagina del video. Recupera lo share_url via
// Display API (cache condivisa col fresh video), poi scrapa e persiste.
export const maxDuration = 30;

export async function POST(
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
    const videos = await getOrFetch(`video:${openId}:${id}`, 4500, () =>
      queryVideoStats(accessToken, [id]),
    );
    const video = videos[0];
    if (!video) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const saved = await scrapeVideoSaved(openId, video);
    return NextResponse.json({ saved, videoId: id, fetchedAt: Date.now() });
  } catch (err) {
    if (err instanceof TikTokApiError && err.isAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Errore /api/video/[id]/scrape:", err);
    return NextResponse.json({ error: "scrape_failed", message }, { status: 502 });
  }
}
