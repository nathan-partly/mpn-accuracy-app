"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface Snapshot {
  id: number;
  region: string;
  snapshot_date: string;
  uploaded_by: string | null;
  notes: string | null;
  row_count: number | null;
  is_baseline: boolean;
  created_at: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function CoveragePage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [iframeSrc, setIframeSrc] = useState("/api/coverage-html");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/coverage-samples")
      .then((r) => r.json())
      .then((data: Snapshot[]) => {
        setSnapshots(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = useCallback((id: number | null) => {
    setSelectedId(id);
    setIframeSrc(id ? `/api/coverage-html?snapshot=${id}` : "/api/coverage-html");
  }, []);

  // Show non-baseline first, then baseline — each pill shows its region label
  const nonBaseline = snapshots.filter((s) => !s.is_baseline);
  const baseline = snapshots.filter((s) => s.is_baseline && s.region !== "ALL");
  const pillSnapshots = [...nonBaseline, ...baseline];

  const selectedSnap = selectedId ? snapshots.find((s) => s.id === selectedId) : null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      {/* ── Page header ── */}
      <div className="bg-white border-b border-grey-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-0.5">Coverage</p>
          <h1 className="text-lg font-bold text-grey-950 leading-tight">VIN Coverage Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/coverage/integrations"
            className="flex items-center gap-2 px-4 py-2 bg-white text-brand-blue text-sm font-semibold rounded-lg border border-brand-blue hover:bg-blue-50 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
            </svg>
            Data Integrations
          </Link>
          <Link
            href="/coverage/upload"
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Snapshot
          </Link>
        </div>
      </div>

      {/* ── Snapshot selector bar ── */}
      <div className="bg-grey-50 border-b border-grey-100 px-6 py-2.5 flex items-center gap-2 flex-shrink-0 overflow-x-auto">
        {/* "Latest" pill — always first */}
        <button
          onClick={() => handleSelect(null)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors flex-shrink-0 ${
            selectedId === null
              ? "bg-brand-blue text-white border-brand-blue"
              : "bg-white text-grey-600 border-grey-200 hover:border-brand-blue hover:text-brand-blue"
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Latest (all brands)
        </button>

        <div className="w-px h-4 bg-grey-200 flex-shrink-0" />

        {/* Snapshot pills — non-baseline then baseline */}
        {loading ? (
          <span className="text-xs text-grey-400 italic">Loading…</span>
        ) : (
          pillSnapshots.map((snap) => {
            const isSelected = selectedId === snap.id;
            return (
              <button
                key={snap.id}
                onClick={() => handleSelect(snap.id)}
                title={snap.notes ?? undefined}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors flex-shrink-0 ${
                  isSelected
                    ? "bg-brand-blue text-white border-brand-blue"
                    : snap.is_baseline
                    ? "bg-white text-grey-400 border-grey-200 hover:border-grey-400 hover:text-grey-600"
                    : "bg-white text-grey-700 border-grey-200 hover:border-brand-blue hover:text-brand-blue"
                }`}
              >
                {!snap.is_baseline && (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? "bg-white" : "bg-brand-blue"}`} />
                )}
                <span>{fmtDate(snap.snapshot_date)}</span>
                {/* Always show region on the pill */}
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                  isSelected
                    ? "bg-blue-500 text-white"
                    : snap.is_baseline
                    ? "bg-grey-100 text-grey-400"
                    : "bg-blue-50 text-brand-blue"
                }`}>
                  {snap.region}
                </span>
                {snap.is_baseline && (
                  <span className={`text-[10px] ${isSelected ? "text-blue-200" : "text-grey-400"}`}>
                    baseline
                  </span>
                )}
                {snap.row_count && (
                  <span className={`text-[10px] ${isSelected ? "text-blue-200" : "text-grey-400"}`}>
                    {snap.row_count} brands
                  </span>
                )}
              </button>
            );
          })
        )}

        {/* Context label for selected snapshot */}
        {selectedSnap && (
          <span className="ml-auto flex-shrink-0 text-xs text-grey-500 whitespace-nowrap">
            {selectedSnap.is_baseline
              ? `Baseline · ${selectedSnap.region} · ${fmtDate(selectedSnap.snapshot_date)}`
              : `${selectedSnap.region} snapshot · ${fmtDate(selectedSnap.snapshot_date)}${selectedSnap.notes ? ` · ${selectedSnap.notes}` : ""}`
            }
          </span>
        )}

        {nonBaseline.length === 0 && !loading && (
          <span className="ml-2 text-xs text-grey-400 italic">
            Upload a CSV to track progress over time
          </span>
        )}
      </div>

      {/* ── Dashboard iframe ── */}
      <div className="flex-1 overflow-hidden">
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="VIN Coverage Dashboard"
        />
      </div>
    </div>
  );
}
