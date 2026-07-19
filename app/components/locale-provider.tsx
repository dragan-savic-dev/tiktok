"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { setNumberLocale } from "@/lib/i18n/format";
import { LOCALE_COOKIE, translate, type Locale } from "@/lib/i18n/messages";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (en: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale va usato dentro <LocaleProvider>");
  return ctx;
}

/** Scorciatoia: la sola funzione di traduzione. */
export function useT(): (en: string) => string {
  return useLocale().t;
}

export default function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Allinea il locale dei numeri già in fase di render (anche SSR), così i
  // numeri formattati combaciano tra server e client (niente mismatch).
  setNumberLocale(locale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setNumberLocale(next);
    try {
      localStorage.setItem(LOCALE_COOKIE, next);
    } catch {
      // ignora
    }
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((en: string) => translate(locale, en), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}
