import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllBrands } from "@/lib/queries";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brands = await getAllBrands();
  return NextResponse.json(brands);
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
