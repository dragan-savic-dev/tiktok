import { DEFAULT_LOCALE, type Locale } from "./messages";

// Locale dei NUMERI, separato dalle stringhe: l'inglese usa "1,234.5" (en-GB,
// non americano su richiesta ma per i numeri è identico), l'italiano "1.234,5".
// È un valore a livello di modulo aggiornato dal LocaleProvider in fase di
// render (client e SSR): l'app è mono-utente, quindi va bene così.

const TAG: Record<Locale, string> = { en: "en-GB", it: "it-IT" };

let current = TAG[DEFAULT_LOCALE];

export function setNumberLocale(locale: Locale): void {
  current = TAG[locale];
}

/** Tag BCP-47 corrente per toLocaleString (es. "en-GB" | "it-IT"). */
export function numberLocale(): string {
  return current;
}
