import { redirect } from "next/navigation";
import { getServerT } from "@/lib/i18n/server";
import { hasSession } from "@/lib/session";
import { TikTokIcon } from "./components/icons";
import InstallButton from "./components/install-button";

const ERROR_KEYS: Record<string, string> = {
  access_denied: "You denied access on TikTok.",
  invalid_state: "Security check failed: try again.",
  token_exchange_failed: "Couldn’t complete sign-in: try again.",
  session_expired: "Your session expired: sign in again.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasSession()) redirect("/dashboard");

  const { t } = await getServerT();
  const { error } = await searchParams;
  const errorMessage = error
    ? t(ERROR_KEYS[error] ?? "An error occurred: try again.")
    : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <TikTokIcon className="h-14 w-14 text-white drop-shadow-[0_0_25px_rgba(37,244,238,0.5)]" />
        <h1 className="text-4xl font-bold text-white sm:text-5xl">
          TikTok <span className="text-tt-cyan">Live</span>{" "}
          <span className="text-tt-pink">Stats</span>
        </h1>
        <p className="max-w-md text-zinc-400">
          {t(
            "Sign in with your TikTok account and watch followers, views, likes, comments and shares across all your videos update in real time, every 5 seconds.",
          )}
        </p>
      </div>

      {errorMessage && (
        <p className="rounded-xl border border-tt-pink/40 bg-tt-pink/10 px-4 py-3 text-sm text-tt-pink">
          {errorMessage}
        </p>
      )}

      <a
        href="/api/auth/login"
        className="flex items-center gap-3 rounded-full bg-tt-pink px-8 py-4 text-base font-semibold text-white transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(254,44,85,0.45)]"
      >
        <TikTokIcon className="h-5 w-5" />
        {t("Continue with TikTok")}
      </a>

      <InstallButton />

      <p className="max-w-sm text-xs text-zinc-600">
        {t(
          "No data is stored: access tokens live in httpOnly cookies and stats in a temporary in-memory cache.",
        )}
      </p>
    </main>
  );
}
