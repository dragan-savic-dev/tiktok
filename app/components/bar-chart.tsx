export interface Bar {
  label: string;
  value: number;
}

/**
 * Istogramma verticale a barre stile "Monthly Sale Report", costruito con div
 * in flex (niente libreria). Le barre scalano sul valore massimo; l'altezza è
 * gestita dal contenitore che lo ospita.
 */
export default function BarChart({
  bars,
  color = "#25f4ee",
  className = "",
}: {
  bars: Bar[];
  color?: string;
  className?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div className={`flex h-full items-end gap-1.5 ${className}`}>
      {bars.map((bar, i) => {
        const pct = (bar.value / max) * 100;
        return (
          <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="relative flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md transition-[height] duration-500 ease-out"
                style={{
                  height: `${Math.max(2, pct)}%`,
                  background: `linear-gradient(to top, ${color}22, ${color})`,
                }}
              >
                <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {bar.value.toLocaleString("it-IT")}
                </span>
              </div>
            </div>
            <span className="w-full truncate text-center text-[9px] text-zinc-500">
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
