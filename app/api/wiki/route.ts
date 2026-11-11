import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const agentVisibleOnly =
      req.nextUrl.searchParams.get("agent_visible") === "true";
    const tableOrView = agentVisibleOnly
      ? "agent_visible_wiki_pages"
      : "wiki_pages";

    const pagesRes = await dbQuery(
      `SELECT id, page_type, path, title, summary, markdown_body, project_id,
              current_version, body_hash, review_state, requires_approval,
              created_at::text, updated_at::text
         FROM ${tableOrView}
        ORDER BY CASE
          WHEN path = 'index.md' THEN 0
          WHEN path = 'log.md' THEN 1
          ELSE 2 END, updated_at DESC`
    );

    const claimsRes = await dbQuery(
      `SELECT id, wiki_page_id, page_version, claim_text, source_id, artifact_id,
              locator, confidence, review_state, created_at::text
         FROM claims
        ORDER BY created_at DESC`
    );

    return NextResponse.json({
      wiki_pages: pagesRes.rows,
      claims: claimsRes.rows,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to list wiki pages" },
      { status: 500 }
    );
  }
}
