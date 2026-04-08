import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveCoverageSnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Vercel body size limit is 4.5 MB by default — coverage HTML is ~600 KB, well within limit.
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

  if (!file.name.endsWith(".html") && file.type !== "text/html") {
    return NextResponse.json(
      { error: "File must be an HTML file (.html)" },
      { status: 400 }
    );
  }

  const html = await file.text();

  // Basic sanity check — ensure it looks like a coverage dashboard
  if (!html.includes("const DATA =") || !html.includes("make")) {
    return NextResponse.json(
      { error: "File doesn't look like a valid coverage dashboard HTML — missing expected DATA structure." },
      { status: 400 }
    );
  }

  const id = await saveCoverageSnapshot(html, session.user.email);
  return NextResponse.json({ success: true, id });
}
