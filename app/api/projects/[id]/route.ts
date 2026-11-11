import { NextRequest, NextResponse } from "next/server";
import { dbQuery, toUuid } from "@/lib/db/client";
import { requireOwnerKey } from "@/lib/db/auth";
import {
  canTransitionLifecyclePhase,
  type StudioSlug,
  sha256Hex,
} from "@/lib/cortex-os-data";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const uuid = toUuid(id);
    const res = await dbQuery(
      "SELECT id, slug, name, description, status, current_phase, created_at::text, updated_at::text FROM projects WHERE id = $1 OR slug = $2 LIMIT 1",
      [uuid, id]
    );
    if (!res.rows[0]) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(res.rows[0]);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to fetch project" },
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
    const body = await req.json();

    // Optional studio pack update or audit finding resolution
    if (body.studio_pack_update) {
      const { studio_slug, pack } = body.studio_pack_update;
      const manifestHash = sha256Hex(JSON.stringify(pack));
      await dbQuery(
        "UPDATE studios SET manifest_hash = $1 WHERE slug = $2",
        [manifestHash, studio_slug]
      );
      await dbQuery(
        `UPDATE agents
            SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{pack}', $1::jsonb, true)
          WHERE studio_id = (SELECT id FROM studios WHERE slug = $2 LIMIT 1)`,
        [JSON.stringify(pack), studio_slug]
      );
      return NextResponse.json({
        ok: true,
        studio_slug,
        manifest_hash: manifestHash,
      });
    }

    if (body.resolve_finding_id) {
      const fid = toUuid(body.resolve_finding_id);
      await dbQuery(
        "UPDATE audit_findings SET status = 'resolved'::finding_status, resolved_at = now(), resolved_by = $1 WHERE id = $2",
        [body.resolved_by || "Ray (Founder)", fid]
      );
      return NextResponse.json({ ok: true, id: fid, status: "resolved" });
    }

    const uuid = toUuid(id);
    const existingRes = await dbQuery<{
      id: string;
      slug: string;
      name: string;
      description: string;
      status: string;
      current_phase: StudioSlug;
    }>(
      "SELECT id, slug, name, description, status, current_phase FROM projects WHERE id = $1 OR slug = $2 LIMIT 1",
      [uuid, id]
    );
    const project = existingRes.rows[0];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (
      body.current_phase &&
      body.current_phase !== project.current_phase &&
      !body.force
    ) {
      const approvedRes = await dbQuery<{ artifact_type: string }>(
        "SELECT artifact_type FROM artifacts WHERE project_id = $1 AND status = 'approved'",
        [project.id]
      );
      const approvedTypes = approvedRes.rows.map((r) => r.artifact_type);
      const gate = canTransitionLifecyclePhase(
        project.current_phase,
        body.current_phase as StudioSlug,
        approvedTypes
      );
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.reason }, { status: 422 });
      }
    }

    const nextName = body.name ?? project.name;
    const nextDesc = body.description ?? project.description;
    const nextStatus = body.status ?? project.status;
    const nextPhase = body.current_phase ?? project.current_phase;

    const updatedRes = await dbQuery(
      `UPDATE projects
          SET name = $1,
              description = $2,
              status = $3::project_status,
              current_phase = $4
        WHERE id = $5
        RETURNING id, slug, name, description, status, current_phase, created_at::text, updated_at::text`,
      [nextName, nextDesc, nextStatus, nextPhase, project.id]
    );

    return NextResponse.json(updatedRes.rows[0]);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to update project" },
      { status: 500 }
    );
  }
}
