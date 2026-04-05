import clsx from "clsx";
import type { BrandLevel } from "@/types";

const config: Record<BrandLevel, { label: string; classes: string }> = {
  L2: {
    label: "Level 2",
    classes: "bg-brand-tint text-brand-blue border-brand-blue/20",
  },
  L1: {
    label: "Level 1",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  L0: {
    label: "Level 0",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  Unsupported: {
    label: "Unsupported",
    classes: "bg-grey-50 text-grey-400 border-grey-200",
  },
};

export function LevelBadge({ level }: { level: BrandLevel }) {
  const { label, classes } = config[level];
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border",
        classes
      )}
    >
      {label}
    </span>
  );
}
