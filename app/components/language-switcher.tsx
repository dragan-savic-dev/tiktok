"use client";

import type { ComponentType } from "react";
import type { Locale } from "@/lib/i18n/messages";
import { FlagGB, FlagIT } from "./flags";
import { useLocale } from "./locale-provider";

const OPTIONS: { loc: Locale; Flag: ComponentType<{ className?: string }>; label: string }[] = [
  { loc: "en", Flag: FlagGB, label: "English" },
  { loc: "it", Flag: FlagIT, label: "Italiano" },
];

/** Selettore lingua con bandiere (header). Persiste in cookie + localStorage. */
export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5">
      {OPTIONS.map(({ loc, Flag, label }) => {
        const active = locale === loc;
        return (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={`flex h-7 w-9 items-center justify-center rounded-full transition ${
              active
                ? "bg-white/10 ring-1 ring-tt-cyan"
                : "opacity-45 hover:opacity-100"
            }`}
          >
            <Flag className="h-3.5 w-5 overflow-hidden rounded-[2px]" />
          </button>
        );
      })}
    </div>
  );
}
