/**
 * Interpreter Accuracy Benchmarking — Google Sheets export script
 * ---------------------------------------------------------------
 * Paste this into Tools → Apps Script in the Google Sheet.
 * Then run exportAllBrandsToCSV().
 *
 * What it does:
 *   - Iterates every brand tab (skipping utility tabs listed in SKIP_TABS)
 *   - Reads the multi-column header structure (row 1 = part-type group, row 2 = sub-column)
 *   - For each data row × part-type column group, emits one flat CSV row
 *   - Determines is_valid based on the Analysis column and the interpreter output
 *   - Creates a CSV file per brand in your Google Drive (root folder)
 *
 * is_valid logic (matches Nathan's definition):
 *   - If interpreter output is empty, "Missing hotspot", or "Missing diagram" → blank (skipped)
 *   - If Analysis contains "Invalid" → false
 *   - If Analysis contains "Valid" or "Outdated supersession" → true
 *   - Otherwise → blank (skipped — review manually)
 *
 * After running, download each CSV from Google Drive and upload via the app.
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
  "missing diagram",
  "",
];

function exportAllBrandsToCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

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

    const csv = exportBrandSheet(sheet, brandName);
    if (!csv) {
      Logger.log(`  → No data found, skipping`);
      return;
    }

    // Save to Drive
    const fileName = `mpn_accuracy_${brandName.toLowerCase().replace(/\s+/g, "_")}.csv`;
    const existing = DriveApp.getFilesByName(fileName);
    while (existing.hasNext()) existing.next().setTrashed(true); // remove old version

    DriveApp.createFile(fileName, csv, MimeType.CSV);
    Logger.log(`  → Saved ${fileName}`);
  });

  SpreadsheetApp.getUi().alert(
    "Export complete! CSVs saved to your Google Drive root folder."
  );
}

function exportBrandSheet(sheet, brandName) {
  const allValues = sheet.getDataRange().getValues();
  if (allValues.length < 3) return null;

  const row1 = allValues[0]; // Part-type group headers (merged cells repeat the value in col 0 of group)
  const row2 = allValues[1]; // Sub-column headers: "Interpreter", "PL24", "EPC"

  // Find part-type column groups starting at col H (index 7)
  // Structure: for each group starting at some column index:
  //   row1[col] = part type name (e.g. "Front Bumper Cover")
  //   row2[col]   = "Interpreter"
  //   row2[col+1] = "PL24"
  //   row2[col+2] = "EPC"
  const partTypeGroups = []; // { partType, interpreterCol, pl24Col, epcCol }

  let col = 7; // Start at column H
  while (col < row1.length) {
    const partType = String(row1[col] || "").trim();
    const subHeader = String(row2[col] || "").trim().toLowerCase();

    if (!partType) {
      col++;
      continue;
    }

    // Look for "Interpreter" sub-header in this column or nearby
    if (subHeader === "interpreter" || subHeader === "") {
      // Find the interpreter, pl24, epc columns in this group
      let interpreterCol = -1;
      let pl24Col = -1;
      let epcCol = -1;

      for (let offset = 0; offset <= 3; offset++) {
        const sub = String(row2[col + offset] || "").trim().toLowerCase();
        if (sub === "interpreter" && interpreterCol === -1) interpreterCol = col + offset;
        if (sub === "pl24" && pl24Col === -1) pl24Col = col + offset;
        if (sub === "epc" && epcCol === -1) epcCol = col + offset;
      }

      if (interpreterCol !== -1) {
        partTypeGroups.push({ partType, interpreterCol, pl24Col, epcCol });
        col = interpreterCol + 3; // advance past this group
      } else {
        col++;
      }
    } else {
      col++;
    }
  }

  if (partTypeGroups.length === 0) {
    Logger.log(`  → No part type columns found`);
    return null;
  }

  Logger.log(`  → Found ${partTypeGroups.length} part types: ${partTypeGroups.map(g => g.partType).join(", ")}`);

  // Build flat CSV rows
  const csvRows = [];
  csvRows.push([
    "region", "vin", "make", "model", "year", "upstream_provider",
    "part_type", "interpreter_output", "epc_output", "pl24_output", "epc_source", "is_valid", "notes",
  ]);

  // Data starts at row 3 (index 2); skip blank rows (used as group separators)
  for (let rowIdx = 2; rowIdx < allValues.length; rowIdx++) {
    const row = allValues[rowIdx];
    const vin = String(row[META_COLS.VIN] || "").trim();
    if (!vin) continue; // separator row

    const region           = String(row[META_COLS.REGION] || "").trim();
    const make             = String(row[META_COLS.MAKE] || "").trim();
    const model            = String(row[META_COLS.MODEL] || "").trim();
    const year             = String(row[META_COLS.YEAR] || "").trim();
    const upstreamProvider = String(row[META_COLS.UPSTREAM_PROVIDER] || "").trim();
    const analysis         = String(row[META_COLS.ANALYSIS] || "").trim().toLowerCase();

    for (const group of partTypeGroups) {
      const interpreterRaw = String(row[group.interpreterCol] || "").trim();
      const epcRaw =
        group.epcCol !== -1 ? String(row[group.epcCol] || "").trim() : "";
      const pl24Raw =
        group.pl24Col !== -1 ? String(row[group.pl24Col] || "").trim() : "";

      // Determine is_valid
      let isValid = "";
      const interpLower = interpreterRaw.toLowerCase();

      if (
        !interpreterRaw ||
        SKIP_INTERPRETER_VALUES.includes(interpLower)
      ) {
        // No part number returned — skip (different category of issue)
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
      } else {
        // Ambiguous — leave blank for manual review
        isValid = "";
      }

      // Skip rows where there's no interpreter output AND no EPC or PL24 output
      // (completely empty part type for this VIN)
      if (!interpreterRaw && !epcRaw && !pl24Raw) continue;

      // Derive epc_source from which output columns are populated
      let epcSource = "";
      if (epcRaw && pl24Raw) epcSource = "Both";
      else if (epcRaw) epcSource = "Original EPC";
      else if (pl24Raw) epcSource = "PL24";

      csvRows.push([
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
        epcSource,
        isValid,
        "", // notes
      ]);
    }
  }

  if (csvRows.length <= 1) return null;

  Logger.log(`  → ${csvRows.length - 1} data rows`);

  // Convert to CSV string
  return csvRows
    .map((row) =>
      row.map((cell) => {
        const s = String(cell ?? "");
        // Escape cells containing commas, quotes, or newlines
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }).join(",")
    )
    .join("\n");
}
