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

/** Numeric sort key for quarter labels like "Q2 2026" → 20262 */
function quarterSortKey(label: string): number {
  const parts = label.split(" ");
  const q = parseInt(parts[0].replace("Q", ""), 10);
  const yr = parseInt(parts[1], 10);
  return yr * 10 + q;
}

export interface RoadmapBrand {
  brand: string;
  today: number;
  totalVins: number;
  [quarter: string]: number | string;
}

export interface RoadmapResponse {
  data: RoadmapBrand[];
  quarters: string[];
}

export async function GET(): Promise<NextResponse> {
  const todayISO = new Date().toISOString().split("T")[0];

  // ── 1. Per-brand NZ coverage from latest coverage snapshot ───────────────────
  const brandCoverage: Record<string, { today: number; totalVins: number }> = {};
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
        brandCoverage[entry.make.toUpperCase()] = { today: pct, totalVins: total };
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
  const brandFirstQuarter: Record<string, string> = {};
  for (const integ of integrations) {
    if (!integ.integration_date || integ.integration_date <= todayISO) continue;
    const q = quarterLabel(integ.integration_date);
    for (const brand of (integ.brands ?? [])) {
      const key = brand.toUpperCase();
      const existing = brandFirstQuarter[key];
      if (!existing || quarterSortKey(q) < quarterSortKey(existing)) {
        brandFirstQuarter[key] = q;
      }
    }
  }

  // ── 3. Collect all relevant brands ───────────────────────────────────────────
  const brandSet: Record<string, true> = {};
  for (const k of Object.keys(brandCoverage)) brandSet[k] = true;
  for (const k of Object.keys(brandFirstQuarter)) brandSet[k] = true;
  // Also include brands from live integrations
  for (const integ of integrations) {
    if (!integ.integration_date || integ.integration_date > todayISO) continue;
    for (const b of (integ.brands ?? [])) brandSet[b.toUpperCase()] = true;
  }
  const allBrands = Object.keys(brandSet);

  // ── 4. Build result rows ──────────────────────────────────────────────────────
  const quartersFound: Record<string, true> = {};
  const rows: RoadmapBrand[] = [];

  for (const brand of allBrands) {
    const cov = brandCoverage[brand] ?? { today: 0, totalVins: 0 };
    const firstQ = brandFirstQuarter[brand] ?? null;
    const remaining = firstQ ? parseFloat(Math.max(0, 100 - cov.today).toFixed(2)) : 0;

    const row: RoadmapBrand = {
      brand,
      today: parseFloat(cov.today.toFixed(2)),
      totalVins: cov.totalVins,
    };

    if (firstQ && remaining > 0) {
      row[firstQ] = remaining;
      quartersFound[firstQ] = true;
    }

    rows.push(row);
  }

  // Sort by totalVins desc, then alphabetical
  rows.sort((a, b) => (b.totalVins - a.totalVins) || a.brand.localeCompare(b.brand));

  // Cap at top 50 brands
  const topRows = rows.slice(0, 50);

  // Ordered quarter labels
  const quarters = Object.keys(quartersFound).sort(
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
