import fs from "node:fs";
import path from "node:path";
import { getRawExecutor, isRemotePostgresUrl, toUuid } from "./client.ts";
import {
  INITIAL_PROJECTS,
  INITIAL_STUDIOS,
  INITIAL_SOURCES,
  INITIAL_ARTIFACTS,
  INITIAL_ENTITIES,
  INITIAL_CONCEPTS,
  INITIAL_DECISIONS,
  INITIAL_WIKI_PAGES,
  INITIAL_CLAIMS,
  INITIAL_RELATIONSHIPS,
  INITIAL_WORK_REQUESTS,
  INITIAL_EVENTS,
  INITIAL_AUDIT_FINDINGS,
  INITIAL_COUNCIL_MESSAGES,
  sha256Hex,
} from "../cortex-os-data.ts";

let migrationInFlight: Promise<{
  migrated: boolean;
  alreadyExisted: boolean;
  tables: number;
}> | null = null;

export async function ensureDatabaseMigrated(): Promise<{
  migrated: boolean;
  alreadyExisted: boolean;
  tables: number;
}> {
  if (global.__cortexMigrated) {
    return { migrated: false, alreadyExisted: true, tables: 19 };
  }
  if (migrationInFlight) {
    return migrationInFlight;
  }
  migrationInFlight = runMigration().finally(() => {
    migrationInFlight = null;
  });
  return migrationInFlight;
}

export async function runMigration(): Promise<{
  migrated: boolean;
  alreadyExisted: boolean;
  tables: number;
}> {
  const exec = await getRawExecutor();

  const checkRes = await exec.query<{ reg: string | null }>(
    "SELECT to_regclass('public.brain_objects') AS reg"
  );
  const alreadyExisted = Boolean(checkRes.rows[0]?.reg);

  if (!alreadyExisted) {
    console.log(
      "[CortexOS DB] brain_objects table not found on boot — executing brain_schema_v1_36b1d887.sql..."
    );
    const schemaPath = path.join(
      process.cwd(),
      "public",
      "assets",
      "aistudio",
      "brain_schema_v1_36b1d887.sql"
    );
    let rawSql = fs.readFileSync(schemaPath, "utf8");

    if (!isRemotePostgresUrl()) {
      // Embedded PGlite Postgres 16: provide real[] vector domain + cosine distance operator (<=>)
      const vectorShim = `
DROP OPERATOR IF EXISTS <=> (real[], real[]);
DROP DOMAIN IF EXISTS vector CASCADE;
CREATE DOMAIN vector AS real[];
CREATE OR REPLACE FUNCTION vector_cosine_distance(a real[], b real[]) RETURNS double precision LANGUAGE sql IMMUTABLE AS $vec$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL OR array_length(a, 1) IS NULL OR array_length(b, 1) IS NULL THEN 1.0
    ELSE (
      SELECT CASE
        WHEN sum(x::double precision * x::double precision) = 0 OR sum(y::double precision * y::double precision) = 0 THEN 1.0
        ELSE 1.0 - (sum(x::double precision * y::double precision) / (sqrt(sum(x::double precision * x::double precision)) * sqrt(sum(y::double precision * y::double precision))))
      END
      FROM unnest(a, b) AS t(x, y)
    )
  END
$vec$;
CREATE OPERATOR <=> (LEFTARG = real[], RIGHTARG = real[], PROCEDURE = vector_cosine_distance);
`;
      rawSql = rawSql
        .replace("CREATE EXTENSION IF NOT EXISTS vector;", () => vectorShim)
        .replaceAll("vector(1536)", "real[]")
        .replace(
          "CREATE INDEX embeddings_vec_idx ON embeddings USING hnsw (embedding vector_cosine_ops);",
          ""
        );
    }

    await exec.exec(rawSql);

    // Idempotent v1 schema column extensions required by Locked Decisions:
    await exec.exec(`
      ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS markdown_body text NOT NULL DEFAULT '';
      DROP VIEW IF EXISTS agent_visible_wiki_pages;
      CREATE VIEW agent_visible_wiki_pages AS
        SELECT * FROM wiki_pages
        WHERE review_state <> 'rejected'
          AND (NOT requires_approval OR review_state = 'approved');

      ALTER TABLE sources ADD COLUMN IF NOT EXISTS raw_content text NOT NULL DEFAULT '';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_phase text NOT NULL DEFAULT 'discovery';
      ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS markdown_content text NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS council_messages (
        id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id         uuid        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        speaker_role       text        NOT NULL,
        speaker_name       text        NOT NULL,
        studio_name        text,
        phase              text,
        content            text        NOT NULL,
        artifacts_produced text[]      NOT NULL DEFAULT '{}',
        decisions_logged   text[]      NOT NULL DEFAULT '{}',
        wiki_ripples       text[]      NOT NULL DEFAULT '{}',
        timestamp_label    text        NOT NULL DEFAULT 'Just now',
        created_at         timestamptz NOT NULL DEFAULT now()
      );
    `);

    await seedInitialCortexData(exec);
  } else {
    const projCountRes = await exec.query<{ cnt: string }>(
      "SELECT count(*)::text AS cnt FROM projects"
    );
    if (Number(projCountRes.rows[0]?.cnt || "0") === 0) {
      await exec.exec(`
        ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS markdown_body text NOT NULL DEFAULT '';
        DROP VIEW IF EXISTS agent_visible_wiki_pages;
        CREATE VIEW agent_visible_wiki_pages AS
          SELECT * FROM wiki_pages
          WHERE review_state <> 'rejected'
            AND (NOT requires_approval OR review_state = 'approved');

        ALTER TABLE sources ADD COLUMN IF NOT EXISTS raw_content text NOT NULL DEFAULT '';
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_phase text NOT NULL DEFAULT 'discovery';
        ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS markdown_content text NOT NULL DEFAULT '';

        CREATE TABLE IF NOT EXISTS council_messages (
          id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id         uuid        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
          speaker_role       text        NOT NULL,
          speaker_name       text        NOT NULL,
          studio_name        text,
          phase              text,
          content            text        NOT NULL,
          artifacts_produced text[]      NOT NULL DEFAULT '{}',
          decisions_logged   text[]      NOT NULL DEFAULT '{}',
          wiki_ripples       text[]      NOT NULL DEFAULT '{}',
          timestamp_label    text        NOT NULL DEFAULT 'Just now',
          created_at         timestamptz NOT NULL DEFAULT now()
        );
      `);
      await seedInitialCortexData(exec);
    }
    console.log(
      "[CortexOS DB] brain_objects table exists — boot migration check complete."
    );
  }

  const tablesRes = await exec.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public'"
  );
  const tablesCount = parseInt(tablesRes.rows[0]?.count || "0", 10);

  global.__cortexMigrated = true;
  console.log(
    `[CortexOS DB] Migration ready (alreadyExisted=${alreadyExisted}, tables=${tablesCount}).`
  );

  return {
    migrated: !alreadyExisted,
    alreadyExisted,
    tables: tablesCount,
  };
}

async function ensureBrainObject(
  exec: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> },
  id: string,
  objectType: string
) {
  await exec.query(
    `INSERT INTO brain_objects (id, object_type) VALUES ($1, $2::object_type) ON CONFLICT (id) DO NOTHING`,
    [id, objectType]
  );
}

async function seedInitialCortexData(exec: {
  query: <T = Record<string, unknown>>(
    t: string,
    p?: unknown[]
  ) => Promise<{ rows: T[] }>;
}) {
  const projCount = await exec.query<{ cnt: string }>(
    "SELECT count(*)::text AS cnt FROM projects"
  );
  if (parseInt(projCount.rows[0]?.cnt || "0", 10) > 0) {
    return;
  }

  // 1. Map the 7 seeded studios by slug and attach manifest metadata + agents
  const studioSlugToId = new Map<string, string>();
  const studioSlugToAgentId = new Map<string, string>();

  for (const st of INITIAL_STUDIOS) {
    const existingStudio = await exec.query<{ id: string }>(
      "SELECT id FROM studios WHERE slug = $1",
      [st.slug]
    );
    let studioUuid: string;
    if (existingStudio.rows[0]?.id) {
      studioUuid = existingStudio.rows[0].id;
      await exec.query(
        `UPDATE studios SET name = $1, mission = $2, manifest_path = $3, manifest_version = $4, manifest_hash = $5 WHERE id = $6`,
        [
          st.name,
          st.mission,
          st.manifest_path,
          st.manifest_version,
          st.manifest_hash,
          studioUuid,
        ]
      );
    } else {
      studioUuid = toUuid(st.id);
      await ensureBrainObject(exec, studioUuid, "studio");
      await exec.query(
        `INSERT INTO studios (id, slug, name, mission, status, manifest_path, manifest_version, manifest_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (slug) DO NOTHING`,
        [
          studioUuid,
          st.slug,
          st.name,
          st.mission,
          st.status,
          st.manifest_path,
          st.manifest_version,
          st.manifest_hash,
        ]
      );
    }
    studioSlugToId.set(st.slug, studioUuid);

    const agentUuid = toUuid(st.agent_id);
    await ensureBrainObject(exec, agentUuid, "agent");
    await exec.query(
      `INSERT INTO agents (id, studio_id, name, role, model, config, active)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, true) ON CONFLICT (id) DO NOTHING`,
      [
        agentUuid,
        studioUuid,
        st.agent_name,
        st.mission,
        "gemini-3-flash-preview",
        JSON.stringify({
          inputs: st.inputs,
          outputs: st.outputs,
          quality_checks: st.quality_checks,
          pack: st.pack,
        }),
      ]
    );
    studioSlugToAgentId.set(st.slug, agentUuid);
  }

  // 2. Seed Projects
  for (const p of INITIAL_PROJECTS) {
    const pid = toUuid(p.id);
    await ensureBrainObject(exec, pid, "project");
    await exec.query(
      `INSERT INTO projects (id, slug, name, description, status, current_phase)
       VALUES ($1, $2, $3, $4, $5::project_status, $6)
       ON CONFLICT (slug) DO NOTHING`,
      [pid, p.slug, p.name, p.description, p.status, p.current_phase]
    );
  }

  // 3. Seed Work Requests
  for (const wr of INITIAL_WORK_REQUESTS) {
    const wrId = toUuid(wr.id);
    const projId = toUuid(wr.project_id);
    const studioId =
      studioSlugToId.get(wr.studio_slug) ||
      studioSlugToId.get("design")!;
    const ctxIds = wr.context_ids.map((cid) => toUuid(cid));
    await exec.query(
      `INSERT INTO work_requests (id, project_id, studio_id, objective, context_ids, constraints, status, requested_by, completed_at)
       VALUES ($1, $2, $3, $4, $5::uuid[], $6::text[], $7::work_status, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        wrId,
        projId,
        studioId,
        wr.objective,
        ctxIds,
        wr.constraints,
        wr.status,
        wr.requested_by,
        wr.completed_at || null,
      ]
    );
  }

  // 4. Seed Sources
  for (const s of INITIAL_SOURCES) {
    const sid = toUuid(s.id);
    const pid = s.project_id ? toUuid(s.project_id) : null;
    await ensureBrainObject(exec, sid, "source");
    await exec.query(
      `INSERT INTO sources (id, project_id, kind, title, uri, storage_path, content_hash, raw_content, mime_type, byte_size, trust, ingest_status, metadata)
       VALUES ($1, $2, $3::source_kind, $4, $5, $6, $7, $8, $9, $10, $11::trust_level, $12::ingest_status, $13::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        sid,
        pid,
        s.kind,
        s.title,
        s.uri,
        s.storage_path,
        s.content_hash,
        s.raw_content,
        s.mime_type,
        s.byte_size,
        s.trust,
        s.ingest_status,
        JSON.stringify({ ...s.metadata, legacy_id: s.id }),
      ]
    );
  }

  // 5. Seed Artifacts
  for (const a of INITIAL_ARTIFACTS) {
    const aid = toUuid(a.id);
    const pid = toUuid(a.project_id);
    const stId = a.studio_slug ? studioSlugToId.get(a.studio_slug) || null : null;
    const wrId = a.work_request_id ? toUuid(a.work_request_id) : null;
    const agId = a.studio_slug
      ? studioSlugToAgentId.get(a.studio_slug) || null
      : null;
    await ensureBrainObject(exec, aid, "artifact");
    await exec.query(
      `INSERT INTO artifacts (id, project_id, studio_id, work_request_id, artifact_type, schema_version, title, summary, status, version, storage_path, content_hash, body, markdown_content, created_by_agent_id, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::artifact_status, $10, $11, $12, $13::jsonb, $14, $15, $16, $17)
       ON CONFLICT (id) DO NOTHING`,
      [
        aid,
        pid,
        stId,
        wrId,
        a.artifact_type,
        a.schema_version,
        a.title,
        a.summary,
        a.status,
        a.version,
        a.storage_path,
        a.content_hash,
        JSON.stringify({
          ...(a.body || {}),
          studio_slug: a.studio_slug,
          legacy_id: a.id,
        }),
        a.markdown_content,
        agId,
        a.approved_by || null,
        a.approved_at || null,
      ]
    );
  }

  // 6. Seed Entities
  for (const e of INITIAL_ENTITIES) {
    const eid = toUuid(e.id);
    await ensureBrainObject(exec, eid, "entity");
    await exec.query(
      `INSERT INTO entities (id, canonical_name, entity_type, description, aliases, metadata, review_state, confidence)
       VALUES ($1, $2, $3, $4, $5::text[], $6::jsonb, $7::review_state, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        eid,
        e.canonical_name,
        e.entity_type,
        e.description,
        e.aliases,
        JSON.stringify(e.metadata),
        e.review_state,
        e.confidence,
      ]
    );
  }

  // 7. Seed Concepts
  for (const c of INITIAL_CONCEPTS) {
    const cid = toUuid(c.id);
    await ensureBrainObject(exec, cid, "concept");
    await exec.query(
      `INSERT INTO concepts (id, name, summary, domain, aliases, review_state, confidence)
       VALUES ($1, $2, $3, $4, $5::text[], $6::review_state, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        cid,
        c.name,
        c.summary,
        c.domain || null,
        c.aliases,
        c.review_state,
        c.confidence,
      ]
    );
  }

  // 8. Seed Decisions
  for (const d of INITIAL_DECISIONS) {
    const did = toUuid(d.id);
    const pid = toUuid(d.project_id);
    await ensureBrainObject(exec, did, "decision");
    await exec.query(
      `INSERT INTO decisions (id, project_id, title, decision, reasoning, status, decided_by, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6::decision_status, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        did,
        pid,
        d.title,
        d.decision,
        d.reasoning,
        d.status,
        d.decided_by || null,
        d.decided_at || null,
      ]
    );
  }

  // 9. Seed Wiki Pages & Versions
  for (const w of INITIAL_WIKI_PAGES) {
    const wid = toUuid(w.id);
    const pid = w.project_id ? toUuid(w.project_id) : null;
    const bHash = w.body_hash || sha256Hex(w.markdown_body);
    await ensureBrainObject(exec, wid, "wiki_page");
    await exec.query(
      `INSERT INTO wiki_pages (id, page_type, path, title, summary, markdown_body, project_id, current_version, body_hash, review_state, requires_approval)
       VALUES ($1, $2::wiki_page_type, $3, $4, $5, $6, $7, $8, $9, $10::review_state, $11)
       ON CONFLICT (path) DO NOTHING`,
      [
        wid,
        w.page_type,
        w.path,
        w.title,
        w.summary,
        w.markdown_body,
        pid,
        w.current_version,
        bHash,
        w.review_state,
        w.requires_approval,
      ]
    );
    await exec.query(
      `INSERT INTO wiki_page_versions (page_id, version, body_hash, change_summary, actor_type, actor_id)
       VALUES ($1, $2, $3, $4, 'agent', 'chief-librarian')
       ON CONFLICT (page_id, version) DO NOTHING`,
      [wid, Math.max(1, w.current_version), bHash, "Initial CortexOS v1 seed"]
    );
  }

  // 10. Seed Claims
  for (const cl of INITIAL_CLAIMS) {
    const clId = toUuid(cl.id);
    const wikiId = toUuid(cl.wiki_page_id);
    const srcId = cl.source_id ? toUuid(cl.source_id) : null;
    const artId = cl.artifact_id ? toUuid(cl.artifact_id) : null;
    await exec.query(
      `INSERT INTO claims (id, wiki_page_id, page_version, claim_text, source_id, artifact_id, locator, confidence, review_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::review_state)
       ON CONFLICT (id) DO NOTHING`,
      [
        clId,
        wikiId,
        cl.page_version || 1,
        cl.claim_text,
        srcId,
        artId,
        cl.locator || null,
        cl.confidence,
        cl.review_state,
      ]
    );
  }

  const resolveSeedObjectId = (rawId: string): string => {
    if (rawId.startsWith("studio-")) {
      const slug = rawId.replace(/^studio-/, "");
      const mapped = studioSlugToId.get(slug);
      if (mapped) return mapped;
    }
    return toUuid(rawId);
  };

  // 11. Seed Relationships
  for (const rel of INITIAL_RELATIONSHIPS) {
    const rId = toUuid(rel.id);
    const fromId = resolveSeedObjectId(rel.from_id);
    const toId = resolveSeedObjectId(rel.to_id);
    const srcId = rel.source_id ? toUuid(rel.source_id) : null;
    if (fromId === toId) continue;
    await exec.query(
      `INSERT INTO relationships (id, from_id, to_id, edge_type, confidence, review_state, source_id, metadata)
       SELECT $1, $2, $3, $4::edge_type, $5, $6::review_state, $7, $8::jsonb
       WHERE EXISTS (SELECT 1 FROM brain_objects WHERE id = $2)
         AND EXISTS (SELECT 1 FROM brain_objects WHERE id = $3)
       ON CONFLICT DO NOTHING`,
      [
        rId,
        fromId,
        toId,
        rel.edge_type,
        rel.confidence,
        rel.review_state,
        srcId,
        JSON.stringify({
          from_label: rel.from_label,
          to_label: rel.to_label,
        }),
      ]
    );
  }

  // 12. Seed Events
  for (const ev of INITIAL_EVENTS) {
    const aggId = ev.aggregate_id ? resolveSeedObjectId(ev.aggregate_id) : null;
    await exec.query(
      `INSERT INTO events (event_type, aggregate_type, aggregate_id, payload, idempotency_key, status, attempts, max_attempts, processed_at)
       VALUES ($1, $2::object_type, $3, $4::jsonb, $5, $6::event_status, $7, $8, $9)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        ev.event_type,
        ev.aggregate_type,
        aggId,
        JSON.stringify(ev.payload),
        ev.idempotency_key,
        ev.status,
        ev.attempts,
        ev.max_attempts,
        ev.processed_at || null,
      ]
    );
  }

  // 13. Seed Audit Findings
  for (const af of INITIAL_AUDIT_FINDINGS) {
    const afId = toUuid(af.id);
    const objId = resolveSeedObjectId(af.object_id || "");
    await exec.query(
      `INSERT INTO audit_findings (id, finding_type, object_id, details, status, resolved_at, resolved_by)
       SELECT $1, $2::finding_type, $3, $4::jsonb, $5::finding_status, $6, $7
       WHERE EXISTS (SELECT 1 FROM brain_objects WHERE id = $3)
       ON CONFLICT (id) DO NOTHING`,
      [
        afId,
        af.finding_type,
        objId,
        JSON.stringify({
          ...af.details,
          object_title: af.object_title,
        }),
        af.status,
        af.resolved_at || null,
        af.resolved_by || null,
      ]
    );
  }

  // 14. Seed Council Messages
  for (const cm of INITIAL_COUNCIL_MESSAGES) {
    const cmId = toUuid(cm.id);
    const pid = toUuid(cm.project_id);
    await exec.query(
      `INSERT INTO council_messages (id, project_id, speaker_role, speaker_name, studio_name, phase, content, artifacts_produced, decisions_logged, wiki_ripples, timestamp_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::text[], $10::text[], $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        cmId,
        pid,
        cm.speaker_role,
        cm.speaker_name,
        cm.studio_name || null,
        cm.phase || null,
        cm.content,
        cm.artifacts_produced || [],
        cm.decisions_logged || [],
        cm.wiki_ripples || [],
        cm.timestamp,
      ]
    );
  }

  // 15. Seed initial embeddings for seeded sources so /api/search works immediately on boot
  const { generateDeterministicEmbedding } = await import("./embeddings.ts");
  for (const s of INITIAL_SOURCES) {
    const sid = toUuid(s.id);
    const vec = generateDeterministicEmbedding(`${s.title}\n\n${s.raw_content}`);
    const vecParam = isRemotePostgresUrl()
      ? `[${vec.join(",")}]`
      : vec;
    const castExpr = isRemotePostgresUrl() ? "$4::vector" : "$4::real[]";
    await exec.query(
      `INSERT INTO embeddings (object_id, chunk_index, model, content_hash, chunk_text, embedding)
       VALUES ($1, 0, 'gemini-embedding-001', $2, $3, ${castExpr})
       ON CONFLICT (object_id, chunk_index, model) DO NOTHING`,
      [
        sid,
        s.content_hash,
        `${s.title}\n\n${s.raw_content}`,
        vecParam,
      ]
    );
  }
}
