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

// "ALL" = combined/aggregate view (latest per brand)
// number = specific snapshot ID
type SnapshotSelection = "ALL" | number;

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

/** Most recent non-baseline snapshot for a region, or "ALL" if none. */
function defaultSelectionForRegion(region: string, snapshots: Snapshot[]): SnapshotSelection {
  if (region === "ALL") return "ALL";
  const nonBaseline = snapshots
    .filter((s) => s.region === region && !s.is_baseline)
    .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
  return nonBaseline.length > 0 ? nonBaseline[0].id : "ALL";
}

export default function CoveragePage() {
  const [snapshots, setSnapshots]           = useState<Snapshot[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [selectedSel, setSelectedSel]       = useState<SnapshotSelection>("ALL");
  const [loading, setLoading]               = useState(true);

  // ── Iframe refs ──────────────────────────────────────────────────────────────
  // The iframe is loaded ONCE (on mount) and never reloaded.
  // All subsequent changes go via postMessage — region switches are instant,
  // snapshot switches fetch a small JSON payload then postMessage it in.
  const iframeRef      = useRef<HTMLIFrameElement>(null);
  const iframeReady    = useRef(false);      // true after first onLoad
  const isFirstRender  = useRef(true);       // skip postMessage on initial mount
  const dataCache      = useRef(new Map<string, Record<string, unknown[]>>());

  // ── Fetch data and postMessage it to the iframe ───────────────────────────────
  // Uses a request counter to discard stale responses — prevents the "All" data
  // from landing after a snapshot was already selected (or vice versa).
  const requestCounter = useRef(0);

  const sendData = useCallback(async (region: string, sel: SnapshotSelection) => {
    const requestId = ++requestCounter.current;
    const cacheKey = typeof sel === "number" ? `snap:${sel}` : "combined";

    let data = dataCache.current.get(cacheKey);
    if (!data) {
      const params = new URLSearchParams();
      if (typeof sel === "number") params.set("snapshot", String(sel));
      try {
        const res = await fetch(`/api/coverage-data?${params.toString()}`);
        if (!res.ok) return;
        data = await res.json() as Record<string, unknown[]>;
        dataCache.current.set(cacheKey, data);
      } catch { return; }
    }

    // Discard if a newer request has already been made
    if (requestId !== requestCounter.current) return;

    iframeRef.current?.contentWindow?.postMessage(
      { type: "setData", data, region },
      "*"
    );
  }, []);

  // ── Drive iframe on selection change ──────────────────────────────────────────
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // initial data is already embedded in the iframe HTML
    }
    if (!iframeReady.current) return;
    sendData(selectedRegion, selectedSel);
  }, [selectedRegion, selectedSel, sendData]);

  // ── Load snapshots list ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/coverage-samples")
      .then((r) => r.json())
      .then((data: Snapshot[]) => {
        setSnapshots(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Auto-select most recent snapshot once snapshots list has loaded ───────
  useEffect(() => {
    if (!loading && snapshots.length > 0 && selectedRegion !== "ALL") {
      const sel = defaultSelectionForRegion(selectedRegion, snapshots);
      setSelectedSel(sel);
      // Don't wait for the effect above — kick off data fetch immediately
      if (iframeReady.current) sendData(selectedRegion, sel);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleIframeLoad = useCallback(() => {
    iframeReady.current = true;
  }, []);

  const handleRegionChange = useCallback((region: string) => {
    setSelectedRegion(region);
    setSelectedSel((prev) => {
      const next = defaultSelectionForRegion(region, snapshots);
      // If selection didn't change, the effect won't fire — trigger manually
      if (next === prev && iframeReady.current) {
        sendData(region, next);
      }
      return next;
    });
  }, [snapshots, sendData]);

  const handleSelectionChange = useCallback((sel: SnapshotSelection) => {
    setSelectedSel(sel);
  }, []);

  // Snapshots for the selected region (pills only for non-"ALL" main tab)
  const regionSnapshots = selectedRegion !== "ALL"
    ? snapshots.filter((s) => s.region === selectedRegion)
    : [];
  const nonBaseline   = regionSnapshots.filter((s) => !s.is_baseline);
  const baseline      = regionSnapshots.filter((s) => s.is_baseline);
  const pillSnapshots = [...nonBaseline, ...baseline];

  // Initial iframe src — only set once; all changes go via postMessage
  const initialSrc = `/api/coverage-html?r=${selectedRegion}`;

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

      {/* ── Snapshot pills — only for specific regions ── */}
      {selectedRegion !== "ALL" && (
        <div className="bg-grey-50 border-b border-grey-100 px-6 py-2.5 flex items-center gap-2 flex-shrink-0 overflow-x-auto">

          {/* "All" pill — combined view across all snapshots */}
          <button
            onClick={() => handleSelectionChange("ALL")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors flex-shrink-0 ${
              selectedSel === "ALL"
                ? "bg-brand-blue text-white border-brand-blue"
                : "bg-white text-grey-600 border-grey-200 hover:border-brand-blue hover:text-brand-blue"
            }`}
          >
            All
          </button>

          {pillSnapshots.length > 0 && <div className="w-px h-4 bg-grey-200 flex-shrink-0" />}

          {loading ? (
            <span className="text-xs text-grey-400 italic">Loading…</span>
          ) : (
            pillSnapshots.map((snap) => {
              const isSelected = selectedSel === snap.id;
              return (
                <button
                  key={snap.id}
                  onClick={() => handleSelectionChange(snap.id)}
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
              No snapshots yet — upload one to track progress
            </span>
          )}
        </div>
      )}

      {/* ── Dashboard iframe — loaded once; all updates via postMessage ── */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={initialSrc}
          onLoad={handleIframeLoad}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="VIN Coverage Dashboard"
        />
      </div>
    </div>
  );
}
