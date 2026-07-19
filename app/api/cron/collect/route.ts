import { NextResponse, type NextRequest } from "next/server";
import { collectAllUsers } from "@/lib/background";

// Endpoint chiamato dal Vercel Cron (vedi vercel.json) per storicizzare su DB
// anche ad app chiusa. Vercel aggiunge l'header Authorization: Bearer
// ${CRON_SECRET} quando la variabile è impostata: lo verifichiamo per evitare
// che chiunque inneschi la raccolta.

// Lo scraping dei "salvati" scarica un lotto di pagine con pause: il default
// di 10s potrebbe non bastare.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await collectAllUsers();
  return NextResponse.json({ ok: true, ...result });
}
