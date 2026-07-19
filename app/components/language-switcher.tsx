"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { Locale } from "@/lib/i18n/messages";
import { FlagES, FlagGB, FlagIT } from "./flags";
import { ChevronDownIcon } from "./icons";
import { useLocale } from "./locale-provider";

const OPTIONS: {
  loc: Locale;
  Flag: ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { loc: "en", Flag: FlagGB, label: "English" },
  { loc: "it", Flag: FlagIT, label: "Italiano" },
  { loc: "es", Flag: FlagES, label: "Español" },
];

/** Selettore lingua a menu (dropdown) con bandiere. Persiste in cookie + localStorage. */
export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.loc === locale) ?? OPTIONS[0];
  const CurrentFlag = current.Flag;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current.label}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-tt-cyan/60 hover:text-white"
      >
        <CurrentFlag className="h-3.5 w-5 overflow-hidden rounded-[2px]" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1.5 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#141414] py-1 shadow-xl"
        >
          {OPTIONS.map(({ loc, Flag, label }) => {
            const active = locale === loc;
            return (
              <li key={loc}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLocale(loc);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Flag className="h-3.5 w-5 overflow-hidden rounded-[2px]" />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
