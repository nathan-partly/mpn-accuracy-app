import { format, parseISO } from "date-fns";

export function formatDate(dateStr: string | Date): string {
  try {
    // Postgres DATE columns arrive as JS Date objects; strings need parseISO
    const d = dateStr instanceof Date ? dateStr : parseISO(dateStr);
    return format(d, "d MMM yyyy");
  } catch {
    return String(dateStr);
  }
}

export function formatPct(pct: number | null | undefined): string {
  if (pct == null) return "—";
  return `${Number(pct).toFixed(2)}%`;
}

/** Returns null (→ "No data" badge) when no parts have been tested. */
export function accuracyPct(
  pct: number | string | null | undefined,
  totalParts: number | string | null | undefined
): number | null {
  // Neon returns COUNT columns as strings, so coerce before checking
  if (!Number(totalParts)) return null;
  return pct != null ? Number(pct) : null;
}

export function parseIsValid(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "valid"].includes(s)) return true;
  if (["false", "0", "no", "invalid"].includes(s)) return false;
  return null; // skipped / unknown
}
