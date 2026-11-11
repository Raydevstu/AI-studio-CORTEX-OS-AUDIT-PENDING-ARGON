import { NextRequest, NextResponse } from "next/server";
import { dbQuery, toUuid } from "@/lib/db/client";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const uuid = toUuid(id);
    const res = await dbQuery(
      `SELECT id, project_id, kind, title, uri, storage_path, content_hash, raw_content,
              mime_type, byte_size::int AS byte_size, trust, ingest_status, ingest_error,
              metadata, ingested_at::text
         FROM sources
        WHERE id = $1 LIMIT 1`,
      [uuid]
    );
    if (!res.rows[0]) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }
    return NextResponse.json(res.rows[0]);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to fetch source" },
      { status: 500 }
    );
  }
}
