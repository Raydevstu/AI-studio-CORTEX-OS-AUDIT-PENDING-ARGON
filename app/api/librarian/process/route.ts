import { NextRequest, NextResponse } from "next/server";
import { requireOwnerKey } from "@/lib/db/auth";
import { processPendingLibrarianEvents } from "@/lib/db/librarian-pipeline";

export async function POST(req: NextRequest) {
  const unauthorized = requireOwnerKey(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await processPendingLibrarianEvents(
      "librarian-manual-worker",
      25
    );
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[POST /api/librarian/process] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process pending Librarian events" },
      { status: 500 }
    );
  }
}
