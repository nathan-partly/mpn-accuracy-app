"use client";

import { useState, Fragment } from "react";
import { AccuracyBadge } from "./AccuracyBadge";
import { accuracyPct } from "@/lib/utils";
import type { ModelBreakdown, BenchmarkRecord } from "@/types";

interface Props {
  modelBreakdown: ModelBreakdown[];
  records: BenchmarkRecord[];
}

export function ExpandableModelTable({ modelBreakdown, records }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function rowKey(row: ModelBreakdown) {
    return `${row.model}__${row.year ?? ""}__${row.region ?? ""}`;
  }

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function recordsFor(row: ModelBreakdown) {
    return records.filter(
      (r) =>
        r.model === row.model &&
        (row.year == null || r.year === row.year) &&
        (row.region == null || r.region === row.region)
    );
  }

  // Group records by VIN + upstream_provider so each VIN/provider combo gets its own sub-section
  function groupByVin(recs: BenchmarkRecord[]): Map<string, BenchmarkRecord[]> {
    const map = new Map<string, BenchmarkRecord[]>();
    for (const r of recs) {
      const key = `${r.vin}||${r.upstream_provider ?? ""}`;
      const existing = map.get(key) ?? [];
      existing.push(r);
      map.set(key, existing);
    }
    return map;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-grey-100">
          <th className="w-8 pb-2" />
          <th className="text-left pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Model</th>
          <th className="text-left pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Year</th>
          <th className="text-left pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Region</th>
          <th className="text-right pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Parts</th>
          <th className="text-right pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Valid</th>
          <th className="text-right pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Invalid</th>
          <th className="text-right pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Accuracy</th>
        </tr>
      </thead>
      <tbody>
        {modelBreakdown.map((row, i) => {
          const key = rowKey(row);
          const isOpen = expanded.has(key);
          const rowRecords = isOpen ? recordsFor(row) : [];
          const isLast = i === modelBreakdown.length - 1;
          const vinGroups = groupByVin(rowRecords);

          return (
            <Fragment key={key}>
              {/* Summary row */}
              <tr
                onClick={() => toggle(key)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle(key)}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                className={`cursor-pointer hover:bg-grey-50 transition-colors focus:outline-none focus:bg-grey-50 ${!isLast || isOpen ? "border-b border-grey-100" : ""}`}
              >
                <td className="py-2.5 pl-1 pr-2 text-grey-300">
                  <svg
                    aria-hidden="true"
                    className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </td>
                <td className="py-2.5 font-medium text-grey-950">{row.model}</td>
                <td className="py-2.5 text-grey-400">{row.year ?? "—"}</td>
                <td className="py-2.5 text-grey-400">{row.region ?? "—"}</td>
                <td className="py-2.5 text-right text-grey-900">{row.total_parts}</td>
                <td className="py-2.5 text-right text-emerald-700 font-medium">{row.valid_count}</td>
                <td className="py-2.5 text-right text-red-600 font-medium">{row.invalid_count}</td>
                <td className="py-2.5 text-right">
                  <AccuracyBadge pct={accuracyPct(row.accuracy_pct, row.total_parts)} />
                </td>
              </tr>

              {/* Expanded records grouped by VIN */}
              {isOpen && (
                <tr className={!isLast ? "border-b border-grey-100" : ""}>
                  <td colSpan={7} className="p-0">
                    <div className="bg-grey-50 border-t border-grey-100">
                      {rowRecords.length === 0 ? (
                        <p className="text-xs text-grey-400 px-6 py-3">No records found.</p>
                      ) : (
                        Array.from(vinGroups.entries()).map(([vin, vinRecords], vi) => {
                          const first = vinRecords[0];
                          const isLastVin = vi === vinGroups.size - 1;
                          return (
                            <div key={vin} className={!isLastVin ? "border-b border-grey-100" : ""}>
                              {/* VIN sub-header */}
                              <div className="flex items-center gap-4 px-10 py-2 bg-grey-100 border-b border-grey-100">
                                <span className="font-mono text-xs text-grey-400">{vin}</span>
                                {first.make && (
                                  <span className="text-xs text-grey-600 font-medium">{first.make}</span>
                                )}
                                {first.upstream_provider && (
                                  <span className="text-xs text-grey-400">{first.upstream_provider}</span>
                                )}
                              </div>
                              {/* Part rows */}
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-grey-100">
                                    {["Part Type", "Interpreter Output", "EPC Output", "PL24 Output", "Result"].map((h) => (
                                      <th key={h} className="text-left px-4 py-2 pl-10 text-grey-400 font-semibold uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {vinRecords.map((r, ri) => (
                                    <tr
                                      key={r.id}
                                      className={ri !== vinRecords.length - 1 ? "border-b border-grey-100" : ""}
                                    >
                                      <td className="px-4 py-2 pl-10 text-grey-900 whitespace-nowrap">{r.part_type}</td>
                                      <td className="px-4 py-2 font-mono text-grey-400 max-w-[180px] truncate">{r.interpreter_output ?? "—"}</td>
                                      <td className="px-4 py-2 font-mono text-grey-400 max-w-[180px] truncate">{r.epc_output ?? "—"}</td>
                                      <td className="px-4 py-2 font-mono text-grey-400 max-w-[180px] truncate">{r.pl24_output ?? "—"}</td>
                                      <td className="px-4 py-2 whitespace-nowrap">
                                        {r.is_valid === null ? (
                                          <span className="text-grey-400" title={r.notes ?? undefined}>{r.notes ?? "N/A"}</span>
                                        ) : r.is_valid ? (
                                          <span className="text-emerald-700 font-semibold">Valid</span>
                                        ) : (
                                          <span className="text-red-600 font-semibold">Invalid</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
