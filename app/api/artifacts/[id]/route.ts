import { NextRequest, NextResponse } from "next/server";
import { dbQuery, toUuid } from "@/lib/db/client";
import { requireOwnerKey } from "@/lib/db/auth";
import { validateArtifact } from "@/lib/cortex-os-data";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const uuid = toUuid(id);
    const res = await dbQuery(
      `SELECT a.id, a.project_id, a.studio_id, s.slug AS studio_slug, a.work_request_id,
              a.artifact_type, a.schema_version, a.title, a.summary, a.status, a.version,
              a.storage_path, a.content_hash, a.body, a.markdown_content,
              a.created_by_agent_id, a.approved_by, a.approved_at::text,
              a.created_at::text, a.updated_at::text
         FROM artifacts a
         LEFT JOIN studios s ON s.id = a.studio_id
        WHERE a.id = $1 LIMIT 1`,
      [uuid]
    );
    if (!res.rows[0]) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }
    return NextResponse.json(res.rows[0]);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to fetch artifact" },
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

    // Locked rule: status=approved requires approved_by AND approved_at, else return 422
    if (body.status === "approved") {
      const approvedBy =
        typeof body.approved_by === "string" ? body.approved_by.trim() : "";
      const approvedAt =
        typeof body.approved_at === "string" ? body.approved_at.trim() : "";
      if (!approvedBy || !approvedAt) {
        return NextResponse.json(
          {
            error:
              "Unprocessable Entity: status='approved' requires both approved_by and approved_at",
          },
          { status: 422 }
        );
      }
    }

    const existingRes = await dbQuery<{
      id: string;
      title: string;
      summary: string;
      status: string;
      approved_by: string | null;
      approved_at: string | null;
    }>(
      "SELECT id, title, summary, status, approved_by, approved_at::text FROM artifacts WHERE id = $1 LIMIT 1",
      [uuid]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    const nextStatus = body.status ?? existing.status;
    const nextApprovedBy =
      body.approved_by !== undefined ? body.approved_by : existing.approved_by;
    const nextApprovedAt =
      body.approved_at !== undefined ? body.approved_at : existing.approved_at;

    if (nextStatus === "approved" && (!nextApprovedBy || !nextApprovedAt)) {
      return NextResponse.json(
        {
          error:
            "Unprocessable Entity: status='approved' requires both approved_by and approved_at",
        },
        { status: 422 }
      );
    }

    const updatedRes = await dbQuery(
      `UPDATE artifacts
          SET title = $1,
              summary = $2,
              status = $3::artifact_status,
              approved_by = $4,
              approved_at = $5
        WHERE id = $6
        RETURNING id, project_id, studio_id, work_request_id, artifact_type, schema_version,
                  title, summary, status, version, storage_path, content_hash, body,
                  markdown_content, approved_by, approved_at::text, created_at::text, updated_at::text`,
      [
        body.title ?? existing.title,
        body.summary ?? existing.summary,
        nextStatus,
        nextApprovedBy,
        nextApprovedAt,
        existing.id,
      ]
    );

    const validated = validateArtifact(updatedRes.rows[0] as never);

    await dbQuery(
      `INSERT INTO audit_log (actor_type, actor_id, action, object_id, details)
       VALUES ('user', $1, 'artifact.update', $2, $3::jsonb)`,
      [
        nextApprovedBy || "owner",
        existing.id,
        JSON.stringify({
          status: nextStatus,
          approved_by: nextApprovedBy,
          approved_at: nextApprovedAt,
        }),
      ]
    );

    return NextResponse.json(validated);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.includes("approved_by")) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to update artifact" },
      { status: 500 }
    );
  }
}
