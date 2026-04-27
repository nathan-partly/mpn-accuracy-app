"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RoadmapBrand, RoadmapResponse, Market } from "@/app/api/coverage-roadmap/route";

// ── Colours ───────────────────────────────────────────────────────────────────
const TODAY_COLOR  = "#BBFCE8";
const TODAY_STROKE = "#6EE7B7";
const QUARTER_COLORS = ["#1E3A8A", "#E879A0", "#F97316", "#7C3AED", "#0EA5E9"];

function quarterColor(i: number) {
  return QUARTER_COLORS[i % QUARTER_COLORS.length];
}

// ── Market tabs ───────────────────────────────────────────────────────────────
const MARKETS: { key: Market; label: string }[] = [
  { key: "all",  label: "All" },
  { key: "nz",   label: "NZ" },
  { key: "uk",   label: "UK" },
  { key: "au",   label: "AU" },
  { key: "us",   label: "US" },
];

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const total = payload.reduce((s, e) => s + (e.value || 0), 0);
  const nonZero = payload.filter((e) => e.value > 0);

  return (
    <div className="bg-white border border-grey-200 rounded-lg shadow-md px-3 py-2.5 text-xs min-w-40">
      <p className="font-bold text-grey-950 mb-2">{label}</p>
      {nonZero.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-0.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: entry.color }} />
            <span className="text-grey-500">
              {entry.name === "today" ? "Current coverage" : `Gain (${entry.name})`}
            </span>
          </span>
          <span className="font-semibold text-grey-900 tabular-nums">{entry.value.toFixed(1)}%</span>
        </div>
      ))}
      <div className="flex justify-between gap-4 mt-1.5 pt-1.5 border-t border-grey-100">
        <span className="text-grey-500">Projected total</span>
        <span className="font-bold text-grey-950 tabular-nums">{Math.min(100, total).toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend({ quarters }: { quarters: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-3">
      <span className="flex items-center gap-1.5 text-xs text-grey-500">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: TODAY_COLOR, border: `1.5px solid ${TODAY_STROKE}` }} />
        Today
      </span>
      {quarters.map((q, i) => (
        <span key={q} className="flex items-center gap-1.5 text-xs text-grey-500">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: quarterColor(i) }} />
          {q}
        </span>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CoverageRoadmapChart() {
  const [market, setMarket] = useState<Market>("all");
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (m: Market) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coverage-roadmap?market=${m}`);
      if (res.ok) setRoadmap(await res.json());
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(market); }, [market, fetchData]);

  const data: RoadmapBrand[] = roadmap?.data ?? [];
  const quarters: string[] = roadmap?.quarters ?? [];

  return (
    <div>
      {/* Market filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-grey-400 mr-1">Market:</span>
        <div className="flex items-center gap-1 bg-grey-50 rounded-lg p-0.5">
          {MARKETS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMarket(m.key)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                market === m.key
                  ? "bg-brand-blue text-white"
                  : "text-grey-500 hover:text-grey-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {market !== "all" && (
          <span className="text-xs text-grey-400 ml-1">
            · Segments show incremental coverage from upcoming integrations for this market
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center text-grey-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-grey-400 text-sm">
          No coverage data available
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 64, left: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid stroke="#F3F4F6" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="brand"
                tick={{ fontSize: 9, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                interval={0}
                height={64}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                width={40}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(54,50,255,0.04)" }} />

              <Bar
                dataKey="today"
                stackId="cov"
                fill={TODAY_COLOR}
                stroke={TODAY_STROKE}
                strokeWidth={0.5}
                isAnimationActive={false}
              />
              {quarters.map((q, i) => (
                <Bar
                  key={q}
                  dataKey={q}
                  stackId="cov"
                  fill={quarterColor(i)}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          <Legend quarters={quarters} />

          {market !== "all" && quarters.length > 0 && (
            <p className="text-xs text-grey-300 text-center mt-2">
              Segment height = integration&apos;s {market.toUpperCase()} incremental VIO % ÷ number of brands in that integration
            </p>
          )}
          {quarters.length === 0 && (
            <p className="text-xs text-grey-400 text-center mt-2">
              No upcoming integrations with {market === "all" ? "global" : market.toUpperCase()} incremental data set
            </p>
          )}
        </>
      )}
    </div>
  );
}
