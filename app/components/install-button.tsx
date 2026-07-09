"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Env {
  ready: boolean;
  ios: boolean;
  installed: boolean;
}

export default function InstallButton() {
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
    return (
      <p className="max-w-xs text-xs text-zinc-500">
        Per installare l’app: tocca <span className="text-zinc-300">Condividi</span> e poi{" "}
        <span className="text-zinc-300">“Aggiungi a Home”</span>.
      </p>
    );
  }

  if (!deferred) return null;

  return (
    <button
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      }}
      className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-tt-cyan/60 hover:text-white"
    >
      Installa l’app
    </button>
  );
}
