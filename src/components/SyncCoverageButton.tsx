"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncCoverageButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ added: string[]; skipped: string[] } | null>(null);
  const router = useRouter();

  async function handleSync() {
    setState("loading");
    setResult(null);
    try {
      const res = await fetch("/api/brands/sync-coverage", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setResult({ added: data.added, skipped: data.skipped });
      setState("done");
      if (data.added.length > 0) router.refresh();
    } catch {
      setState("error");
    }
  }

  function dismiss() {
    setState("idle");
    setResult(null);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleSync}
        disabled={state === "loading"}
        className="flex items-center gap-2 px-4 py-2 bg-white text-brand-blue text-sm font-semibold rounded-lg border border-brand-blue hover:bg-blue-50 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {state === "loading" ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Syncing…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync from Coverage
          </>
        )}
      </button>

      {state === "done" && result && (
        <div className="text-xs bg-white border border-grey-100 rounded-lg px-3 py-2 shadow-sm max-w-xs text-right">
          {result.added.length > 0 ? (
            <>
              <span className="text-emerald-600 font-semibold">
                {result.added.length} brand{result.added.length !== 1 ? "s" : ""} added:
              </span>{" "}
              <span className="text-grey-600">{result.added.join(", ")}</span>
            </>
          ) : (
            <span className="text-grey-500">All covered brands are already listed ({result.skipped.length} found).</span>
          )}
          <button onClick={dismiss} className="ml-2 text-grey-300 hover:text-grey-500">✕</button>
        </div>
      )}

      {state === "error" && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          Sync failed — try again.
          <button onClick={dismiss} className="ml-2 text-red-300 hover:text-red-500">✕</button>
        </div>
      )}
    </div>
  );
}
