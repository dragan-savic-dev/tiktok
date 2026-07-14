"use client";

import { useEffect, useRef, useState } from "react";

export type FlashDir = "up" | "down" | null;

/**
 * Ritorna "up"/"down" per `duration` ms quando `value` cambia, poi torna a
 * null. Serve al "lampeggio" verde/rosso transitorio sui valori che si
 * aggiornano: il colore non resta, appare solo un istante alla variazione.
 * Traccia il valore precedente internamente, quindi ogni istanza (es. una
 * cella di tabella con key stabile) si ricorda il proprio.
 */
export function useValueFlash(value: number, duration = 1000): FlashDir {
  const [dir, setDir] = useState<FlashDir>(null);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const next: FlashDir = value > prev.current ? "up" : "down";
    prev.current = value;
    setDir(next);
    const timer = setTimeout(() => setDir(null), duration);
    return () => clearTimeout(timer);
  }, [value, duration]);

  return dir;
}
