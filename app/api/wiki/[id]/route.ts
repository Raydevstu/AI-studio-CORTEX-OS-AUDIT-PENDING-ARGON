import { NextRequest, NextResponse } from "next/server";
import { dbQuery, toUuid } from "@/lib/db/client";
import { requireOwnerKey } from "@/lib/db/auth";
import { validateWikiPage } from "@/lib/cortex-os-data";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const uuid = toUuid(id);
    const res = await dbQuery(
      `SELECT id, page_type, path, title, summary, markdown_body, project_id,
              current_version, body_hash, review_state, requires_approval,
              created_at::text, updated_at::text
         FROM wiki_pages
        WHERE id = $1 OR path = $2 LIMIT 1`,
      [uuid, id]
    );
    if (!res.rows[0]) {
      return NextResponse.json({ error: "Wiki page not found" }, { status: 404 });
    }

    const page = res.rows[0] as { id: string };
    const claimsRes = await dbQuery(
      `SELECT id, wiki_page_id, page_version, claim_text, source_id, artifact_id,
              locator, confidence, review_state, created_at::text
         FROM claims
        WHERE wiki_page_id = $1
        ORDER BY created_at DESC`,
      [page.id]
    );

    return NextResponse.json({
      ...page,
      claims: claimsRes.rows,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to fetch wiki page" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireOwnerKey(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await context.params;
    const uuid = toUuid(id);
    const body = await req.json();

    const existingRes = await dbQuery<{
      id: string;
      page_type: string;
      path: string;
      title: string;
      summary: string;
      markdown_body: string;
      project_id: string | null;
      current_version: number;
      body_hash: string;
      review_state: string;
      requires_approval: boolean;
    }>(
      "SELECT id, page_type, path, title, summary, markdown_body, project_id, current_version, body_hash, review_state, requires_approval FROM wiki_pages WHERE id = $1 OR path = $2 LIMIT 1",
      [uuid, id]
    );

    const existing = existingRes.rows[0];
    if (!existing) {
      return NextResponse.json({ error: "Wiki page not found" }, { status: 404 });
    }

    const nextReviewState = body.review_state ?? existing.review_state;
    const nextRequiresApproval =
      body.requires_approval !== undefined
        ? Boolean(body.requires_approval)
        : existing.requires_approval;

    if (existing.page_type === "doctrine" && !nextRequiresApproval) {
      return NextResponse.json(
        { error: "doctrine pages always require approval" },
        { status: 422 }
      );
    }

    const updatedRes = await dbQuery(
      `UPDATE wiki_pages
          SET review_state = $1::review_state,
              requires_approval = $2,
              title = $3,
              summary = $4,
              markdown_body = $5
        WHERE id = $6
        RETURNING id, page_type, path, title, summary, markdown_body, project_id,
                  current_version, body_hash, review_state, requires_approval,
                  created_at::text, updated_at::text`,
      [
        nextReviewState,
        nextRequiresApproval,
        body.title ?? existing.title,
        body.summary ?? existing.summary,
        body.markdown_body ?? existing.markdown_body,
        existing.id,
      ]
    );

    const validated = validateWikiPage(updatedRes.rows[0] as never);

    if (nextReviewState === "approved") {
      await dbQuery(
        "UPDATE audit_findings SET status = 'resolved'::finding_status, resolved_at = now(), resolved_by = $1 WHERE object_id = $2",
        [body.approved_by || "Ray (Founder)", existing.id]
      );
    }

    await dbQuery(
      `INSERT INTO audit_log (actor_type, actor_id, action, object_id, details)
       VALUES ('user', $1, 'wiki.approve', $2, $3::jsonb)`,
      [
        body.approved_by || "owner",
        existing.id,
        JSON.stringify({
          path: existing.path,
          review_state: nextReviewState,
        }),
      ]
    );

    return NextResponse.json(validated);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to update wiki page" },
      { status: 500 }
    );
  }
}
