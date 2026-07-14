"use client";

import OdometerNumber from "./odometer-number";
import { useValueFlash } from "./use-value-flash";

/**
 * Il numero "vivo" standard della piattaforma: cifre a rullo stile odometro
 * più lampeggio verde (su) o rosso (giù) per ~1s alla variazione, poi torna
 * al colore ereditato dal contenitore. Da usare per tutti i valori numerici
 * visibili, così l'animazione incremento/decremento è coerente ovunque.
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
    <OdometerNumber
      value={value}
      format={format}
      className={`transition-colors duration-300 ${color} ${className}`}
    />
  );
}
