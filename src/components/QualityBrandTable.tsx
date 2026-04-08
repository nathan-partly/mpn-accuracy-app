"use client";

import { useState, useMemo } from "react";
import { LevelBadge } from "@/components/LevelBadge";
import type { QualityBrandData } from "@/types";

// ─── Sub-components (copied from server page, safe to duplicate in client) ────

function CoverageBar({ value, threshold }: { value: number | null; threshold: number }) {
  if (value == null) return <span className="text-grey-300 text-xs">—</span>;
  const pctVal = Math.min(100, Number(value));
  const reached = pctVal >= threshold;
  const barColor = reached
    ? "bg-brand-blue"
    : pctVal >= threshold * 0.5
    ? "bg-amber-400"
    : pctVal > 0
    ? "bg-grey-400"
    : "bg-grey-200";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-grey-100 rounded-full overflow-hidden" style={{ minWidth: 60 }}>
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.max(pctVal, pctVal > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums w-12 text-right ${reached ? "text-brand-blue" : "text-grey-700"}`}>
        {pctVal.toFixed(1)}%
      </span>
    </div>
  );
}

function GateCheck({ met, label }: { met: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {met ? (
        <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3 h-3 text-grey-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
      <span className={`text-xs ${met ? "text-grey-700" : "text-grey-400"}`}>{label}</span>
    </span>
  );
}

function QualityGates({ brand }: { brand: QualityBrandData }) {
  const gates = [
    { met: !!brand.req_diagram_cleanup,    label: "Diagram cleanup" },
    { met: !!brand.req_titles_rephrased,   label: "Titles rephrased" },
    { met: !!brand.req_irrelevant_removed, label: "Irrelevant removed" },
    { met: !!brand.req_part_variant_l2,    label: "Part variant ≥ OEM" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {gates.map((g, i) => <GateCheck key={i} met={g.met} label={g.label} />)}
    </div>
  );
}

function MarketPills({ brand }: { brand: QualityBrandData }) {
  const markets = [
    { label: "NZ", value: brand.vio_nz_pct },
    { label: "UK", value: brand.vio_uk_pct },
    { label: "AU", value: brand.vio_au_pct },
    { label: "US", value: brand.vio_us_pct },
  ].filter((m) => m.value != null && Number(m.value) > 0);
  if (markets.length === 0) return <span className="text-grey-300 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {markets.map((m) => (
        <span key={m.label} className="text-xs text-grey-500 bg-grey-50 border border-grey-100 px-1.5 py-0.5 rounded tabular-nums">
          {m.label} {Number(m.value).toFixed(1)}%
        </span>
      ))}
    </div>
  );
}

// ─── Sorting ──────────────────────────────────────────────────────────────────
type SortKey = "vio_rank" | "brand" | "vio_pct" | "classification" | "annotation" | "level";
type SortDir = "asc" | "desc";

const LEVEL_ORDER: Record<string, number> = { L2: 0, L1: 1, L0: 2, Unsupported: 3 };

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) return (
    <svg className="w-3 h-3 text-grey-300 inline-block ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
    </svg>
  );
  return dir === "asc" ? (
    <svg className="w-3 h-3 text-brand-blue inline-block ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-brand-blue inline-block ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function QualityBrandTable({ brands }: { brands: QualityBrandData[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("vio_rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? brands.filter((b) => b.brand.toLowerCase().includes(q)) : brands;
  }, [brands, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "vio_rank":
          cmp = (a.vio_rank ?? 9999) - (b.vio_rank ?? 9999);
          break;
        case "brand":
          cmp = a.brand.localeCompare(b.brand);
          break;
        case "vio_pct":
          cmp = (Number(a.vio_combined_pct) || 0) - (Number(b.vio_combined_pct) || 0);
          break;
        case "classification":
          cmp = (Number(a.classification_pct) || 0) - (Number(b.classification_pct) || 0);
          break;
        case "annotation":
          cmp = (Number(a.annotation_pct) || 0) - (Number(b.annotation_pct) || 0);
          break;
        case "level":
          cmp = (LEVEL_ORDER[a.level] ?? 4) - (LEVEL_ORDER[b.level] ?? 4);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function th(label: string, key: SortKey, align: "left" | "right" | "center" = "right") {
    const active = sortKey === key;
    return (
      <th
        onClick={() => handleSort(key)}
        className={`px-5 py-3 text-xs font-semibold uppercase tracking-widest cursor-pointer select-none whitespace-nowrap text-${align} ${active ? "text-brand-blue" : "text-grey-400 hover:text-grey-700"}`}
      >
        {label}
        <SortIcon dir={active ? sortDir : null} />
      </th>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest">
          Brand Breakdown · {filtered.length}{filtered.length !== brands.length ? ` of ${brands.length}` : ""} brands
        </h2>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z" />
          </svg>
          <input
            type="text"
            placeholder="Filter brands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-grey-200 rounded-lg focus:outline-none focus:border-brand-blue w-44"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-brand-blue" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-100">
                {th("VIO Rank", "vio_rank", "center")}
                {th("Brand", "brand", "left")}
                {th("VIO %", "vio_pct", "right")}
                <th className="px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Markets</th>
                {th("Classification", "classification", "left")}
                {th("Annotation", "annotation", "left")}
                <th className="px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Gates</th>
                {th("Level", "level", "right")}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-grey-400">No brands match your filter.</td>
                </tr>
              ) : (
                sorted.map((brand, i) => (
                  <tr key={brand.id} className={`hover:bg-grey-50 transition-colors ${i !== sorted.length - 1 ? "border-b border-grey-50" : ""}`}>
                    <td className="px-5 py-3.5 text-grey-400 text-xs tabular-nums text-center">
                      {brand.vio_rank ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-grey-950">{brand.brand}</td>
                    <td className="px-5 py-3.5 text-right text-grey-700 tabular-nums font-medium">
                      {brand.vio_combined_pct != null
                        ? `${(Number(brand.vio_combined_pct) / 4).toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <MarketPills brand={brand} />
                    </td>
                    <td className="px-5 py-3.5" style={{ minWidth: 160 }}>
                      <CoverageBar value={brand.classification_pct} threshold={80} />
                    </td>
                    <td className="px-5 py-3.5" style={{ minWidth: 160 }}>
                      <CoverageBar value={brand.annotation_pct} threshold={80} />
                    </td>
                    <td className="px-5 py-3.5">
                      <QualityGates brand={brand} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <LevelBadge level={brand.level} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
