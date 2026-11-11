import { NextRequest, NextResponse } from "next/server";
import { dbQuery, dbTransaction, toUuid } from "@/lib/db/client";
import { requireOwnerKey } from "@/lib/db/auth";
import { sha256Hex, validateArtifact } from "@/lib/cortex-os-data";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("project_id");
    const params: unknown[] = [];
    let whereClause = "";
    if (projectId) {
      params.push(toUuid(projectId));
      whereClause = "WHERE a.project_id = $1";
    }

    const res = await dbQuery<{
      id: string;
      project_id: string;
      studio_id: string | null;
      studio_slug: string | null;
      work_request_id: string | null;
      artifact_type: string;
      schema_version: string;
      title: string;
      summary: string;
      status: string;
      version: number;
      storage_path: string;
      content_hash: string;
      body: Record<string, unknown> | null;
      markdown_content: string;
      created_by_agent_id: string | null;
      approved_by: string | null;
      approved_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT a.id, a.project_id, a.studio_id, s.slug AS studio_slug, a.work_request_id,
              a.artifact_type, a.schema_version, a.title, a.summary, a.status, a.version,
              a.storage_path, a.content_hash, a.body, a.markdown_content,
              a.created_by_agent_id, a.approved_by, a.approved_at::text,
              a.created_at::text, a.updated_at::text
         FROM artifacts a
         LEFT JOIN studios s ON s.id = a.studio_id
         ${whereClause}
        ORDER BY a.created_at DESC`,
      params
    );

    return NextResponse.json({
      artifacts: res.rows.map((row) => ({
        ...row,
        studio_slug:
          row.studio_slug ||
          (row.body?.studio_slug as string) ||
          undefined,
      })),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to list artifacts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = requireOwnerKey(req);
  if (unauthorized) return unauthorized;

  try {
    const payload = await req.json();
    const title = (payload.title || "").trim();
    const projectId = payload.project_id ? toUuid(payload.project_id) : null;
    if (!title || !projectId) {
      return NextResponse.json(
        { error: "project_id and title are required" },
        { status: 422 }
      );
    }

    const status = payload.status || "draft";
    if (
      status === "approved" &&
      (!payload.approved_by || !payload.approved_at)
    ) {
      return NextResponse.json(
        {
          error:
            "status=approved requires both approved_by and approved_at",
        },
        { status: 422 }
      );
    }

    const markdownContent =
      payload.markdown_content ||
      (payload.body ? JSON.stringify(payload.body, null, 2) : `# ${title}`);
    const contentHash =
      payload.content_hash || sha256Hex(markdownContent);
    const artifactType = payload.artifact_type || "Spec";
    const schemaVersion = payload.schema_version || "1";
    const version = Number(payload.version || 1);
    const storagePath =
      payload.storage_path || `brain/artifacts/${projectId}/${Date.now()}.md`;

    const created = await dbTransaction(async (tx) => {
      const idRes = await tx.query<{ id: string }>(
        "SELECT new_object('artifact') AS id"
      );
      const artId = payload.id ? toUuid(payload.id) : idRes.rows[0].id;
      if (payload.id) {
        await tx.query(
          "INSERT INTO brain_objects (id, object_type) VALUES ($1, 'artifact') ON CONFLICT (id) DO NOTHING",
          [artId]
        );
      }

      let studioId = payload.studio_id ? toUuid(payload.studio_id) : null;
      if (!studioId && payload.studio_slug) {
        const stRes = await tx.query<{ id: string }>(
          "SELECT id FROM studios WHERE slug = $1 LIMIT 1",
          [payload.studio_slug]
        );
        studioId = stRes.rows[0]?.id || null;
      }

      const ins = await tx.query(
        `INSERT INTO artifacts (
           id, project_id, studio_id, work_request_id, artifact_type, schema_version,
           title, summary, status, version, storage_path, content_hash, body,
           markdown_content, approved_by, approved_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::artifact_status, $10, $11, $12, $13::jsonb, $14, $15, $16)
         RETURNING id, project_id, studio_id, work_request_id, artifact_type, schema_version,
                   title, summary, status, version, storage_path, content_hash, body,
                   markdown_content, approved_by, approved_at::text, created_at::text, updated_at::text`,
        [
          artId,
          projectId,
          studioId,
          payload.work_request_id ? toUuid(payload.work_request_id) : null,
          artifactType,
          schemaVersion,
          title,
          payload.summary || "",
          status,
          version,
          storagePath,
          contentHash,
          JSON.stringify(payload.body || {}),
          markdownContent,
          payload.approved_by || null,
          payload.approved_at || null,
        ]
      );

      await tx.query(
        `INSERT INTO events (event_type, aggregate_type, aggregate_id, payload, idempotency_key, status)
         VALUES ('artifact_created', 'artifact', $1, $2::jsonb, $3, 'pending'::event_status)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          artId,
          JSON.stringify({ title, artifact_type: artifactType }),
          `artifact_created:${artId}`,
        ]
      );

      return validateArtifact(ins.rows[0] as never);
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to create artifact" },
      { status: 500 }
    );
  }
}
