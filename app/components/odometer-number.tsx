import { numberLocale } from "@/lib/i18n/format";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Formato di default dei contatori: intero non negativo, nel locale corrente. */
export function defaultNumberFormat(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString(numberLocale());
}

function RollingDigit({ digit }: { digit: number }) {
  return (
    <span className="inline-block h-[1em] w-[1ch] overflow-hidden">
      <span
        className="flex flex-col transition-transform duration-700 ease-out will-change-transform"
        style={{ transform: `translateY(-${digit}em)` }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="h-[1em] leading-none">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Numero con cifre "a rullo" stile odometro (come i live counter tipo
 * TokCount): ogni cifra è una colonna 0-9 traslata via CSS transform,
 * così i cambi di valore scorrono invece di scattare. `format` permette
 * testi come "12,3%" o "1,2 Mln": i caratteri non numerici passano intatti.
 */
export default function OdometerNumber({
  value,
  format,
  className = "",
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const text = format ? format(value) : defaultNumberFormat(value);
  const chars = text.split("");

  return (
    <span className={`inline-flex tabular-nums leading-none ${className}`}>
      {chars.map((ch, i) => {
        // Chiave relativa alla fine del numero: quando il valore cresce di
        // una cifra, quelle a destra mantengono identità e non ri-animano.
        const key = chars.length - i;
        return /\d/.test(ch) ? (
          <RollingDigit key={key} digit={Number(ch)} />
        ) : (
          <span key={key} className="inline-block h-[1em] overflow-hidden leading-none">
            {ch}
          </span>
        );
      })}
    </span>
  );
}
