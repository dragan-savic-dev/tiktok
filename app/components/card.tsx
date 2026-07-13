import type { ReactNode } from "react";

/** Pannello con intestazione opzionale, come i riquadri della dashboard di riferimento. */
export function Card({
  title,
  action,
  children,
  bodyClassName = "",
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3 sm:px-5">
          {title && (
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className={`flex-1 p-4 sm:p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Voce di legenda: pallino colorato + etichetta + valore. */
export function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-zinc-400">{label}</span>
      <span className="ml-auto font-semibold text-white">{value}</span>
    </div>
  );
}
