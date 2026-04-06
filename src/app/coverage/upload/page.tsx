import Link from "next/link";

export const metadata = {
  title: "Update Coverage | Interpreter Metrics",
};

export default function CoverageUploadPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">Coverage</p>
        <h1 className="text-2xl font-bold text-grey-950">New Coverage Snapshot</h1>
        <p className="text-grey-400 text-sm mt-1">
          Replace the VIN coverage dashboard with a freshly generated report.
        </p>
      </div>

      {/* Instructions card */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-6">
        <div className="h-1 bg-brand-blue" />
        <div className="p-6">
          <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">How to update</h2>
          <ol className="space-y-4 text-sm text-grey-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-tint text-brand-blue rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-semibold text-grey-950">Run the coverage generation script</p>
                <p className="text-grey-400 mt-0.5">This produces a self-contained <code className="bg-grey-50 px-1 py-0.5 rounded text-xs font-mono">coverage-dashboard.html</code> file from the master VIN list.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-tint text-brand-blue rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-semibold text-grey-950">Replace the file in the repository</p>
                <p className="text-grey-400 mt-0.5">Copy the new file to <code className="bg-grey-50 px-1 py-0.5 rounded text-xs font-mono">public/coverage-dashboard.html</code> and push to main.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-tint text-brand-blue rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-semibold text-grey-950">Vercel redeploys automatically</p>
                <p className="text-grey-400 mt-0.5">The dashboard will reflect the new data within a minute of the deploy completing.</p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <Link
        href="/coverage"
        className="text-sm text-brand-blue font-semibold hover:underline"
      >
        ← Back to Coverage
      </Link>
    </div>
  );
}
