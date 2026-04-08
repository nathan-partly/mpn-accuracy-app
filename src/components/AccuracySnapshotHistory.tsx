"use client";

import { useState } from "react";
import Link from "next/link";
import { AccuracyBadge } from "@/components/AccuracyBadge";
import { formatDate, accuracyPct } from "@/lib/utils";
import type { BenchmarkSnapshot } from "@/types";

export function AccuracySnapshotHistory({ snapshots }: { snapshots: BenchmarkSnapshot[] }) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_ROWS = 10;
  const visible = expanded ? snapshots : snapshots.slice(0, INITIAL_ROWS);

  if (snapshots.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">
        Snapshot Upload History · {snapshots.length} uploads
      </h2>
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-brand-blue" />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Brand</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Snapshot Date</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">VINs</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Parts</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Accuracy</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Uploaded by</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Uploaded at</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => (
              <tr
                key={s.id}
                className={`hover:bg-grey-50 transition-colors ${i !== visible.length - 1 ? "border-b border-grey-100" : ""}`}
              >
                <td className="px-5 py-3.5 font-semibold text-grey-950">{s.brand_name}</td>
                <td className="px-5 py-3.5 text-grey-700">{formatDate(s.snapshot_date)}</td>
                <td className="px-5 py-3.5 text-right text-grey-900 tabular-nums">
                  {Number(s.active_vins || s.total_vins || 0).toLocaleString()}
                </td>
                <td className="px-5 py-3.5 text-right text-grey-900 tabular-nums">
                  {Number(s.total_parts || 0).toLocaleString()}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <AccuracyBadge pct={accuracyPct(s.accuracy_pct, s.total_parts)} />
                </td>
                <td className="px-5 py-3.5 text-right text-grey-500 text-xs">
                  {s.uploaded_by ?? <span className="text-grey-300">—</span>}
                </td>
                <td className="px-5 py-3.5 text-right text-grey-400 text-xs whitespace-nowrap">
                  {s.created_at
                    ? formatDate(s.created_at)
                    : "—"}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/brands/${s.brand_id}`}
                    className="text-xs text-brand-blue font-semibold hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {snapshots.length > INITIAL_ROWS && (
          <div className="border-t border-grey-100 px-5 py-3 flex justify-center">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-brand-blue font-semibold hover:underline"
            >
              {expanded
                ? "Show fewer"
                : `Show all ${snapshots.length} uploads`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
