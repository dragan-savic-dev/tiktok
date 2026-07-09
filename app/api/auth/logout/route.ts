import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/session";
import { appUrl, revokeToken } from "@/lib/tiktok";

export async function GET() {
  const store = await cookies();
  const accessToken = store.get("tt_access_token")?.value;

  if (accessToken) {
    try {
      await revokeToken(accessToken);
    } catch {
      // La revoca è best-effort: i cookie vengono comunque cancellati.
    }
  }

  await clearAuthCookies();
  return NextResponse.redirect(new URL("/", appUrl()));
}
