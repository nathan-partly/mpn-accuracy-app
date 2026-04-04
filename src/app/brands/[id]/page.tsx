import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getBrandById,
  getSnapshotsForBrand,
  getAccuracyHistory,
  getModelBreakdown,
  getPartTypeBreakdown,
  getProviderBreakdown,
  getRegionBreakdown,
  getEpcSourceBreakdown,
  getRecordsForSnapshot,
} from "@/lib/queries";
import { KpiCard } from "@/components/KpiCard";
import { AccuracyBadge } from "@/components/AccuracyBadge";
import { AccuracyChart } from "@/components/AccuracyChart";
import { ExpandableModelTable } from "@/components/ExpandableModelTable";
import { formatDate, formatPct, accuracyPct } from "@/lib/utils";

export const revalidate = 60;

interface Props {
  params: { id: string };
  searchParams: { snapshot?: string };
}

export default async function BrandDetailPage({ params, searchParams }: Props) {
  const brand = await getBrandById(params.id);
  if (!brand) notFound();

  const [snapshots, history] = await Promise.all([
    getSnapshotsForBrand(params.id),
    getAccuracyHistory(params.id),
  ]);

  if (snapshots.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Breadcrumb brandName={brand.name} />
        <h1 className="text-2xl font-bold text-grey-950 mb-2">{brand.name}</h1>
        <p className="text-grey-400 text-sm mb-8">No benchmark data yet.</p>
        <Link
          href="/upload"
          className="inline-block bg-brand-blue text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Upload results
        </Link>
      </div>
    );
  }

  // Active snapshot: from query param or default to latest
  const activeSnapshotId =
    searchParams.snapshot ?? snapshots[0].id;
  const activeSnapshot =
    snapshots.find((s) => s.id === activeSnapshotId) ?? snapshots[0];

  const [modelBreakdown, partTypeBreakdown, providerBreakdown, regionBreakdown, epcSourceBreakdown, records] = await Promise.all([
    getModelBreakdown(activeSnapshot.id),
    getPartTypeBreakdown(activeSnapshot.id),
    getProviderBreakdown(activeSnapshot.id),
    getRegionBreakdown(activeSnapshot.id),
    getEpcSourceBreakdown(activeSnapshot.id),
    getRecordsForSnapshot(activeSnapshot.id),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <Breadcrumb brandName={brand.name} />

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-grey-950">{brand.name}</h1>
          <p className="text-grey-400 text-sm mt-1">
            {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} ·
            Latest: {formatDate(snapshots[0].snapshot_date)}
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-block bg-brand-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Re-upload master CSV
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Accuracy"
          value={activeSnapshot.total_parts > 0 ? formatPct(activeSnapshot.accuracy_pct) : "No data"}
          sub={`${activeSnapshot.valid_count} valid / ${activeSnapshot.invalid_count} invalid`}
          highlight
        />
        <KpiCard
          label="VINs Checked"
          value={activeSnapshot.active_vins.toLocaleString()}
          sub={`${(activeSnapshot.total_vins - activeSnapshot.active_vins).toLocaleString()} skipped`}
        />
        <KpiCard
          label="Parts Validated"
          value={activeSnapshot.total_parts.toLocaleString()}
          sub={`${activeSnapshot.skipped_count} skipped`}
        />
        <KpiCard
          label="Snapshots"
          value={snapshots.length}
          sub={`since ${formatDate(snapshots[snapshots.length - 1].snapshot_date)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Accuracy over time */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-brand-blue" />
          <div className="p-5">
            <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
              Accuracy Over Time
            </p>
            <AccuracyChart data={history} />
          </div>
        </div>

        {/* Snapshot selector */}
        <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-brand-blue" />
          <div className="p-5">
            <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
              Snapshots
            </p>
            <div className="space-y-2">
              {snapshots.map((s) => (
                <Link
                  key={s.id}
                  href={`/brands/${brand.id}?snapshot=${s.id}`}
                  className={`block rounded-lg border px-3 py-2.5 transition-colors text-sm ${
                    s.id === activeSnapshot.id
                      ? "border-brand-blue bg-brand-tint"
                      : "border-grey-100 hover:bg-grey-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-semibold ${
                        s.id === activeSnapshot.id
                          ? "text-brand-blue"
                          : "text-grey-950"
                      }`}
                    >
                      {formatDate(s.snapshot_date)}
                    </span>
                    <AccuracyBadge pct={accuracyPct(s.accuracy_pct, s.total_parts)} />
                  </div>
                  {s.notes && (
                    <p className="text-xs text-grey-400 mt-1 truncate">
                      {s.notes}
                    </p>
                  )}
                  <p className="text-xs text-grey-400 mt-1">
                    {s.total_parts.toLocaleString()} parts · {s.total_vins} VINs
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Provider + Region + EPC source split */}
      {(providerBreakdown.length > 0 || regionBreakdown.length > 0 || epcSourceBreakdown.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {providerBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-brand-blue" />
              <div className="p-5">
                <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
                  Data Provider Split
                </p>
                <div className="space-y-3">
                  {providerBreakdown.map((p) => (
                    <div key={p.upstream_provider}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-grey-950">{p.upstream_provider}</span>
                        <span className="text-sm text-grey-400">
                          {p.vin_count} VIN{p.vin_count !== 1 ? "s" : ""} · {Number(p.pct).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-grey-100 rounded-full h-2">
                        <div className="bg-brand-blue h-2 rounded-full" style={{ width: `${Number(p.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {regionBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-brand-blue" />
              <div className="p-5">
                <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
                  Region Split
                </p>
                <div className="space-y-3">
                  {regionBreakdown.map((r) => (
                    <div key={r.region}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-grey-950">{r.region}</span>
                        <span className="text-sm text-grey-400">
                          {r.vin_count} VIN{r.vin_count !== 1 ? "s" : ""} · {Number(r.pct).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-grey-100 rounded-full h-2">
                        <div className="bg-brand-blue h-2 rounded-full" style={{ width: `${Number(r.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {epcSourceBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-brand-blue" />
              <div className="p-5">
                <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-1">
                  EPC Validation Source
                </p>
                <p className="text-xs text-grey-400 mb-4">
                  Of validated parts only
                </p>
                <div className="space-y-3">
                  {epcSourceBreakdown.map((e) => (
                    <div key={e.epc_source}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-grey-950">{e.epc_source}</span>
                        <span className="text-sm text-grey-400">
                          {Number(e.part_count).toLocaleString()} parts · {Number(e.pct).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-grey-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${e.epc_source === "Non-Original EPC" ? "bg-amber-400" : "bg-brand-blue"}`}
                          style={{ width: `${Number(e.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Model breakdown — expandable rows */}
      {modelBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-6">
          <div className="h-1 bg-brand-blue" />
          <div className="p-5">
            <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
              Breakdown by Model
            </p>
            <ExpandableModelTable modelBreakdown={modelBreakdown} records={records} />
          </div>
        </div>
      )}

      {/* Part type breakdown */}
      {partTypeBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-6">
          <div className="h-1 bg-brand-blue" />
          <div className="p-5">
            <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
              Breakdown by Part Type
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-100">
                  <th className="text-left pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Part Type</th>
                  <th className="text-right pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Total</th>
                  <th className="text-right pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Valid</th>
                  <th className="text-right pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Invalid</th>
                  <th className="text-right pb-2 text-xs text-grey-400 font-semibold uppercase tracking-widest">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {partTypeBreakdown.map((row, i) => (
                  <tr
                    key={row.part_type}
                    className={i !== partTypeBreakdown.length - 1 ? "border-b border-grey-100" : ""}
                  >
                    <td className="py-2.5 font-medium text-grey-950">{row.part_type}</td>
                    <td className="py-2.5 text-right text-grey-900">{row.total_parts}</td>
                    <td className="py-2.5 text-right text-emerald-700 font-medium">{row.valid_count}</td>
                    <td className="py-2.5 text-right text-red-600 font-medium">{row.invalid_count}</td>
                    <td className="py-2.5 text-right">
                      <AccuracyBadge pct={accuracyPct(row.accuracy_pct, row.total_parts)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

function Breadcrumb({ brandName }: { brandName: string }) {
  return (
    <nav className="flex items-center gap-2 text-xs text-grey-400 mb-4">
      <Link href="/" className="hover:text-brand-blue transition-colors">
        Dashboard
      </Link>
      <span>/</span>
      <span className="text-grey-900">{brandName}</span>
    </nav>
  );
}
