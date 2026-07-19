"use client";

import { useId } from "react";

// Bandiere in SVG (non emoji: su Windows le flag emoji si vedono come "GB"/"IT",
// non come bandiere). Inglese = Union Jack (UK), come richiesto (niente USA).

type FlagProps = { className?: string };

export function FlagGB({ className = "" }: FlagProps) {
  const uid = useId().replace(/:/g, "");
  const clipT = `gb-t-${uid}`;
  const clipS = `gb-s-${uid}`;
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
      <clipPath id={clipT}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={clipS}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#${clipT})`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clipPath={`url(#${clipS})`}
          stroke="#C8102E"
          strokeWidth="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

export function FlagIT({ className = "" }: FlagProps) {
  return (
    <svg viewBox="0 0 3 2" className={className} aria-hidden="true">
      <rect width="3" height="2" fill="#fff" />
      <rect width="1" height="2" fill="#009246" />
      <rect x="2" width="1" height="2" fill="#CE2B37" />
    </svg>
  );
}
