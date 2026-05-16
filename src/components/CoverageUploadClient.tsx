"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type UploadState = "idle" | "dragging" | "ready" | "uploading" | "success" | "error";

interface UploadResult {
  region: string;
  id: number;
  brands: number;
}

export function CoverageUploadClient() {
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function acceptFile(f: File) {
    if (!f.name.endsWith(".csv")) {
      setError("Please select a .csv file.");
      setState("error");
      return;
    }
    setFile(f);
    setError(null);
    setState("ready");
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState("idle");
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setState("dragging");
  };

  const onDragLeave = () => {
    setState(file ? "ready" : "idle");
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  async function handleUpload() {
    if (!file) return;
    setState("uploading");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("snapshot_date", snapshotDate);
      if (notes.trim()) fd.append("notes", notes.trim());

      const res = await fetch("/api/coverage-samples", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setResults(data.snapshots ?? []);
      setState("success");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("error");
    }
  }

  function reset() {
    setState("idle");
    setFile(null);
    setError(null);
    setResults(null);
    setNotes("");
    setSnapshotDate(new Date().toISOString().split("T")[0]);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (state === "success" && results) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-grey-950">Snapshot saved!</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {results.map((r) => (
            <span key={r.id} className="text-xs text-grey-600 bg-grey-50 border border-grey-100 px-2.5 py-1 rounded-full">
              {r.region} · {r.brands} brands · <span className="text-grey-400">#{r.id}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-grey-400">The dashboard now shows the latest data for each brand.</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => window.location.href = "/coverage"}
            className="text-xs text-brand-blue font-semibold hover:underline"
          >
            View dashboard →
          </button>
          <button
            onClick={reset}
            className="text-xs text-grey-500 font-semibold hover:underline"
          >
            Upload another
          </button>
        </div>
      </div>
    );
  }

  const isDragging = state === "dragging";
  const isReady = state === "ready" || state === "error";
  const isUploading = state === "uploading";

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragging
            ? "border-brand-blue bg-brand-tint"
            : isReady
            ? "border-grey-300 bg-grey-50"
            : "border-grey-200 bg-white hover:border-brand-blue hover:bg-grey-50"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChange}
        />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-brand-tint rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-grey-950">{file.name}</p>
            <p className="text-xs text-grey-400">{(file.size / 1024).toFixed(0)} KB · click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-grey-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-grey-950">
              {isDragging ? "Drop it here" : "Drop your CSV here"}
            </p>
            <p className="text-xs text-grey-400">or click to browse · Make, Region, VIN, Coverage Status columns required</p>
          </div>
        )}
      </div>

      {/* Metadata fields */}
      {(file || isReady) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-grey-600 mb-1">Snapshot date</label>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-grey-200 rounded-lg focus:outline-none focus:border-brand-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-grey-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. UK sample May 2026"
              className="w-full px-3 py-1.5 text-sm border border-grey-200 rounded-lg focus:outline-none focus:border-brand-blue"
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* Upload button */}
      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving snapshot…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Save snapshot
            </>
          )}
        </button>
        {file && !isUploading && (
          <button onClick={reset} className="px-4 py-2 text-sm font-semibold text-grey-500 hover:text-grey-700 transition-colors">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
