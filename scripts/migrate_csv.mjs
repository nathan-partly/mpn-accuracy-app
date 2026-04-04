/**
 * One-time migration script: import the consolidated "Accuracy test" CSV
 * from the Google Sheet into the Neon database.
 *
 * Usage (from the mpn-accuracy-app directory):
 *   node scripts/migrate_csv.mjs <path-to-csv> [snapshot-date]
 *
 * Example:
 *   node scripts/migrate_csv.mjs ~/Downloads/"Interpreter Accuracy Benchmarking - Accuracy test.csv" 2026-04-04
 *
 * The snapshot date defaults to today if not provided.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Papa = require("papaparse");
const { Client } = require("@neondatabase/serverless");

// ---------------------------------------------------------------------------
// Load .env.local manually
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
try {
  const envContents = readFileSync(envPath, "utf8");
  for (const line of envContents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
} catch {
  // .env.local not found — DATABASE_URL must already be set
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CSV_PATH = process.argv[2];
const SNAPSHOT_DATE = process.argv[3] ?? new Date().toISOString().slice(0, 10);
const SNAPSHOT_LABEL = `Initial import (migrated from Google Sheet)`;
const BATCH_SIZE = 500;

// Map CSV "Make" values → DB brand names where they differ
const BRAND_NAME_MAP = {
  Mercedes: "Mercedes-Benz",
};

// Brands in the CSV that aren't seeded yet — insert as 'pending'
const EXTRA_BRANDS = ["Alfa Romeo", "Renault", "Citroen", "Jaguar", "Seat", "Dacia"];

// ---------------------------------------------------------------------------
// EPC source detector
// ---------------------------------------------------------------------------
function getEpcSource(row) {
  const matchNonOrig = (row["Interpreter match Non Original EPC"] || "").trim().toLowerCase();
  const matchOrig    = (row["Interpreter match EPC"] || "").trim().toLowerCase();
  const hasOrig      = (row["EPC"] || "").trim().length > 0;
  const hasNonOrig   = (row["Non Original EPC"] || "").trim().length > 0;

  // "Not needed" means the other source was sufficient
  if (matchNonOrig === "not needed") return "Original EPC";
  if (matchOrig    === "not needed") return "Non-Original EPC";

  // Fall back to which column actually has data
  if (hasOrig && !hasNonOrig) return "Original EPC";
  if (hasNonOrig && !hasOrig) return "Non-Original EPC";
  if (hasOrig && hasNonOrig)  return "Both";
  return null;
}

// ---------------------------------------------------------------------------
// is_valid mapper
// ---------------------------------------------------------------------------
const NOT_TESTABLE_PATTERNS = [
  "missing diagram",
  "missing hotspot",
  "vin not found",
  "no vehicle found",
  "vehicle not found",
  "no diagram found",
  "not found",   // catches "VIN not found" in EPC columns too
];

function containsNotTestable(str) {
  const s = (str ?? "").trim().toLowerCase();
  return NOT_TESTABLE_PATTERNS.some((p) => s.includes(p));
}

function toIsValid(interpreterResult, interpreterOutput, epcOutput, nonOrigEpcOutput) {
  // If the interpreter output OR either EPC reference indicates the test
  // couldn't run (missing diagram/hotspot, VIN/vehicle not found, etc.),
  // exclude regardless of what the result column says.
  if (
    containsNotTestable(interpreterOutput) ||
    containsNotTestable(epcOutput) ||
    containsNotTestable(nonOrigEpcOutput)
  ) {
    return null;
  }

  const v = (interpreterResult ?? "").trim().toLowerCase();

  if (
    v === "match" ||
    v.startsWith("match - partial") ||
    v === "match - missing prefix/sufix" ||
    v === "match - missing prefix/suffix"
  ) {
    return true;
  }

  if (v === "no-match" || v === "no match") {
    return false;
  }

  // missing vin/mpn/diagram, check, still to check, exclude, empty → skip
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
if (!CSV_PATH) {
  console.error(
    "Usage: node scripts/migrate_csv.mjs <path-to-csv> [YYYY-MM-DD]"
  );
  process.exit(1);
}

const db = new Client(process.env.DATABASE_URL);
await db.connect();

try {
  console.log(`\n🚀  MPN Accuracy Migration`);
  console.log(`   CSV:            ${CSV_PATH}`);
  console.log(`   Snapshot date:  ${SNAPSHOT_DATE}`);
  console.log(`   Label:          "${SNAPSHOT_LABEL}"\n`);

  // -------------------------------------------------------------------------
  // 1. Ensure all extra brands exist
  // -------------------------------------------------------------------------
  console.log("1️⃣  Ensuring all brands exist...");
  for (const name of EXTRA_BRANDS) {
    await db.query(
      `INSERT INTO brands (name, status) VALUES ($1, 'pending') ON CONFLICT (name) DO NOTHING`,
      [name]
    );
  }

  // -------------------------------------------------------------------------
  // 2. Build brand name → DB row map
  // -------------------------------------------------------------------------
  const { rows: brandRows } = await db.query(`SELECT id, name FROM brands`);
  const brandMap = {};
  for (const row of brandRows) {
    brandMap[row.name.toLowerCase()] = row;
  }

  function resolveBrand(make) {
    const normalized = (BRAND_NAME_MAP[make] ?? make).toLowerCase();
    return brandMap[normalized] ?? null;
  }

  // -------------------------------------------------------------------------
  // 3. Parse CSV
  // -------------------------------------------------------------------------
  console.log("2️⃣  Parsing CSV...");
  const csvText = readFileSync(CSV_PATH, "utf8");
  const { data, errors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length > 0) {
    console.warn(`   ⚠️  ${errors.length} parse warnings (usually harmless).`);
  }
  console.log(`   ${data.length} rows parsed.\n`);

  // Group by brand
  const rowsByBrand = {};
  const unknownMakes = new Set();

  for (const row of data) {
    const make = row["Make"]?.trim();
    if (!make) continue;

    const brand = resolveBrand(make);
    if (!brand) {
      unknownMakes.add(make);
      continue;
    }

    if (!rowsByBrand[brand.id]) {
      rowsByBrand[brand.id] = { brand, records: [] };
    }

    rowsByBrand[brand.id].records.push({
      region: row["H1"] || null,
      vin: row["VIN"]?.trim() || "",
      make: row["Make"]?.trim() || null,
      model: row["Model"]?.trim() || null,
      year: parseInt(row["Year"]) || null,
      upstream_provider: row["Upstream Provider"]?.trim() || null,
      part_type:
        row["Part Description"]?.trim() || row["HCA"]?.trim() || "",
      interpreter_output: row["Interpreter"]?.trim() || null,
      // Use original EPC when available; fall back to Non Original EPC
      epc_output: row["EPC"]?.trim() || row["Non Original EPC"]?.trim() || null,
      is_valid: toIsValid(row["Interpreter result"], row["Interpreter"], row["EPC"], row["Non Original EPC"]),
      epc_source: getEpcSource(row),
      // For skipped records, store the reason (interpreter output if it explains
      // the skip, otherwise the interpreter result value); for valid/invalid,
      // store the analysis notes.
      notes: (() => {
        const validity = toIsValid(row["Interpreter result"], row["Interpreter"], row["EPC"], row["Non Original EPC"]);
        if (validity !== null) return row["Analysis"]?.trim() || null;
        // For skipped records, surface the most informative reason
        const interpOut  = row["Interpreter"]?.trim() || "";
        const epcOut     = row["EPC"]?.trim() || "";
        const nonOrigOut = row["Non Original EPC"]?.trim() || "";
        const result     = row["Interpreter result"]?.trim() || "";
        if (containsNotTestable(interpOut))  return interpOut;
        if (containsNotTestable(epcOut))     return `EPC: ${epcOut}`;
        if (containsNotTestable(nonOrigOut)) return `Non-Original EPC: ${nonOrigOut}`;
        return result || interpOut || row["Analysis"]?.trim() || null;
      })(),
    });
  }

  if (unknownMakes.size > 0) {
    console.warn(`⚠️   Skipped unknown brands: ${[...unknownMakes].join(", ")}\n`);
  }

  const brandIds = Object.keys(rowsByBrand);
  console.log(`   Found data for ${brandIds.length} brands.\n`);

  // -------------------------------------------------------------------------
  // 4. Insert snapshot + records + stats for each brand
  // -------------------------------------------------------------------------
  console.log("3️⃣  Inserting records...\n");

  for (const brandId of brandIds) {
    const { brand, records } = rowsByBrand[brandId];

    // Create the snapshot
    const { rows: snapRows } = await db.query(
      `INSERT INTO benchmark_snapshots
         (brand_id, snapshot_date, notes, uploaded_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [brandId, SNAPSHOT_DATE, SNAPSHOT_LABEL, "migration-script"]
    );
    const snapshotId = snapRows[0].id;

    // Insert records in batches
    let inserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      const valuePlaceholders = [];
      const values = [];
      let idx = 1;

      for (const r of batch) {
        valuePlaceholders.push(
          `($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`
        );
        values.push(
          snapshotId,
          brandId,
          r.region,
          r.vin,
          r.make,
          r.model,
          r.year,
          r.upstream_provider,
          r.part_type,
          r.interpreter_output,
          r.epc_output,
          r.is_valid,
          r.epc_source
        );
      }

      await db.query(
        `INSERT INTO benchmark_records
           (snapshot_id, brand_id, region, vin, make, model, year,
            upstream_provider, part_type, interpreter_output, epc_output, is_valid, epc_source)
         VALUES ${valuePlaceholders.join(",")}`,
        values
      );
      inserted += batch.length;
    }

    // Compute snapshot stats
    await db.query(
      `UPDATE benchmark_snapshots
       SET
         total_vins    = (SELECT COUNT(DISTINCT vin) FROM benchmark_records WHERE snapshot_id = $1),
         active_vins   = (SELECT COUNT(DISTINCT vin) FROM benchmark_records WHERE snapshot_id = $1 AND is_valid IS NOT NULL),
         total_parts   = (SELECT COUNT(*) FROM benchmark_records WHERE snapshot_id = $1 AND is_valid IS NOT NULL),
         valid_count   = (SELECT COUNT(*) FROM benchmark_records WHERE snapshot_id = $1 AND is_valid = TRUE),
         invalid_count = (SELECT COUNT(*) FROM benchmark_records WHERE snapshot_id = $1 AND is_valid = FALSE),
         skipped_count = (SELECT COUNT(*) FROM benchmark_records WHERE snapshot_id = $1 AND is_valid IS NULL),
         accuracy_pct  = CASE
           WHEN (SELECT COUNT(*) FROM benchmark_records WHERE snapshot_id = $1 AND is_valid IS NOT NULL) = 0 THEN 0
           ELSE ROUND(
             (SELECT COUNT(*) FROM benchmark_records WHERE snapshot_id = $1 AND is_valid = TRUE)::NUMERIC /
             (SELECT COUNT(*) FROM benchmark_records WHERE snapshot_id = $1 AND is_valid IS NOT NULL) * 100,
             2
           )
         END
       WHERE id = $1`,
      [snapshotId]
    );

    // Print summary row
    const { rows: stats } = await db.query(
      `SELECT total_vins, total_parts, valid_count, invalid_count, skipped_count, accuracy_pct
       FROM benchmark_snapshots WHERE id = $1`,
      [snapshotId]
    );
    const s = stats[0];
    console.log(
      `   ✅  ${brand.name.padEnd(18)}  ` +
        `${String(inserted).padStart(4)} rows  |  ` +
        `${s.total_vins} VINs  |  ` +
        `${s.valid_count}✓  ${s.invalid_count}✗  ${s.skipped_count}⊘  |  ` +
        `${s.accuracy_pct}%`
    );
  }

  console.log(
    `\n✨  Done! Refresh http://localhost:3000 to see your data.\n`
  );
} finally {
  await db.end();
}
