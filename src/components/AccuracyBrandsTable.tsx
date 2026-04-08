"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AccuracyBadge } from "@/components/AccuracyBadge";
import { formatDate, accuracyPct } from "@/lib/utils";
import type { Brand } from "@/types";

// ─── Sort helpers ─────────────────────────────────────────────────────────────
type SortKey = "vio_rank" | "name" | "vio_pct" | "vins" | "parts" | "accuracy" | "date";
type SortDir = "asc" | "desc";

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
export function AccuracyBrandsTable({ brands }: { brands: Brand[] }) {
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
    return q ? brands.filter((b) => b.name.toLowerCase().includes(q)) : brands;
  }, [brands, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "vio_rank":
          cmp = (a.vio_rank ?? 9999) - (b.vio_rank ?? 9999);
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "vio_pct":
          cmp = (Number(a.vio_combined_pct) || 0) - (Number(b.vio_combined_pct) || 0);
          break;
        case "vins":
          cmp = (Number(a.latest_total_vins) || 0) - (Number(b.latest_total_vins) || 0);
          break;
        case "parts":
          cmp = (Number(a.latest_total_parts) || 0) - (Number(b.latest_total_parts) || 0);
          break;
        case "accuracy":
          cmp = (Number(a.latest_accuracy_pct) || 0) - (Number(b.latest_accuracy_pct) || 0);
          break;
        case "date":
          cmp = (a.latest_snapshot_date ?? "").localeCompare(b.latest_snapshot_date ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function th(
    label: string,
    key: SortKey,
    align: "left" | "right" | "center" = "right"
  ) {
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
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest">
          Benchmarked Brands · {filtered.length}{filtered.length !== brands.length ? ` of ${brands.length}` : ""}
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100">
              {th("VIO Rank", "vio_rank", "center")}
              {th("Brand", "name", "left")}
              {th("VIO %", "vio_pct", "right")}
              {th("VINs", "vins", "right")}
              {th("Parts", "parts", "right")}
              <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Valid</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Invalid</th>
              {th("Accuracy", "accuracy", "right")}
              {th("Last Updated", "date", "right")}
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-sm text-grey-400">No brands match your filter.</td>
              </tr>
            ) : (
              sorted.map((brand, i) => (
                <tr
                  key={brand.id}
                  className={`hover:bg-grey-50 transition-colors ${i !== sorted.length - 1 ? "border-b border-grey-100" : ""}`}
                >
                  <td className="px-5 py-3.5 text-grey-400 text-xs tabular-nums text-center">
                    {brand.vio_rank ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-grey-950">{brand.name}</td>
                  <td className="px-5 py-3.5 text-right text-grey-700 tabular-nums font-medium text-xs">
                    {brand.vio_combined_pct != null
                      ? `${(Number(brand.vio_combined_pct) / 4).toFixed(2)}%`
                      : <span className="text-grey-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right text-grey-900">
                    {brand.latest_total_vins?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right text-grey-900">
                    {brand.latest_total_parts?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right text-emerald-700 font-medium">
                    {brand.latest_valid_count?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right text-red-600 font-medium">
                    {brand.latest_invalid_count?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <AccuracyBadge pct={accuracyPct(brand.latest_accuracy_pct, brand.latest_total_parts)} />
                  </td>
                  <td className="px-5 py-3.5 text-right text-grey-400 text-xs">
                    {brand.latest_snapshot_date
                      ? formatDate(brand.latest_snapshot_date)
                      : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/brands/${brand.id}`}
                      className="text-xs text-brand-blue font-semibold hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
