"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import type { CsvRow } from "@/types";
import { parseIsValid } from "@/lib/utils";

const REQUIRED_COLUMNS = ["brand", "vin", "part_type", "is_valid"];

type UploadState = "idle" | "parsing" | "preview" | "uploading" | "success";

interface BrandGroup {
  brandId: string;
  brandName: string;
  rows: CsvRow[];
}

interface UploadResult {
  brandName: string;
  brandId: string;
  rowCount: number;
}

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>("idle");
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandGroups, setBrandGroups] = useState<BrandGroup[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data) => setBrands(data ?? []));
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setState("parsing");
      setParseErrors([]);
      setBrandGroups([]);

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
        complete: (results) => {
          const errors: string[] = [];
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
          const validRows = rows.filter((r) => r.vin?.trim() && r.part_type?.trim());

          if (validRows.length === 0) {
            setParseErrors(["No valid rows found. Check that vin and part_type columns are populated."]);
            setState("idle");
            return;
          }

          // Group by brand
          const grouped = new Map<string, CsvRow[]>();
          const unknownBrands = new Set<string>();
          const missingBrand: number[] = [];

          validRows.forEach((row, idx) => {
            const brandName = row.brand?.trim() ?? "";
            if (!brandName) {
              missingBrand.push(idx + 2); // +2 for header row + 1-indexed
              return;
            }
            const match = brands.find(
              (b) => b.name.toLowerCase() === brandName.toLowerCase()
            );
            if (!match) {
              unknownBrands.add(brandName);
            } else {
              const existing = grouped.get(match.name) ?? [];
              existing.push(row);
              grouped.set(match.name, existing);
            }
          });

          if (missingBrand.length > 0) {
            errors.push(
              `${missingBrand.length} row${missingBrand.length > 1 ? "s" : ""} are missing a brand name. Fill in the brand column for every row.`
            );
          }
          if (unknownBrands.size > 0) {
            errors.push(
              `Unknown brand${unknownBrands.size > 1 ? "s" : ""}: ${Array.from(unknownBrands).join(", ")}. Brand names must match exactly (e.g. "Ford", "BMW").`
            );
          }

          if (errors.length > 0) {
            setParseErrors(errors);
            setState("idle");
            return;
          }

          const groups: BrandGroup[] = Array.from(grouped.entries())
            .map(([name, rows]) => {
              const brand = brands.find((b) => b.name.toLowerCase() === name.toLowerCase())!;
              return { brandId: brand.id, brandName: brand.name, rows };
            })
            .sort((a, b) => a.brandName.localeCompare(b.brandName));

          setBrandGroups(groups);
          setTotalRows(validRows.length);
          setState("preview");
        },
        error: (err) => {
          setParseErrors([`CSV parse error: ${err.message}`]);
          setState("idle");
        },
      });
    },
    [brands]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSubmit = async () => {
    if (!snapshotDate) {
      setErrorMsg("Please set a snapshot date.");
      return;
    }

    setState("uploading");
    setErrorMsg("");
    setUploadProgress({ done: 0, total: brandGroups.length });

    const results: UploadResult[] = [];

    for (let i = 0; i < brandGroups.length; i++) {
      const group = brandGroups[i];
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: group.brandId,
          snapshot_date: snapshotDate,
          notes,
          records: group.rows.map((r) => ({
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
            is_valid:           parseIsValid(r.is_valid),
            notes:              r.notes?.trim() || null,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(`Failed to import ${group.brandName}: ${body.error ?? "unknown error"}`);
        setState("preview");
        return;
      }

      results.push({ brandName: group.brandName, brandId: group.brandId, rowCount: group.rows.length });
      setUploadProgress({ done: i + 1, total: brandGroups.length });
    }

    setUploadResults(results);
    setState("success");
  };

  const resetForm = () => {
    setState("idle");
    setBrandGroups([]);
    setUploadResults([]);
    setUploadProgress(null);
    setNotes("");
    setTotalRows(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Success screen ───────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-grey-950 mb-1">
            {uploadResults.length} snapshot{uploadResults.length !== 1 ? "s" : ""} created
          </h2>
          <p className="text-grey-400 text-sm">
            {totalRows.toLocaleString()} total rows · {snapshotDate}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-6">
          <div className="h-1 bg-brand-blue" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-grey-400 uppercase tracking-widest">Brand</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-grey-400 uppercase tracking-widest">Rows</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {uploadResults.map((r, i) => (
                <tr key={r.brandId} className={i !== uploadResults.length - 1 ? "border-b border-grey-100" : ""}>
                  <td className="px-4 py-2.5 font-medium text-grey-950">{r.brandName}</td>
                  <td className="px-4 py-2.5 text-right text-grey-500">{r.rowCount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => router.push(`/brands/${r.brandId}`)}
                      className="text-xs font-semibold text-brand-blue hover:underline"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-center">
          <button
            onClick={resetForm}
            className="px-4 py-2 text-sm text-grey-400 border border-grey-100 rounded-lg hover:bg-grey-50 transition-colors"
          >
            Upload another file
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">
          Upload
        </p>
        <h1 className="text-2xl font-bold text-grey-950">Import Benchmark Results</h1>
        <p className="text-grey-400 text-sm mt-1">
          Re-upload your master CSV whenever you add or edit rows. Each upload creates a new dated snapshot for every brand in the file.
        </p>
      </div>

      {/* Step 1: Snapshot metadata */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-5">
        <div className="h-1 bg-brand-blue" />
        <div className="p-6">
          <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-4">
            Step 1 — Snapshot details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div>
              <label className="block text-xs font-semibold text-grey-950 mb-1.5">
                Notes <span className="text-grey-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Added PL24 results for EU fleet"
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
              Must include a <code className="bg-white border border-grey-100 px-1 rounded">brand</code> column — download the template below for the full format
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

          {/* Format reference + template download */}
          <div className="mt-4 border border-grey-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-grey-50 border-b border-grey-100">
              <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest">
                CSV columns
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rows = [
                    ["brand", "region", "vin", "make", "model", "year", "upstream_provider", "part_type", "interpreter_output", "epc_output", "pl24_output", "is_valid", "notes"],
                    ["Toyota", "EU", "VIN1AB23CD45EF01", "Toyota", "RAV4", "2023", "YQService", "Front Bumper Cover", "521194A922", "521194A922", "", "true", ""],
                    ["Toyota", "EU", "VIN2GH67IJ89KL02", "Toyota", "RAV4", "2023", "ADP", "Radiator", "164000A040", "", "164000A040", "true", ""],
                    ["Toyota", "EU", "VIN3MN01OP23QR03", "Toyota", "RAV4", "2023", "YQService", "Cabin Air Filter", "1780A003", "1780A003", "1780A003", "true", ""],
                    ["Ford", "EU", "VIN4ST45UV67WX04", "Ford", "Focus", "2022", "YQService", "Left Headlamp Assembly", "8118542E10", "8118542E11", "", "false", ""],
                    ["Ford", "EU", "VIN5AB12CD34EF05", "Ford", "Focus", "2021", "YQService", "Roof Rack", "Missing Diagram", "", "", "", "No diagram in EPC"],
                    ["Ford", "US", "VIN6YZ89AB12CD06", "Ford", "Mustang", "2020", "ADP", "Oil Filter", "VIN not found", "", "", "", "VIN absent from EPC"],
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-blue border border-brand-light bg-white rounded-lg hover:bg-brand-tint transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download template
              </button>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-grey-100 bg-grey-50">
                  <th className="text-left px-4 py-2 font-semibold text-grey-400 uppercase tracking-widest w-40">Column</th>
                  <th className="text-left px-4 py-2 font-semibold text-grey-400 uppercase tracking-widest w-24">Required</th>
                  <th className="text-left px-4 py-2 font-semibold text-grey-400 uppercase tracking-widest">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {[
                  { col: "brand", req: true, note: 'Must match an existing brand exactly — e.g. "Ford", "BMW"' },
                  { col: "vin", req: true, note: "Vehicle Identification Number" },
                  { col: "part_type", req: true, note: 'The HCA (Human-centric Assembly) — e.g. "Front Bumper Cover", "Oil Filter"' },
                  { col: "is_valid", req: true, note: (
                    <span>
                      <code className="bg-grey-50 border border-grey-100 px-1 rounded">true</code> = match &nbsp;·&nbsp;
                      <code className="bg-grey-50 border border-grey-100 px-1 rounded">false</code> = no-match &nbsp;·&nbsp;
                      <em>blank</em> = skip
                    </span>
                  )},
                  { col: "interpreter_output", req: false, note: "MPN returned by the interpreter" },
                  { col: "epc_output", req: false, note: "MPN from the original EPC" },
                  { col: "pl24_output", req: false, note: "MPN from PL24 (non-original EPC)" },
                  { col: "region", req: false, note: 'E.g. "EU", "US"' },
                  { col: "make", req: false, note: "Vehicle make" },
                  { col: "model", req: false, note: "Vehicle model" },
                  { col: "year", req: false, note: "Vehicle year" },
                  { col: "upstream_provider", req: false, note: 'Data provider — e.g. "ADP", "YQService"' },
                  { col: "notes", req: false, note: "Any extra context for this row" },
                ].map(({ col, req, note }) => (
                  <tr key={col} className="hover:bg-grey-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <code className="font-mono text-grey-900">{col}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      {req ? (
                        <span className="inline-block px-1.5 py-0.5 text-xs font-semibold bg-red-50 text-red-600 rounded">Required</span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 text-xs font-medium bg-grey-100 text-grey-400 rounded">Optional</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-grey-500">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Total Rows", value: totalRows.toLocaleString() },
                { label: "Brands", value: brandGroups.length.toLocaleString() },
                { label: "VINs", value: new Set(brandGroups.flatMap((g) => g.rows.map((r) => r.vin))).size.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="bg-grey-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-grey-950">{s.value}</p>
                  <p className="text-xs text-grey-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Per-brand breakdown */}
            <div className="border border-grey-100 rounded-lg overflow-hidden mb-5">
              <table className="w-full text-sm">
                <thead className="bg-grey-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-grey-400 uppercase tracking-widest">Brand</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-grey-400 uppercase tracking-widest">Rows</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-grey-400 uppercase tracking-widest">VINs</th>
                    {state === "uploading" && (
                      <th className="text-right px-3 py-2 text-xs font-semibold text-grey-400 uppercase tracking-widest">Status</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {brandGroups.map((g, i) => {
                    const done = uploadProgress?.done ?? 0;
                    const isComplete = state === "uploading" && i < done;
                    const isActive = state === "uploading" && i === done;
                    return (
                      <tr key={g.brandId} className="border-t border-grey-100">
                        <td className="px-3 py-2 font-medium text-grey-950">{g.brandName}</td>
                        <td className="px-3 py-2 text-right text-grey-500">{g.rows.length.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-grey-500">
                          {new Set(g.rows.map((r) => r.vin)).size.toLocaleString()}
                        </td>
                        {state === "uploading" && (
                          <td className="px-3 py-2 text-right">
                            {isComplete ? (
                              <span className="text-emerald-600 font-semibold text-xs">✓ Done</span>
                            ) : isActive ? (
                              <span className="text-brand-blue text-xs">Importing…</span>
                            ) : (
                              <span className="text-grey-300 text-xs">Waiting</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {errorMsg && (
              <p className="mb-4 text-sm text-red-600">{errorMsg}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={resetForm}
                disabled={state === "uploading"}
                className="px-4 py-2 text-sm text-grey-400 border border-grey-100 rounded-lg hover:bg-grey-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={state === "uploading"}
                className="px-5 py-2 text-sm font-semibold bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state === "uploading"
                  ? `Importing ${uploadProgress?.done ?? 0} of ${uploadProgress?.total ?? brandGroups.length}…`
                  : `Confirm import (${brandGroups.length} brand${brandGroups.length !== 1 ? "s" : ""} · ${totalRows.toLocaleString()} rows)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
