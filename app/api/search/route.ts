import { NextRequest, NextResponse } from "next/server";
import { dbQuery, isRemotePostgresUrl } from "@/lib/db/client";
import { embedText1536 } from "@/lib/db/embeddings";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "15", 10))
    );

    if (!q) {
      const recentSources = await dbQuery<{
        id: string;
        title: string;
        raw_content: string;
        storage_path: string;
        trust: string;
      }>(
        "SELECT id, title, raw_content, storage_path, trust FROM sources ORDER BY ingested_at DESC LIMIT $1",
        [limit]
      );
      return NextResponse.json({
        query: "",
        results: recentSources.rows.map((s, idx) => ({
          object_id: s.id,
          object_type: "source",
          source_id: s.id,
          title: s.title,
          snippet: s.raw_content.slice(0, 260),
          rrf_score: Number((1 / (60 + idx + 1)).toFixed(6)),
          citations: [
            {
              source_id: s.id,
              title: s.title,
              storage_path: s.storage_path,
              locator: "line 1",
            },
          ],
        })),
      });
    }

    const queryVec = await embedText1536(q);
    const vecParam = isRemotePostgresUrl()
      ? `[${queryVec.join(",")}]`
      : queryVec;
    const vecCast = isRemotePostgresUrl() ? "$2::vector" : "$2::real[]";

    // Hybrid Search: Full-Text Search (ts_rank_cd + ILIKE) + pgvector cosine distance (<=>)
    // fused via Reciprocal-Rank Fusion (RRF: k=60)
    const hybridSql = `
      WITH fts_candidates AS (
        SELECT e.object_id,
               e.chunk_index,
               e.chunk_text,
               (
                 ts_rank_cd(to_tsvector('english', e.chunk_text), plainto_tsquery('english', $1))
                 + CASE WHEN e.chunk_text ILIKE ('%' || $1 || '%') THEN 0.5 ELSE 0.0 END
               ) AS fts_score
          FROM embeddings e
         WHERE to_tsvector('english', e.chunk_text) @@ plainto_tsquery('english', $1)
            OR e.chunk_text ILIKE ('%' || $1 || '%')
      ),
      fts_ranked AS (
        SELECT object_id,
               chunk_index,
               chunk_text,
               fts_score,
               ROW_NUMBER() OVER (ORDER BY fts_score DESC) AS fts_rank
          FROM fts_candidates
         LIMIT 50
      ),
      vec_ranked AS (
        SELECT e.object_id,
               e.chunk_index,
               e.chunk_text,
               (1.0 - (e.embedding <=> ${vecCast})) AS cosine_similarity,
               ROW_NUMBER() OVER (ORDER BY (e.embedding <=> ${vecCast}) ASC) AS vec_rank
          FROM embeddings e
         LIMIT 50
      ),
      rrf_fused AS (
        SELECT COALESCE(f.object_id, v.object_id) AS object_id,
               COALESCE(f.chunk_index, v.chunk_index) AS chunk_index,
               COALESCE(f.chunk_text, v.chunk_text) AS chunk_text,
               f.fts_rank,
               v.vec_rank,
               COALESCE(v.cosine_similarity, 0) AS cosine_similarity,
               (
                 COALESCE(1.0 / (60.0 + f.fts_rank), 0.0) +
                 COALESCE(1.0 / (60.0 + v.vec_rank), 0.0)
               ) AS rrf_score
          FROM fts_ranked f
          FULL OUTER JOIN vec_ranked v
            ON f.object_id = v.object_id AND f.chunk_index = v.chunk_index
      )
      SELECT r.object_id,
             bo.object_type,
             r.chunk_index,
             r.chunk_text,
             r.fts_rank::int AS fts_rank,
             r.vec_rank::int AS vec_rank,
             r.cosine_similarity,
             r.rrf_score,
             s.id AS source_id,
             COALESCE(s.title, a.title, w.title, r.object_id::text) AS title,
             s.storage_path AS source_storage_path
        FROM rrf_fused r
        JOIN brain_objects bo ON bo.id = r.object_id
        LEFT JOIN sources s ON s.id = r.object_id
        LEFT JOIN artifacts a ON a.id = r.object_id
        LEFT JOIN wiki_pages w ON w.id = r.object_id
       ORDER BY r.rrf_score DESC
       LIMIT $3
    `;

    const res = await dbQuery<{
      object_id: string;
      object_type: string;
      chunk_index: number;
      chunk_text: string;
      fts_rank: number | null;
      vec_rank: number | null;
      cosine_similarity: number;
      rrf_score: number;
      source_id: string | null;
      title: string;
      source_storage_path: string | null;
    }>(hybridSql, [q, vecParam, limit]);

    // Attach provenance claim citations (`source_id`, `locator`, `claim_text`) for every hit
    const results = [];
    for (const row of res.rows) {
      let resolvedSourceId = row.source_id;
      const citations: {
        source_id: string;
        claim_text: string;
        locator: string | null;
      }[] = [];

      if (row.source_id) {
        const claimsForSource = await dbQuery<{
          source_id: string;
          claim_text: string;
          locator: string | null;
        }>(
          "SELECT source_id, claim_text, locator FROM claims WHERE source_id = $1 LIMIT 5",
          [row.source_id]
        );
        for (const cl of claimsForSource.rows) {
          citations.push(cl);
        }
        if (citations.length === 0) {
          citations.push({
            source_id: row.source_id,
            claim_text: row.chunk_text.slice(0, 180),
            locator: "line 1",
          });
        }
      } else {
        const claimsForObj = await dbQuery<{
          source_id: string | null;
          claim_text: string;
          locator: string | null;
        }>(
          "SELECT source_id, claim_text, locator FROM claims WHERE wiki_page_id = $1 OR artifact_id = $1 LIMIT 5",
          [row.object_id]
        );
        for (const cl of claimsForObj.rows) {
          if (cl.source_id) {
            if (!resolvedSourceId) resolvedSourceId = cl.source_id;
            citations.push({
              source_id: cl.source_id,
              claim_text: cl.claim_text,
              locator: cl.locator,
            });
          }
        }
      }

      results.push({
        object_id: row.object_id,
        object_type: row.object_type,
        source_id: resolvedSourceId,
        title: row.title,
        snippet: row.chunk_text.slice(0, 320),
        fts_rank: row.fts_rank,
        vec_rank: row.vec_rank,
        cosine_similarity: Number(Number(row.cosine_similarity).toFixed(4)),
        rrf_score: Number(Number(row.rrf_score).toFixed(6)),
        citations,
      });
    }

    const allCitations = results.flatMap((r) => r.citations);

    return NextResponse.json({
      query: q,
      results,
      citations: allCitations,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[GET /api/search] Error:", error);
    return NextResponse.json(
      { error: error.message || "Search failed" },
      { status: 500 }
    );
  }
}
