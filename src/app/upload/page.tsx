"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import type { CsvRow } from "@/types";
import { parseIsValid } from "@/lib/utils";

const REQUIRED_COLUMNS = ["vin", "part_type", "is_valid"];

type UploadState = "idle" | "parsing" | "preview" | "uploading" | "success" | "error";

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>("idle");
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandId, setBrandId] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [uploadedSnapshotId, setUploadedSnapshotId] = useState("");

  // Load brands on mount
  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data) => setBrands(data ?? []));
  }, []);

  const handleFile = useCallback((file: File) => {
    setState("parsing");
    setParseErrors([]);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        const errors: string[] = [];

        // Check required columns
        const headers = results.meta.fields ?? [];
        for (const col of REQUIRED_COLUMNS) {
          if (!headers.includes(col)) {
            errors.push(`Missing required column: "${col}"`);
          }
        }

        if (errors.length > 0) {
          setParseErrors(errors);
          setState("idle");
          return;
        }

        const rows = results.data as unknown as CsvRow[];
        const validRows = rows.filter(
          (r) => r.vin?.trim() && r.part_type?.trim()
        );

        if (validRows.length === 0) {
          setParseErrors(["No valid rows found. Check that VIN and part_type columns are populated."]);
          setState("idle");
          return;
        }

        setParsedRows(validRows);
        setState("preview");
      },
      error: (err) => {
        setParseErrors([`CSV parse error: ${err.message}`]);
        setState("idle");
      },
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSubmit = async () => {
    if (!brandId) {
      setErrorMsg("Please select a brand.");
      return;
    }
    if (!snapshotDate) {
      setErrorMsg("Please set a snapshot date.");
      return;
    }

    setState("uploading");
    setErrorMsg("");

    const payload = {
      brand_id: brandId,
      snapshot_date: snapshotDate,
      notes,
      records: parsedRows.map((r) => ({
        region:             r.region?.trim() || null,
        vin:                r.vin?.trim(),
        make:               r.make?.trim() || null,
        model:              r.model?.trim() || null,
        year:               r.year ? parseInt(String(r.year)) : null,
        upstream_provider:  r.upstream_provider?.trim() || null,
        part_type:          r.part_type?.trim(),
        interpreter_output: r.interpreter_output?.trim() || null,
        epc_output:         r.epc_output?.trim() || null,
        pl24_output:        r.pl24_output?.trim() || null,
        epc_source:         r.epc_source?.trim() || null,
        is_valid:           parseIsValid(r.is_valid),
        notes:              r.notes?.trim() || null,
      })),
    };

    const res = await fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorMsg(body.error ?? "Upload failed. Please try again.");
      setState("preview");
      return;
    }

    const data = await res.json();
    setUploadedSnapshotId(data.snapshot_id);
    setState("success");
  };

  // Summary stats of parsed rows
  const validCount   = parsedRows.filter((r) => parseIsValid(r.is_valid) === true).length;
  const invalidCount = parsedRows.filter((r) => parseIsValid(r.is_valid) === false).length;
  const skippedCount = parsedRows.filter((r) => parseIsValid(r.is_valid) === null).length;
  const vinCount     = new Set(parsedRows.map((r) => r.vin)).size;

  if (state === "success") {
    const brand = brands.find((b) => b.id === brandId);
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-grey-950 mb-2">Snapshot imported</h2>
        <p className="text-grey-400 text-sm mb-6">
          {parsedRows.length.toLocaleString()} records imported for {brand?.name} · {snapshotDate}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              setState("idle");
              setParsedRows([]);
              setBrandId("");
              setNotes("");
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="px-4 py-2 text-sm text-grey-400 border border-grey-100 rounded-lg hover:bg-grey-50 transition-colors"
          >
            Upload another
          </button>
          <button
            onClick={() => router.push(`/brands/${brandId}`)}
            className="px-4 py-2 text-sm font-semibold bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View {brand?.name} →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">
          Upload
        </p>
        <h1 className="text-2xl font-bold text-grey-950">Import Benchmark Results</h1>
        <p className="text-grey-400 text-sm mt-1">
          Upload a CSV to create a new dated snapshot for a brand.
        </p>
      </div>

      {/* Step 1: Metadata */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-5">
        <div className="h-1 bg-brand-blue" />
        <div className="p-6">
          <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
            Step 1 — Snapshot details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-grey-950 mb-1.5">
                Brand <span className="text-red-500">*</span>
              </label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full border border-grey-100 rounded-lg px-3 py-2 text-sm text-grey-950 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              >
                <option value="">Select brand…</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-950 mb-1.5">
                Snapshot Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                className="w-full border border-grey-100 rounded-lg px-3 py-2 text-sm text-grey-950 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-grey-950 mb-1.5">
                Notes <span className="text-grey-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Post ADP data source block, re-run after filter update"
                className="w-full border border-grey-100 rounded-lg px-3 py-2 text-sm text-grey-950 placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: File upload */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-5">
        <div className="h-1 bg-brand-blue" />
        <div className="p-6">
          <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
            Step 2 — Upload CSV
          </p>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-grey-100 rounded-xl p-10 text-center cursor-pointer hover:border-brand-blue hover:bg-brand-tint transition-colors group"
          >
            <div className="w-10 h-10 bg-grey-50 group-hover:bg-white rounded-lg flex items-center justify-center mx-auto mb-3 transition-colors">
              <svg className="w-5 h-5 text-grey-400 group-hover:text-brand-blue transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-grey-950">
              {state === "parsing" ? "Parsing…" : "Drop CSV here or click to browse"}
            </p>
            <p className="text-xs text-grey-400 mt-1">
              Required: vin, part_type, is_valid · Download the template below for the full format
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {parseErrors.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-1">
              {parseErrors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          {/* Expected format + template download */}
          <div className="mt-4 p-3 bg-grey-50 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-2">
                  Expected CSV format
                </p>
                <code className="text-xs text-grey-900 font-mono break-all">
                  region, vin, make, model, year, upstream_provider, part_type, interpreter_output, epc_output, pl24_output, epc_source, is_valid, notes
                </code>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-grey-400">
                    <strong className="text-grey-900">is_valid</strong> — <code className="bg-white px-1 py-0.5 rounded border border-grey-100">true</code> match · <code className="bg-white px-1 py-0.5 rounded border border-grey-100">false</code> no-match · <em>blank</em> = skip (missing diagram, VIN not found, etc.)
                  </p>
                  <p className="text-xs text-grey-400">
                    <strong className="text-grey-900">epc_source</strong> — <code className="bg-white px-1 py-0.5 rounded border border-grey-100">Original EPC</code> · <code className="bg-white px-1 py-0.5 rounded border border-grey-100">PL24</code> · <code className="bg-white px-1 py-0.5 rounded border border-grey-100">Both</code> · or leave blank
                  </p>
                  <p className="text-xs text-grey-400">
                    <strong className="text-grey-900">pl24_output</strong> — the MPN returned by PL24 for this part (leave blank if PL24 wasn&apos;t used)
                  </p>
                  <p className="text-xs text-grey-400">
                    Only <strong className="text-grey-900">vin</strong>, <strong className="text-grey-900">part_type</strong> and <strong className="text-grey-900">is_valid</strong> are required. All other columns are optional.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const rows = [
                    // Headers
                    ["region", "vin", "make", "model", "year", "upstream_provider", "part_type", "interpreter_output", "epc_output", "pl24_output", "epc_source", "is_valid", "notes"],
                    // Valid match — Original EPC only
                    ["EU", "VIN1AB23CD45EF01", "Toyota", "RAV4", "2023", "YQService", "Front Bumper Cover", "521194A922", "521194A922", "", "Original EPC", "true", ""],
                    // Valid match — PL24 only
                    ["EU", "VIN2GH67IJ89KL02", "Toyota", "RAV4", "2023", "ADP", "Radiator", "164000A040", "", "164000A040", "PL24", "true", ""],
                    // Valid match — both Original EPC and PL24
                    ["EU", "VIN3MN01OP23QR03", "Toyota", "RAV4", "2023", "YQService", "Cabin Air Filter", "1780A003", "1780A003", "1780A003", "Both", "true", ""],
                    // Invalid — interpreter MPN differs from EPC
                    ["EU", "VIN4ST45UV67WX04", "Toyota", "RAV4", "2022", "YQService", "Left Headlamp Assembly", "8118542E10", "8118542E11", "", "Original EPC", "false", ""],
                    // Skipped — missing diagram (interpreter_output signals untestable; leave is_valid blank)
                    ["EU", "VIN5AB12CD34EF05", "Toyota", "Camry", "2021", "YQService", "Roof Rack", "Missing Diagram", "", "", "", "", "No diagram in EPC"],
                    // Skipped — VIN not found in EPC
                    ["US", "VIN6YZ89AB12CD06", "Toyota", "Camry", "2020", "YQService", "Oil Filter", "VIN not found", "", "", "", "", "VIN absent from EPC"],
                  ];
                  const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "mpn-accuracy-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-blue border border-brand-light bg-brand-tint rounded-lg hover:bg-blue-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download template
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Preview & confirm */}
      {(state === "preview" || state === "uploading") && (
        <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-5">
          <div className="h-1 bg-brand-blue" />
          <div className="p-6">
            <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
              Step 3 — Preview & confirm
            </p>

            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "Rows", value: parsedRows.length.toLocaleString() },
                { label: "VINs", value: vinCount.toLocaleString() },
                { label: "Valid", value: validCount.toLocaleString() },
                { label: "Invalid", value: invalidCount.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="bg-grey-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-grey-950">{s.value}</p>
                  <p className="text-xs text-grey-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Sample rows */}
            <div className="overflow-x-auto border border-grey-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-grey-50">
                  <tr>
                    {["VIN", "Model", "Year", "Part Type", "is_valid"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-grey-400 font-semibold uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-grey-100">
                      <td className="px-3 py-2 font-mono text-grey-400">{r.vin}</td>
                      <td className="px-3 py-2 text-grey-900">{r.model ?? "—"}</td>
                      <td className="px-3 py-2 text-grey-900">{r.year ?? "—"}</td>
                      <td className="px-3 py-2 text-grey-900">{r.part_type}</td>
                      <td className="px-3 py-2">
                        {parseIsValid(r.is_valid) === true ? (
                          <span className="text-emerald-700 font-semibold">valid</span>
                        ) : parseIsValid(r.is_valid) === false ? (
                          <span className="text-red-600 font-semibold">invalid</span>
                        ) : (
                          <span className="text-grey-400">skipped</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 5 && (
                <p className="px-3 py-2 text-xs text-grey-400 border-t border-grey-100">
                  …and {(parsedRows.length - 5).toLocaleString()} more rows
                </p>
              )}
            </div>

            {errorMsg && (
              <p className="mt-3 text-sm text-red-600">{errorMsg}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setState("idle");
                  setParsedRows([]);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="px-4 py-2 text-sm text-grey-400 border border-grey-100 rounded-lg hover:bg-grey-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={state === "uploading"}
                className="px-5 py-2 text-sm font-semibold bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state === "uploading"
                  ? "Importing…"
                  : `Confirm import (${parsedRows.length.toLocaleString()} rows)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
