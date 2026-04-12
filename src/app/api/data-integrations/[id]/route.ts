import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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
      UPDATE data_integrations
      SET
        name                = ${name.trim()},
        type                = ${type},
        brands              = ${brandsArr},
        total_vio_pct       = ${tvio},
        incremental_vio_pct = ${ivio},
        integration_date    = ${integration_date},
        updated_at          = NOW()
      WHERE id = ${id}
      RETURNING
        id, name, type, brands,
        total_vio_pct::float       AS total_vio_pct,
        incremental_vio_pct::float AS incremental_vio_pct,
        integration_date::text     AS integration_date,
        created_at, updated_at
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[data-integrations PUT]", err);
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    await sql`DELETE FROM data_integrations WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[data-integrations DELETE]", err);
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }
}
