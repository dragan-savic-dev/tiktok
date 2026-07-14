"use client";

import { useValueFlash } from "./use-value-flash";

/**
 * Numero che lampeggia verde (su) o rosso (giù) per ~1s alla variazione, poi
 * torna al colore ereditato dal contenitore. Da usare per tutti i valori "vivi"
 * della piattaforma, così l'animazione incremento/decremento è coerente.
 */
export default function FlashNumber({
  value,
  format,
  className = "",
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const dir = useValueFlash(value);
  const color = dir === "up" ? "text-emerald-400" : dir === "down" ? "text-tt-pink" : "";
  return (
    <span className={`transition-colors duration-300 ${color} ${className}`}>
      {format ? format(value) : value.toLocaleString("it-IT")}
    </span>
  );
}
