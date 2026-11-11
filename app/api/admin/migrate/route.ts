import { NextResponse } from "next/server";
import { ensureDatabaseMigrated } from "@/lib/db/migrate";

export async function GET() {
  try {
    const result = await ensureDatabaseMigrated();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[/api/admin/migrate] Migration error:", error.message);
    return NextResponse.json(
      { error: error.message || "Database migration failed" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
