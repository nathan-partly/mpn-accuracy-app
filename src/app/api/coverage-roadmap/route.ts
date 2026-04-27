import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getLatestCoverageDataJson } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Convert a date string to a "Q1 2026" style label. */
function quarterLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

/** Numeric sort key for quarter labels like "Q2 2026" → 20262, "Q3 2026" → 20263 */
function quarterSortKey(label: string): number {
  const parts = label.split(" ");
  const q = parseInt(parts[0].replace("Q", ""), 10);
  const yr = parseInt(parts[1], 10);
  return yr * 10 + q;
}

export interface RoadmapBrand {
  brand: string;
  today: number;      // 0–100, current NZ VIN coverage %
  totalVins: number;  // total NZ VINs (used for sort order)
  [quarter: string]: number | string; // dynamic quarter keys, e.g. "Q2 2026": 15.3
}

export interface RoadmapResponse {
  data: RoadmapBrand[];
  quarters: string[]; // ordered list of unique upcoming quarters
}

export async function GET(): Promise<NextResponse> {
  const todayISO = new Date().toISOString().split("T")[0];

  // ── 1. Per-brand NZ coverage from latest coverage snapshot ───────────────────
  const brandCoverage = new Map<string, { today: number; totalVins: number }>();
  try {
    const dataJson = await getLatestCoverageDataJson();
    if (dataJson) {
      const parsed = JSON.parse(dataJson) as Record<
        string,
        Array<{ make: string; yv: string[]; nv: string[] }>
      >;
      const nzBrands = parsed["NZ"] ?? parsed["nz"] ?? [];
      for (const entry of nzBrands) {
        const total = (entry.yv?.length ?? 0) + (entry.nv?.length ?? 0);
        const pct = total > 0 ? (entry.yv.length / total) * 100 : 0;
        brandCoverage.set(entry.make.toUpperCase(), { today: pct, totalVins: total });
      }
    }
  } catch {
    // No coverage snapshot — brands show 0% today
  }

  // ── 2. Integrations from DB ───────────────────────────────────────────────────
  let integrations: Array<{ brands: string[]; integration_date: string }> = [];
  try {
    const rows = await sql`
      SELECT brands, integration_date::text AS integration_date
      FROM data_integrations
      ORDER BY integration_date ASC
    `;
    integrations = rows as typeof integrations;
  } catch {
    integrations = [];
  }

  // For each brand, find the earliest upcoming quarter that covers it
  const brandFirstQuarter = new Map<string, string>();
  for (const integ of integrations) {
    if (!integ.integration_date || integ.integration_date <= todayISO) continue;
    const q = quarterLabel(integ.integration_date);
    for (const brand of (integ.brands ?? [])) {
      const key = brand.toUpperCase();
      const existing = brandFirstQuarter.get(key);
      if (!existing || quarterSortKey(q) < quarterSortKey(existing)) {
        brandFirstQuarter.set(key, q);
      }
    }
  }

  // ── 3. Collect all relevant brands ───────────────────────────────────────────
  // Include every brand from the coverage snapshot plus any from integrations
  const allBrands = new Set<string>([
    ...Array.from(brandCoverage.keys()),
    ...Array.from(brandFirstQuarter.keys()),
  ]);
  // Also include brands from live integrations (even if not in coverage snapshot)
  for (const integ of integrations) {
    if (!integ.integration_date || integ.integration_date > todayISO) continue;
    for (const b of (integ.brands ?? [])) allBrands.add(b.toUpperCase());
  }

  // ── 4. Build result rows ──────────────────────────────────────────────────────
  const quartersSet = new Set<string>();
  const rows: RoadmapBrand[] = [];

  for (const brand of allBrands) {
    const cov = brandCoverage.get(brand) ?? { today: 0, totalVins: 0 };
    const firstQ = brandFirstQuarter.get(brand) ?? null;
    const remaining = firstQ ? parseFloat(Math.max(0, 100 - cov.today).toFixed(2)) : 0;

    const row: RoadmapBrand = {
      brand,
      today: parseFloat(cov.today.toFixed(2)),
      totalVins: cov.totalVins,
    };

    if (firstQ && remaining > 0) {
      row[firstQ] = remaining;
      quartersSet.add(firstQ);
    }

    rows.push(row);
  }

  // Sort by totalVins desc, then alphabetical
  rows.sort((a, b) => (b.totalVins - a.totalVins) || a.brand.localeCompare(b.brand));

  // Cap at top 50 brands
  const topRows = rows.slice(0, 50);

  // Ordered quarter labels
  const quarters = Array.from(quartersSet).sort(
    (a, b) => quarterSortKey(a) - quarterSortKey(b)
  );

  // Ensure every row has a 0-value for every quarter (Recharts needs consistent keys)
  for (const row of topRows) {
    for (const q of quarters) {
      if (!(q in row)) row[q] = 0;
    }
  }

  return NextResponse.json({ data: topRows, quarters } satisfies RoadmapResponse);
}
