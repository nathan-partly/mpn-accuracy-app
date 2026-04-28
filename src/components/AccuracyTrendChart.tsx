"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AccuracyTrendPoint } from "@/app/api/accuracy-trend/route";

// ── Metric toggles ────────────────────────────────────────────────────────────
const METRICS = [
  { key: "overall_accuracy_pct", label: "Overall Accuracy %", color: "#1E3A8A", axis: "pct", type: "line" },
  { key: "brands_high",          label: "Brands ≥ 99%",       color: "#E879A0", axis: "count", type: "line" },
  { key: "brands_high_sig",      label: "≥ 99% (sig.)",       color: "#F97316", axis: "count", type: "line" },
  { key: "total_vins",           label: "VINs Checked",       color: "#7C3AED", axis: "volume", type: "bar" },
  { key: "total_parts",          label: "Parts Validated",    color: "#0EA5E9", axis: "volume", type: "bar" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function formatValue(key: MetricKey, v: number): string {
  if (key === "overall_accuracy_pct") return `${v.toFixed(2)}%`;
  if (key === "total_vins" || key === "total_parts") return v.toLocaleString();
  return String(v);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-grey-200 rounded-lg shadow-md px-3 py-2.5 text-xs min-w-44">
      <p className="font-bold text-grey-950 mb-2">{label}</p>
      {payload.map((entry) => {
        const metric = METRICS.find((m) => m.key === entry.dataKey);
        if (!metric) return null;
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-sm flex-shrink-0" style={{ background: entry.color }} />
              <span className="text-grey-500">{metric.label}</span>
            </span>
            <span className="font-semibold text-grey-900 tabular-nums">
              {formatValue(metric.key, entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AccuracyTrendChart() {
  const [data, setData] = useState<AccuracyTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set<MetricKey>(["overall_accuracy_pct", "brands_high", "brands_high_sig"])
  );

  useEffect(() => {
    fetch("/api/accuracy-trend", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: MetricKey) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least one
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const chartData = data.map((d) => ({ ...d, date: formatDate(d.date) }));

  // Determine which axes are needed
  const hasPct    = METRICS.some((m) => m.axis === "pct"    && activeMetrics.has(m.key));
  const hasCount  = METRICS.some((m) => m.axis === "count"  && activeMetrics.has(m.key));
  const hasVolume = METRICS.some((m) => m.axis === "volume" && activeMetrics.has(m.key));

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-grey-400 text-sm">
        Loading trend data…
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="h-40 flex items-center justify-center text-grey-400 text-sm">
        Not enough snapshots yet to show a trend — upload more benchmarks over time.
      </div>
    );
  }

  return (
    <div>
      {/* Metric toggle pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {METRICS.map((m) => {
          const active = activeMetrics.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? "border-transparent text-white"
                  : "border-grey-200 text-grey-400 bg-white hover:border-grey-300"
              }`}
              style={active ? { background: m.color } : {}}
            >
              <span
                className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                style={{ background: active ? "rgba(255,255,255,0.7)" : m.color }}
              />
              {m.label}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 8, right: hasVolume ? 56 : 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#F3F4F6" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
          />

          {/* Left axis: % */}
          {hasPct && (
            <YAxis
              yAxisId="pct"
              domain={[95, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
          )}

          {/* Left axis (fallback): brand count */}
          {!hasPct && hasCount && (
            <YAxis
              yAxisId="count"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
          )}

          {/* Right axis: volume (VINs / parts) */}
          {hasVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
          )}

          {/* Hidden count axis when pct is also shown (so lines don't share the wrong axis) */}
          {hasPct && hasCount && (
            <YAxis yAxisId="count" hide />
          )}

          <Tooltip content={<CustomTooltip />} />

          {METRICS.map((m) => {
            if (!activeMetrics.has(m.key)) return null;
            const axisId = m.axis === "pct" ? "pct" : m.axis === "count" ? "count" : "volume";
            if (m.type === "bar") {
              return (
                <Bar
                  key={m.key}
                  yAxisId={axisId}
                  dataKey={m.key}
                  fill={m.color}
                  opacity={0.25}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                  barSize={18}
                />
              );
            }
            return (
              <Line
                key={m.key}
                yAxisId={axisId}
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2}
                dot={{ r: 3, fill: m.color, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
