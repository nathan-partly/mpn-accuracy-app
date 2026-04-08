import { NextResponse } from "next/server";
import { getLatestCoverageSnapshot } from "@/lib/queries";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Prefer DB-stored version (uploaded via the app)
    const latest = await getLatestCoverageSnapshot();
    if (latest?.html_content) {
      return new NextResponse(latest.html_content, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  } catch {
    // Fall through to static file fallback
  }

  // Fallback: serve the static file bundled with the deployment
  try {
    const html = readFileSync(
      join(process.cwd(), "public", "coverage-dashboard.html"),
      "utf-8"
    );
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new NextResponse("Coverage dashboard not found", { status: 404 });
  }
}
