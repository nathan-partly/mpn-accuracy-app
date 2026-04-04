import type { SnapshotDiff, BenchmarkSnapshot } from "@/types";
import { formatDate } from "@/lib/utils";

interface Props {
  diff: SnapshotDiff;
  currentSnapshot: BenchmarkSnapshot;
  prevSnapshot: BenchmarkSnapshot;
}

export function SnapshotDiffPanel({ diff, currentSnapshot, prevSnapshot }: Props) {
  const accuracyDelta =
    Number(currentSnapshot.accuracy_pct) - Number(prevSnapshot.accuracy_pct);

  const sign = accuracyDelta > 0 ? "+" : "";
  const deltaStr = `${sign}${accuracyDelta.toFixed(1)}%`;
  const deltaColor =
    accuracyDelta > 0.05
      ? "text-emerald-600"
      : accuracyDelta < -0.05
      ? "text-red-500"
      : "text-grey-400";

  const hasVinChanges = diff.new_vin_count > 0 || diff.removed_vin_count > 0;
  const hasRecordChanges = diff.improved_count > 0 || diff.regressed_count > 0;

  return (
    <div className="mt-3 pt-3 border-t border-grey-100">
      <p className="text-xs font-semibold text-grey-400 uppercase tracking-widest mb-2.5">
        vs {formatDate(prevSnapshot.snapshot_date)}
      </p>
      <div className="space-y-2">
        {/* Accuracy delta */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-grey-500">Accuracy</span>
          <span className={`text-xs font-semibold tabular-nums ${deltaColor}`}>
            {deltaStr}
          </span>
        </div>

        {/* VIN changes */}
        {hasVinChanges && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-grey-500">VINs</span>
            <span className="text-xs tabular-nums space-x-1.5">
              {diff.new_vin_count > 0 && (
                <span className="text-emerald-600">+{diff.new_vin_count} added</span>
              )}
              {diff.new_vin_count > 0 && diff.removed_vin_count > 0 && (
                <span className="text-grey-300">·</span>
              )}
              {diff.removed_vin_count > 0 && (
                <span className="text-red-500">−{diff.removed_vin_count} removed</span>
              )}
            </span>
          </div>
        )}

        {/* Record-level changes */}
        {hasRecordChanges && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-grey-500">Records</span>
            <span className="text-xs tabular-nums space-x-1.5">
              {diff.improved_count > 0 && (
                <span className="text-emerald-600">↑{diff.improved_count} fixed</span>
              )}
              {diff.improved_count > 0 && diff.regressed_count > 0 && (
                <span className="text-grey-300">·</span>
              )}
              {diff.regressed_count > 0 && (
                <span className="text-red-500">↓{diff.regressed_count} broken</span>
              )}
            </span>
          </div>
        )}

        {/* No changes */}
        {!hasVinChanges && !hasRecordChanges && accuracyDelta === 0 && (
          <p className="text-xs text-grey-400 italic">No changes detected</p>
        )}
      </div>
    </div>
  );
}
