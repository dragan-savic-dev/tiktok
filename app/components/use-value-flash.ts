"use client";

import { useEffect, useRef, useState } from "react";

export type FlashDir = "up" | "down" | null;

/**
 * Ritorna "up"/"down" per `duration` ms quando il testo visualizzato (`text`)
 * cambia, poi torna a null. Il confronto avviene sul testo e non sul valore
 * grezzo: i valori derivati (percentuali, medie, per-1.000) variano di
 * frazioni invisibili a ogni refresh e lampeggerebbero senza che il numero
 * mostrato cambi. La direzione si giudica sul valore numerico rispetto
 * all'ultimo cambio visibile.
 */
export function useValueFlash(value: number, text: string, duration = 1000): FlashDir {
  const [dir, setDir] = useState<FlashDir>(null);
  const prev = useRef({ value, text });

  // Dipende solo dal testo: se l'effect girasse anche per le variazioni
  // invisibili di `value`, il suo cleanup spegnerebbe il timer del lampeggio
  // in corso senza riarmarlo, lasciando il colore bloccato.
  useEffect(() => {
    if (text === prev.current.text) return;
    const next: FlashDir = value >= prev.current.value ? "up" : "down";
    prev.current = { value, text };
    setDir(next);
    const timer = setTimeout(() => setDir(null), duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value` serve solo quando cambia `text`
  }, [text, duration]);

  return dir;
}
