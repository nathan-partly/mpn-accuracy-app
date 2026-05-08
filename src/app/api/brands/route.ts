import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllBrands } from "@/lib/queries";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // If ?full=1 is passed return the full brand objects (used by the accuracy dashboard).
  // The default lightweight response only returns id+name, which is all the upload page needs
  // and avoids the slow lateral-join query timing out before the user can drop a file.
  const url = new URL(req.url);
  if (url.searchParams.get("full") === "1") {
    const brands = await getAllBrands();
    return NextResponse.json(brands);
  }

  const rows = await sql`SELECT id, name FROM brands ORDER BY name ASC`;
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, status = "pending" } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO brands (name, status)
    VALUES (${name.trim()}, ${status})
    ON CONFLICT (name) DO NOTHING
    RETURNING *
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Brand already exists" }, { status: 409 });
  }

  return NextResponse.json(rows[0], { status: 201 });
}
