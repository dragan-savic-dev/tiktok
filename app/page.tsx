import { redirect } from "next/navigation";
import { hasSession } from "@/lib/session";
import { TikTokIcon } from "./components/icons";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Hai negato l’accesso su TikTok.",
  invalid_state: "Verifica di sicurezza non superata: riprova.",
  token_exchange_failed: "Non sono riuscito a completare l’accesso: riprova.",
  session_expired: "La sessione è scaduta: accedi di nuovo.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasSession()) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "Si è verificato un errore: riprova.")
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
          Accedi col tuo account TikTok e guarda follower, visualizzazioni, mi
          piace, commenti e condivisioni di tutti i tuoi video aggiornarsi in
          tempo reale, ogni 5 secondi.
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
        Continua con TikTok
      </a>

      <p className="max-w-sm text-xs text-zinc-600">
        Nessun dato viene salvato: i token di accesso vivono in cookie httpOnly
        e le statistiche in una cache temporanea in memoria.
      </p>
    </main>
  );
}
