import { NextRequest, NextResponse } from "next/server";
import { dbQuery, dbTransaction, toUuid } from "@/lib/db/client";
import { checkRateLimit, requireOwnerKey } from "@/lib/db/auth";
import { processPendingLibrarianEvents } from "@/lib/db/librarian-pipeline";
import { sha256Hex, type SourceKind, type TrustLevel } from "@/lib/cortex-os-data";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024; // 2MB

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("project_id");
    const trust = req.nextUrl.searchParams.get("trust");
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (projectId) {
      params.push(toUuid(projectId));
      conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`);
    }
    if (trust === "trusted" || trust === "untrusted") {
      params.push(trust);
      conditions.push(`trust = $${params.length}::trust_level`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const res = await dbQuery(
      `SELECT id, project_id, kind, title, uri, storage_path, content_hash, raw_content,
              mime_type, byte_size::int AS byte_size, trust, ingest_status, ingest_error,
              metadata, ingested_at::text
         FROM sources
         ${whereSql}
        ORDER BY ingested_at DESC`,
      params
    );

    return NextResponse.json({ sources: res.rows });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to list sources" },
      { status: 500 }
    );
  }
}

async function createAndIngestSource(req: NextRequest) {
  const unauthorized = requireOwnerKey(req);
  if (unauthorized) return unauthorized;

  const clientIp =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "default-ingest";
  const rateLimited = checkRateLimit(`ingest:${clientIp}`, 30, 60_000);
  if (rateLimited) return rateLimited;

  try {
    const rawBodyText = await req.text();
    const byteLength = Buffer.byteLength(rawBodyText, "utf8");
    if (byteLength > MAX_SOURCE_BYTES) {
      return NextResponse.json(
        { error: "Payload Too Large: source body exceeds 2MB limit" },
        { status: 413 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBodyText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rawContent = String(
      body.raw_content ?? body.rawContent ?? body.content ?? ""
    );
    const contentByteSize = Buffer.byteLength(rawContent, "utf8");
    if (contentByteSize > MAX_SOURCE_BYTES) {
      return NextResponse.json(
        { error: "Payload Too Large: raw_content exceeds 2MB limit" },
        { status: 413 }
      );
    }

    const rawTitle = String(body.title || "").trim();
    if (!rawTitle || !rawContent.trim()) {
      return NextResponse.json(
        { error: "Both title and raw_content are required" },
        { status: 422 }
      );
    }

    const cleanTitle = rawTitle.startsWith("R - ")
      ? rawTitle
      : `R - ${rawTitle}`;
    const kind: SourceKind = (body.kind as SourceKind) || "markdown";
    // Locked rule: trust defaults to 'untrusted'
    const trust: TrustLevel =
      body.trust === "trusted" ? "trusted" : "untrusted";
    const uri = body.uri ? String(body.uri).trim() : null;
    const rawProjectId = body.project_id ?? body.projectId ?? null;
    const projectId = rawProjectId ? toUuid(String(rawProjectId)) : null;

    const normalizedContent = rawContent.trim();
    const contentHash = sha256Hex(normalizedContent);
    const storagePath =
      typeof body.storage_path === "string" && body.storage_path.trim()
        ? body.storage_path.trim()
        : `brain/raw/${cleanTitle}.md`;

    // Check duplicate content_hash before insert -> 409 Conflict
    const dupCheck = await dbQuery<{ id: string }>(
      "SELECT id FROM sources WHERE content_hash = $1 LIMIT 1",
      [contentHash]
    );

    if (dupCheck.rows[0]) {
      return NextResponse.json(
        {
          error: "Conflict: duplicate source content_hash already exists",
          existing_source_id: dupCheck.rows[0].id,
          content_hash: contentHash,
        },
        { status: 409 }
      );
    }

    // Locked rule: INSERT the source row AND a source_created outbox event in ONE transaction
    const insertedSource = await dbTransaction(async (tx) => {
      const idRes = await tx.query<{ id: string }>(
        "SELECT new_object('source') AS id"
      );
      const sourceId =
        typeof body.sourceId === "string" && body.sourceId.trim()
          ? toUuid(body.sourceId.trim())
          : typeof body.id === "string" && body.id.trim()
          ? toUuid(body.id.trim())
          : idRes.rows[0].id;

      if (body.sourceId || body.id) {
        await tx.query(
          "INSERT INTO brain_objects (id, object_type) VALUES ($1, 'source') ON CONFLICT (id) DO NOTHING",
          [sourceId]
        );
      }

      const srcIns = await tx.query<{
        id: string;
        project_id: string | null;
        kind: string;
        title: string;
        uri: string | null;
        storage_path: string;
        content_hash: string;
        raw_content: string;
        mime_type: string;
        byte_size: number;
        trust: string;
        ingest_status: string;
        metadata: Record<string, unknown>;
        ingested_at: string;
      }>(
        `INSERT INTO sources (
           id, project_id, kind, title, uri, storage_path, content_hash, raw_content,
           mime_type, byte_size, trust, ingest_status, metadata
         )
         VALUES ($1, $2, $3::source_kind, $4, $5, $6, $7, $8, $9, $10, $11::trust_level, 'received'::ingest_status, $12::jsonb)
         RETURNING id, project_id, kind, title, uri, storage_path, content_hash, raw_content,
                   mime_type, byte_size::int AS byte_size, trust, ingest_status, metadata, ingested_at::text`,
        [
          sourceId,
          projectId,
          kind,
          cleanTitle,
          uri,
          storagePath,
          contentHash,
          normalizedContent,
          "text/markdown",
          contentByteSize,
          trust,
          JSON.stringify({ ingested_by: "Chief Librarian" }),
        ]
      );

      await tx.query(
        `INSERT INTO events (event_type, aggregate_type, aggregate_id, payload, idempotency_key, status)
         VALUES ('source_created', 'source', $1, $2::jsonb, $3, 'pending'::event_status)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          sourceId,
          JSON.stringify({
            title: cleanTitle,
            kind,
            trust,
            content_hash: contentHash,
          }),
          `source_created:${sourceId}`,
        ]
      );

      return srcIns.rows[0];
    });

    // After commit, claim the event via claim_events() and process it
    const workerResult = await processPendingLibrarianEvents(
      "librarian-ingest-worker",
      10
    );

    const updatedSourceRes = await dbQuery(
      `SELECT id, project_id, kind, title, uri, storage_path, content_hash, raw_content,
              mime_type, byte_size::int AS byte_size, trust, ingest_status, ingest_error,
              metadata, ingested_at::text
         FROM sources WHERE id = $1`,
      [insertedSource.id]
    );

    const latestSource = updatedSourceRes.rows[0] || insertedSource;
    const processedInfo = workerResult.results.find(
      (r) => r.source_id === insertedSource.id
    );

    return NextResponse.json(
      {
        source: latestSource,
        event_status: "done",
        extraction: processedInfo?.extraction || null,
        is_fallback: processedInfo?.is_fallback ?? false,
        worker: workerResult,
      },
      { status: 202 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    if (
      error.message?.includes("sources_project_hash_uq") ||
      error.message?.includes("sources_global_hash_uq") ||
      error.message?.includes("duplicate key")
    ) {
      return NextResponse.json(
        { error: "Conflict: duplicate source content_hash" },
        { status: 409 }
      );
    }
    console.error("[POST /api/sources] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to ingest source" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return createAndIngestSource(req);
}
