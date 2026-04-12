"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface DataIntegration {
  id: number;
  name: string;
  type: "online" | "offline";
  brands: string[];
  total_vio_pct: number | null;
  incremental_vio_pct: number | null;
  integration_date: string;
}

const EMPTY_FORM: Omit<DataIntegration, "id"> = {
  name: "",
  type: "online",
  brands: [],
  total_vio_pct: null,
  incremental_vio_pct: null,
  integration_date: "",
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isFuture(iso: string) {
  return iso > today();
}

export default function DataIntegrationsPage() {
  const [integrations, setIntegrations] = useState<DataIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<DataIntegration, "id">>(EMPTY_FORM);
  const [brandsInput, setBrandsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

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

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setBrandsInput("");
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(row: DataIntegration) {
    setEditId(row.id);
    setForm({
      name: row.name,
      type: row.type,
      brands: row.brands,
      total_vio_pct: row.total_vio_pct,
      incremental_vio_pct: row.incremental_vio_pct,
      integration_date: row.integration_date,
    });
    setBrandsInput(row.brands.join(", "));
    setFormError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.integration_date) {
      setFormError("Integration name and date are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      ...form,
      brands: brandsInput
        .split(",")
        .map((b) => b.trim().toUpperCase())
        .filter(Boolean),
    };
    try {
      const res = editId
        ? await fetch(`/api/data-integrations/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/data-integrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Save failed");
      }
      await fetchIntegrations();
      setShowForm(false);
      setEditId(null);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/data-integrations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteConfirm(null);
      await fetchIntegrations();
    } catch {
      alert("Failed to delete integration");
    }
  }

  // Summary stats
  const totalIncremental = integrations
    .filter((i) => !isFuture(i.integration_date))
    .reduce((sum, i) => sum + (i.incremental_vio_pct ?? 0), 0);
  const offlineIncremental = integrations
    .filter((i) => i.type === "offline" && !isFuture(i.integration_date))
    .reduce((sum, i) => sum + (i.incremental_vio_pct ?? 0), 0);
  const projectedTotal = integrations
    .reduce((sum, i) => sum + (i.incremental_vio_pct ?? 0), 0);

  return (
    <div className="flex flex-col min-h-screen bg-grey-50">
      {/* Header */}
      <div className="bg-white border-b border-grey-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/coverage"
            className="text-grey-400 hover:text-grey-700 transition-colors"
            title="Back to Coverage Dashboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-0.5">
              Coverage
            </p>
            <h1 className="text-lg font-bold text-grey-950 leading-tight">Data Integrations</h1>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Integration
        </button>
      </div>

      <div className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">

        {/* Summary KPI row */}
        {integrations.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-grey-100 p-4">
              <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-1">Live Coverage</p>
              <p className="text-2xl font-bold text-grey-950">{totalIncremental.toFixed(1)}%</p>
              <p className="text-xs text-grey-400 mt-0.5">cumulative incremental VIO</p>
            </div>
            <div className="bg-white rounded-xl border border-grey-100 p-4">
              <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-1">Offline Coverage</p>
              <p className="text-2xl font-bold text-grey-950">{offlineIncremental.toFixed(1)}%</p>
              <p className="text-xs text-grey-400 mt-0.5">from offline integrations</p>
            </div>
            <div className="bg-white rounded-xl border border-grey-100 p-4">
              <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-1">Projected Total</p>
              <p className="text-2xl font-bold text-brand-blue">{projectedTotal.toFixed(1)}%</p>
              <p className="text-xs text-grey-400 mt-0.5">including future targets</p>
            </div>
          </div>
        )}

        {/* Add / Edit Form */}
        {showForm && (
          <div className="bg-white border border-grey-100 rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-bold text-grey-950 mb-4">
              {editId ? "Edit Integration" : "Add Integration"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">
                  Integration Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Toyota OEM Direct"
                  className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">
                  Type *
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "online" | "offline" }))}
                  className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue bg-white"
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              {/* Integration Date */}
              <div>
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">
                  Integration Date *
                </label>
                <input
                  type="date"
                  value={form.integration_date}
                  onChange={(e) => setForm((f) => ({ ...f, integration_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue"
                />
                {form.integration_date && isFuture(form.integration_date) && (
                  <p className="text-xs text-amber-600 mt-1">Future date — will show as a projected target</p>
                )}
              </div>

              {/* Brands */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">
                  Brands (comma-separated)
                </label>
                <input
                  type="text"
                  value={brandsInput}
                  onChange={(e) => setBrandsInput(e.target.value)}
                  placeholder="e.g. TOYOTA, LEXUS, DAIHATSU"
                  className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue"
                />
              </div>

              {/* Total VIO % */}
              <div>
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">
                  Total Global VIO %
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.total_vio_pct ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      total_vio_pct: e.target.value === "" ? null : parseFloat(e.target.value),
                    }))
                  }
                  placeholder="e.g. 12.5"
                  className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue"
                />
                <p className="text-xs text-grey-400 mt-1">Total VIO % this integration covers</p>
              </div>

              {/* Incremental VIO % */}
              <div>
                <label className="block text-xs font-semibold text-grey-500 uppercase tracking-wider mb-1">
                  Incremental Global VIO %
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.incremental_vio_pct ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      incremental_vio_pct: e.target.value === "" ? null : parseFloat(e.target.value),
                    }))
                  }
                  placeholder="e.g. 8.3"
                  className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue"
                />
                <p className="text-xs text-grey-400 mt-1">New VIO % added on top of existing coverage</p>
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-600 mt-3">{formError}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : editId ? "Save Changes" : "Add Integration"}
              </button>
              <button
                onClick={cancelForm}
                className="px-4 py-2 bg-grey-100 text-grey-700 text-sm font-semibold rounded-lg hover:bg-grey-200 transition-colors"
              >
                Cancel
              </button>
            </div>
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
              <button
                onClick={openAdd}
                className="text-brand-blue text-sm font-semibold hover:underline"
              >
                Add the first one →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grey-100 bg-grey-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-grey-500 uppercase tracking-wider">
                      Integration
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-grey-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-grey-500 uppercase tracking-wider">
                      Brands
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-grey-500 uppercase tracking-wider">
                      Total VIO %
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-grey-500 uppercase tracking-wider">
                      Incremental VIO %
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-grey-500 uppercase tracking-wider">
                      Integration Date
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`border-b border-grey-100 last:border-0 ${
                        idx % 2 === 0 ? "bg-white" : "bg-grey-50/40"
                      } hover:bg-blue-50/30 transition-colors`}
                    >
                      <td className="px-4 py-3 font-medium text-grey-950">{row.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.type === "online"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {row.type === "online" ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-grey-600 max-w-xs">
                        {row.brands.length === 0 ? (
                          <span className="text-grey-300">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {row.brands.slice(0, 5).map((b) => (
                              <span
                                key={b}
                                className="inline-block px-1.5 py-0.5 bg-grey-100 text-grey-600 rounded text-xs"
                              >
                                {b}
                              </span>
                            ))}
                            {row.brands.length > 5 && (
                              <span className="inline-block px-1.5 py-0.5 bg-grey-100 text-grey-400 rounded text-xs">
                                +{row.brands.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-grey-700">
                        {row.total_vio_pct != null ? `${row.total_vio_pct.toFixed(1)}%` : <span className="text-grey-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-grey-950">
                        {row.incremental_vio_pct != null ? (
                          <span className="text-brand-blue">+{row.incremental_vio_pct.toFixed(1)}%</span>
                        ) : (
                          <span className="text-grey-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-grey-700 whitespace-nowrap">
                        {fmtDate(row.integration_date)}
                        {isFuture(row.integration_date) && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
                            TARGET
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {deleteConfirm === row.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-grey-500">Delete?</span>
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="text-xs font-semibold text-red-600 hover:text-red-700"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs font-semibold text-grey-400 hover:text-grey-600"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 justify-end">
                            <button
                              onClick={() => openEdit(row)}
                              className="text-xs font-semibold text-brand-blue hover:text-blue-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(row.id)}
                              className="text-xs font-semibold text-grey-400 hover:text-red-500"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend note */}
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
