import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Ensure tables exist on every cold start
async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS coverage_vin_snapshots (
      id          BIGSERIAL PRIMARY KEY,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      row_count   INT,
      filename    TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS coverage_vin_data (
      id              BIGSERIAL PRIMARY KEY,
      snapshot_id     BIGINT NOT NULL REFERENCES coverage_vin_snapshots(id) ON DELETE CASCADE,
      input_make      TEXT NOT NULL,
      input_region    TEXT,
      vin             TEXT NOT NULL,
      wmi             TEXT,
      gcs_found       BOOLEAN NOT NULL,
      brand           TEXT,
      year            TEXT,
      model           TEXT,
      market          TEXT,
      providers_found TEXT[],
      rule_id         TEXT,
      rule_name       TEXT,
      rule_provider   TEXT
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cvd_snapshot ON coverage_vin_data(snapshot_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cvd_make ON coverage_vin_data(snapshot_id, input_make)
  `;
}

interface CsvRow {
  input_make: string;
  input_region: string;
  vin: string;
  wmi: string;
  gcs_found: boolean;
  brand: string;
  year: string;
  model: string;
  market: string;
  providers_found: string[];
  rule_id: string | null;
  rule_name: string | null;
  rule_provider: string | null;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const iMake     = idx("input_make");
  const iRegion   = idx("input_region");
  const iVin      = idx("vin");
  const iWmi      = idx("wmi");
  const iFound    = idx("gcs_found");
  const iBrand    = idx("brand");
  const iYear     = idx("year");
  const iModel    = idx("model");
  const iMarket   = idx("market");
  const iProviders = idx("providers_found");
  const iRuleId   = idx("rule_id");
  const iRuleName = idx("rule_name");
  const iRuleProv = idx("rule_provider");

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV split (no quoted-field handling needed for this schema)
    const cols = lines[i].split(",");
    const make = cols[iMake]?.trim();
    if (!make) continue;

    const rawProviders = cols[iProviders]?.trim() ?? "";
    const providers = rawProviders ? rawProviders.split(",").map((p) => p.trim()).filter(Boolean) : [];
    const ruleId = cols[iRuleId]?.trim() || null;

    rows.push({
      input_make:      make,
      input_region:    cols[iRegion]?.trim() ?? "",
      vin:             cols[iVin]?.trim() ?? "",
      wmi:             cols[iWmi]?.trim() ?? "",
      gcs_found:       (cols[iFound]?.trim() ?? "").toUpperCase() === "TRUE",
      brand:           cols[iBrand]?.trim() ?? "",
      year:            cols[iYear]?.trim() ?? "",
      model:           cols[iModel]?.trim() ?? "",
      market:          cols[iMarket]?.trim() ?? "",
      providers_found: providers,
      rule_id:         ruleId,
      rule_name:       cols[iRuleName]?.trim() || null,
      rule_provider:   cols[iRuleProv]?.trim() || null,
    });
  }
  return rows;
}

/** Bulk insert rows in chunks of 1000 using unnest */
async function bulkInsert(snapshotId: number, rows: CsvRow[]) {
  const CHUNK = 1000;
  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    const chunk = rows.slice(offset, offset + CHUNK);

    const makes      = chunk.map((r) => r.input_make);
    const regions    = chunk.map((r) => r.input_region);
    const vins       = chunk.map((r) => r.vin);
    const wmis       = chunk.map((r) => r.wmi);
    const founds     = chunk.map((r) => r.gcs_found);
    const brands     = chunk.map((r) => r.brand);
    const years      = chunk.map((r) => r.year);
    const models     = chunk.map((r) => r.model);
    const markets    = chunk.map((r) => r.market);
    const providers  = chunk.map((r) => r.providers_found); // text[][]
    const ruleIds    = chunk.map((r) => r.rule_id);
    const ruleNames  = chunk.map((r) => r.rule_name);
    const ruleProvs  = chunk.map((r) => r.rule_provider);

    await sql`
      INSERT INTO coverage_vin_data
        (snapshot_id, input_make, input_region, vin, wmi, gcs_found,
         brand, year, model, market, providers_found, rule_id, rule_name, rule_provider)
      SELECT
        ${snapshotId},
        unnest(${makes}::text[]),
        unnest(${regions}::text[]),
        unnest(${vins}::text[]),
        unnest(${wmis}::text[]),
        unnest(${founds}::boolean[]),
        unnest(${brands}::text[]),
        unnest(${years}::text[]),
        unnest(${models}::text[]),
        unnest(${markets}::text[]),
        unnest(${providers}::text[][]),
        unnest(${ruleIds}::text[]),
        unnest(${ruleNames}::text[]),
        unnest(${ruleProvs}::text[])
    `;
  }
}

// ── GET: list snapshots ───────────────────────────────────────────────────────
export async function GET() {
  try {
    await ensureTables();
    const rows = await sql`
      SELECT id, uploaded_at, row_count, filename
      FROM coverage_vin_snapshots
      ORDER BY uploaded_at DESC
      LIMIT 10
    `;
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST: upload CSV ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await ensureTables();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) return NextResponse.json({ error: "CSV contained no valid rows" }, { status: 400 });

    // Create snapshot record
    const [snap] = await sql`
      INSERT INTO coverage_vin_snapshots (row_count, filename)
      VALUES (${rows.length}, ${file.name})
      RETURNING id, uploaded_at
    ` as Array<{ id: number; uploaded_at: string }>;

    await bulkInsert(snap.id, rows);

    return NextResponse.json(
      { ok: true, snapshot_id: snap.id, row_count: rows.length, uploaded_at: snap.uploaded_at },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[coverage-vin POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
