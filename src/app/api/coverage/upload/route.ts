import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveCoverageSnapshot, getLatestCoverageSnapshot } from "@/lib/queries";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

// Vercel body size limit is 4.5 MB by default — coverage HTML is ~600 KB, well within limit.

// ── Logo slug helpers ─────────────────────────────────────────────────────────

// Overrides for makes whose CDN slug can't be derived automatically from the name
const LOGO_OVERRIDES: Record<string, string> = {
  "mercedes":        "mercedes-benz",
  "mercedes benz":   "mercedes-benz",
  "mercedes-benz":   "mercedes-benz",
  "mercedesbenz":    "mercedes-benz",
  "land rover":      "land-rover",
  "alfa romeo":      "alfa-romeo",
  "alfa":            "alfa-romeo",
  "great":           "great-wall",        // "GREAT" = Great Wall Motors in source data
  "great wall":      "great-wall",
  "great wall motors": "great-wall",
  "vw":              "volkswagen",
  "vw / audi":       "volkswagen",
  "gm":              "general-motors",
  "bmw / mini":      "bmw",
};

function deriveLogo(make: string): string {
  const key = make.toLowerCase().trim();
  if (LOGO_OVERRIDES[key]) return LOGO_OVERRIDES[key];
  // Default: lowercase and replace spaces/special chars with hyphens, collapse runs
  return key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── CSV helpers ────────────────────────────────────────────────────────────────

function parseCsvToData(csv: string): Record<string, unknown[]> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`CSV is missing required column: "${name}"`);
    return i;
  };

  const iMake = idx("make");
  const iRegion = idx("region");
  const iVin = idx("vin");
  const iStatus = idx("coverage status");

  // Accumulate VINs per region → make
  const acc: Record<string, Record<string, { yv: string[]; nv: string[] }>> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) continue;

    const make = cols[iMake].trim();
    const region = cols[iRegion].trim();
    const vin = cols[iVin].trim();
    const status = cols[iStatus].trim().toLowerCase();

    if (!make || !region || !vin) continue;

    if (!acc[region]) acc[region] = {};
    if (!acc[region][make]) acc[region][make] = { yv: [], nv: [] };

    if (status === "yes") {
      acc[region][make].yv.push(vin);
    } else {
      acc[region][make].nv.push(vin);
    }
  }

  if (Object.keys(acc).length === 0) {
    throw new Error("CSV produced no valid data rows");
  }

  // Build DATA structure, auto-calculating share, rate, logo
  const data: Record<string, unknown[]> = {};

  for (const [region, makes] of Object.entries(acc)) {
    const totalVinsInRegion = Object.values(makes).reduce(
      (sum, m) => sum + m.yv.length + m.nv.length, 0
    );

    data[region] = Object.entries(makes).map(([make, vins]) => {
      const y = vins.yv.length;
      const n = vins.nv.length;
      const total = y + n;
      const rate = total === 0 ? 0 : Math.round((y / total) * 1000) / 10;
      const share = totalVinsInRegion === 0 ? 0 :
        Math.round((total / totalVinsInRegion) * 1000) / 10;
      // Derive logo slug from make name (lowercase, no spaces/special chars)
      const logo = deriveLogo(make);

      return { make, logo, y, n, total, rate, share, yv: vins.yv, nv: vins.nv };
    });
  }

  // Re-build the ALL aggregate (sum across all regions, deduped by VIN)
  const allMakes: Record<string, { yv: Set<string>; nv: Set<string> }> = {};
  for (const makes of Object.values(acc)) {
    for (const [make, vins] of Object.entries(makes)) {
      if (!allMakes[make]) allMakes[make] = { yv: new Set(), nv: new Set() };
      vins.yv.forEach((v) => allMakes[make].yv.add(v));
      vins.nv.forEach((v) => allMakes[make].nv.add(v));
    }
  }
  const totalVinsAll = Object.values(allMakes).reduce(
    (sum, m) => sum + m.yv.size + m.nv.size, 0
  );
  data["ALL"] = Object.entries(allMakes).map(([make, vins]) => {
    const yv = Array.from(vins.yv);
    const nv = Array.from(vins.nv);
    const y = yv.length;
    const n = nv.length;
    const total = y + n;
    const rate = total === 0 ? 0 : Math.round((y / total) * 1000) / 10;
    const share = totalVinsAll === 0 ? 0 : Math.round((total / totalVinsAll) * 1000) / 10;
    const logo = deriveLogo(make);
    return { make, logo, y, n, total, rate, share, yv, nv };
  });

  return data;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function injectDataIntoHtml(html: string, data: Record<string, unknown[]>): string {
  const dataJson = JSON.stringify(data);
  // Find the DATA constant and replace it using bracket counting
  const marker = "const DATA = ";
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error("Could not find DATA constant in HTML template to replace");
  }
  const jsonStart = html.indexOf("{", markerIdx + marker.length);
  if (jsonStart === -1) {
    throw new Error("Could not find DATA object start in HTML template");
  }
  let depth = 0;
  let i = jsonStart;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return html.slice(0, markerIdx) + `const DATA = ${dataJson}` + html.slice(i + 1);
}

async function getHtmlTemplate(): Promise<string> {
  // Prefer the latest DB snapshot as the template base
  try {
    const latest = await getLatestCoverageSnapshot();
    if (latest?.html_content) return latest.html_content;
  } catch {
    // fall through
  }
  // Fall back to the static bundled file
  return readFileSync(join(process.cwd(), "public", "coverage-dashboard.html"), "utf-8");
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const isCsv = file.name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/csv";
  const isHtml = file.name.endsWith(".html") || file.type === "text/html";

  if (!isCsv && !isHtml) {
    return NextResponse.json(
      { error: "File must be a CSV (.csv) or HTML (.html) file" },
      { status: 400 }
    );
  }

  const content = await file.text();
  let html: string;

  if (isCsv) {
    // Parse the CSV, rebuild DATA, inject into HTML template
    let data: Record<string, unknown[]>;
    try {
      data = parseCsvToData(content);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to parse CSV" },
        { status: 400 }
      );
    }

    let template: string;
    try {
      template = await getHtmlTemplate();
    } catch {
      return NextResponse.json(
        { error: "No HTML template found to inject data into — upload an HTML snapshot first." },
        { status: 500 }
      );
    }

    try {
      html = injectDataIntoHtml(template, data);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to build HTML from CSV" },
        { status: 500 }
      );
    }
  } else {
    // Legacy HTML upload path
    html = content;
    if (!html.includes("const DATA =") || !html.includes("make")) {
      return NextResponse.json(
        { error: "File doesn't look like a valid coverage dashboard HTML — missing expected DATA structure." },
        { status: 400 }
      );
    }
  }

  // Extract DATA from the final HTML to store as lightweight data_json
  let dataJson: string | undefined;
  try {
    const marker = "const DATA = ";
    const markerIdx = html.indexOf(marker);
    if (markerIdx !== -1) {
      const jsonStart = html.indexOf("{", markerIdx + marker.length);
      let depth = 0, i = jsonStart;
      for (; i < html.length; i++) {
        if (html[i] === "{") depth++;
        else if (html[i] === "}") { depth--; if (depth === 0) break; }
      }
      dataJson = html.slice(jsonStart, i + 1);
    }
  } catch { /* non-fatal */ }

  const id = await saveCoverageSnapshot(html, session.user.email, dataJson);
  return NextResponse.json({ success: true, id });
}
