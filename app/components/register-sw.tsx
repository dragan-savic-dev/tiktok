"use client";

import { useEffect } from "react";

/**
 * Registra il service worker della PWA e, quando ne viene attivato uno nuovo,
 * ricarica una volta la pagina così l'app si aggiorna da sé senza passare da
 * uno store. Non tocca il polling di /api/stats (il SW lo lascia alla rete).
 */
export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
