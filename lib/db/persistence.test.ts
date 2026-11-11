import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Register a lightweight Node ESM resolver hook so extensionless .ts imports and @/* aliases resolve natively under `node --test`
const rootDirUrl = pathToFileURL(process.cwd() + "/").href;
const loaderCode = `
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const rootUrl = ${JSON.stringify(rootDirUrl)};

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }
  if (specifier.startsWith("@/")) {
    const targetPath = path.join(fileURLToPath(rootUrl), specifier.slice(2));
    if (fs.existsSync(targetPath + ".ts")) {
      return nextResolve(pathToFileURL(targetPath + ".ts").href, context);
    }
    if (fs.existsSync(targetPath + ".tsx")) {
      return nextResolve(pathToFileURL(targetPath + ".tsx").href, context);
    }
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
    const parentPath = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
    const candidateTs = path.resolve(parentPath, specifier + ".ts");
    if (fs.existsSync(candidateTs)) {
      return nextResolve(pathToFileURL(candidateTs).href, context);
    }
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript;charset=utf-8,${encodeURIComponent(loaderCode)}`);

test("1. Database automatic migration creates brain_objects and seeds 7 studios idempotently", async () => {
  const { query, ensureDatabaseMigrated } = await import("./client.ts");
  await ensureDatabaseMigrated();

  const tableCheck = await query<{ exists_flag: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'brain_objects'
     ) AS exists_flag`
  );
  assert.equal(tableCheck.rows[0]?.exists_flag, true);

  const studiosCheck = await query<{ cnt: string }>(`SELECT COUNT(*)::text AS cnt FROM studios`);
  assert.ok(Number(studiosCheck.rows[0]?.cnt) >= 7, "All 7 studios must be seeded");
});

test("2. Unauthenticated mutating requests are rejected with 401 across mutating routes", async () => {
  const { NextRequest } = await import("next/server.js");
  const { POST: postSource } = await import("../../app/api/sources/route.ts");
  const { POST: postProject } = await import("../../app/api/projects/route.ts");
  const { POST: postMigrate } = await import("../../app/api/admin/migrate/route.ts");

  const unauthSourceReq = new NextRequest("http://localhost:3000/api/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Unauthorized Source", raw_content: "Test" }),
  });
  const res1 = await postSource(unauthSourceReq);
  assert.equal(res1.status, 401);

  const unauthProjReq = new NextRequest("http://localhost:3000/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Unauthorized Project" }),
  });
  const res2 = await postProject(unauthProjReq);
  assert.equal(res2.status, 401);

  const unauthMigrateReq = new NextRequest("http://localhost:3000/api/admin/migrate", {
    method: "POST",
  });
  const res3 = await postMigrate(unauthMigrateReq);
  assert.equal(res3.status, 401);
});

test("3. POST /api/sources enforces 413 (>2MB), defaults trust='untrusted', persists entities/concepts/relationships/claims/wiki pages, and rejects duplicate hash with 409", async () => {
  const { NextRequest } = await import("next/server.js");
  const { POST: postSource } = await import("../../app/api/sources/route.ts");
  const { query } = await import("./client.ts");

  const ownerKey = process.env.OWNER_KEY || "cortex-owner-key-v1";

  // 3a. Body > 2MB -> 413
  const oversizedContent = "A".repeat(2 * 1024 * 1024 + 64);
  const req413 = new NextRequest("http://localhost:3000/api/sources", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-owner-key": ownerKey,
      "x-forwarded-for": "test-413-client",
    },
    body: JSON.stringify({
      title: "Oversized Source",
      raw_content: oversizedContent,
    }),
  });
  const res413 = await postSource(req413);
  assert.equal(res413.status, 413);

  // 3b. Real markdown ingestion -> 202
  const uniqueRunTag = `PgVectorZeroTrust_${Date.now()}`;
  const markdownBody = `# ${uniqueRunTag} Architecture Note

PostgreSQL 16 with pgvector and pg_trgm powers the CortexOS unified Second Brain database.
Chief Librarian validates every extracted claim with verbatim line locators and ripples changes to Wiki/Index.md and Wiki/Log.md.
Jarvis Supervisor enforces quality gates before transitioning between the 7 Studios.
`;

  const req202 = new NextRequest("http://localhost:3000/api/sources", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-owner-key": ownerKey,
      "x-forwarded-for": "test-202-client",
    },
    body: JSON.stringify({
      title: `R - ${uniqueRunTag}`,
      kind: "markdown",
      raw_content: markdownBody,
      project_id: "proj-cortex-os",
      // Omit trust to verify default 'untrusted'
    }),
  });

  const res202 = await postSource(req202);
  assert.equal(res202.status, 202);
  const data202 = await res202.json();
  assert.equal(data202.source.trust, "untrusted", "trust must default to 'untrusted'");
  assert.equal(data202.source.ingest_status, "processed");

  const sourceUuid = data202.source.id;

  // Verify persistence in Postgres tables: sources, entities/concepts, relationships, claims, wiki_pages, chunks
  const srcCheck = await query<{ id: string; trust: string; ingest_status: string }>(
    `SELECT id, trust, ingest_status FROM sources WHERE id = $1::uuid`,
    [sourceUuid]
  );
  assert.equal(srcCheck.rows.length, 1);
  assert.equal(srcCheck.rows[0].trust, "untrusted");
  assert.equal(srcCheck.rows[0].ingest_status, "processed");

  const claimsCheck = await query<{ id: string; locator: string }>(
    `SELECT id, locator FROM claims WHERE source_id = $1::uuid`,
    [sourceUuid]
  );
  assert.ok(claimsCheck.rows.length >= 1, "At least one provenance claim must be persisted for the source");
  assert.match(claimsCheck.rows[0].locator, /^(line|lines|L)\s*\d+/i, "Claim locator must use real line numbers");

  const relCheck = await query<{ id: string }>(
    `SELECT id FROM relationships WHERE source_id = $1::uuid`,
    [sourceUuid]
  );
  assert.ok(relCheck.rows.length >= 1, "Extracted relationships must be persisted in Postgres");

  const wikiCheck = await query<{ id: string; path: string; markdown_body: string }>(
    `SELECT id, path, markdown_body FROM wiki_pages WHERE markdown_body ILIKE $1`,
    [`%${uniqueRunTag}%`]
  );
  assert.ok(wikiCheck.rows.length >= 1, "Wiki summary, index.md, or log.md must be persisted with source content");

  const chunkCheck = await query<{ object_id: string; dim: number }>(
    `SELECT object_id, array_length(embedding, 1) AS dim FROM embeddings WHERE object_id = $1::uuid`,
    [sourceUuid]
  );
  assert.ok(chunkCheck.rows.length >= 1, "Source chunks must be persisted with embeddings");
  assert.equal(chunkCheck.rows[0].dim, 1536, "Embedding dimensionality must be 1536");

  // 3c. Duplicate content_hash -> 409
  const req409 = new NextRequest("http://localhost:3000/api/sources", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-owner-key": ownerKey,
      "x-forwarded-for": "test-409-client",
    },
    body: JSON.stringify({
      title: `R - Duplicate ${uniqueRunTag}`,
      kind: "markdown",
      raw_content: markdownBody,
    }),
  });
  const res409 = await postSource(req409);
  assert.equal(res409.status, 409);

  // 4. Verify /api/search hybrid search returns the ingested source with source_id citations
  const { GET: getSearch } = await import("../../app/api/search/route.ts");
  const searchReq = new NextRequest(
    `http://localhost:3000/api/search?q=${encodeURIComponent(uniqueRunTag)}&limit=5`
  );
  const searchRes = await getSearch(searchReq);
  assert.equal(searchRes.status, 200);
  const searchData = await searchRes.json();
  assert.ok(Array.isArray(searchData.results) && searchData.results.length > 0, "Hybrid search must return results");
  const citedSourceIds = searchData.citations.map((c: { source_id: string }) => c.source_id);
  assert.ok(
    citedSourceIds.includes(sourceUuid),
    `Hybrid search citations must include ingested source_id ${sourceUuid}`
  );

  // 5. Verify /api/graph/[id] returns depth-2 neighbors using graph_neighbors() SQL function
  const { GET: getGraph } = await import("../../app/api/graph/[id]/route.ts");
  const graphReq = new NextRequest(
    `http://localhost:3000/api/graph/proj-cortex-os?depth=2`
  );
  const graphRes = await getGraph(graphReq, { params: Promise.resolve({ id: "proj-cortex-os" }) });
  assert.equal(graphRes.status, 200);
  const graphData = await graphRes.json();
  assert.ok(Array.isArray(graphData.neighbors), "graph_neighbors() must return neighbors array");
  assert.ok(graphData.neighbors.length > 0, "proj-cortex-os must have connected graph neighbors");
  const hasDepth2 = graphData.neighbors.some((n: { depth: number }) => n.depth === 2);
  assert.equal(hasDepth2, true, "graph_neighbors(id, 2) must return depth-2 neighbors");
});

test("4. PATCH /api/artifacts/[id] enforces status=approved requires approved_by AND approved_at (422 vs 200)", async () => {
  const { NextRequest } = await import("next/server.js");
  const { PATCH: patchArtifact } = await import("../../app/api/artifacts/[id]/route.ts");

  const ownerKey = process.env.OWNER_KEY || "cortex-owner-key-v1";

  // Missing approved_by / approved_at -> 422
  const req422 = new NextRequest("http://localhost:3000/api/artifacts/art-solar-wireframes", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-owner-key": ownerKey,
    },
    body: JSON.stringify({
      status: "approved",
    }),
  });
  const res422 = await patchArtifact(req422, {
    params: Promise.resolve({ id: "art-solar-wireframes" }),
  });
  assert.equal(res422.status, 422);

  // With both approved_by and approved_at -> 200
  const nowIso = new Date().toISOString();
  const req200 = new NextRequest("http://localhost:3000/api/artifacts/art-solar-wireframes", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-owner-key": ownerKey,
    },
    body: JSON.stringify({
      status: "approved",
      approved_by: "Ray (Founder)",
      approved_at: nowIso,
    }),
  });
  const res200 = await patchArtifact(req200, {
    params: Promise.resolve({ id: "art-solar-wireframes" }),
  });
  assert.equal(res200.status, 200);
  const updated = await res200.json();
  assert.equal(updated.status, "approved");
  assert.equal(updated.approved_by, "Ray (Founder)");
});

test.after(async () => {
  if (global.__cortexPglite) {
    await global.__cortexPglite.close();
  }
  setTimeout(() => process.exit(0), 100).unref();
});
