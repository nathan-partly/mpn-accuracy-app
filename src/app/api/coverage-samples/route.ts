import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCoverageSampleSnapshots,
  saveCoverageSampleSnapshot,
  type CoverageSampleRow,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

// ── Logo slug helpers ─────────────────────────────────────────────────────────
const LOGO_OVERRIDES: Record<string, string> = {
  "mercedes": "mercedes-benz", "mercedes benz": "mercedes-benz",
  "mercedes-benz": "mercedes-benz", "mercedesbenz": "mercedes-benz",
  "land rover": "land-rover", "alfa romeo": "alfa-romeo", "alfa": "alfa-romeo",
  "great": "great-wall", "great wall": "great-wall", "great wall motors": "great-wall",
  "vw": "volkswagen", "vw / audi": "volkswagen", "gm": "general-motors",
  "bmw / mini": "bmw",
};
function deriveLogo(make: string): string {
  const key = make.toLowerCase().trim();
  return LOGO_OVERRIDES[key] ?? key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { result.push(current); current = ""; }
    else current += ch;
  }
  result.push(current);
  return result;
}

function parseCsvToRegionRows(csv: string): Record<string, CoverageSampleRow[]> {
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
  const iStatus = idx("coverage status");

  // Accumulate per region → make
  const acc: Record<string, Record<string, { y: number; n: number }>> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const make = cols[iMake]?.trim();
    const region = cols[iRegion]?.trim();
    const status = cols[iStatus]?.trim().toLowerCase();
    if (!make || !region || make === "null") continue;
    if (!acc[region]) acc[region] = {};
    if (!acc[region][make]) acc[region][make] = { y: 0, n: 0 };
    if (status === "yes") acc[region][make].y++;
    else acc[region][make].n++;
  }

  if (Object.keys(acc).length === 0) throw new Error("CSV produced no valid data rows");

  const result: Record<string, CoverageSampleRow[]> = {};
  for (const [region, makes] of Object.entries(acc)) {
    const entries = Object.entries(makes);
    const totalVins = entries.reduce((s, [, v]) => s + v.y + v.n, 0);
    result[region] = entries.map(([make, counts]) => {
      const total = counts.y + counts.n;
      const rate = total === 0 ? 0 : Math.round((counts.y / total) * 1000) / 10;
      const share = totalVins === 0 ? 0 : Math.round((total / totalVins) * 1000) / 10;
      return { make, logo: deriveLogo(make), y: counts.y, n: counts.n, total, rate, share };
    });
  }

  return result;
}

// GET /api/coverage-samples — list all snapshots
export async function GET() {
  const snapshots = await getCoverageSampleSnapshots();
  return NextResponse.json(snapshots);
}

// POST /api/coverage-samples — upload a new snapshot CSV
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
  const notes = (formData.get("notes") as string | null) ?? undefined;
  const snapshotDate = (formData.get("snapshot_date") as string | null) ??
    new Date().toISOString().split("T")[0];

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const isCsv = file.name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/csv";
  if (!isCsv) return NextResponse.json({ error: "File must be a CSV (.csv)" }, { status: 400 });

  const MAX_BYTES = 4 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 4 MB.` },
      { status: 413 }
    );
  }

  const content = await file.text();

  let regionRows: Record<string, CoverageSampleRow[]>;
  try {
    regionRows = parseCsvToRegionRows(content);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse CSV" },
      { status: 400 }
    );
  }

  const results: { region: string; id: number; brands: number }[] = [];
  for (const [region, rows] of Object.entries(regionRows)) {
    const id = await saveCoverageSampleSnapshot(
      region,
      snapshotDate,
      rows,
      session.user.email,
      notes
    );
    results.push({ region, id, brands: rows.length });
  }

  return NextResponse.json({ success: true, snapshots: results });
}
