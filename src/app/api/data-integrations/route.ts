import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface DataIntegration {
  id: number;
  name: string;
  type: "online" | "offline";
  brands: string[];
  total_vio_pct: number | null;
  incremental_vio_pct: number | null;
  integration_date: string; // ISO date string YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id, name, type, brands,
        total_vio_pct::float          AS total_vio_pct,
        incremental_vio_pct::float    AS incremental_vio_pct,
        integration_date::text        AS integration_date,
        created_at, updated_at
      FROM data_integrations
      ORDER BY integration_date ASC, id ASC
    `;
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[data-integrations GET]", err);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, type, brands, total_vio_pct, incremental_vio_pct, integration_date } = body;

    if (!name?.trim() || !type || !integration_date) {
      return NextResponse.json(
        { error: "name, type, and integration_date are required" },
        { status: 400 }
      );
    }
    if (!["online", "offline"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'online' or 'offline'" },
        { status: 400 }
      );
    }

    const brandsArr: string[] = Array.isArray(brands)
      ? brands.map((b: string) => b.trim()).filter(Boolean)
      : [];
    const tvio = total_vio_pct != null ? Number(total_vio_pct) : null;
    const ivio = incremental_vio_pct != null ? Number(incremental_vio_pct) : null;

    const rows = await sql`
      INSERT INTO data_integrations
        (name, type, brands, total_vio_pct, incremental_vio_pct, integration_date)
      VALUES
        (${name.trim()}, ${type}, ${brandsArr}, ${tvio}, ${ivio}, ${integration_date})
      RETURNING
        id, name, type, brands,
        total_vio_pct::float       AS total_vio_pct,
        incremental_vio_pct::float AS incremental_vio_pct,
        integration_date::text     AS integration_date,
        created_at, updated_at
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[data-integrations POST]", err);
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }
}
