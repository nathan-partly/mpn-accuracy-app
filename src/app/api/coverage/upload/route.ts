import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveCoverageSnapshot, getLatestCoverageSnapshot } from "@/lib/queries";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

// Vercel body size limit is 4.5 MB by default — coverage HTML is ~600 KB, well within limit.

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

  const iRegion = idx("region");
  const iMake = idx("make");
  const iLogo = idx("logo");
  const iY = idx("y");
  const iN = idx("n");
  const iTotal = idx("total");
  const iRate = idx("rate");
  const iShare = idx("share");
  const iYesVins = idx("yes_vins");
  const iNoVins = idx("no_vins");

  const data: Record<string, unknown[]> = {};

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parse respecting double-quoted fields
    const cols = parseCsvLine(lines[i]);
    if (cols.length < header.length) continue;

    const region = cols[iRegion].trim();
    if (!region) continue;

    const yesVins = cols[iYesVins].trim();
    const noVins = cols[iNoVins].trim();

    const entry = {
      make: cols[iMake].trim(),
      logo: cols[iLogo].trim(),
      y: Number(cols[iY]) || 0,
      n: Number(cols[iN]) || 0,
      total: Number(cols[iTotal]) || 0,
      rate: Number(cols[iRate]) || 0,
      share: Number(cols[iShare]) || 0,
      yv: yesVins ? yesVins.split("|").filter(Boolean) : [],
      nv: noVins ? noVins.split("|").filter(Boolean) : [],
    };

    if (!data[region]) data[region] = [];
    data[region].push(entry);
  }

  if (Object.keys(data).length === 0) {
    throw new Error("CSV produced no valid data rows");
  }

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
  // Replace the existing DATA constant with the new one
  const replaced = html.replace(
    /const DATA\s*=\s*\{[\s\S]*?\};\s*\n/,
    `const DATA = ${dataJson};\n`
  );
  if (replaced === html) {
    throw new Error("Could not find DATA constant in HTML template to replace");
  }
  return replaced;
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

  const id = await saveCoverageSnapshot(html, session.user.email);
  return NextResponse.json({ success: true, id });
}
