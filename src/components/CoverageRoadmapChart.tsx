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
import type { RoadmapBrand, RoadmapBrandMeta, RoadmapResponse, Market } from "@/app/api/coverage-roadmap/route";

// ── Colours ───────────────────────────────────────────────────────────────────
const TODAY_COLOR  = "#BBFCE8";
const TODAY_STROKE = "#6EE7B7";
const QUARTER_COLORS = ["#1E3A8A", "#E879A0", "#F97316", "#7C3AED", "#0EA5E9"];
const TBD_COLOR    = "#9CA3AF"; // grey stripe fill for undated integrations
const TBD_KEY      = "TBD";

function quarterColor(q: string, i: number) {
  if (q === TBD_KEY) return `url(#tbd-hatch)`;
  return QUARTER_COLORS[i % QUARTER_COLORS.length];
}
function quarterSolidColor(q: string, i: number) {
  if (q === TBD_KEY) return TBD_COLOR;
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
  active, payload, label, totalSampleVins,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: RoadmapBrand }>;
  label?: string;
  totalSampleVins: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const total = payload.reduce((s, e) => s + (e.value || 0), 0);
  const nonZero = payload.filter((e) => e.value > 0);
  const meta = (payload[0]?.payload?._meta ?? {}) as RoadmapBrandMeta;
  const brandVins = (payload[0]?.payload?.sampleVins as number) ?? 0;
  const sampleShare = totalSampleVins > 0 && brandVins > 0 ? (brandVins / totalSampleVins) * 100 : null;

  return (
    <div className="bg-white border border-grey-200 rounded-lg shadow-md px-3 py-2.5 text-xs min-w-48 max-w-64">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="font-bold text-grey-950">{label}</p>
        {sampleShare !== null && (
          <span className="text-grey-400 tabular-nums whitespace-nowrap">
            {sampleShare.toFixed(1)}% of sample
          </span>
        )}
      </div>
      {nonZero.map((entry) => {
        const integrations = entry.name !== "today" ? (meta[entry.name] ?? []) : [];
        const isGain = entry.name !== "today";
        const sampleEquivalent = isGain && sampleShare !== null
          ? (entry.value * sampleShare) / 100
          : null;
        return (
          <div key={entry.name} className="mb-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm flex-shrink-0 border border-grey-300"
                  style={{ background: entry.name === TBD_KEY ? "repeating-linear-gradient(-45deg,#9CA3AF,#9CA3AF 2px,transparent 2px,transparent 5px)" : entry.color }} />
                <span className="text-grey-500">
                  {entry.name === "today" ? "Current coverage"
                    : entry.name === TBD_KEY ? "Gain (undated target)"
                    : `Gain (${entry.name})`}
                </span>
              </span>
              <span className="font-semibold text-grey-900 tabular-nums">{entry.value.toFixed(1)}%</span>
            </div>
            {sampleEquivalent !== null && (
              <p className="text-grey-400 ml-3.5 mt-0.5 leading-tight tabular-nums">
                = {sampleEquivalent.toFixed(2)}% of total sample
              </p>
            )}
            {integrations.length > 0 && (
              <p className="text-grey-400 ml-3.5 mt-0.5 leading-tight">
                {integrations.join(", ")}
              </p>
            )}
          </div>
        );
      })}
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
          {q === TBD_KEY ? (
            <span className="inline-block w-3 h-3 rounded-sm border border-grey-300"
              style={{ background: "repeating-linear-gradient(-45deg,#9CA3AF,#9CA3AF 2px,transparent 2px,transparent 5px)" }} />
          ) : (
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: quarterSolidColor(q, i) }} />
          )}
          {q === TBD_KEY ? "No date (lower confidence)" : q}
        </span>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  /** Increment this after saving/deleting an integration to trigger a re-fetch */
  refreshKey?: number;
}

export function CoverageRoadmapChart({ refreshKey = 0 }: Props) {
  const [market, setMarket] = useState<Market>("all");
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (m: Market) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coverage-roadmap?market=${m}&_t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) setRoadmap(await res.json());
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever market changes OR parent signals a data change via refreshKey
  useEffect(() => { fetchData(market); }, [market, fetchData, refreshKey]);

  const data: RoadmapBrand[] = roadmap?.data ?? [];
  const quarters: string[] = roadmap?.quarters ?? [];
  const undatedKey: string | null = roadmap?.undatedKey ?? null;
  const totalSampleVins: number = roadmap?.totalSampleVins ?? 0;

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
              <defs>
                <pattern id="tbd-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)">
                  <rect width="6" height="6" fill="transparent" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={TBD_COLOR} strokeWidth="2.5" strokeOpacity="0.55" />
                </pattern>
              </defs>
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
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip content={(props) => <CustomTooltip {...(props as any)} totalSampleVins={totalSampleVins} />} cursor={{ fill: "rgba(54,50,255,0.04)" }} />

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
                  fill={quarterColor(q, i)}
                  stroke={q === TBD_KEY ? TBD_COLOR : undefined}
                  strokeWidth={q === TBD_KEY ? 0.5 : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          <Legend quarters={quarters} />

          {market !== "all" && quarters.length > 0 && (
            <p className="text-xs text-grey-300 text-center mt-2">
              Segment height = expected {market.toUpperCase()} coverage gain for that brand · capped at 100% total
            </p>
          )}
          {undatedKey && (
            <p className="text-xs text-grey-400 text-center mt-2">
              Striped segments = undated future targets · timing unknown, lower confidence
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
