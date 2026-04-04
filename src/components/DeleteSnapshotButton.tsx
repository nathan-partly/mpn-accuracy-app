"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  snapshotId: string;
  brandId: string;
  label: string; // e.g. "4 Apr 2026" — used in confirmation message
  isActive: boolean;
}

export function DeleteSnapshotButton({ snapshotId, brandId, label, isActive }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/snapshots/${snapshotId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      // Redirect to brand page (without snapshot param — will default to latest)
      router.push(`/brands/${brandId}`);
      router.refresh();
    } catch {
      setDeleting(false);
      setConfirming(false);
      alert("Failed to delete snapshot. Please try again.");
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="text-xs text-grey-400">Delete {label}?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Yes"}
        </button>
        <span className="text-grey-300 text-xs">·</span>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-grey-400 hover:text-grey-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault(); // don't follow the parent Link
        e.stopPropagation();
        setConfirming(true);
      }}
      aria-label={`Delete snapshot from ${label}`}
      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-grey-300 hover:text-red-500 focus:opacity-100"
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  );
}
