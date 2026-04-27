import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getLatestCoverageDataJson } from "@/lib/queries";

export const dynamic = "force-dynamic";

export type Market = "all" | "nz" | "uk" | "au" | "us";

function quarterLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

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
  market: Market;
}

interface Integration {
  brands: string[];
  integration_date: string;
  incremental_vio_pct: number | null;
  incremental_nz_pct: number | null;
  incremental_uk_pct: number | null;
  incremental_au_pct: number | null;
  incremental_us_pct: number | null;
}

/** Pick the right incremental field for a market, falling back to global/4 as rough estimate */
function marketIncremental(integ: Integration, market: Market): number {
  switch (market) {
    case "nz": return integ.incremental_nz_pct ?? 0;
    case "uk": return integ.incremental_uk_pct ?? 0;
    case "au": return integ.incremental_au_pct ?? 0;
    case "us": return integ.incremental_us_pct ?? 0;
    default:   return integ.incremental_vio_pct ?? 0;
  }
}

/** The region key inside the coverage snapshot JSON */
function regionKey(market: Market): string {
  switch (market) {
    case "nz": return "NZ";
    case "uk": return "UK";
    case "au": return "AU";
    case "us": return "US";
    default:   return "ALL"; // combined across all regions
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const market = (searchParams.get("market") ?? "all") as Market;
  const todayISO = new Date().toISOString().split("T")[0];

  // ── 1. Per-brand coverage from snapshot ───────────────────────────────────────
  const brandCoverage: Record<string, { today: number; totalVins: number }> = {};
  try {
    const dataJson = await getLatestCoverageDataJson();
    if (dataJson) {
      const parsed = JSON.parse(dataJson) as Record<
        string,
        Array<{ make: string; yv: string[]; nv: string[] }>
      >;
      const key = regionKey(market);
      // Fall back to NZ if the requested region key isn't in this snapshot
      const regionBrands = parsed[key] ?? parsed[key.toLowerCase()] ?? parsed["NZ"] ?? parsed["nz"] ?? [];
      for (const entry of regionBrands) {
        const total = (entry.yv?.length ?? 0) + (entry.nv?.length ?? 0);
        const pct = total > 0 ? (entry.yv.length / total) * 100 : 0;
        brandCoverage[entry.make.toUpperCase()] = { today: pct, totalVins: total };
      }
    }
  } catch {
    // No snapshot — all brands show 0% today
  }

  // ── 2. Integrations — ensure market columns exist before selecting them ────────
  try {
    await sql`
      ALTER TABLE data_integrations
        ADD COLUMN IF NOT EXISTS incremental_nz_pct float,
        ADD COLUMN IF NOT EXISTS incremental_uk_pct float,
        ADD COLUMN IF NOT EXISTS incremental_au_pct float,
        ADD COLUMN IF NOT EXISTS incremental_us_pct float
    `;
  } catch { /* already applied */ }

  let integrations: Integration[] = [];
  try {
    const rows = await sql`
      SELECT
        brands,
        integration_date::text     AS integration_date,
        incremental_vio_pct::float AS incremental_vio_pct,
        incremental_nz_pct::float  AS incremental_nz_pct,
        incremental_uk_pct::float  AS incremental_uk_pct,
        incremental_au_pct::float  AS incremental_au_pct,
        incremental_us_pct::float  AS incremental_us_pct
      FROM data_integrations
      ORDER BY integration_date ASC
    `;
    integrations = rows as Integration[];
  } catch {
    integrations = [];
  }

  // ── 3. Collect all brands that appear in any integration ─────────────────────
  // Only show brands that are part of at least one integration (live or upcoming)
  const integrationBrands: Record<string, true> = {};
  for (const integ of integrations) {
    for (const b of (integ.brands ?? [])) integrationBrands[b.toUpperCase()] = true;
  }

  // ── 4. Per-brand: earliest upcoming quarter + per-brand incremental % ─────────
  // Per-brand incremental = integration's market incremental / number of brands in it
  const brandUpcoming: Record<string, { quarter: string; increment: number }> = {};

  for (const integ of integrations) {
    if (!integ.integration_date || integ.integration_date <= todayISO) continue;
    const q = quarterLabel(integ.integration_date);
    const totalIncremental = marketIncremental(integ, market);
    const brandCount = (integ.brands ?? []).length || 1;
    const perBrand = totalIncremental / brandCount;

    for (const brand of (integ.brands ?? [])) {
      const key = brand.toUpperCase();
      const existing = brandUpcoming[key];
      if (!existing || quarterSortKey(q) < quarterSortKey(existing.quarter)) {
        brandUpcoming[key] = { quarter: q, increment: perBrand };
      }
    }
  }

  // ── 5. Build result rows ──────────────────────────────────────────────────────
  const quartersFound: Record<string, true> = {};
  const rows: RoadmapBrand[] = [];

  for (const brand of Object.keys(integrationBrands)) {
    const cov = brandCoverage[brand] ?? { today: 0, totalVins: 0 };
    const upcoming = brandUpcoming[brand] ?? null;

    const row: RoadmapBrand = {
      brand,
      today: parseFloat(cov.today.toFixed(2)),
      totalVins: cov.totalVins,
    };

    if (upcoming && upcoming.increment > 0) {
      row[upcoming.quarter] = parseFloat(upcoming.increment.toFixed(2));
      quartersFound[upcoming.quarter] = true;
    }

    rows.push(row);
  }

  // Sort by totalVins desc (market importance), then alphabetical
  rows.sort((a, b) => (b.totalVins - a.totalVins) || a.brand.localeCompare(b.brand));

  // Cap at 35 brands to keep chart readable
  const topRows = rows.slice(0, 35);

  const quarters = Object.keys(quartersFound).sort(
    (a, b) => quarterSortKey(a) - quarterSortKey(b)
  );

  // Zero-fill quarter keys
  for (const row of topRows) {
    for (const q of quarters) {
      if (!(q in row)) row[q] = 0;
    }
  }

  return NextResponse.json({ data: topRows, quarters, market } satisfies RoadmapResponse);
}
