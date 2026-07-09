"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Registra il service worker e mostra un popup "Aggiorna" quando un nuovo
 * deploy è pronto. L'utente conferma → il SW in attesa fa skipWaiting → al
 * controllerchange la pagina si ricarica sulla nuova versione. Il polling di
 * /api/stats resta escluso dalla cache, quindi gli aggiornamenti live non si
 * fermano mai.
 */
export default function RegisterSW() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloaded = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => {
      if (reloaded.current) return;
      reloaded.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let interval: ReturnType<typeof setInterval> | undefined;
    let cleanupFocus = () => {};

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        // Mostra il popup solo per un AGGIORNAMENTO (c'è già un SW che controlla
        // la pagina), non alla primissima installazione.
        const promptIfUpdate = (worker: ServiceWorker | null) => {
          if (worker && navigator.serviceWorker.controller) setWaiting(worker);
        };

        promptIfUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const next = registration.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed") promptIfUpdate(next);
          });
        });

        // Controlla nuove versioni periodicamente e al ritorno sulla tab,
        // così il popup compare anche con l'app installata sempre aperta.
        const check = () => registration.update().catch(() => {});
        interval = setInterval(check, 60_000);
        const onFocus = () => check();
        window.addEventListener("focus", onFocus);
        cleanupFocus = () => window.removeEventListener("focus", onFocus);
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (interval) clearInterval(interval);
      cleanupFocus();
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0d0d14]/95 px-5 py-3 shadow-2xl backdrop-blur">
        <span className="text-sm text-zinc-200">È disponibile una nuova versione.</span>
        <button
          onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
          className="rounded-full bg-tt-cyan px-4 py-1.5 text-sm font-semibold text-black transition-transform hover:scale-105"
        >
          Aggiorna
        </button>
      </div>
    </div>
  );
}
