import { NextRequest, NextResponse } from "next/server";
import { requireOwnerKey } from "@/lib/db/auth";
import { runMigration } from "@/lib/db/migrate";

export async function POST(req: NextRequest) {
  const unauthorized = requireOwnerKey(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await runMigration();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[/api/admin/migrate] Migration error:", error);
    return NextResponse.json(
      { error: error.message || "Database migration failed" },
      { status: 500 }
    );
  }
}
