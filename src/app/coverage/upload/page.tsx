import Link from "next/link";
import { getAllCoverageSnapshots } from "@/lib/queries";
import { CoverageUploadClient } from "@/components/CoverageUploadClient";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "Update Coverage | Interpreter Metrics",
};

export const revalidate = 0;

export default async function CoverageUploadPage() {
  const snapshots = await getAllCoverageSnapshots();

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">Coverage</p>
        <h1 className="text-2xl font-bold text-grey-950">New Coverage Snapshot</h1>
        <p className="text-grey-400 text-sm mt-1">
          Download the current data, update it with your generation script, then re-upload.
        </p>
      </div>

      {/* Step 1: Download */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-5">
        <div className="h-1 bg-brand-blue" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-tint text-brand-blue rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
              <div>
                <p className="font-semibold text-grey-950 text-sm">Download current coverage data</p>
                <p className="text-grey-400 text-sm mt-0.5">
                  Get the latest <code className="bg-grey-50 px-1 py-0.5 rounded text-xs font-mono">coverage-dashboard.html</code> to use as a base for your update.
                </p>
              </div>
            </div>
            <a
              href="/api/coverage-html"
              download="coverage-dashboard.html"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border border-brand-blue text-brand-blue text-sm font-semibold rounded-lg hover:bg-brand-tint transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download
            </a>
          </div>
        </div>
      </div>

      {/* Step 2: Regenerate (instruction only) */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-5">
        <div className="h-1 bg-grey-100" />
        <div className="p-6 flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 bg-grey-100 text-grey-500 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
          <div>
            <p className="font-semibold text-grey-950 text-sm">Run your coverage generation script</p>
            <p className="text-grey-400 text-sm mt-0.5">
              This produces a fresh <code className="bg-grey-50 px-1 py-0.5 rounded text-xs font-mono">coverage-dashboard.html</code> from the latest VIN master list.
            </p>
          </div>
        </div>
      </div>

      {/* Step 3: Upload (client component) */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-8">
        <div className="h-1 bg-brand-blue" />
        <div className="p-6">
          <div className="flex gap-3 mb-5">
            <span className="flex-shrink-0 w-6 h-6 bg-brand-tint text-brand-blue rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</span>
            <div>
              <p className="font-semibold text-grey-950 text-sm">Upload the new coverage file</p>
              <p className="text-grey-400 text-sm mt-0.5">
                Drop or select the new <code className="bg-grey-50 px-1 py-0.5 rounded text-xs font-mono">coverage-dashboard.html</code>. It will be live immediately — no deploy needed.
              </p>
            </div>
          </div>
          <CoverageUploadClient />
        </div>
      </div>

      {/* Upload history */}
      {snapshots.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">Upload History</h2>
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-brand-blue" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-100">
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">#</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Uploaded at</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Uploaded by</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => (
                  <tr key={s.id} className={i !== snapshots.length - 1 ? "border-b border-grey-100" : ""}>
                    <td className="px-5 py-3.5 text-right text-grey-400 tabular-nums text-xs">
                      #{s.id}
                      {i === 0 && (
                        <span className="ml-2 text-xs font-semibold text-brand-blue bg-brand-tint px-1.5 py-0.5 rounded">Live</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-grey-700">{formatDate(s.created_at)}</td>
                    <td className="px-5 py-3.5 text-right text-grey-400 text-xs">{s.uploaded_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-8">
        <Link href="/coverage" className="text-sm text-brand-blue font-semibold hover:underline">
          ← Back to Coverage
        </Link>
      </div>
    </div>
  );
}
