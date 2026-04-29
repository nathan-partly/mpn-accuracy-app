import Link from "next/link";
import { CoverageVinTable } from "@/components/CoverageVinTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VIN Dataset | Interpreter Metrics",
};

export default function CoverageDatasetPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">
            Coverage · VIN Dataset
          </p>
          <h1 className="text-2xl font-bold text-grey-950">
            VIN Sample Analysis
          </h1>
          <p className="text-grey-400 text-sm mt-1">
            Per-brand coverage, block rule impact, and upstream provider breakdown across the VIN dataset
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/coverage/integrations"
            className="flex items-center gap-2 px-4 py-2 bg-white text-brand-blue text-sm font-semibold rounded-lg border border-brand-blue hover:bg-blue-50 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
            </svg>
            Integrations
          </Link>
          <Link
            href="/coverage"
            className="flex items-center gap-2 px-4 py-2 bg-white text-grey-600 text-sm font-semibold rounded-lg border border-grey-200 hover:bg-grey-50 transition-colors flex-shrink-0"
          >
            ← Coverage Dashboard
          </Link>
        </div>
      </div>

      {/* Callout: blocked = no coverage */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="text-sm text-amber-800">
          <span className="font-semibold">Block rules count as no coverage.</span>{" "}
          VINs with a matched block rule are excluded from interpreter results — coverage % treats them the same as &ldquo;not found&rdquo;.
          The <span className="font-semibold">Blocked</span> and <span className="font-semibold">Block %</span> columns show how much of each brand&apos;s dataset is currently impacted.
        </div>
      </div>

      <CoverageVinTable />
    </div>
  );
}
