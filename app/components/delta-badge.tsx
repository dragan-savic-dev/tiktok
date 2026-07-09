import OdometerNumber from "./odometer-number";

/** Badge ±N con le stesse cifre a rullo dei contatori. */
export default function DeltaBadge({
  delta,
  className = "",
}: {
  delta?: number;
  className?: string;
}) {
  if (delta === undefined || delta === 0) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${
        delta > 0 ? "bg-emerald-400/10 text-emerald-400" : "bg-tt-pink/10 text-tt-pink"
      } ${className}`}
    >
      <span className="leading-none">{delta > 0 ? "+" : "−"}</span>
      <OdometerNumber value={Math.abs(delta)} />
    </span>
  );
}
