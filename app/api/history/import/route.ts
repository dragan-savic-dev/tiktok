import { NextResponse, type NextRequest } from "next/server";
import { hasDb, upsertUser } from "@/lib/db";
import { importSnapshots } from "@/lib/history";
import { getOpenId } from "@/lib/session";
import type { HistorySnapshot } from "@/lib/types";

// Import degli snapshot accumulati nel localStorage del client (il "sync dal
// telefono"): li carica nello storico DB. Idempotente. Una volta importati, il
// client smette di salvare in localStorage perché ci pensa il server.

export const maxDuration = 60;

// Tetto di sicurezza: 120 giorni a 1/min ~ 173k, arrotondiamo abbondante.
const MAX_SNAPSHOTS = 250_000;

export async function POST(request: NextRequest) {
  const openId = await getOpenId();
  if (!openId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasDb()) {
    return NextResponse.json(
      { error: "db_disabled", message: "DATABASE_URL non configurato" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const raw = (body as { snapshots?: unknown })?.snapshots;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const snapshots = raw.slice(0, MAX_SNAPSHOTS) as HistorySnapshot[];

  try {
    await upsertUser(openId);
    const imported = await importSnapshots(openId, snapshots);
    return NextResponse.json({ imported, received: snapshots.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Errore /api/history/import:", err);
    return NextResponse.json(
      { error: "import_failed", message },
      { status: 500 },
    );
  }
}
