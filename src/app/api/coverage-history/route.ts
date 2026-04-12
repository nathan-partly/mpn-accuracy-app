import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface CoverageHistoryPoint {
  date: string;   // ISO date string (YYYY-MM-DD)
  rate: number;   // overall coverage rate as a percentage 0–100
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT created_at, data_json
      FROM coverage_snapshots
      WHERE data_json IS NOT NULL
      ORDER BY created_at ASC
    `;

    const history: CoverageHistoryPoint[] = rows
      .map((row) => {
        try {
          const data = JSON.parse(row.data_json as string) as Record<
            string,
            Array<{ y: number; n: number; total: number }>
          >;
          const allRegion = data["ALL"];
          if (!allRegion || allRegion.length === 0) return null;

          const totalY = allRegion.reduce((sum, b) => sum + (Number(b.y) || 0), 0);
          const totalAll = allRegion.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
          if (totalAll === 0) return null;

          const rate = Math.round((totalY / totalAll) * 1000) / 10;
          const date = new Date(row.created_at as string).toISOString().split("T")[0];
          return { date, rate };
        } catch {
          return null;
        }
      })
      .filter((p): p is CoverageHistoryPoint => p !== null);

    return NextResponse.json(history, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[coverage-history] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch coverage history" },
      { status: 500 }
    );
  }
}
