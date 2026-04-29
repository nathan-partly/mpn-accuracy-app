"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { VinStatsResponse, BrandVinStat, BlockRuleDetail } from "@/app/api/coverage-vin/stats/route";

// ── Provider colours ──────────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<string, { backgroundColor: string; color: string }> = {
  yq_service:  { backgroundColor: "#EFF6FF", color: "#1D4ED8" },
  adp:         { backgroundColor: "#F0FDF4", color: "#15803D" },
  partsbond:   { backgroundColor: "#FFF7ED", color: "#C2410C" },
  tradesoft:   { backgroundColor: "#FAF5FF", color: "#7E22CE" },
};
function providerStyle(p: string): React.CSSProperties {
  return PROVIDER_COLORS[p] ?? { backgroundColor: "#F3F4F6", color: "#374151" };
}
const PROVIDER_LABELS: Record<string, string> = {
  yq_service: "YQ",
  adp:        "ADP",
  partsbond:  "PB",
  tradesoft:  "TS",
};
function providerLabel(p: string) {
  return PROVIDER_LABELS[p] ?? p.replace(/_/g, " ").toUpperCase();
}

// ── Region badge colours ──────────────────────────────────────────────────────
const REGION_COLORS: Record<string, React.CSSProperties> = {
  NZ: { backgroundColor: "#EFF6FF", color: "#1D4ED8" },
  UK: { backgroundColor: "#F0FDF4", color: "#15803D" },
  US: { backgroundColor: "#FEF9C3", color: "#854D0E" },
  AU: { backgroundColor: "#FFF1F2", color: "#BE123C" },
};
function regionStyle(r: string): React.CSSProperties {
  return REGION_COLORS[r.toUpperCase()] ?? { backgroundColor: "#F3F4F6", color: "#374151" };
}

// ── Coverage stacked bar ──────────────────────────────────────────────────────
function StackedBar({ covered, blocked, not_found, total }: { covered: number; blocked: number; not_found: number; total: number }) {
  const covPct = (covered / total) * 100;
  const blkPct = (blocked / total) * 100;
  const nfPct  = (not_found / total) * 100;
  return (
    <div className="flex h-2 w-28 rounded-full overflow-hidden bg-grey-100 gap-px">
      {covPct > 0 && <div style={{ width: `${covPct}%`, background: "#10B981" }} title={`Covered ${covPct.toFixed(1)}%`} />}
      {blkPct > 0 && <div style={{ width: `${blkPct}%`, background: "#F59E0B" }} title={`Blocked ${blkPct.toFixed(1)}%`} />}
      {nfPct  > 0 && <div style={{ width: `${nfPct}%`,  background: "#E5E7EB" }} title={`Not found ${nfPct.toFixed(1)}%`} />}
    </div>
  );
}

// ── Block rule impact bar ─────────────────────────────────────────────────────
function ImpactBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-grey-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: pct >= 20 ? "#EF4444" : pct >= 10 ? "#F59E0B" : "#6B7280",
          }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${pct >= 20 ? "text-red-600" : pct >= 10 ? "text-amber-600" : "text-grey-500"}`}>
        -{pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ── Expanded rule breakdown for a brand ───────────────────────────────────────
function BlockRuleExpanded({ rules }: { rules: BlockRuleDetail[] }) {
  // Group by region
  const byRegion: Record<string, BlockRuleDetail[]> = {};
  for (const r of rules) {
    if (!byRegion[r.region]) byRegion[r.region] = [];
    byRegion[r.region].push(r);
  }

  const regions = Object.keys(byRegion).sort();

  return (
    <tr>
      <td colSpan={7} className="bg-grey-50 border-b border-grey-100 px-0 py-0">
        <div className="px-6 py-4">
          <p className="text-xs font-bold text-grey-400 uppercase tracking-widest mb-3">
            Block rule impact by region
          </p>
          <div className="flex flex-col gap-4">
            {regions.map((region) => {
              const regionRules = byRegion[region];
              const regionTotal = regionRules[0].region_total;
              const totalBlocked = regionRules.reduce((s, r) => s + r.blocked_count, 0);
              const style = regionStyle(region);

              return (
                <div key={region}>
                  {/* Region header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                      style={style}
                    >
                      {region}
                    </span>
                    <span className="text-xs text-grey-400">
                      {regionTotal.toLocaleString()} VINs in dataset ·{" "}
                      <span className="text-amber-600 font-semibold">{totalBlocked.toLocaleString()} blocked</span>
                      {" "}({(totalBlocked / regionTotal * 100).toFixed(1)}% of {region} coverage lost)
                    </span>
                  </div>

                  {/* Rules table */}
                  <div className="rounded-lg border border-grey-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white border-b border-grey-100">
                          <th className="text-left px-3 py-2 font-semibold text-grey-400 uppercase tracking-wide">Rule</th>
                          <th className="text-left px-3 py-2 font-semibold text-grey-400 uppercase tracking-wide">Description</th>
                          <th className="text-left px-3 py-2 font-semibold text-grey-400 uppercase tracking-wide">Provider</th>
                          <th className="text-right px-3 py-2 font-semibold text-grey-400 uppercase tracking-wide">VINs Blocked</th>
                          <th className="px-3 py-2 font-semibold text-grey-400 uppercase tracking-wide">Coverage Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regionRules.map((rule, i) => (
                          <tr key={rule.rule_id} className={i < regionRules.length - 1 ? "border-b border-grey-50" : ""}>
                            <td className="px-3 py-2 font-mono text-grey-600 whitespace-nowrap">
                              {rule.rule_id}
                            </td>
                            <td className="px-3 py-2 text-grey-700">
                              {rule.rule_name ?? <span className="text-grey-300 italic">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              {rule.rule_provider ? (
                                <span
                                  className="inline-block px-1.5 py-0.5 rounded font-semibold text-[10px]"
                                  style={providerStyle(rule.rule_provider)}
                                >
                                  {providerLabel(rule.rule_provider)}
                                </span>
                              ) : (
                                <span className="text-grey-200">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-600">
                              {rule.blocked_count.toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              <ImpactBar pct={rule.impact_pct} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Sort helpers ──────────────────────────────────────────────────────────────
type SortKey = "brand" | "total" | "coverage_pct" | "blocked" | "blocked_pct";
type SortDir = "asc" | "desc";

function sortBrands(brands: BrandVinStat[], key: SortKey, dir: SortDir): BrandVinStat[] {
  return [...brands].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (key === "brand") {
      return dir === "asc"
        ? (va as string).localeCompare(vb as string)
        : (vb as string).localeCompare(va as string);
    }
    return dir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-block ml-1 ${active ? "text-brand-blue" : "text-grey-200"}`}>
      {!active || dir === "desc" ? "↓" : "↑"}
    </span>
  );
}

// ── Upload section ────────────────────────────────────────────────────────────
function UploadSection({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) { setError("Please upload a .csv file"); return; }
    setUploading(true); setError(null); setSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/coverage-vin", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setSuccess(`Uploaded ${json.row_count.toLocaleString()} VINs`);
      onUploaded();
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="border-2 border-dashed border-grey-200 rounded-xl px-6 py-5 flex items-center gap-4 bg-grey-50 hover:border-brand-blue transition-colors cursor-pointer"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
    >
      <input ref={inputRef} type="file" accept=".csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-grey-100 flex items-center justify-center shadow-sm">
        <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        {uploading ? <p className="text-sm text-grey-500">Uploading…</p>
          : success  ? <p className="text-sm text-emerald-600 font-semibold">{success}</p>
          : error    ? <p className="text-sm text-red-600">{error}</p>
          : (
            <>
              <p className="text-sm font-semibold text-grey-800">Upload VIN dataset CSV</p>
              <p className="text-xs text-grey-400 mt-0.5">
                Columns: input_make, input_region, vin, gcs_found, providers_found, rule_id, rule_name, rule_provider
              </p>
            </>
          )}
      </div>
      {!uploading && !success && (
        <button
          className="flex-shrink-0 px-3 py-1.5 bg-brand-blue text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        >
          Browse
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CoverageVinTable() {
  const [data, setData] = useState<VinStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  // Filter: "all" | "blocked"
  const [filter, setFilter] = useState<"all" | "blocked">("all");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coverage-vin/stats", { cache: "no-store" });
      setData(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats, refreshKey]);

  function toggleExpand(brand: string) {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand); else next.add(brand);
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "brand" ? "asc" : "desc"); }
  }

  const thCls = "px-4 py-2.5 text-xs font-semibold text-grey-400 uppercase tracking-wider cursor-pointer select-none hover:text-grey-700";

  const brands = data?.brands ?? [];
  const filtered = brands
    .filter((b) => !search || b.brand.toLowerCase().includes(search.toLowerCase()))
    .filter((b) => filter === "all" || b.blocked > 0);
  const sorted = sortBrands(filtered, sortKey, sortDir);

  const totalVins    = data?.total_vins ?? 0;
  const totalCovered = brands.reduce((s, b) => s + b.covered, 0);
  const totalBlocked = brands.reduce((s, b) => s + b.blocked, 0);
  const totalNotFound = brands.reduce((s, b) => s + b.not_found, 0);
  const overallCovPct = totalVins > 0 ? (totalCovered / totalVins * 100).toFixed(1) : "0.0";
  const overallBlkPct = totalVins > 0 ? (totalBlocked / totalVins * 100).toFixed(1) : "0.0";

  const allProviders = Array.from(new Set(brands.flatMap((b) => Object.keys(b.providers)))).sort();
  const brandsWithBlocks = brands.filter((b) => b.blocked > 0).length;

  return (
    <div>
      <div className="mb-6">
        <UploadSection onUploaded={() => setRefreshKey((k) => k + 1)} />
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-grey-400 text-sm">Loading…</div>
      ) : !data?.snapshot_id ? (
        <div className="h-40 flex items-center justify-center text-grey-400 text-sm">
          No VIN dataset uploaded yet. Upload a CSV above to see coverage analysis.
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Total VINs",      value: totalVins.toLocaleString(),    sub: `${brands.length} brands` },
              { label: "Covered",         value: totalCovered.toLocaleString(), sub: `${overallCovPct}% of dataset` },
              { label: "Blocked by Rule", value: totalBlocked.toLocaleString(), sub: `${overallBlkPct}% · ${brandsWithBlocks} brands affected`, warn: totalBlocked > 0 },
              { label: "Not Found",       value: totalNotFound.toLocaleString(), sub: "no provider data" },
              { label: "Last Upload",     value: new Date(data.uploaded_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), sub: new Date(data.uploaded_at!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-xl border border-grey-100 shadow-sm px-4 py-3">
                <p className="text-xs text-grey-400 font-medium uppercase tracking-wide mb-1">{k.label}</p>
                <p className={`text-xl font-bold tabular-nums ${k.warn ? "text-amber-600" : "text-grey-950"}`}>{k.value}</p>
                <p className="text-xs text-grey-400 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Legend + filter */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 text-xs text-grey-500">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm bg-emerald-500" />Covered</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm bg-amber-400" />Blocked by rule</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm bg-grey-200" />Not found</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Filter */}
              <div className="flex items-center gap-1 bg-grey-50 rounded-lg p-0.5">
                {(["all", "blocked"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${filter === f ? "bg-brand-blue text-white" : "text-grey-500 hover:text-grey-800"}`}
                  >
                    {f === "all" ? "All brands" : `Blocked only (${brandsWithBlocks})`}
                  </button>
                ))}
              </div>
              {/* Search */}
              <input type="text" placeholder="Search brand…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 border border-grey-200 rounded-lg text-sm text-grey-800 placeholder-grey-300 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent w-44"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-brand-blue" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grey-100 bg-grey-50">
                    {/* Expand toggle column */}
                    <th className="w-8 px-2" />
                    <th className={`${thCls} text-left`} onClick={() => handleSort("brand")}>
                      Brand<SortIcon active={sortKey === "brand"} dir={sortDir} />
                    </th>
                    <th className={`${thCls} text-right`} onClick={() => handleSort("total")}>
                      Total<SortIcon active={sortKey === "total"} dir={sortDir} />
                    </th>
                    <th className={`${thCls} text-right`} onClick={() => handleSort("coverage_pct")}>
                      Coverage<SortIcon active={sortKey === "coverage_pct"} dir={sortDir} />
                    </th>
                    <th className={`${thCls} text-right`} onClick={() => handleSort("blocked")}>
                      Blocked<SortIcon active={sortKey === "blocked"} dir={sortDir} />
                    </th>
                    <th className={`${thCls} text-right`} onClick={() => handleSort("blocked_pct")}>
                      Block %<SortIcon active={sortKey === "blocked_pct"} dir={sortDir} />
                    </th>
                    <th className={`${thCls} text-left`}>Providers</th>
                    <th className="px-4 py-2.5 w-32" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((brand, i) => {
                    const isExpanded = expandedBrands.has(brand.brand);
                    const hasRules   = brand.block_rules.length > 0;
                    const isLast     = i === sorted.length - 1;

                    return (
                      <>
                        <tr
                          key={brand.brand}
                          className={`${!isLast || isExpanded ? "border-b border-grey-100" : ""} ${hasRules ? "cursor-pointer hover:bg-grey-50" : ""} transition-colors`}
                          onClick={() => hasRules && toggleExpand(brand.brand)}
                        >
                          {/* Expand chevron */}
                          <td className="px-2 py-2.5 text-center">
                            {hasRules ? (
                              <span className={`inline-block text-grey-400 transition-transform text-xs ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                            ) : null}
                          </td>
                          {/* Brand */}
                          <td className="px-4 py-2.5 font-semibold text-grey-900 whitespace-nowrap">
                            {brand.brand}
                            {hasRules && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                {brand.block_rules.length} rule{brand.block_rules.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </td>
                          {/* Total */}
                          <td className="px-4 py-2.5 text-right tabular-nums text-grey-600 text-xs">
                            {brand.total.toLocaleString()}
                          </td>
                          {/* Coverage % */}
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            <span className={`font-semibold ${brand.coverage_pct >= 90 ? "text-emerald-600" : brand.coverage_pct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                              {brand.coverage_pct.toFixed(1)}%
                            </span>
                            <span className="text-grey-400 text-xs ml-1">({brand.covered.toLocaleString()})</span>
                          </td>
                          {/* Blocked */}
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {brand.blocked > 0
                              ? <span className="text-amber-600 font-semibold">{brand.blocked.toLocaleString()}</span>
                              : <span className="text-grey-200">—</span>}
                          </td>
                          {/* Block % */}
                          <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                            {brand.blocked > 0
                              ? <span className="text-amber-600 font-medium">{brand.blocked_pct.toFixed(1)}%</span>
                              : <span className="text-grey-200">—</span>}
                          </td>
                          {/* Providers */}
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(brand.providers).sort((a, b) => b[1] - a[1]).map(([p, cnt]) => {
                                const pct = (cnt / brand.total * 100).toFixed(0);
                                const style = providerStyle(p);
                                return (
                                  <span key={p} title={`${p}: ${cnt.toLocaleString()} VINs (${pct}%)`}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                    style={style}
                                  >
                                    {providerLabel(p)} {pct}%
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          {/* Bar */}
                          <td className="px-4 py-2.5">
                            <StackedBar covered={brand.covered} blocked={brand.blocked} not_found={brand.not_found} total={brand.total} />
                          </td>
                        </tr>

                        {/* Expanded rule breakdown */}
                        {isExpanded && hasRules && (
                          <BlockRuleExpanded key={`${brand.brand}-rules`} rules={brand.block_rules} />
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Provider legend */}
          {allProviders.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {allProviders.map((p) => {
                const style = providerStyle(p);
                return (
                  <span key={p} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold" style={style}>
                    {providerLabel(p)} = {p}
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
