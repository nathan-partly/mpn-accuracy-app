"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Snapshot {
  id: number;
  region: string;
  snapshot_date: string;
  uploaded_by: string | null;
  notes: string | null;
  row_count: number | null;
  is_baseline: boolean;
}

const REGIONS = ["UK", "NZ", "AU", "US", "ALL"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function EditRow({
  snap,
  onDone,
}: {
  snap: Snapshot;
  onDone: () => void;
}) {
  const [region, setRegion] = useState(snap.region);
  const [date, setDate] = useState(snap.snapshot_date);
  const [notes, setNotes] = useState(snap.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/coverage-samples/${snap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, snapshot_date: date, notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-brand-tint border-b border-grey-100">
      <td className="px-5 py-3" colSpan={5}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-grey-600 mb-1">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-grey-200 rounded-lg focus:outline-none focus:border-brand-blue bg-white"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-grey-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-grey-200 rounded-lg focus:outline-none focus:border-brand-blue"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-grey-600 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional description"
              className="w-full px-2.5 py-1.5 text-sm border border-grey-200 rounded-lg focus:outline-none focus:border-brand-blue"
            />
          </div>
          <div className="flex gap-2 pb-0.5">
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold bg-brand-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={onDone}
              className="px-3 py-1.5 text-xs font-semibold text-grey-500 hover:text-grey-700"
            >
              Cancel
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}
      </td>
    </tr>
  );
}

export function SnapshotManager({ snapshots }: { snapshots: Snapshot[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const router = useRouter();

  const nonBaseline = snapshots.filter((s) => !s.is_baseline);

  async function handleDelete(id: number) {
    if (!confirm("Delete this snapshot? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/coverage-samples/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  if (nonBaseline.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold text-grey-950 uppercase tracking-widest mb-4">Snapshot History</h2>
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-x-auto">
        <div className="h-1 bg-brand-blue" />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Region</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Brands</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Notes</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Uploaded by</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {nonBaseline.map((s, i) => (
              editingId === s.id ? (
                <EditRow key={s.id} snap={s} onDone={() => setEditingId(null)} />
              ) : (
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
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditingId(s.id)}
                        className="text-xs text-brand-blue font-semibold hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={deletingId === s.id}
                        className="text-xs text-red-500 font-semibold hover:underline disabled:opacity-50"
                      >
                        {deletingId === s.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
