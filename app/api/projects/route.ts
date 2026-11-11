import { NextRequest, NextResponse } from "next/server";
import { dbQuery, dbTransaction, toUuid } from "@/lib/db/client";
import { requireOwnerKey } from "@/lib/db/auth";
import { INITIAL_STUDIOS, type Project, type Studio } from "@/lib/cortex-os-data";

export async function GET(req: NextRequest) {
  try {
    const includeAll = req.nextUrl.searchParams.get("include") === "all";
    const projRes = await dbQuery<{
      id: string;
      slug: string;
      name: string;
      description: string;
      status: "active" | "paused" | "archived";
      current_phase: Project["current_phase"];
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, slug, name, description, status, current_phase, created_at::text, updated_at::text FROM projects ORDER BY created_at ASC"
    );

    if (!includeAll) {
      return NextResponse.json({ projects: projRes.rows });
    }

    // Hydrate Studios + Agents, WorkRequests, Decisions, Events, AuditFindings, CouncilMessages, Entities, Concepts, Relationships
    const studiosRes = await dbQuery<{
      id: string;
      slug: Studio["slug"];
      name: string;
      mission: string;
      status: "active" | "disabled";
      manifest_path: string;
      manifest_version: string;
      manifest_hash: string;
      created_at: string;
      updated_at: string;
      agent_id: string | null;
      agent_name: string | null;
      agent_config: Record<string, unknown> | null;
    }>(`
      SELECT s.id, s.slug, s.name, s.mission, s.status, s.manifest_path, s.manifest_version, s.manifest_hash,
             s.created_at::text, s.updated_at::text,
             a.id AS agent_id, a.name AS agent_name, a.config AS agent_config
        FROM studios s
        LEFT JOIN agents a ON a.studio_id = s.id
       ORDER BY CASE s.slug
         WHEN 'discovery' THEN 1
         WHEN 'product' THEN 2
         WHEN 'design' THEN 3
         WHEN 'architecture' THEN 4
         WHEN 'development' THEN 5
         WHEN 'qa' THEN 6
         WHEN 'release' THEN 7
         ELSE 8 END
    `);

    const studios: Studio[] = studiosRes.rows.map((row) => {
      const seedStudio =
        INITIAL_STUDIOS.find((st) => st.slug === row.slug) || INITIAL_STUDIOS[0];
      const cfg = (row.agent_config || {}) as {
        inputs?: string[];
        outputs?: string[];
        quality_checks?: string[];
        pack?: Studio["pack"];
      };
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        mission: row.mission,
        status: row.status === "disabled" ? "disabled" : "active",
        manifest_path: row.manifest_path || seedStudio.manifest_path,
        manifest_version: row.manifest_version || seedStudio.manifest_version,
        manifest_hash: row.manifest_hash || seedStudio.manifest_hash,
        agent_id: row.agent_id || seedStudio.agent_id,
        agent_name: row.agent_name || seedStudio.agent_name,
        agent_role: seedStudio.agent_role,
        color: seedStudio.color,
        inputs: cfg.inputs || seedStudio.inputs,
        outputs: cfg.outputs || seedStudio.outputs,
        quality_checks: cfg.quality_checks || seedStudio.quality_checks,
        success_criteria: seedStudio.success_criteria,
        pack: cfg.pack || seedStudio.pack,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    const wrRes = await dbQuery<{
      id: string;
      project_id: string;
      studio_id: string;
      studio_slug: Studio["slug"];
      objective: string;
      context_ids: string[];
      constraints: string[];
      status: string;
      requested_by: string;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>(`
      SELECT wr.id, wr.project_id, wr.studio_id, COALESCE(s.slug, 'design') AS studio_slug,
             wr.objective, wr.context_ids, wr.constraints, wr.status, wr.requested_by,
             wr.created_at::text, wr.updated_at::text, wr.completed_at::text
        FROM work_requests wr
        LEFT JOIN studios s ON s.id = wr.studio_id
       ORDER BY wr.created_at DESC
    `);

    const decRes = await dbQuery(
      "SELECT id, project_id, title, decision, reasoning, status, supersedes_id, decided_by, decided_at::text, created_at::text, updated_at::text FROM decisions ORDER BY created_at DESC"
    );

    const evRes = await dbQuery(
      "SELECT id, event_type, aggregate_type, aggregate_id, payload, idempotency_key, status, attempts, max_attempts, available_at::text, locked_by, locked_at::text, last_error, created_at::text, processed_at::text FROM events ORDER BY id DESC LIMIT 50"
    );

    const afRes = await dbQuery<{
      id: string;
      finding_type: string;
      object_id: string;
      details: Record<string, unknown>;
      status: string;
      created_at: string;
      resolved_at: string | null;
      resolved_by: string | null;
    }>(
      "SELECT id, finding_type, object_id, details, status, created_at::text, resolved_at::text, resolved_by FROM audit_findings ORDER BY created_at DESC"
    );

    const cmRes = await dbQuery<{
      id: string;
      project_id: string;
      speaker_role: string;
      speaker_name: string;
      studio_name: string | null;
      phase: string | null;
      content: string;
      artifacts_produced: string[];
      decisions_logged: string[];
      wiki_ripples: string[];
      timestamp_label: string;
    }>(
      "SELECT id, project_id, speaker_role, speaker_name, studio_name, phase, content, artifacts_produced, decisions_logged, wiki_ripples, timestamp_label FROM council_messages ORDER BY created_at ASC"
    );

    const entRes = await dbQuery(
      "SELECT id, canonical_name, entity_type, description, aliases, metadata, review_state, confidence, merged_into_id, created_at::text, updated_at::text FROM entities WHERE merged_into_id IS NULL ORDER BY created_at DESC"
    );

    const conRes = await dbQuery(
      "SELECT id, name, summary, domain, aliases, review_state, confidence, merged_into_id, created_at::text, updated_at::text FROM concepts WHERE merged_into_id IS NULL ORDER BY created_at DESC"
    );

    const relRes = await dbQuery<{
      id: string;
      from_id: string;
      to_id: string;
      edge_type: string;
      confidence: number;
      review_state: string;
      source_id: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    }>(
      "SELECT id, from_id, to_id, edge_type, confidence, review_state, source_id, metadata, created_at::text FROM relationships WHERE superseded_at IS NULL ORDER BY created_at DESC"
    );

    return NextResponse.json({
      projects: projRes.rows,
      studios,
      work_requests: wrRes.rows,
      decisions: decRes.rows,
      events: evRes.rows,
      audit_findings: afRes.rows.map((f) => ({
        ...f,
        object_title:
          (f.details?.object_title as string) || f.object_id,
      })),
      council_messages: cmRes.rows.map((m) => ({
        id: m.id,
        project_id: m.project_id,
        speaker_role: m.speaker_role,
        speaker_name: m.speaker_name,
        studio_name: m.studio_name || undefined,
        phase: m.phase || undefined,
        content: m.content,
        artifacts_produced: m.artifacts_produced,
        decisions_logged: m.decisions_logged,
        wiki_ripples: m.wiki_ripples,
        timestamp: m.timestamp_label,
      })),
      entities: entRes.rows,
      concepts: conRes.rows,
      relationships: relRes.rows.map((r) => ({
        id: r.id,
        from_id: r.from_id,
        from_label: (r.metadata?.from_label as string) || r.from_id,
        to_id: r.to_id,
        to_label: (r.metadata?.to_label as string) || r.to_id,
        edge_type: r.edge_type,
        confidence: r.confidence,
        source_id: r.source_id || undefined,
        review_state: r.review_state,
        created_at: r.created_at,
      })),
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[GET /api/projects] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = requireOwnerKey(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 422 }
      );
    }

    const rawSlug =
      (body.slug || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `project-${Date.now()}`;
    const description =
      (body.description || "").trim() ||
      "Managed by Jarvis Supervisor across the 7 CortexOS Studios.";
    const status = body.status || "active";
    const currentPhase = body.current_phase || "discovery";

    const created = await dbTransaction(async (tx) => {
      const idRes = await tx.query<{ id: string }>(
        "SELECT new_object('project') AS id"
      );
      const id = body.id ? toUuid(body.id) : idRes.rows[0].id;
      if (body.id) {
        await tx.query(
          "INSERT INTO brain_objects (id, object_type) VALUES ($1, 'project') ON CONFLICT (id) DO NOTHING",
          [id]
        );
      }

      const ins = await tx.query<{
        id: string;
        slug: string;
        name: string;
        description: string;
        status: string;
        current_phase: string;
        created_at: string;
        updated_at: string;
      }>(
        `INSERT INTO projects (id, slug, name, description, status, current_phase)
         VALUES ($1, $2, $3, $4, $5::project_status, $6)
         RETURNING id, slug, name, description, status, current_phase, created_at::text, updated_at::text`,
        [id, rawSlug, name, description, status, currentPhase]
      );

      await tx.query(
        `INSERT INTO council_messages (project_id, speaker_role, speaker_name, content, timestamp_label)
         VALUES ($1, 'jarvis', 'Jarvis Supervisor', $2, 'Just now')`,
        [
          id,
          `Initialized **${name}** (\`${rawSlug}\`) in **1. Discovery Studio**. All 7 Studios and Chief Librarian are standing by.`,
        ]
      );

      await tx.query(
        `INSERT INTO audit_log (actor_type, actor_id, action, object_id, details)
         VALUES ('user', 'owner', 'project.create', $1, $2::jsonb)`,
        [id, JSON.stringify({ slug: rawSlug, name })]
      );

      return ins.rows[0];
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[POST /api/projects] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
