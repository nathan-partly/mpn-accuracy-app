"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";

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

const REGIONS = [
  { key: "ALL", label: "All Regions", flag: null },
  { key: "UK",  label: "UK",          flag: "🇬🇧" },
  { key: "US",  label: "US",          flag: "🇺🇸" },
  { key: "NZ",  label: "NZ",          flag: "🇳🇿" },
  { key: "AU",  label: "AU",          flag: "🇦🇺" },
];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function buildSrc(region: string, snapshotId: number | null) {
  const p = new URLSearchParams({ r: region });
  if (snapshotId) p.set("snapshot", String(snapshotId));
  return `/api/coverage-html?${p.toString()}`;
}

export default function CoveragePage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Iframe controlled via ref — we only update src when the snapshot changes.
  // Region-only changes are handled via postMessage (instant, no network request).
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState(buildSrc("ALL", null));
  const lastSnapshotRef = useRef<number | null | "INIT">("INIT");

  useEffect(() => {
    fetch("/api/coverage-samples")
      .then((r) => r.json())
      .then((data: Snapshot[]) => {
        setSnapshots(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Decide whether to reload the iframe (snapshot changed) or postMessage (region only)
  useEffect(() => {
    if (lastSnapshotRef.current === "INIT") {
      lastSnapshotRef.current = selectedSnapshotId;
      return;
    }

    if (lastSnapshotRef.current !== selectedSnapshotId) {
      // Different data needed — update the iframe src (browser navigates in place)
      setIframeSrc(buildSrc(selectedRegion, selectedSnapshotId));
      lastSnapshotRef.current = selectedSnapshotId;
    } else {
      // Same data, different region — instant switch via postMessage, no reload
      iframeRef.current?.contentWindow?.postMessage(
        { type: "setRegion", region: selectedRegion },
        "*"
      );
    }
  }, [selectedRegion, selectedSnapshotId]);

  const handleRegionChange = useCallback((region: string) => {
    setSelectedRegion(region);
    setSelectedSnapshotId(null);
  }, []);

  const handleSnapshotSelect = useCallback((id: number | null) => {
    setSelectedSnapshotId(id);
  }, []);

  // Snapshots for the selected region only (not shown for All Regions)
  const regionSnapshots = selectedRegion !== "ALL"
    ? snapshots.filter((s) => s.region === selectedRegion)
    : [];
  const nonBaseline  = regionSnapshots.filter((s) => !s.is_baseline);
  const baseline     = regionSnapshots.filter((s) => s.is_baseline);
  const pillSnapshots = [...nonBaseline, ...baseline];

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

      {/* ── Region tabs ── */}
      <div className="bg-white border-b border-grey-100 px-6 flex items-center flex-shrink-0">
        {REGIONS.map((r) => (
          <button
            key={r.key}
            onClick={() => handleRegionChange(r.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors flex-shrink-0 ${
              selectedRegion === r.key
                ? "border-brand-blue text-brand-blue font-semibold"
                : "border-transparent text-grey-500 hover:text-grey-800 font-medium"
            }`}
          >
            {r.flag && <span>{r.flag}</span>}
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Snapshot pills — only shown for specific regions, not All Regions ── */}
      {selectedRegion !== "ALL" && (
        <div className="bg-grey-50 border-b border-grey-100 px-6 py-2.5 flex items-center gap-2 flex-shrink-0 overflow-x-auto">

          <button
            onClick={() => handleSnapshotSelect(null)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors flex-shrink-0 ${
              selectedSnapshotId === null
                ? "bg-brand-blue text-white border-brand-blue"
                : "bg-white text-grey-600 border-grey-200 hover:border-brand-blue hover:text-brand-blue"
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Latest {selectedRegion}
          </button>

          {pillSnapshots.length > 0 && <div className="w-px h-4 bg-grey-200 flex-shrink-0" />}

          {loading ? (
            <span className="text-xs text-grey-400 italic">Loading…</span>
          ) : (
            pillSnapshots.map((snap) => {
              const isSelected = selectedSnapshotId === snap.id;
              return (
                <button
                  key={snap.id}
                  onClick={() => handleSnapshotSelect(snap.id)}
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

          {nonBaseline.length === 0 && !loading && (
            <span className="ml-2 text-xs text-grey-400 italic">
              No historical snapshots — upload one to track progress
            </span>
          )}
        </div>
      )}

      {/* ── Dashboard iframe — no key prop; src updates navigate in place ── */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="VIN Coverage Dashboard"
        />
      </div>
    </div>
  );
}
