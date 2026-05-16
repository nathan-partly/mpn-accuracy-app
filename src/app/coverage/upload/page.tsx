import Link from "next/link";
import { getCoverageSampleSnapshots } from "@/lib/queries";
import { CoverageUploadClient } from "@/components/CoverageUploadClient";

export const metadata = {
  title: "New Coverage Snapshot | Interpreter Metrics",
};

export const revalidate = 0;

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function CoverageUploadPage() {
  const snapshots = await getCoverageSampleSnapshots();
  const nonBaseline = snapshots.filter((s) => !s.is_baseline);

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">Coverage</p>
        <h1 className="text-2xl font-bold text-grey-950">New Coverage Snapshot</h1>
        <p className="text-grey-400 text-sm mt-1">
          Upload a regional VIN sample CSV to track coverage progress over time.
          Each upload is stored as a snapshot — historical data is preserved.
        </p>
      </div>

      {/* CSV format guide */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-5">
        <div className="h-1 bg-brand-blue" />
        <div className="p-6">
          <div className="flex gap-3 mb-3">
            <span className="flex-shrink-0 w-6 h-6 bg-brand-tint text-brand-blue rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
            <div>
              <p className="font-semibold text-grey-950 text-sm">Prepare your CSV</p>
              <p className="text-grey-400 text-sm mt-0.5">
                Required columns: <code className="bg-grey-50 px-1 py-0.5 rounded text-xs font-mono">Make</code>{" "}
                <code className="bg-grey-50 px-1 py-0.5 rounded text-xs font-mono">Region</code>{" "}
                <code className="bg-grey-50 px-1 py-0.5 rounded text-xs font-mono">VIN</code>{" "}
                <code className="bg-grey-50 px-1 py-0.5 rounded text-xs font-mono">Coverage Status</code> (Yes/No).
                Multiple regions can be in one file.
              </p>
            </div>
          </div>
          <div className="ml-9 bg-grey-50 rounded-lg px-4 py-3 font-mono text-xs text-grey-600 border border-grey-100">
            <div className="text-grey-400 mb-1">Make,Region,VIN,Coverage Status</div>
            <div>Toyota,UK,JTMBZ3FV30D012345,Yes</div>
            <div>Ford,UK,WF0FXXGCDF1A12345,No</div>
            <div>Honda,NZ,JHMCM56557C012345,Yes</div>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-8">
        <div className="h-1 bg-brand-blue" />
        <div className="p-6">
          <div className="flex gap-3 mb-5">
            <span className="flex-shrink-0 w-6 h-6 bg-brand-tint text-brand-blue rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
            <div>
              <p className="font-semibold text-grey-950 text-sm">Upload the snapshot CSV</p>
              <p className="text-grey-400 text-sm mt-0.5">
                Saved immediately to the database. The Coverage dashboard will show the latest data for each brand,
                falling back to older snapshots for brands not in this sample.
              </p>
            </div>
          </div>
          <CoverageUploadClient />
        </div>
      </div>

      {/* Snapshot history */}
      {nonBaseline.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">Snapshot History</h2>
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-brand-blue" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Region</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Brands</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Notes</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Uploaded by</th>
                </tr>
              </thead>
              <tbody>
                {nonBaseline.map((s, i) => (
                  <tr key={s.id} className={i !== nonBaseline.length - 1 ? "border-b border-grey-100" : ""}>
                    <td className="px-5 py-3.5 font-semibold text-grey-950 whitespace-nowrap">
                      {fmtDate(s.snapshot_date)}
                      {i === 0 && (
                        <span className="ml-2 text-xs font-semibold text-brand-blue bg-brand-tint px-1.5 py-0.5 rounded">Latest</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-bold text-grey-700 bg-grey-100 px-2 py-0.5 rounded">{s.region}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-grey-700 tabular-nums">{s.row_count ?? "—"}</td>
                    <td className="px-5 py-3.5 text-grey-500 text-xs">{s.notes ?? <span className="text-grey-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-right text-grey-400 text-xs">{s.uploaded_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Baseline note */}
      <div className="bg-grey-50 rounded-xl border border-grey-100 px-5 py-4 mb-8">
        <p className="text-xs text-grey-500">
          <span className="font-semibold text-grey-700">Baseline dataset</span> — the original large sample
          (April 2026, ~57k VINs across UK/NZ/AU/US) is stored as the baseline.
          It serves as the fallback for brands not covered by newer regional snapshots.
        </p>
      </div>

      <Link href="/coverage" className="text-sm text-brand-blue font-semibold hover:underline">
        ← Back to Coverage
      </Link>
    </div>
  );
}
