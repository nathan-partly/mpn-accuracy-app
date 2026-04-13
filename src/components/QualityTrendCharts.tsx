"use client";

import { useState, useCallback } from "react";
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
const PALETTE = [
  "#3632FF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#14B8A6",
  "#6366F1", "#D97706", "#DC2626", "#059669", "#7C3AED",
  "#0284C7", "#DB2777", "#65A30D", "#EA580C", "#0F766E",
];

const TOP_N = 10; // brands visible by default

interface ChartDataPoint {
  date: string;
  [brand: string]: string | number | null;
}

interface Props {
  rows: QualityTrendRow[];
}

function formatAxisDate(dateStr: string) {
  try { return format(parseISO(dateStr), "d MMM yy"); } catch { return dateStr; }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function CustomTooltip({
  active,
  payload,
  label,
  visibleBrands,
}: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?: string;
  visibleBrands: Set<string>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const sorted = [...payload]
    .filter((p) => p.value != null && visibleBrands.has(p.name))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="bg-white border border-grey-100 shadow-lg rounded-lg p-3 text-xs max-w-64">
      <p className="font-semibold text-grey-950 mb-2">{label ? formatAxisDate(label) : ""}</p>
      <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
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

// ─── Legend ───────────────────────────────────────────────────────────────────
function BrandLegend({
  brands,
  allBrands,
  colorMap,
  visibleBrands,
  hoveredBrand,
  onToggle,
  onHover,
  showAll,
  onToggleShowAll,
  onSelectAll,
  onDeselectAll,
}: {
  brands: string[];
  allBrands: string[];
  colorMap: Map<string, string>;
  visibleBrands: Set<string>;
  hoveredBrand: string | null;
  onToggle: (brand: string) => void;
  onHover: (brand: string | null) => void;
  showAll: boolean;
  onToggleShowAll: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const allOn  = allBrands.every((b) => visibleBrands.has(b));
  const noneOn = allBrands.every((b) => !visibleBrands.has(b));

  return (
    <div className="px-5 pb-4">
      {/* Select / deselect all controls */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onSelectAll}
          disabled={allOn}
          className="text-xs font-semibold text-brand-blue hover:underline disabled:text-grey-300 disabled:no-underline transition-colors"
        >
          Select all
        </button>
        <span className="text-grey-200 text-xs">|</span>
        <button
          onClick={onDeselectAll}
          disabled={noneOn}
          className="text-xs font-semibold text-grey-400 hover:text-grey-700 hover:underline disabled:text-grey-200 disabled:no-underline transition-colors"
        >
          Deselect all
        </button>
        <span className="text-xs text-grey-300 ml-1">
          {visibleBrands.size} / {allBrands.length} shown
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {brands.map((brand) => {
          const color = colorMap.get(brand) ?? "#ccc";
          const isOn = visibleBrands.has(brand);
          const isHovered = hoveredBrand === brand;
          return (
            <button
              key={brand}
              onClick={() => onToggle(brand)}
              onMouseEnter={() => onHover(brand)}
              onMouseLeave={() => onHover(null)}
              className={`
                flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                border transition-all duration-100 cursor-pointer select-none
                ${isOn
                  ? "border-transparent text-grey-900"
                  : "border-grey-200 text-grey-400 bg-white"
                }
                ${isHovered ? "ring-2 ring-offset-1" : ""}
              `}
              style={isOn ? { backgroundColor: `${color}18`, color, borderColor: `${color}40` } : {}}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 transition-opacity"
                style={{ backgroundColor: color, opacity: isOn ? 1 : 0.3 }}
              />
              {brand}
            </button>
          );
        })}
        <button
          onClick={onToggleShowAll}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-grey-200 text-grey-500 hover:border-grey-400 hover:text-grey-700 transition-colors cursor-pointer"
        >
          {showAll ? "Collapse" : `+${allBrands.length - TOP_N} more`}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function QualityTrendCharts({ rows }: Props) {
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (rows.length === 0) return null;

  const dates = Array.from(new Set(rows.map((r) => r.snapshot_date))).sort();
  const latestDate = dates[dates.length - 1];

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

  // Sort brands by latest classification_pct descending so top brands are first
  const allBrands = Array.from(new Set(rows.map((r) => r.brand))).sort((a, b) => {
    const aVal = rows.find((r) => r.snapshot_date === latestDate && r.brand === a)?.classification_pct ?? -1;
    const bVal = rows.find((r) => r.snapshot_date === latestDate && r.brand === b)?.classification_pct ?? -1;
    return (bVal as number) - (aVal as number);
  });

  const visibleBrandList = showAll ? allBrands : allBrands.slice(0, TOP_N);

  // Colour map — stable across all brands regardless of showAll
  const colorMap = new Map(allBrands.map((b, i) => [b, PALETTE[i % PALETTE.length]]));

  // ── Per-chart state ──────────────────────────────────────────────────────
  const [classVisible, setClassVisible] = useState<Set<string>>(
    () => new Set(allBrands.slice(0, TOP_N))
  );
  const [annotVisible, setAnnotVisible] = useState<Set<string>>(
    () => new Set(allBrands.slice(0, TOP_N))
  );

  const makeToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    (brand: string) => {
      setter((prev) => {
        const next = new Set(prev);
        next.has(brand) ? next.delete(brand) : next.add(brand);
        return next;
      });
    };

  const makeSelectAll   = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    () => setter(new Set(allBrands));
  const makeDeselectAll = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    () => setter(new Set());

  const buildData = (key: "classification_pct" | "annotation_pct"): ChartDataPoint[] =>
    dates.map((date) => {
      const point: ChartDataPoint = { date };
      for (const brand of allBrands) {
        const row = rows.find((r) => r.snapshot_date === date && r.brand === brand);
        point[brand] = row?.[key] != null ? Number(row[key]) : null;
      }
      return point;
    });

  const classificationData = buildData("classification_pct");
  const annotationData = buildData("annotation_pct");

  const renderChart = (
    data: ChartDataPoint[],
    title: string,
    visibleBrands: Set<string>,
    onToggle: (brand: string) => void,
    onSelectAll: () => void,
    onDeselectAll: () => void,
  ) => (
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
            <Tooltip content={<CustomTooltip visibleBrands={visibleBrands} />} />
            {allBrands.map((brand) => {
              const color = colorMap.get(brand) ?? "#ccc";
              const isVisible = visibleBrands.has(brand);
              const isHovered = hoveredBrand === brand;
              if (!isVisible) return null;
              return (
                <Line
                  key={brand}
                  type="monotone"
                  dataKey={brand}
                  stroke={color}
                  name={brand}
                  dot={dates.length <= 6}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  strokeWidth={isHovered ? 3 : hoveredBrand ? 1 : 1.5}
                  strokeOpacity={hoveredBrand && !isHovered ? 0.2 : 1}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <BrandLegend
        brands={visibleBrandList}
        allBrands={allBrands}
        colorMap={colorMap}
        visibleBrands={visibleBrands}
        hoveredBrand={hoveredBrand}
        onToggle={onToggle}
        onHover={setHoveredBrand}
        showAll={showAll}
        onToggleShowAll={() => {
          setShowAll((s) => !s);
          // When expanding, add new brands to visible set by default
          if (!showAll) {
            const newBrands = allBrands.slice(TOP_N);
            setClassVisible((prev) => new Set(Array.from(prev).concat(newBrands)));
            setAnnotVisible((prev) => new Set(Array.from(prev).concat(newBrands)));
          }
        }}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
      />
    </div>
  );

  return (
    <>
      {renderChart(classificationData, "Classification Coverage Over Time", classVisible, makeToggle(setClassVisible), makeSelectAll(setClassVisible), makeDeselectAll(setClassVisible))}
      {renderChart(annotationData, "Annotation Coverage Over Time", annotVisible, makeToggle(setAnnotVisible), makeSelectAll(setAnnotVisible), makeDeselectAll(setAnnotVisible))}
    </>
  );
}
