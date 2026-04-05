import { KpiCard } from "@/components/KpiCard";

export const metadata = {
  title: "Quality | Interpreter Metrics",
};

export default function QualityPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">
          Quality
        </p>
        <h1 className="text-2xl font-bold text-grey-950">
          Interpreter Response Quality
        </h1>
        <p className="text-grey-400 text-sm mt-1">
          Data completeness across interpreter responses — how fully populated are the fields returned for each VIN
        </p>
      </div>

      {/* Placeholder KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <KpiCard label="Overall Completeness" value="—" sub="Coming soon" highlight />
        <KpiCard label="Fully Complete" value="—" sub="All fields populated" />
        <KpiCard label="Partially Complete" value="—" sub="Some fields missing" />
        <KpiCard label="Empty Responses" value="—" sub="No fields returned" />
      </div>

      {/* Coming soon state */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-brand-blue" />
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-12 h-12 bg-brand-tint rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-brand-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
          </div>
          <h2 className="text-base font-bold text-grey-950 mb-2">
            Quality metrics coming soon
          </h2>
          <p className="text-sm text-grey-400 max-w-sm">
            This section will show field-level completeness across interpreter
            responses — how often make, model, year, engine, and other fields
            are returned for each brand and region.
          </p>
        </div>
      </div>
    </div>
  );
}
