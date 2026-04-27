"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";
import type { RoadmapBrand } from "@/app/api/coverage-roadmap/route";

// ── Quarter colour palette ─────────────────────────────────────────────────────
// Matches the feel of the reference screenshot: light green base, then vivid
// accent colours for upcoming quarters.
const TODAY_COLOR = "#D1FAE5";   // light green
const TODAY_BORDER = "#6EE7B7"; // subtle border on "today" segment

const QUARTER_COLORS: Record<number, string> = {
  0: "#1E3A8A",  // dark navy  — first upcoming quarter
  1: "#E879A0",  // rose/pink  — second
  2: "#F97316",  // orange     — third
  3: "#7C3AED",  // violet     — fourth
  4: "#0EA5E9",  // sky        — fifth+
};

function quarterColor(index: number): string {
  return QUARTER_COLORS[index] ?? QUARTER_COLORS[4];
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  payload: RoadmapBrand;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="bg-white border border-grey-200 rounded-lg shadow-md px-3 py-2 text-xs"
      style={{ minWidth: 160 }}
    >
      <p className="font-bold text-grey-950 mb-2">{label}</p>
      {payload.map((entry) => {
        if (!entry.value || entry.name === "today" && entry.value === 0) return null;
        return (
          <div key={entry.name} className="flex items-center justify-between gap-4 mb-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-grey-600">
                {entry.name === "today" ? "Current coverage" : `From ${entry.name} integration`}
              </span>
            </span>
            <span className="font-semibold text-grey-900 tabular-nums">
              {entry.value.toFixed(1)}%
            </span>
          </div>
        );
      })}
      {/* Total */}
      {(() => {
        const total = payload.reduce((sum, e) => sum + (e.value || 0), 0);
        return (
          <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-grey-100">
            <span className="text-grey-500">Total coverage</span>
            <span className="font-bold text-grey-950 tabular-nums">{Math.min(100, total).toFixed(1)}%</span>
          </div>
        );
      })()}
    </div>
  );
}

// ── Custom legend ──────────────────────────────────────────────────────────────
function CustomLegend({ quarters }: { quarters: string[] }) {
  const items = [
    { label: "Today", color: TODAY_COLOR, border: TODAY_BORDER },
    ...quarters.map((q, i) => ({ label: q, color: quarterColor(i), border: undefined })),
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-2 pb-1">
      {items.map(({ label, color, border }) => (
        <span key={label} className="flex items-center gap-1.5 text-xs text-grey-600">
          <span
            className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: color, border: border ? `1.5px solid ${border}` : undefined }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Main chart ─────────────────────────────────────────────────────────────────
interface Props {
  data: RoadmapBrand[];
  quarters: string[];
}

export function CoverageRoadmapChart({ data, quarters }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-grey-400 text-sm">
        No coverage data available
      </div>
    );
  }

  // Width: at least 900px, 28px per brand
  const chartWidth = Math.max(900, data.length * 28);
  const chartHeight = 280;

  return (
    <div>
      <div className="overflow-x-auto w-full">
        <div style={{ width: chartWidth }}>
          <BarChart
            width={chartWidth}
            height={chartHeight}
            data={data}
            margin={{ top: 8, right: 16, bottom: 60, left: 0 }}
            barCategoryGap="25%"
          >
            <CartesianGrid stroke="#F3F4F6" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="brand"
              tick={{ fontSize: 10, fill: "#6B7280" }}
              axisLine={false}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#6B7280" }}
              axisLine={false}
              tickLine={false}
              width={42}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(54, 50, 255, 0.04)" }} />
            <ReferenceLine y={100} stroke="#E5E7EB" strokeDasharray="3 3" />

            {/* Today's coverage */}
            <Bar dataKey="today" stackId="coverage" fill={TODAY_COLOR} stroke={TODAY_BORDER} strokeWidth={0.5} isAnimationActive={false} />

            {/* One bar per upcoming quarter */}
            {quarters.map((q, i) => (
              <Bar
                key={q}
                dataKey={q}
                stackId="coverage"
                fill={quarterColor(i)}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </div>
      </div>

      <CustomLegend quarters={quarters} />
    </div>
  );
}
