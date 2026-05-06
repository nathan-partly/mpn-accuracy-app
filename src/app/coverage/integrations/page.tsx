"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { CoverageRoadmapChart } from "@/components/CoverageRoadmapChart";

type BrandIncrementalMap = Record<string, { nz: number | null; uk: number | null; au: number | null; us: number | null }>;
type DataAvailability = "available" | "high_confidence" | "low_confidence" | null;

const AVAILABILITY_OPTIONS: { value: DataAvailability; label: string; color: string; bg: string }[] = [
  { value: null,              label: "Unknown",                  color: "text-grey-400",   bg: "bg-grey-100" },
  { value: "available",       label: "Available",                color: "text-green-700",  bg: "bg-green-100" },
  { value: "high_confidence", label: "Can get · High confidence", color: "text-blue-700",   bg: "bg-blue-100" },
  { value: "low_confidence",  label: "Can get · Low confidence",  color: "text-amber-700",  bg: "bg-amber-100" },
];

function AvailabilityBadge({ value }: { value: DataAvailability }) {
  const opt = AVAILABILITY_OPTIONS.find((o) => o.value === value) ?? AVAILABILITY_OPTIONS[0];
  if (!value) return <span className="text-grey-300">—</span>;
  return (
    <span className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-semibold ${opt.bg} ${opt.color}`}>
      {opt.label}
    </span>
  );
}

function fmtCost(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

interface DataIntegration {
  id: number;
  name: string;
  type: "online" | "offline";
  relationship: "direct" | "third-party";
  brands: string[];
  total_vio_pct: number | null;
  incremental_vio_pct: number | null;
  incremental_nz_pct: number | null;
  incremental_uk_pct: number | null;
  incremental_au_pct: number | null;
  incremental_us_pct: number | null;
  brand_incremental: BrandIncrementalMap | null;
  data_availability: DataAvailability;
  annual_cost: number | null;
  cost_per_vin: number | null;
  integration_date: string;
}

type SortKey = "name" | "integration_date" | "total_vio_pct" | "incremental_vio_pct";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "live" | "upcoming";

const EMPTY_FORM: Omit<DataIntegration, "id"> = {
  name: "",
  type: "online",
  relationship: "third-party",
  brands: [],
  total_vio_pct: null,
  incremental_vio_pct: null,
  incremental_nz_pct: null,
  incremental_uk_pct: null,
  incremental_au_pct: null,
  incremental_us_pct: null,
  brand_incremental: null,
  data_availability: null,
  annual_cost: null,
  cost_per_vin: null,
  integration_date: "",
};

// Per-brand incremental state: string values so inputs work cleanly
type BrandIncrementalForm = Record<string, { nz: string; uk: string; au: string; us: string }>;

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isFuture(iso: string) {
  return iso >= todayISO();
}

// ── Sortable column header ────────────────────────────────────────────────────
function SortTh({
  label, col, sort, onSort, right,
}: {
  label: string; col: SortKey; sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void; right?: boolean;
}) {
  const active = sort.key === col;
  return (
    <th
      className={`px-3 py-2 text-[10px] font-semibold text-grey-500 uppercase tracking-wider cursor-pointer select-none hover:text-grey-800 transition-colors ${right ? "text-right" : "text-left"}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {right && active && <Arrow dir={sort.dir} />}
        {label}
        {!right && active && <Arrow dir={sort.dir} />}
        {!active && <span className="text-grey-300">↕</span>}
      </span>
    </th>
  );
}

function Arrow({ dir }: { dir: SortDir }) {
  return <span className="text-brand-blue">{dir === "asc" ? "↑" : "↓"}</span>;
}

// ── Expandable brand list ─────────────────────────────────────────────────────
function BrandList({ brands }: { brands: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (brands.length === 0) return <span className="text-grey-300">—</span>;
  const visible = expanded ? brands : brands.slice(0, 5);
  const overflow = brands.length - 5;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((b) => (
        <span key={b} className="inline-block px-1.5 py-0.5 bg-grey-100 text-grey-600 rounded text-xs">
          {b}
        </span>
      ))}
      {!expanded && overflow > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="inline-block px-1.5 py-0.5 bg-brand-blue/10 text-brand-blue rounded text-xs font-semibold hover:bg-brand-blue/20 transition-colors"
        >
          +{overflow} more
        </button>
      )}
      {expanded && brands.length > 5 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="inline-block px-1.5 py-0.5 bg-grey-100 text-grey-400 rounded text-xs font-semibold hover:bg-grey-200 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DataIntegrationsPage() {
  const [integrations, setIntegrations] = useState<DataIntegration[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

  // Filter + sort state
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "online" | "offline">("all");
  const [relFilter,  setRelFilter]  = useState<"all" | "direct" | "third-party">("all");
  const [status,     setStatus]     = useState<StatusFilter>("all");
  const [sort,       setSort]       = useState<{ key: SortKey; dir: SortDir }>({ key: "integration_date", dir: "asc" });

  // Form state
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [form,      setForm]      = useState<Omit<DataIntegration, "id">>(EMPTY_FORM);
  const [brandsInput, setBrandsInput] = useState("");
  const [brandIncremental, setBrandIncremental] = useState<BrandIncrementalForm>({});
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/data-integrations");
      if (!res.ok) throw new Error("Failed to load");
      setIntegrations(await res.json());
    } catch {
      setError("Failed to load data integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  // ── Sort handler ────────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "integration_date" ? "asc" : "desc" });
  }

  // ── Filter + sort pipeline ──────────────────────────────────────────────────
  const filtered = integrations
    .filter((i) => {
      if (search && !i.name.toLowerCase().includes(search.toLowerCase()) &&
          !i.brands.some((b) => b.toLowerCase().includes(search.toLowerCase()))) return false;
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (relFilter !== "all" && i.relationship !== relFilter) return false;
      if (status === "live"     &&  isFuture(i.integration_date)) return false;
      if (status === "upcoming" && !isFuture(i.integration_date)) return false;
      return true;
    })
    .sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sort.key) {
        case "name":             av = a.name; bv = b.name; break;
        case "integration_date": av = a.integration_date; bv = b.integration_date; break;
        case "total_vio_pct":    av = a.total_vio_pct ?? -1; bv = b.total_vio_pct ?? -1; break;
        case "incremental_vio_pct": av = a.incremental_vio_pct ?? -1; bv = b.incremental_vio_pct ?? -1; break;
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });

  const hasFilters = search || typeFilter !== "all" || relFilter !== "all" || status !== "all";

  // ── Summary KPIs (always from full list, not filtered) ──────────────────────
  const totalIncremental   = integrations.filter((i) => !isFuture(i.integration_date)).reduce((s, i) => s + (i.incremental_vio_pct ?? 0), 0);
  const offlineTotalVio    = integrations.filter((i) => i.type === "offline" && !isFuture(i.integration_date)).reduce((s, i) => s + (i.total_vio_pct ?? 0), 0);
  const projectedTotal     = integrations.reduce((s, i) => s + (i.incremental_vio_pct ?? 0), 0);
  const projectedOffline   = integrations.filter((i) => i.type === "offline").reduce((s, i) => s + (i.total_vio_pct ?? 0), 0);
  const upcomingCount      = integrations.filter((i) => isFuture(i.integration_date)).length;

  // ── Form helpers ────────────────────────────────────────────────────────────
  function openAdd() {
    setEditId(null); setForm(EMPTY_FORM); setBrandsInput(""); setBrandIncremental({}); setFormError(null); setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function openEdit(row: DataIntegration) {
    setEditId(row.id);
    setForm({
      name: row.name, type: row.type, relationship: row.relationship ?? "third-party",
      brands: row.brands, total_vio_pct: row.total_vio_pct, incremental_vio_pct: row.incremental_vio_pct,
      incremental_nz_pct: row.incremental_nz_pct ?? null,
      incremental_uk_pct: row.incremental_uk_pct ?? null,
      incremental_au_pct: row.incremental_au_pct ?? null,
      incremental_us_pct: row.incremental_us_pct ?? null,
      brand_incremental: row.brand_incremental ?? null,
      data_availability: row.data_availability ?? null,
      annual_cost: row.annual_cost ?? null,
      cost_per_vin: row.cost_per_vin ?? null,
      integration_date: row.integration_date,
    });
    // Populate per-brand form state from saved data
    const bi: BrandIncrementalForm = {};
    if (row.brand_incremental) {
      for (const brand of Object.keys(row.brand_incremental)) {
        const v = row.brand_incremental[brand];
        bi[brand] = {
          nz: v.nz != null ? String(v.nz) : "",
          uk: v.uk != null ? String(v.uk) : "",
          au: v.au != null ? String(v.au) : "",
          us: v.us != null ? String(v.us) : "",
        };
      }
    }
    setBrandIncremental(bi);
    setBrandsInput(row.brands.join(", ")); setFormError(null); setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.integration_date) { setFormError("Integration name and date are required."); return; }
    setSaving(true); setFormError(null);
    const brandsArr = brandsInput.split(",").map((b) => b.trim().toUpperCase()).filter(Boolean);
    // Convert per-brand string values to numbers for the payload
    const brandIncrementalPayload: BrandIncrementalMap = {};
    for (const brand of Object.keys(brandIncremental)) {
      const v = brandIncremental[brand];
      const nz = v.nz !== "" ? parseFloat(v.nz) : null;
      const uk = v.uk !== "" ? parseFloat(v.uk) : null;
      const au = v.au !== "" ? parseFloat(v.au) : null;
      const us = v.us !== "" ? parseFloat(v.us) : null;
      if (nz != null || uk != null || au != null || us != null) {
        brandIncrementalPayload[brand] = { nz, uk, au, us };
      }
    }
    const payload = {
      ...form,
      brands: brandsArr,
      brand_incremental: Object.keys(brandIncrementalPayload).length > 0 ? brandIncrementalPayload : null,
    };
    try {
      const res = editId
        ? await fetch(`/api/data-integrations/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/data-integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Save failed"); }
      await fetchIntegrations(); setShowForm(false); setEditId(null); setChartRefreshKey((k) => k + 1);
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/data-integrations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteConfirm(null); await fetchIntegrations(); setChartRefreshKey((k) => k + 1);
    } catch { alert("Failed to delete integration"); }
  }

  return (
    <div className="flex flex-col min-h-screen bg-grey-50">
      {/* Header */}
      <div className="bg-white border-b border-grey-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/coverage" className="text-grey-400 hover:text-grey-700 transition-colors" title="Back">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-0.5">Coverage</p>
            <h1 className="text-lg font-bold text-grey-950 leading-tight">Data Integrations</h1>
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Integration
        </button>
      </div>

      <div className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">

        {/* KPI cards */}
        {integrations.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Live Coverage",    value: `${totalIncremental.toFixed(1)}%`,  sub: "cumulative incremental VIO", color: "text-grey-950" },
              { label: "Offline Coverage", value: `${offlineTotalVio.toFixed(1)}%`,   sub: "live offline integrations",  color: "text-grey-950" },
              { label: "Projected Offline",value: `${projectedOffline.toFixed(1)}%`,  sub: "including future targets",   color: "text-emerald-600" },
              { label: "Projected Total",  value: `${projectedTotal.toFixed(1)}%`,    sub: "including future targets",   color: "text-brand-blue" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-grey-100 p-4">
                <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-grey-400 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Coverage Roadmap Chart */}
        {integrations.length > 0 && (
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-6">
            <div className="h-1 bg-brand-blue" />
            <div className="px-5 pt-4 pb-3">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest">
                  VIN Coverage Roadmap
                </h2>
                <p className="text-xs text-grey-400 mt-0.5">
                  Current VIN coverage per brand · segments show incremental gain from upcoming integrations
                </p>
              </div>
              <CoverageRoadmapChart refreshKey={chartRefreshKey} />
            </div>
          </div>
        )}

        {/* Edit / Add form */}
        {showForm && (
          <div ref={formRef} className="bg-white border border-brand-blue rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-bold text-grey-950 mb-4">{editId ? "Edit Integration" : "Add Integration"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Integration Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Toyota OEM Direct" className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Type *</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "online" | "offline" }))} className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue bg-white">
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Relationship *</label>
                <select value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value as "direct" | "third-party" }))} className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue bg-white">
                  <option value="direct">Direct</option>
                  <option value="third-party">Third-party</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Integration Date *</label>
                <input type="date" value={form.integration_date} onChange={(e) => setForm((f) => ({ ...f, integration_date: e.target.value }))} className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue" />
                {form.integration_date && isFuture(form.integration_date) && (
                  <p className="text-xs text-amber-600 mt-1">Future date — will show as a projected target</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Brands (comma-separated)</label>
                <input type="text" value={brandsInput} onChange={(e) => setBrandsInput(e.target.value)} placeholder="e.g. TOYOTA, LEXUS, DAIHATSU" className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Total Global VIO %</label>
                <input type="number" min={0} max={100} step={0.1} value={form.total_vio_pct ?? ""} onChange={(e) => setForm((f) => ({ ...f, total_vio_pct: e.target.value === "" ? null : parseFloat(e.target.value) }))} placeholder="e.g. 12.5" className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue" />
                <p className="text-xs text-grey-400 mt-1">Total VIO % this integration covers</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Incremental Global VIO %</label>
                <input type="number" min={0} max={100} step={0.1} value={form.incremental_vio_pct ?? ""} onChange={(e) => setForm((f) => ({ ...f, incremental_vio_pct: e.target.value === "" ? null : parseFloat(e.target.value) }))} placeholder="e.g. 8.3" className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue" />
                <p className="text-xs text-grey-400 mt-1">New VIO % added on top of existing coverage</p>
              </div>
              {/* Data availability + cost */}
              <div className="col-span-2 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Data Availability</label>
                  <select
                    value={form.data_availability ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, data_availability: (e.target.value || null) as DataAvailability }))}
                    className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue bg-white"
                  >
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <option key={String(o.value)} value={o.value ?? ""}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Annual Cost (USD)</label>
                  <input
                    type="number" min={0} step={100}
                    value={form.annual_cost ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, annual_cost: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">Cost per VIN (USD)</label>
                  <input
                    type="number" min={0} step={0.001}
                    value={form.cost_per_vin ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, cost_per_vin: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                    placeholder="e.g. 0.05"
                    className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue tabular-nums"
                  />
                </div>
              </div>

              {/* Market-specific incremental fields */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">
                  Incremental by Market %{" "}
                  <span className="normal-case font-normal text-grey-400">— optional market-level overrides</span>
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {(["nz", "uk", "au", "us"] as const).map((m) => (
                    <div key={m}>
                      <label className="block text-xs font-semibold text-grey-400 uppercase tracking-wider mb-1">{m}</label>
                      <input
                        type="number" min={0} max={100} step={0.1}
                        value={form[`incremental_${m}_pct` as keyof typeof form] as number ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, [`incremental_${m}_pct`]: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                        placeholder="e.g. 5.0"
                        className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue tabular-nums"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-grey-400 mt-1">
                  Leave blank to fall back to the global incremental ÷ market count for roadmap projections.
                </p>
              </div>
              {/* Per-brand incremental coverage by market */}
              {(() => {
                const parsedBrands = brandsInput.split(",").map((b) => b.trim().toUpperCase()).filter(Boolean);
                if (parsedBrands.length === 0) return null;
                return (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">
                      Per-brand Incremental Coverage %{" "}
                      <span className="normal-case font-normal text-grey-400">
                        — % of <em>that brand&apos;s own VINs</em> newly covered (not % of global VIO)
                      </span>
                    </p>
                    <div className="border border-grey-200 rounded-lg overflow-hidden">
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-grey-50 border-b border-grey-200 z-10">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-grey-500 uppercase tracking-wider w-32">Brand</th>
                              {(["NZ", "UK", "AU", "US"] as const).map((m) => (
                                <th key={m} className="text-center px-2 py-2 font-semibold text-grey-500 uppercase tracking-wider">{m} %</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {parsedBrands.map((brand, idx) => (
                              <tr key={brand} className={idx % 2 === 0 ? "bg-white" : "bg-grey-50/50"}>
                                <td className="px-3 py-1.5 font-semibold text-grey-700 text-xs">{brand}</td>
                                {(["nz", "uk", "au", "us"] as const).map((m) => (
                                  <td key={m} className="px-2 py-1.5">
                                    <input
                                      type="number" min={0} max={100} step={0.1}
                                      value={brandIncremental[brand]?.[m] ?? ""}
                                      onChange={(e) => setBrandIncremental((prev) => ({
                                        ...prev,
                                        [brand]: {
                                          nz: prev[brand]?.nz ?? "",
                                          uk: prev[brand]?.uk ?? "",
                                          au: prev[brand]?.au ?? "",
                                          us: prev[brand]?.us ?? "",
                                          [m]: e.target.value,
                                        },
                                      }))}
                                      placeholder="—"
                                      className="w-full px-2 py-1 border border-grey-200 rounded text-xs text-grey-950 focus:outline-none focus:border-brand-blue text-center tabular-nums"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-xs text-grey-400 mt-1">
                      e.g. FIAT NZ=65 means &ldquo;this integration will cover 65% of NZ Fiat VINs that aren&apos;t covered today.&rdquo;
                      These values drive the roadmap chart bars. Leave blank to fall back to global VIO % ÷ brand count (less accurate).
                    </p>
                  </div>
                );
              })()}
            </div>
            {formError && <p className="text-sm text-red-600 mt-3">{formError}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? "Saving…" : editId ? "Save Changes" : "Add Integration"}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); setFormError(null); }} className="px-4 py-2 bg-grey-100 text-grey-700 text-sm font-semibold rounded-lg hover:bg-grey-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filter bar */}
        {!loading && integrations.length > 0 && (
          <div className="bg-white border border-grey-100 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search integrations or brands…"
                className="w-full pl-8 pr-3 py-1.5 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue"
              />
            </div>

            {/* Status quick-filter pills */}
            <div className="flex items-center gap-1 bg-grey-50 rounded-lg p-1">
              {(["all", "live", "upcoming"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    status === s
                      ? s === "upcoming"
                        ? "bg-amber-500 text-white"
                        : "bg-brand-blue text-white"
                      : "text-grey-500 hover:text-grey-800"
                  }`}
                >
                  {s === "all" ? "All" : s === "live" ? "Live" : `Upcoming${upcomingCount > 0 ? ` (${upcomingCount})` : ""}`}
                </button>
              ))}
            </div>

            {/* Type */}
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="px-3 py-1.5 border border-grey-200 rounded-lg text-sm text-grey-700 focus:outline-none focus:border-brand-blue bg-white">
              <option value="all">All types</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>

            {/* Relationship */}
            <select value={relFilter} onChange={(e) => setRelFilter(e.target.value as typeof relFilter)} className="px-3 py-1.5 border border-grey-200 rounded-lg text-sm text-grey-700 focus:outline-none focus:border-brand-blue bg-white">
              <option value="all">All relationships</option>
              <option value="direct">Direct</option>
              <option value="third-party">Third-party</option>
            </select>

            {/* Clear */}
            {hasFilters && (
              <button onClick={() => { setSearch(""); setTypeFilter("all"); setRelFilter("all"); setStatus("all"); }} className="text-xs font-semibold text-grey-400 hover:text-grey-700 transition-colors whitespace-nowrap">
                Clear filters
              </button>
            )}

            <span className="text-xs text-grey-400 ml-auto whitespace-nowrap">
              {filtered.length} of {integrations.length} shown
            </span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-grey-100 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-grey-400 text-sm">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 text-sm">{error}</div>
          ) : integrations.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-grey-400 text-sm mb-2">No data integrations yet.</p>
              <button onClick={openAdd} className="text-brand-blue text-sm font-semibold hover:underline">Add the first one →</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-grey-400 text-sm">
              No integrations match your filters.{" "}
              <button onClick={() => { setSearch(""); setTypeFilter("all"); setRelFilter("all"); setStatus("all"); }} className="text-brand-blue font-semibold hover:underline">Clear filters</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: "980px" }}>
                <thead>
                  <tr className="border-b border-grey-100 bg-grey-50">
                    <th className="sticky left-0 z-20 bg-grey-50 pl-3 pr-1.5 py-2 text-[10px] font-semibold text-grey-300 uppercase tracking-wider text-right w-8">#</th>
                    <th
                      className="sticky left-8 z-20 bg-grey-50 text-left px-3 py-2 text-[10px] font-semibold text-grey-500 uppercase tracking-wider cursor-pointer select-none hover:text-grey-800 transition-colors whitespace-nowrap shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]"
                      onClick={() => handleSort("name")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Integration
                        {sort.key === "name" ? <Arrow dir={sort.dir} /> : <span className="text-grey-300">↕</span>}
                      </span>
                    </th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-grey-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-grey-500 uppercase tracking-wider">Rel.</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-grey-500 uppercase tracking-wider">Brands</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-grey-500 uppercase tracking-wider text-left">Availability</th>
                    <SortTh label="Total VIO %" col="total_vio_pct" sort={sort} onSort={handleSort} right />
                    <SortTh label="Incremental" col="incremental_vio_pct" sort={sort} onSort={handleSort} right />
                    <th className="px-3 py-2 text-[10px] font-semibold text-grey-500 uppercase tracking-wider text-right">Cost</th>
                    <SortTh label="Date" col="integration_date" sort={sort} onSort={handleSort} />
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => {
                    const stickyBg = idx % 2 === 0 ? "bg-white" : "bg-grey-50/40";
                    return (
                    <tr key={row.id} className={`group border-b border-grey-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-grey-50/40"} hover:bg-blue-50/30 transition-colors`}>
                      <td className={`sticky left-0 z-10 pl-3 pr-1.5 py-1.5 font-mono text-grey-300 text-right tabular-nums transition-colors group-hover:bg-blue-50/30 ${stickyBg}`}>{idx + 1}</td>
                      <td className={`sticky left-8 z-10 px-3 py-1.5 font-medium text-grey-950 whitespace-nowrap transition-colors group-hover:bg-blue-50/30 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] ${stickyBg}`}>{row.name}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-semibold ${row.type === "online" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {row.type === "online" ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-semibold ${row.relationship === "direct" ? "bg-purple-100 text-purple-700" : "bg-grey-100 text-grey-600"}`}>
                          {row.relationship === "direct" ? "Direct" : "3rd party"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-grey-600 max-w-[200px]">
                        <BrandList brands={row.brands} />
                      </td>
                      <td className="px-3 py-1.5">
                        <AvailabilityBadge value={row.data_availability} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-grey-700">
                        {row.total_vio_pct != null ? `${row.total_vio_pct.toFixed(1)}%` : <span className="text-grey-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`font-mono font-semibold ${row.incremental_vio_pct != null ? "text-brand-blue" : "text-grey-300"}`}>
                            {row.incremental_vio_pct != null ? `+${row.incremental_vio_pct.toFixed(1)}%` : "—"}
                          </span>
                          {(() => {
                            const markets = (
                              [
                                { key: "nz" as const, label: "NZ", val: row.incremental_nz_pct },
                                { key: "uk" as const, label: "UK", val: row.incremental_uk_pct },
                                { key: "au" as const, label: "AU", val: row.incremental_au_pct },
                                { key: "us" as const, label: "US", val: row.incremental_us_pct },
                              ] as const
                            ).filter((m) => m.val != null);
                            if (markets.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-0.5 justify-end">
                                {markets.map((m) => (
                                  <span
                                    key={m.key}
                                    className="inline-flex items-center gap-px px-1 py-px rounded text-[9px] font-semibold bg-blue-50 text-blue-600 tabular-nums"
                                  >
                                    <span className="text-blue-400">{m.label}</span>
                                    <span>+{m.val!.toFixed(1)}%</span>
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {(row.annual_cost != null || row.cost_per_vin != null) ? (
                          <div className="flex flex-col items-end gap-px">
                            {row.annual_cost != null && (
                              <span className="font-mono font-semibold text-grey-700">{fmtCost(row.annual_cost)}<span className="font-normal text-grey-400">/yr</span></span>
                            )}
                            {row.cost_per_vin != null && (
                              <span className="font-mono text-grey-400">{fmtCost(row.cost_per_vin)}<span>/VIN</span></span>
                            )}
                          </div>
                        ) : <span className="text-grey-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-grey-700">{fmtDate(row.integration_date)}</span>
                          {isFuture(row.integration_date) && (
                            <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-semibold bg-amber-100 text-amber-700">TARGET</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        {deleteConfirm === row.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-grey-500">Delete?</span>
                            <button onClick={() => handleDelete(row.id)} className="font-semibold text-red-600 hover:text-red-700">Yes</button>
                            <button onClick={() => setDeleteConfirm(null)} className="font-semibold text-grey-400 hover:text-grey-600">No</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => openEdit(row)} className="font-semibold text-brand-blue hover:text-blue-700">Edit</button>
                            <button onClick={() => setDeleteConfirm(row.id)} className="font-semibold text-grey-400 hover:text-red-500">Del</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {integrations.length > 0 && (
          <p className="text-xs text-grey-400 mt-4">
            Integrations with a future date appear as dashed projections in the Coverage Rate Trend chart.
            Incremental VIO % is cumulative — each integration&apos;s value is added to the running total.
          </p>
        )}
      </div>
    </div>
  );
}
