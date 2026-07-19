import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  translate,
  type Locale,
} from "./messages";

/** Legge la lingua dal cookie lato server (default: inglese). */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** t() lato server per i componenti server (es. la landing). */
export async function getServerT(): Promise<{
  locale: Locale;
  t: (en: string) => string;
}> {
  const locale = await getServerLocale();
  return { locale, t: (en: string) => translate(locale, en) };
}
