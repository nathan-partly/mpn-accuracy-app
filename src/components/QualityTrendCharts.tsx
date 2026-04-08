"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { QualityTrendRow } from "@/types";

// ─── Colour palette ───────────────────────────────────────────────────────────
// 20 visually distinct hues that work on white backgrounds
const PALETTE = [
  "#3632FF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#14B8A6",
  "#6366F1", "#D97706", "#DC2626", "#059669", "#7C3AED",
  "#0284C7", "#DB2777", "#65A30D", "#EA580C", "#0F766E",
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChartDataPoint {
  date: string;
  [brand: string]: string | number | null;
}

interface Props {
  rows: QualityTrendRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatAxisDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "d MMM yy");
  } catch {
    return dateStr;
  }
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const sorted = [...payload]
    .filter((p) => p.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="bg-white border border-grey-100 shadow-lg rounded-lg p-3 text-xs max-w-64">
      <p className="font-semibold text-grey-950 mb-2">{label ? formatAxisDate(label) : ""}</p>
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {sorted.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="text-grey-700">{p.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-grey-950">
              {p.value != null ? `${Number(p.value).toFixed(1)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function QualityTrendCharts({ rows }: Props) {
  if (rows.length === 0) return null;

  // Get sorted unique dates and brands
  const dates = Array.from(new Set(rows.map((r) => r.snapshot_date))).sort();
  const brands = Array.from(new Set(rows.map((r) => r.brand))).sort();

  if (dates.length < 2) {
    return (
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-8">
        <div className="h-1 bg-brand-blue" />
        <div className="px-5 py-10 text-center text-sm text-grey-400">
          Upload at least 2 snapshots to see trend charts.
        </div>
      </div>
    );
  }

  // Build chart data — one point per date, keyed by brand
  const classificationData: ChartDataPoint[] = dates.map((date) => {
    const point: ChartDataPoint = { date };
    for (const brand of brands) {
      const row = rows.find((r) => r.snapshot_date === date && r.brand === brand);
      point[brand] = row?.classification_pct != null ? Number(row.classification_pct) : null;
    }
    return point;
  });

  const annotationData: ChartDataPoint[] = dates.map((date) => {
    const point: ChartDataPoint = { date };
    for (const brand of brands) {
      const row = rows.find((r) => r.snapshot_date === date && r.brand === brand);
      point[brand] = row?.annotation_pct != null ? Number(row.annotation_pct) : null;
    }
    return point;
  });

  const brandColor = (i: number) => PALETTE[i % PALETTE.length];

  const commonLineProps = {
    type: "monotone" as const,
    dot: dates.length <= 6,
    activeDot: { r: 4 },
    connectNulls: false,
    strokeWidth: 1.5,
  };

  const sharedChart = (data: ChartDataPoint[], title: string) => (
    <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-6">
      <div className="h-1 bg-brand-blue" />
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <ReferenceLine y={80} stroke="#C5C4FF" strokeDasharray="4 4" label={{ value: "L2 80%", position: "insideTopRight", fontSize: 10, fill: "#9CA3AF" }} />
            <ReferenceLine y={20} stroke="#E5E7EB" strokeDasharray="4 4" label={{ value: "L1 20%", position: "insideTopRight", fontSize: 10, fill: "#9CA3AF" }} />
            <Tooltip content={<CustomTooltip />} />
            {brands.map((brand, i) => (
              <Line
                key={brand}
                {...commonLineProps}
                dataKey={brand}
                stroke={brandColor(i)}
                name={brand}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <>
      {sharedChart(classificationData, "Classification Coverage Over Time")}
      {sharedChart(annotationData, "Annotation Coverage Over Time")}
    </>
  );
}
