import clsx from "clsx";
import Link from "next/link";
import { getAllBrands, getGlobalStats, getGlobalProviderStats } from "@/lib/queries";
import { KpiCard } from "@/components/KpiCard";
import { AccuracyBadge } from "@/components/AccuracyBadge";
import { formatDate, accuracyPct } from "@/lib/utils";
import type { Brand, GlobalProviderStat } from "@/types";

export const revalidate = 60; // ISR — revalidate every 60s

export default async function DashboardPage() {
  const [brands, stats, providerStats] = await Promise.all([
    getAllBrands(),
    getGlobalStats(),
    getGlobalProviderStats(),
  ]);

  const benchmarked = brands.filter((b) => b.latest_snapshot_date);
  const pending     = brands.filter((b) => !b.latest_snapshot_date);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">
            Accuracy
          </p>
          <h1 className="text-2xl font-bold text-grey-950">
            Interpreter Accuracy Benchmarking
          </h1>
          <p className="text-grey-400 text-sm mt-1">
            MPN accuracy validation across all benchmarked brands · {benchmarked.length} benchmarked · {pending.length} pending
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Upload Results
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <KpiCard
          label="Overall Accuracy"
          value={`${Number(stats?.overall_accuracy_pct ?? 0).toFixed(2)}%`}
          sub={`${stats?.valid_count ?? 0} valid / ${stats?.invalid_count ?? 0} invalid`}
          highlight
        />
        <KpiCard
          label="Brands Benchmarked"
          value={benchmarked.length}
          sub={`${pending.length} pending`}
        />
        <KpiCard
          label="VINs Checked"
          value={Number(stats?.total_vins ?? 0).toLocaleString()}
          sub="with at least one part tested"
        />
        <KpiCard
          label="Parts Validated"
          value={Number(stats?.total_parts ?? 0).toLocaleString()}
          sub="excluding skipped / no data"
        />
      </div>

      {/* Benchmarked brands table */}
      {benchmarked.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">
            Benchmarked Brands
          </h2>
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-brand-blue" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Brand
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    VINs
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Parts
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Valid
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Invalid
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Accuracy
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Last Updated
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {benchmarked.map((brand, i) => (
                  <BrandRow
                    key={brand.id}
                    brand={brand}
                    isLast={i === benchmarked.length - 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pending brands */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">
            Pending Benchmarking
          </h2>
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-brand-blue" />
            <table className="w-full text-sm">
              <tbody>
                {pending.map((brand, i) => (
                  <tr
                    key={brand.id}
                    className={
                      i !== pending.length - 1
                        ? "border-b border-grey-100"
                        : ""
                    }
                  >
                    <td className="px-5 py-3 font-medium text-grey-900">
                      {brand.name}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-grey-400 bg-grey-50 border border-grey-100 px-2 py-0.5 rounded">
                        No data yet
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href="/upload"
                        className="text-xs text-brand-blue font-semibold hover:underline"
                      >
                        Upload master CSV →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Accuracy by data provider */}
      {providerStats.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">
            Accuracy by Data Provider
          </h2>
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-brand-blue" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Provider
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Parts Validated
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Valid
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Invalid
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">
                    Accuracy
                  </th>
                </tr>
              </thead>
              <tbody>
                {providerStats.map((p, i) => (
                  <ProviderRow
                    key={p.provider}
                    stat={p}
                    isLast={i === providerStats.length - 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function ProviderRow({
  stat,
  isLast,
}: {
  stat: GlobalProviderStat;
  isLast: boolean;
}) {
  return (
    <tr className={clsx("transition-colors", !isLast && "border-b border-grey-100")}>
      <td className="px-5 py-3.5 font-semibold text-grey-950">{stat.provider}</td>
      <td className="px-5 py-3.5 text-right text-grey-900">
        {Number(stat.total_parts).toLocaleString()}
      </td>
      <td className="px-5 py-3.5 text-right text-emerald-700 font-medium">
        {Number(stat.valid_count).toLocaleString()}
      </td>
      <td className="px-5 py-3.5 text-right text-red-600 font-medium">
        {Number(stat.invalid_count).toLocaleString()}
      </td>
      <td className="px-5 py-3.5 text-right">
        <AccuracyBadge pct={accuracyPct(stat.accuracy_pct, stat.total_parts)} />
      </td>
    </tr>
  );
}

function BrandRow({
  brand,
  isLast,
}: {
  brand: Brand;
  isLast: boolean;
}) {
  return (
    <tr
      className={clsx(
        "hover:bg-grey-50 transition-colors",
        !isLast && "border-b border-grey-100"
      )}
    >
      <td className="px-5 py-3.5 font-semibold text-grey-950">
        {brand.name}
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
  );
}
