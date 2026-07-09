"use client";

import { useEffect, useState } from "react";
import { DownloadIcon } from "./icons";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Env {
  ready: boolean;
  ios: boolean;
  installed: boolean;
}

export default function InstallButton({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // ready=false finché non siamo montati sul client: così server e prima render
  // client mostrano entrambi null (nessun mismatch di hydration).
  const [env, setEnv] = useState<Env>({ ready: false, ios: false, installed: false });

  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lettura ambiente una tantum, dopo il mount
    setEnv({ ready: true, ios, installed });

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEnv((s) => ({ ...s, installed: true }));
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!env.ready || env.installed) return null;

  if (env.ios) {
    // In modalità compatta (header) niente testo lungo: l'utente iOS installa
    // dalla landing con l'istruzione Condividi → Aggiungi a Home.
    if (compact) return null;
    return (
      <p className="max-w-xs text-xs text-zinc-500">
        Per installare l’app: tocca <span className="text-zinc-300">Condividi</span> e poi{" "}
        <span className="text-zinc-300">“Aggiungi a Home”</span>.
      </p>
    );
  }

  if (!deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (compact) {
    return (
      <button
        onClick={install}
        title="Installa l’app"
        aria-label="Installa l’app"
        className="flex items-center gap-1.5 rounded-full border border-white/15 px-2 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-tt-cyan/60 hover:text-white sm:px-3 sm:py-1.5"
      >
        <DownloadIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Installa</span>
      </button>
    );
  }

  return (
    <button
      onClick={install}
      className="flex items-center gap-2 rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-tt-cyan/60 hover:text-white"
    >
      <DownloadIcon className="h-4 w-4" />
      Installa l’app
    </button>
  );
}
