"use client";

import OdometerNumber, { defaultNumberFormat } from "./odometer-number";
import { useValueFlash } from "./use-value-flash";

/**
 * Il numero "vivo" standard della piattaforma: cifre a rullo stile odometro
 * più lampeggio verde (su) o rosso (giù) per ~1s, poi torna al colore
 * ereditato dal contenitore. Lampeggia solo quando cambia il numero
 * effettivamente mostrato: le variazioni invisibili (decimali arrotondati
 * via) non producono animazione.
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
  const text = format ? format(value) : defaultNumberFormat(value);
  const dir = useValueFlash(value, text);
  const color = dir === "up" ? "text-emerald-400" : dir === "down" ? "text-tt-pink" : "";
  return (
    <OdometerNumber
      value={value}
      format={() => text}
      className={`transition-colors duration-300 ${color} ${className}`}
    />
  );
}
