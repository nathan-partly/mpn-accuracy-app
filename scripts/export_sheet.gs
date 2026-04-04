/**
 * Interpreter Accuracy Benchmarking — Google Sheets export script
 * ---------------------------------------------------------------
 * Paste this into Extensions → Apps Script in the Google Sheet.
 * Then run exportMasterCSV().
 *
 * What it does:
 *   - Iterates every brand tab (skipping utility tabs listed in SKIP_TABS)
 *   - Reads the multi-column header structure (row 1 = part-type group, row 2 = sub-column)
 *   - For each data row × part-type column group, emits one flat CSV row
 *   - Determines is_valid from the Analysis column and interpreter output
 *   - Produces a SINGLE master CSV (all brands combined) saved to Google Drive
 *
 * The output CSV matches the upload template exactly:
 *   brand, region, vin, make, model, year, upstream_provider,
 *   part_type, interpreter_output, epc_output, pl24_output, is_valid, notes
 *
 * is_valid logic (Nathan's definition):
 *   - If interpreter output is empty, "Missing hotspot", or "Missing diagram" → blank (skipped)
 *   - If Analysis contains "Invalid" → false
 *   - If Analysis contains "Valid" or "Outdated supersession" → true
 *   - Otherwise → blank (review manually)
 *
 * After running, download the CSV from Google Drive and upload via the app.
 */

const SKIP_TABS = [
  "Brands",
  "Brand Providers",
  "Parts Validation Testing",
  "Accuracy test",
  "Date test",
  "Parts",
  "Accuracy Pivot",
];

// Columns A–G are always metadata; H onwards are part-type data
const META_COLS = {
  REGION:            0, // A
  VIN:               1, // B
  MAKE:              2, // C
  MODEL:             3, // D
  YEAR:              4, // E
  UPSTREAM_PROVIDER: 5, // F
  ANALYSIS:          6, // G
};

const SKIP_INTERPRETER_VALUES = [
  "missing hotspot",
  "missing diagram",
  "",
];

function exportMasterCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  const allRows = [];
  allRows.push([
    "brand", "region", "vin", "make", "model", "year", "upstream_provider",
    "part_type", "interpreter_output", "epc_output", "pl24_output", "is_valid", "notes",
  ]);

  sheets.forEach((sheet) => {
    const name = sheet.getName();

    // Skip utility tabs
    if (SKIP_TABS.some((t) => name.toLowerCase().includes(t.toLowerCase()))) {
      Logger.log(`Skipping tab: ${name}`);
      return;
    }

    // Extract brand name (remove leading count like "47 " or "99+ ")
    const brandName = name.replace(/^\d+\+?\s+/, "").trim();
    Logger.log(`Processing: ${brandName} (tab: ${name})`);

    const brandRows = exportBrandRows(sheet, brandName);
    if (!brandRows || brandRows.length === 0) {
      Logger.log(`  → No data found, skipping`);
      return;
    }

    brandRows.forEach((row) => allRows.push(row));
    Logger.log(`  → ${brandRows.length} rows`);
  });

  if (allRows.length <= 1) {
    SpreadsheetApp.getUi().alert("No data found across any brand tabs.");
    return;
  }

  // Convert to CSV string
  const csv = allRows
    .map((row) =>
      row.map((cell) => {
        const s = String(cell ?? "");
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }).join(",")
    )
    .join("\n");

  // Save to Drive (overwrite if exists)
  const fileName = "mpn_accuracy_all_brands.csv";
  const existing = DriveApp.getFilesByName(fileName);
  while (existing.hasNext()) existing.next().setTrashed(true);
  DriveApp.createFile(fileName, csv, MimeType.CSV);

  SpreadsheetApp.getUi().alert(
    `Export complete!\n${allRows.length - 1} rows written to ${fileName} in your Google Drive root folder.`
  );
}

function exportBrandRows(sheet, brandName) {
  const allValues = sheet.getDataRange().getValues();
  if (allValues.length < 3) return null;

  const row1 = allValues[0]; // Part-type group headers
  const row2 = allValues[1]; // Sub-column headers: "Interpreter", "PL24", "EPC"

  // Find part-type column groups starting at col H (index 7)
  const partTypeGroups = []; // { partType, interpreterCol, pl24Col, epcCol }

  let col = 7;
  while (col < row1.length) {
    const partType = String(row1[col] || "").trim();
    const subHeader = String(row2[col] || "").trim().toLowerCase();

    if (!partType) { col++; continue; }

    if (subHeader === "interpreter" || subHeader === "") {
      let interpreterCol = -1, pl24Col = -1, epcCol = -1;

      for (let offset = 0; offset <= 3; offset++) {
        const sub = String(row2[col + offset] || "").trim().toLowerCase();
        if (sub === "interpreter" && interpreterCol === -1) interpreterCol = col + offset;
        if (sub === "pl24" && pl24Col === -1) pl24Col = col + offset;
        if (sub === "epc" && epcCol === -1) epcCol = col + offset;
      }

      if (interpreterCol !== -1) {
        partTypeGroups.push({ partType, interpreterCol, pl24Col, epcCol });
        col = interpreterCol + 3;
      } else {
        col++;
      }
    } else {
      col++;
    }
  }

  if (partTypeGroups.length === 0) return null;

  Logger.log(`  → Found ${partTypeGroups.length} part types: ${partTypeGroups.map(g => g.partType).join(", ")}`);

  const rows = [];

  for (let rowIdx = 2; rowIdx < allValues.length; rowIdx++) {
    const row = allValues[rowIdx];
    const vin = String(row[META_COLS.VIN] || "").trim();
    if (!vin) continue; // separator / blank row

    const region           = String(row[META_COLS.REGION] || "").trim();
    const make             = String(row[META_COLS.MAKE] || "").trim();
    const model            = String(row[META_COLS.MODEL] || "").trim();
    const year             = String(row[META_COLS.YEAR] || "").trim();
    const upstreamProvider = String(row[META_COLS.UPSTREAM_PROVIDER] || "").trim();
    const analysis         = String(row[META_COLS.ANALYSIS] || "").trim().toLowerCase();

    for (const group of partTypeGroups) {
      const interpreterRaw = String(row[group.interpreterCol] || "").trim();
      const epcRaw  = group.epcCol  !== -1 ? String(row[group.epcCol]  || "").trim() : "";
      const pl24Raw = group.pl24Col !== -1 ? String(row[group.pl24Col] || "").trim() : "";

      // Skip fully empty part-type slots
      if (!interpreterRaw && !epcRaw && !pl24Raw) continue;

      // Determine is_valid
      let isValid = "";
      const interpLower = interpreterRaw.toLowerCase();

      if (!interpreterRaw || SKIP_INTERPRETER_VALUES.includes(interpLower)) {
        isValid = "";
      } else if (
        analysis.includes("invalid part variant") ||
        analysis.includes("invalid part")
      ) {
        isValid = "false";
      } else if (
        analysis.includes("valid part variant") ||
        analysis.includes("valid part") ||
        analysis.includes("outdated supersession") ||
        analysis.includes("no accuracy issue")
      ) {
        isValid = "true";
      }
      // else blank — review manually

      rows.push([
        brandName,
        region,
        vin,
        make,
        model,
        year,
        upstreamProvider,
        group.partType,
        interpreterRaw,
        epcRaw,
        pl24Raw,
        isValid,
        "", // notes
      ]);
    }
  }

  return rows;
}
