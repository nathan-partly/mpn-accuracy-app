import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const todayISO = new Date().toISOString().split("T")[0];

  // Expose DB host so we can verify which Neon instance Vercel is hitting
  const dbUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "(not set)";
  const dbHostMatch = dbUrl.match(/@([^/]+)\/([^?]+)/);
  const result: Record<string, unknown> = {
    todayISO,
    db_host: dbHostMatch ? dbHostMatch[1] : "(could not parse)",
    db_name: dbHostMatch ? dbHostMatch[2] : "(could not parse)",
    // Also run a SELECT current_database() to confirm what DB we're actually on
  };

  // Confirm live DB identity + server fingerprint
  try {
    const dbInfo = await sql`SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS host, pg_postmaster_start_time()::text AS server_started`;
    result.live_db_identity = dbInfo[0];
  } catch (e) { result.live_db_identity_error = String(e); }

  // ── Raw JSONB query ─────────────────────────────────────────────────────────
  try {
    const rawRows = await sql`
      SELECT
        id,
        brands,
        integration_date::text AS integration_date,
        incremental_vio_pct::float AS incremental_vio_pct,
        incremental_nz_pct::float  AS incremental_nz_pct,
        incremental_uk_pct::float  AS incremental_uk_pct,
        incremental_au_pct::float  AS incremental_au_pct,
        incremental_us_pct::float  AS incremental_us_pct,
        brand_incremental
      FROM data_integrations
      ORDER BY integration_date ASC
    `;

    result.rawRows = rawRows.map((r: Record<string, unknown>) => ({
      id: r.id,
      brands: r.brands,
      integration_date: r.integration_date,
      integration_date_vs_today: String(r.integration_date) <= todayISO ? "PAST/TODAY" : "FUTURE",
      incremental_uk_pct: r.incremental_uk_pct,
      brand_incremental_typeof: typeof r.brand_incremental,
      brand_incremental_isNull: r.brand_incremental == null,
      brand_incremental_raw: r.brand_incremental,
      fiat_uk_from_raw: (() => {
        if (!r.brand_incremental) return null;
        const bi = r.brand_incremental as Record<string, Record<string, unknown>>;
        return bi["FIAT"]?.["uk"] ?? bi["fiat"]?.["uk"] ?? "not_found";
      })(),
    }));
  } catch (e) {
    result.rawRowsError = String(e);
  }

  // ── Text-cast JSONB query ───────────────────────────────────────────────────
  try {
    const textRows = await sql`
      SELECT
        id,
        brands,
        integration_date::text AS integration_date,
        incremental_uk_pct::float AS incremental_uk_pct,
        brand_incremental::text AS brand_incremental
      FROM data_integrations
      ORDER BY integration_date ASC
    `;

    result.textRows = textRows.map((r: Record<string, unknown>) => {
      const biRaw = r.brand_incremental;
      let biParsed: unknown = null;
      let parseError: string | null = null;
      try {
        if (biRaw && typeof biRaw === "string") {
          biParsed = JSON.parse(biRaw as string);
        } else if (biRaw) {
          biParsed = biRaw;
        }
      } catch (e) {
        parseError = String(e);
      }

      const bi = biParsed as Record<string, Record<string, unknown>> | null;
      return {
        id: r.id,
        brands: r.brands,
        integration_date: r.integration_date,
        integration_date_vs_today: String(r.integration_date) <= todayISO ? "PAST/TODAY" : "FUTURE",
        incremental_uk_pct: r.incremental_uk_pct,
        brand_incremental_typeof: typeof biRaw,
        brand_incremental_text_value: biRaw,
        parseError,
        biParsed_typeof: typeof biParsed,
        fiat_uk_from_parsed: bi ? (bi["FIAT"]?.["uk"] ?? bi["fiat"]?.["uk"] ?? "not_found") : null,
        all_brands_in_bi: bi ? Object.keys(bi) : [],
      };
    });
  } catch (e) {
    result.textRowsError = String(e);
  }

  // ── Simulate the exact gain-accumulation logic ──────────────────────────────
  try {
    const simRows = await sql`
      SELECT
        brands,
        integration_date::text AS integration_date,
        incremental_uk_pct::float AS incremental_uk_pct,
        brand_incremental::text AS brand_incremental
      FROM data_integrations
      ORDER BY integration_date ASC
    `;

    const brandQuarterGains: Record<string, Record<string, number>> = {};
    const gainLog: unknown[] = [];

    for (const row of simRows as Array<Record<string, unknown>>) {
      const integDate = String(row.integration_date);
      if (!integDate || integDate <= todayISO) {
        gainLog.push({ skipped: true, reason: "past/today", integration_date: integDate });
        continue;
      }

      const d = new Date(integDate + "T00:00:00");
      const q = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;

      let biParsed: Record<string, Record<string, unknown>> | null = null;
      if (row.brand_incremental) {
        try {
          biParsed = typeof row.brand_incremental === "string"
            ? JSON.parse(row.brand_incremental as string)
            : row.brand_incremental as Record<string, Record<string, unknown>>;
        } catch { biParsed = null; }
      }

      const brands = (row.brands as string[] | null) ?? [];
      const brandCount = brands.length || 1;
      const totalUk = (row.incremental_uk_pct as number | null) ?? 0;

      for (const brand of brands) {
        const key = brand.toUpperCase();
        let perBrand: number;

        if (biParsed) {
          const brandData = biParsed[key] ?? biParsed[brand];
          if (brandData) {
            const mVal = brandData["uk"];
            perBrand = mVal != null ? Number(mVal) : totalUk / brandCount;
          } else {
            perBrand = totalUk / brandCount;
          }
        } else {
          perBrand = totalUk / brandCount;
        }

        gainLog.push({
          brand: key,
          q,
          integration_date: integDate,
          biParsed_keys: biParsed ? Object.keys(biParsed) : null,
          brandData: biParsed ? (biParsed[key] ?? biParsed[brand] ?? null) : null,
          totalUk,
          brandCount,
          perBrand,
        });

        if (perBrand > 0) {
          if (!brandQuarterGains[key]) brandQuarterGains[key] = {};
          brandQuarterGains[key][q] = (brandQuarterGains[key][q] ?? 0) + perBrand;
        }
      }
    }

    result.gainSimulation = {
      brandQuarterGains,
      gainLog,
    };
  } catch (e) {
    result.gainSimulationError = String(e);
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
