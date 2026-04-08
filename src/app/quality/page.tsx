import Link from "next/link";
import {
  getLatestQualitySnapshot,
  getAllQualitySnapshots,
  getQualityTrendAllBrands,
} from "@/lib/queries";
import { KpiCard } from "@/components/KpiCard";
import { QualityTrendCharts } from "@/components/QualityTrendCharts";
import { QualityBrandTable } from "@/components/QualityBrandTable";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "Quality | Interpreter Metrics",
};

export const revalidate = 60;

export default async function QualityPage() {
  const [latest, snapshots, trendRows] = await Promise.all([
    getLatestQualitySnapshot(),
    getAllQualitySnapshots(),
    getQualityTrendAllBrands(),
  ]);

  if (!latest) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">Quality</p>
          <h1 className="text-2xl font-bold text-grey-950">Interpreter Response Quality</h1>
          <p className="text-grey-400 text-sm mt-1">
            Classification and annotation coverage — tracks brand progression toward L1 and L2 quality levels
          </p>
        </div>
        <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-brand-blue" />
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="w-12 h-12 bg-brand-tint rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-grey-950 mb-2">No snapshots yet</h2>
            <p className="text-sm text-grey-400 max-w-sm mb-6">
              Upload your first quality snapshot to start tracking classification and annotation coverage over time.
            </p>
            <Link href="/quality/upload" className="px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              Upload first snapshot
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { snapshot, brands } = latest;

  const l2 = brands.filter((b) => b.level === "L2");
  const l1 = brands.filter((b) => b.level === "L1");
  const l0 = brands.filter((b) => b.level === "L0");
  const unsupported = brands.filter((b) => b.level === "Unsupported");

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">Quality</p>
          <h1 className="text-2xl font-bold text-grey-950">Interpreter Response Quality</h1>
          <p className="text-grey-400 text-sm mt-1">
            Classification &amp; annotation coverage · snapshot {formatDate(snapshot.snapshot_date)} ·{" "}
            {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <Link
          href="/quality/upload"
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Snapshot
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <KpiCard label="Level 2 Brands" value={l2.length} sub="≥80% classification & annotation" highlight />
        <KpiCard label="Level 1 Brands" value={l1.length} sub="≥20% classification & annotation" />
        <KpiCard label="Level 0 Brands" value={l0.length} sub="Below L1 threshold" />
        <KpiCard label="Unsupported" value={unsupported.length} sub="No EPC data" />
      </div>

      {/* Level thresholds legend */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-6">
        <div className="h-1 bg-brand-blue" />
        <div className="px-5 py-4 flex flex-wrap gap-6 text-xs text-grey-500">
          <span className="flex items-center gap-1.5"><span className="font-bold text-brand-blue">L2</span>≥80% classification + ≥80% annotation + all quality gates</span>
          <span className="flex items-center gap-1.5"><span className="font-bold text-emerald-700">L1</span>≥20% classification + ≥20% annotation + diagram style</span>
          <span className="flex items-center gap-1.5"><span className="font-bold text-amber-600">L0</span>Below L1 threshold</span>
          <span className="ml-auto text-grey-400">Ranked by VIO market share · VIO % = avg across NZ+UK+AU+US</span>
        </div>
      </div>

      {/* Trend charts (client component) — only shown when ≥2 snapshots */}
      {snapshots.length >= 2 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">
            Coverage Trends · {snapshots.length} snapshots
          </h2>
          <QualityTrendCharts rows={trendRows} />
        </section>
      )}

      {/* Brand table (client component — filter + sort) */}
      <QualityBrandTable brands={brands} />

      {/* Previous snapshots */}
      {snapshots.length > 1 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">Snapshot History</h2>
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-brand-blue" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Brands</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Notes</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Uploaded by</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => (
                  <tr key={s.id} className={i !== snapshots.length - 1 ? "border-b border-grey-100" : ""}>
                    <td className="px-5 py-3.5 font-semibold text-grey-950">
                      {formatDate(s.snapshot_date)}
                      {i === 0 && (
                        <span className="ml-2 text-xs font-semibold text-brand-blue bg-brand-tint px-1.5 py-0.5 rounded">Latest</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-grey-900">{s.brand_count}</td>
                    <td className="px-5 py-3.5 text-grey-500">{s.notes ?? <span className="text-grey-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-right text-grey-400 text-xs">{s.uploaded_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
