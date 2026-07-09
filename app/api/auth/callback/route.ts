import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, setAuthCookies } from "@/lib/session";
import { appUrl, exchangeCode } from "@/lib/tiktok";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (oauthError) {
    return NextResponse.redirect(new URL(`/?error=${oauthError}`, appUrl()));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", appUrl()));
  }

  try {
    const token = await exchangeCode(code);
    await setAuthCookies(token);
    return NextResponse.redirect(new URL("/dashboard", appUrl()));
  } catch (err) {
    console.error("Scambio code->token fallito:", err);
    return NextResponse.redirect(new URL("/?error=token_exchange_failed", appUrl()));
  }
}
