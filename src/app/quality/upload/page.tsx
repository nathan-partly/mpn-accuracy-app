"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import type { QualityCsvRow } from "@/types";

const REQUIRED_COLUMNS = ["brand", "classification_pct", "annotation_pct"];

type UploadState = "idle" | "parsing" | "preview" | "uploading" | "success";

interface ParsedRow {
  brand: string;
  classification_pct: number | null;
  annotation_pct: number | null;
  total_diagrams: number | null;
  req_diagram_style: boolean;
  req_diagram_cleanup: boolean;
  req_titles_rephrased: boolean;
  req_irrelevant_removed: boolean;
  req_accuracy_verified: boolean;
  req_part_variant_l2: boolean;
}

function parseBool(v: string | undefined): boolean {
  return String(v ?? "").toLowerCase().trim() === "true";
}

export default function QualityUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>("idle");
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFile = useCallback((file: File) => {
    setState("parsing");
    setParseErrors([]);
    setRows([]);

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

        const parsed: ParsedRow[] = (results.data as unknown as QualityCsvRow[])
          .filter((r) => r.brand?.trim())
          .map((r) => ({
            brand: r.brand.trim().toUpperCase(),
            classification_pct:
              r.classification_pct != null && r.classification_pct !== ""
                ? parseFloat(String(r.classification_pct))
                : null,
            annotation_pct:
              r.annotation_pct != null && r.annotation_pct !== ""
                ? parseFloat(String(r.annotation_pct))
                : null,
            total_diagrams:
              r.total_diagrams != null && r.total_diagrams !== ""
                ? parseInt(String(r.total_diagrams), 10)
                : null,
            req_diagram_style: parseBool(r.req_diagram_style),
            req_diagram_cleanup: parseBool(r.req_diagram_cleanup),
            req_titles_rephrased: parseBool(r.req_titles_rephrased),
            req_irrelevant_removed: parseBool(r.req_irrelevant_removed),
            req_accuracy_verified: parseBool(r.req_accuracy_verified),
            req_part_variant_l2: parseBool(r.req_part_variant_l2),
          }));

        if (parsed.length === 0) {
          setParseErrors(["No valid rows found. Check that the brand column is populated."]);
          setState("idle");
          return;
        }

        setRows(parsed);
        setState("preview");
      },
      error: (err) => {
        setParseErrors([err.message]);
        setState("idle");
      },
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (rows.length === 0) return;
    setState("uploading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/quality/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot_date: snapshotDate, rows, notes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setState("preview");
    }
  };

  const levelFor = (c: number | null, a: number | null) => {
    const cv = c ?? 0;
    const av = a ?? 0;
    if (cv >= 80 && av >= 80) return { label: "L2", color: "text-brand-blue" };
    if (cv >= 20 && av >= 20) return { label: "L1", color: "text-emerald-700" };
    if (cv > 0 || av > 0) return { label: "L0", color: "text-amber-600" };
    return { label: "—", color: "text-grey-400" };
  };

  const fmt = (v: number | null) =>
    v == null ? <span className="text-grey-300">—</span> : `${v.toFixed(2)}%`;

  const gatesCount = (r: ParsedRow) =>
    [r.req_diagram_style, r.req_diagram_cleanup, r.req_titles_rephrased,
     r.req_irrelevant_removed, r.req_accuracy_verified, r.req_part_variant_l2]
      .filter(Boolean).length;

  const isUploading = (state as string) === "uploading";

  if (state === "success") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-grey-950 mb-2">Snapshot recorded</h2>
        <p className="text-grey-400 text-sm mb-8">
          {rows.length} brands saved for {snapshotDate}.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push("/quality")}
            className="px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Quality Dashboard
          </button>
          <button
            onClick={() => { setState("idle"); setRows([]); setNotes(""); if (fileRef.current) fileRef.current.value = ""; }}
            className="px-4 py-2 bg-white border border-grey-200 text-grey-700 text-sm font-semibold rounded-lg hover:bg-grey-50 transition-colors"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-brand-blue uppercase tracking-widest mb-1">Quality</p>
        <h1 className="text-2xl font-bold text-grey-950">Upload Quality Snapshot</h1>
        <p className="text-grey-400 text-sm mt-1">
          Upload a CSV with coverage percentages and quality gate flags.{" "}
          <a href="/quality-template.csv" download className="text-brand-blue hover:underline font-medium">
            Download CSV template
          </a>
        </p>
      </div>

      {/* Snapshot date + notes */}
      <div className="bg-white rounded-xl border border-grey-100 shadow-sm p-6 mb-6">
        <div className="h-1 bg-brand-blue -mt-6 -mx-6 mb-6 rounded-t-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-grey-950 uppercase tracking-widest mb-2">
              Snapshot Date
            </label>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm font-medium text-grey-950 focus:outline-none focus:border-brand-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-grey-950 uppercase tracking-widest mb-2">
              Notes <span className="text-grey-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Post Ford integration update"
              className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-grey-950 focus:outline-none focus:border-brand-blue"
            />
          </div>
        </div>
      </div>

      {/* Drop zone */}
      {(state === "idle" || state === "parsing") && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="bg-white rounded-xl border-2 border-dashed border-grey-200 shadow-sm p-12 text-center cursor-pointer hover:border-brand-blue transition-colors mb-6"
        >
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          <div className="w-10 h-10 bg-brand-tint rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-grey-950 mb-1">
            {state === "parsing" ? "Parsing…" : "Drop your CSV here, or click to browse"}
          </p>
          <p className="text-xs text-grey-400">
            Required: brand, classification_pct, annotation_pct · Optional: total_diagrams, req_* gates (true/false)
          </p>
        </div>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          {parseErrors.map((e, i) => (
            <p key={i} className="text-sm text-red-700">{e}</p>
          ))}
        </div>
      )}

      {/* Preview */}
      {state === "preview" && rows.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden mb-6">
            <div className="h-1 bg-brand-blue" />
            <div className="px-5 py-4 border-b border-grey-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-grey-950">{rows.length} brands parsed</p>
                <p className="text-xs text-grey-400 mt-0.5">Review before saving</p>
              </div>
              <button
                onClick={() => { setState("idle"); setRows([]); if (fileRef.current) fileRef.current.value = ""; }}
                className="text-xs text-grey-400 hover:text-grey-900"
              >
                Clear
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grey-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Brand</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Classification</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Annotation</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Diagrams</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Level</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-grey-400 uppercase tracking-widest">Gates</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const lv = levelFor(r.classification_pct, r.annotation_pct);
                    const gc = gatesCount(r);
                    return (
                      <tr key={i} className={i !== rows.length - 1 ? "border-b border-grey-100" : ""}>
                        <td className="px-5 py-3 font-semibold text-grey-950">{r.brand}</td>
                        <td className="px-5 py-3 text-right text-grey-900">{fmt(r.classification_pct)}</td>
                        <td className="px-5 py-3 text-right text-grey-900">{fmt(r.annotation_pct)}</td>
                        <td className="px-5 py-3 text-right text-grey-400">
                          {r.total_diagrams != null ? r.total_diagrams.toLocaleString() : <span className="text-grey-300">—</span>}
                        </td>
                        <td className={`px-5 py-3 text-right font-bold ${lv.color}`}>{lv.label}</td>
                        <td className="px-5 py-3 text-right">
                          {gc > 0 ? (
                            <span className="text-xs font-semibold text-emerald-700">{gc}/6</span>
                          ) : (
                            <span className="text-xs text-grey-300">0/6</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-5 py-2.5 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isUploading ? "Saving…" : `Save snapshot · ${snapshotDate}`}
            </button>
            <button
              onClick={() => { setState("idle"); setRows([]); if (fileRef.current) fileRef.current.value = ""; }}
              className="px-5 py-2.5 bg-white border border-grey-200 text-grey-700 text-sm font-semibold rounded-lg hover:bg-grey-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
