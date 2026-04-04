import clsx from "clsx";

interface AccuracyBadgeProps {
  pct: number | null | undefined;
  size?: "sm" | "lg";
}

export function AccuracyBadge({ pct: rawPct, size = "sm" }: AccuracyBadgeProps) {
  // Postgres NUMERIC comes back as a string — coerce to number
  const pct = rawPct != null ? Number(rawPct) : null;

  if (pct == null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-grey-400 bg-grey-50 border border-grey-100">
        No data
      </span>
    );
  }

  const color =
    pct >= 99
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : pct >= 95
      ? "bg-blue-50 text-brand-blue border-brand-light"
      : pct >= 90
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded font-semibold border",
        color,
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      )}
    >
      {pct.toFixed(2)}%
    </span>
  );
}
