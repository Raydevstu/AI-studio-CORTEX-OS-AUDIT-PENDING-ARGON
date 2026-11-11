import { NextRequest, NextResponse } from "next/server";
import { dbQuery, toUuid } from "@/lib/db/client";
import { type BrainNode } from "@/lib/knowledge-data";
import { sha256Hex } from "@/lib/cortex-os-data";

function deterministicCoords(id: string, index: number, total: number) {
  const h = sha256Hex(id);
  const angle = (index / Math.max(1, total)) * Math.PI * 2;
  const r = 70 + (parseInt(h.slice(0, 4), 16) % 95);
  const y = ((parseInt(h.slice(4, 8), 16) % 140) - 70);
  return {
    x: Number((Math.cos(angle) * r).toFixed(2)),
    y: Number(y.toFixed(2)),
    z: Number((Math.sin(angle) * r).toFixed(2)),
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const maxDepth = Math.min(
      5,
      Math.max(1, parseInt(req.nextUrl.searchParams.get("depth") || "2", 10))
    );

    // Resolve start_id: support 'all'/'root' or any project/source/artifact/entity/wiki UUID or slug
    let startUuid: string;
    if (id === "all" || id === "root") {
      const firstProj = await dbQuery<{ id: string }>(
        "SELECT id FROM projects ORDER BY created_at ASC LIMIT 1"
      );
      startUuid = firstProj.rows[0]?.id || toUuid("proj-cortex-os");
    } else {
      startUuid = toUuid(id);
      const existsRes = await dbQuery<{ id: string }>(
        "SELECT id FROM brain_objects WHERE id = $1 LIMIT 1",
        [startUuid]
      );
      if (!existsRes.rows[0]) {
        const bySlug = await dbQuery<{ id: string }>(
          "SELECT id FROM projects WHERE slug = $1 UNION ALL SELECT id FROM studios WHERE slug = $1 LIMIT 1",
          [id]
        );
        if (bySlug.rows[0]) {
          startUuid = bySlug.rows[0].id;
        }
      }
    }

    // Call the PostgreSQL graph_neighbors(start_id, max_depth) SQL function directly
    const neighborsRes = await dbQuery<{ object_id: string; depth: number }>(
      "SELECT object_id, depth FROM graph_neighbors($1::uuid, $2::integer) ORDER BY depth ASC, object_id ASC",
      [startUuid, maxDepth]
    );

    // Also hydrate full graph nodes and relationships for Brain3D and WarRoom
    const allObjectsRes = await dbQuery<{
      id: string;
      object_type: string;
      title: string;
      summary: string;
      notes: string;
      subtype: string;
    }>(`
      SELECT bo.id,
             bo.object_type::text AS object_type,
             COALESCE(p.name, st.name, ag.name, src.title, art.title, ent.canonical_name, con.name, dec.title, wp.title, bo.id::text) AS title,
             COALESCE(p.description, st.mission, ag.role, src.storage_path, art.summary, ent.description, con.summary, dec.decision, wp.summary, '') AS summary,
             COALESCE(src.raw_content, art.markdown_content, wp.markdown_body, dec.reasoning, ent.description, con.summary, p.description, st.mission, '') AS notes,
             COALESCE(ent.entity_type, con.domain, wp.page_type::text, art.artifact_type, src.kind::text, st.slug, bo.object_type::text) AS subtype
        FROM brain_objects bo
        LEFT JOIN projects p ON p.id = bo.id
        LEFT JOIN studios st ON st.id = bo.id
        LEFT JOIN agents ag ON ag.id = bo.id
        LEFT JOIN sources src ON src.id = bo.id
        LEFT JOIN artifacts art ON art.id = bo.id
        LEFT JOIN entities ent ON ent.id = bo.id AND ent.merged_into_id IS NULL
        LEFT JOIN concepts con ON con.id = bo.id AND con.merged_into_id IS NULL
        LEFT JOIN decisions dec ON dec.id = bo.id
        LEFT JOIN wiki_pages wp ON wp.id = bo.id
       WHERE (ent.id IS NULL OR ent.merged_into_id IS NULL)
         AND (con.id IS NULL OR con.merged_into_id IS NULL)
    `);

    const allRelsRes = await dbQuery<{
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
      "SELECT id, from_id, to_id, edge_type, confidence, review_state, source_id, metadata, created_at::text FROM relationships WHERE superseded_at IS NULL AND review_state <> 'rejected'"
    );

    const adjMap = new Map<string, Set<string>>();
    for (const rel of allRelsRes.rows) {
      if (!adjMap.has(rel.from_id)) adjMap.set(rel.from_id, new Set());
      if (!adjMap.has(rel.to_id)) adjMap.set(rel.to_id, new Set());
      adjMap.get(rel.from_id)!.add(rel.to_id);
      adjMap.get(rel.to_id)!.add(rel.from_id);
    }

    const brainNodes: BrainNode[] = allObjectsRes.rows.map((obj, idx) => {
      const coords = deterministicCoords(
        obj.id,
        idx,
        allObjectsRes.rows.length
      );
      const conns = Array.from(adjMap.get(obj.id) || []);

      let category: BrainNode["category"] = "Business wiki";
      let kind: BrainNode["kind"] = "note";
      let area: BrainNode["area"] = "system";

      if (obj.object_type === "studio" || obj.object_type === "agent") {
        category = "Skills & agents";
        kind = "skill";
        area = "system";
      } else if (
        obj.object_type === "project" ||
        obj.object_type === "artifact" ||
        obj.object_type === "decision"
      ) {
        category = "Projects";
        kind = "project";
        area = "business";
      } else if (obj.object_type === "source") {
        category = "Claude memory";
        kind = "memory";
        area = "system";
      } else if (obj.object_type === "entity" || obj.object_type === "concept") {
        category = "Codex memory";
        kind = "note";
        area = "content";
      } else if (obj.object_type === "wiki_page") {
        category = "Business wiki";
        kind = "note";
        area = "system";
      }

      const isAnchor =
        obj.object_type === "project" ||
        obj.object_type === "studio" ||
        obj.object_type === "artifact" ||
        obj.object_type === "source";

      return {
        id: obj.id,
        title: obj.title,
        category,
        kind,
        area,
        summary: obj.summary || obj.title,
        notes: obj.notes || obj.summary || obj.title,
        stalenessDays: 0,
        needsAttention: false,
        connections: conns,
        tags: [obj.object_type, obj.subtype].filter(Boolean),
        x: coords.x,
        y: coords.y,
        z: coords.z,
        radius: isAnchor ? 6.6 : 5.0,
        isKeyAnchor: isAnchor,
      };
    });

    const neighborDepthMap = new Map<string, number>();
    for (const n of neighborsRes.rows) {
      neighborDepthMap.set(n.object_id, Number(n.depth));
    }

    const hydratedNeighbors = neighborsRes.rows.map((n) => {
      const matched = allObjectsRes.rows.find((o) => o.id === n.object_id);
      return {
        object_id: n.object_id,
        depth: Number(n.depth),
        object_type: matched?.object_type || "unknown",
        title: matched?.title || n.object_id,
      };
    });

    return NextResponse.json({
      start_id: startUuid,
      max_depth: maxDepth,
      neighbors: hydratedNeighbors,
      nodes: brainNodes,
      relationships: allRelsRes.rows.map((r) => ({
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
    console.error("[GET /api/graph/[id]] Error:", error);
    return NextResponse.json(
      { error: error.message || "Graph walk failed" },
      { status: 500 }
    );
  }
}
