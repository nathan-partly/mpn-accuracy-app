import clsx from "clsx";

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}

export function KpiCard({ label, value, sub, highlight }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-brand-blue" />
      <div className="p-5">
        <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-2">
          {label}
        </p>
        <p
          className={clsx(
            "text-3xl font-bold",
            highlight ? "text-brand-blue" : "text-grey-950"
          )}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-grey-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
