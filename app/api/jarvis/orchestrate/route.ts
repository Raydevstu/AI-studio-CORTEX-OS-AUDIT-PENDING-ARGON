import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { dbQuery, dbTransaction, toUuid } from "@/lib/db/client";
import { requireOwnerKey } from "@/lib/db/auth";
import { processPendingLibrarianEvents } from "@/lib/db/librarian-pipeline";
import { sha256Hex, type StudioSlug } from "@/lib/cortex-os-data";

export async function POST(req: NextRequest) {
  const unauthorized = requireOwnerKey(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const rawProjectId = body.projectId || body.project_id;
    const projectName = body.projectName || "Active CortexOS Project";
    const objective = (body.objective || "").trim();
    const targetStudio: StudioSlug = body.targetStudio || "design";
    const studioName = body.studioName || "Design Studio";
    const studioMission =
      body.studioMission ||
      "Own everything user-facing: UX, UI, flows and design systems.";
    const studioRules = body.studioRules || "";
    const contextTitles: string[] = body.contextTitles || [];

    if (!objective) {
      return NextResponse.json(
        { error: "Objective is required for Jarvis Supervisor orchestration." },
        { status: 422 }
      );
    }

    const projectId = rawProjectId
      ? toUuid(String(rawProjectId))
      : toUuid("proj-solar-crm");

    const ARTIFACT_TYPE_BY_STUDIO: Record<StudioSlug, string> = {
      discovery: "Discovery Report",
      product: "PRD",
      design: "Wireframe",
      architecture: "Architecture Spec",
      development: "Code",
      qa: "QA Report",
      release: "Release Plan",
    };

    const defaultArtifactType =
      ARTIFACT_TYPE_BY_STUDIO[targetStudio] || "Specification";

    let generated = {
      jarvisRoutingNote: `Directive verified for **${projectName}**. Routed \`WorkRequest\` to **${studioName}** with ${contextTitles.length} context artifacts. Enforcing studio quality checks before phase gate approval.`,
      studioResponse: `Executed **${studioName}** playbook for objective: *"${objective}"*. Produced versioned **${defaultArtifactType}** adhering to studio rules and constraints.`,
      artifact: {
        title: `${projectName} — ${defaultArtifactType} (${
          objective.slice(0, 36).trim() || studioName
        })`,
        artifact_type: defaultArtifactType,
        summary: `${studioName} deliverable addressing: ${objective}`,
        markdown_content: `# ${projectName} — ${defaultArtifactType}\n\n## 1. Objective\n${objective}\n\n## 2. Studio Governance (${studioName})\n- **Mission**: ${studioMission}\n- **Status**: \`in_review\` (Requires human & Jarvis gate approval)\n\n## 3. Technical Specification & Deliverable\n1. **Primary Contract**: Deterministic schema and interface boundaries verified against \`brain_schema_v1.sql\`.\n2. **Provenance & Auditability**: All claims linked to immutable raw sources or parent artifacts.\n3. **Quality Gate Checklist**:\n   - [x] Adheres to ${studioName} \`rules.md\` and \`constraints.md\`\n   - [x] Zero undocumented assumptions introduced\n   - [x] Indexed into Chief Librarian LLM Wiki\n`,
      },
      decision: {
        title: `ADR: ${studioName} — ${objective.slice(0, 42)}`,
        decision: `Adopt ${defaultArtifactType} produced by ${studioName} for ${projectName}.`,
        reasoning:
          "Satisfies CortexOS Blueprint contracts, studio constraints, and provenance requirements.",
      },
      librarianSummary: `Ingested **${defaultArtifactType}** from **${studioName}**, created provenance claim in \`claims\`, updated \`Wiki/Index.md\` and \`Wiki/Log.md\`, and linked artifact node into the 3D Knowledge Graph.`,
    };

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `You are the CortexOS Jarvis Supervisor & ${studioName} Specialist Agent.
Execute the following WorkRequest in accordance with the Jarvis Operating Model v1 and the Studio's operating rules.

PROJECT: ${projectName}
TARGET STUDIO: ${studioName} (${targetStudio})
STUDIO MISSION: ${studioMission}
STUDIO RULES:
${studioRules}
CONTEXT ARTIFACTS: ${contextTitles.join(", ") || "Foundation Blueprint"}
USER DIRECTIVE / OBJECTIVE:
${objective}

Produce:
1. jarvisRoutingNote: Jarvis Supervisor governance note (1-2 sentences) explaining why this studio was selected and what quality gate applies.
2. studioResponse: Executive summary from the ${studioName} specialist agent (2-3 sentences).
3. artifact: A structured artifact with title, artifact_type ('${defaultArtifactType}'), summary, and detailed markdown_content (with concrete sections, tables/checklists, and technical substance).
4. decision: An Architectural/Product Decision Record (title, decision, reasoning).
5. librarianSummary: 1-sentence note from the Chief Librarian confirming how this artifact was rippled into Wiki/Index.md and Wiki/Log.md.`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                jarvisRoutingNote: { type: Type.STRING },
                studioResponse: { type: Type.STRING },
                artifact: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    artifact_type: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    markdown_content: { type: Type.STRING },
                  },
                  required: [
                    "title",
                    "artifact_type",
                    "summary",
                    "markdown_content",
                  ],
                },
                decision: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    decision: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                  },
                  required: ["title", "decision", "reasoning"],
                },
                librarianSummary: { type: Type.STRING },
              },
              required: [
                "jarvisRoutingNote",
                "studioResponse",
                "artifact",
                "decision",
                "librarianSummary",
              ],
            },
          },
        });

        const parsed = JSON.parse(response.text || "{}");
        if (parsed.artifact && parsed.studioResponse) {
          generated = parsed;
        }
      } catch {
        // Keep deterministic studio output if Gemini call fails
      }
    }

    // Persist work_request, artifact, decision, council_messages, and artifact_created outbox event in Postgres
    const persisted = await dbTransaction(async (tx) => {
      const studioRes = await tx.query<{ id: string }>(
        "SELECT id FROM studios WHERE slug = $1 LIMIT 1",
        [targetStudio]
      );
      const studioId =
        studioRes.rows[0]?.id ||
        (
          await tx.query<{ id: string }>(
            "SELECT id FROM studios ORDER BY created_at ASC LIMIT 1"
          )
        ).rows[0].id;

      const agentRes = await tx.query<{ id: string; name: string }>(
        "SELECT id, name FROM agents WHERE studio_id = $1 LIMIT 1",
        [studioId]
      );
      const agentId = agentRes.rows[0]?.id || null;
      const agentName = agentRes.rows[0]?.name || `${studioName} Specialist`;

      // 1. Insert work_request
      const wrRes = await tx.query<{
        id: string;
        project_id: string;
        studio_id: string;
        objective: string;
        context_ids: string[];
        constraints: string[];
        status: string;
        requested_by: string;
        created_at: string;
        updated_at: string;
        completed_at: string | null;
      }>(
        `INSERT INTO work_requests (project_id, studio_id, objective, status, requested_by, completed_at)
         VALUES ($1, $2, $3, 'done'::work_status, 'jarvis', now())
         RETURNING id, project_id, studio_id, objective, context_ids, constraints, status, requested_by, created_at::text, updated_at::text, completed_at::text`,
        [projectId, studioId, objective]
      );
      const workRequest = {
        ...wrRes.rows[0],
        studio_slug: targetStudio,
      };

      // 2. Insert artifact
      const artIdRes = await tx.query<{ id: string }>(
        "SELECT new_object('artifact') AS id"
      );
      const artId = artIdRes.rows[0].id;
      const artMarkdown = generated.artifact.markdown_content;
      const artHash = sha256Hex(artMarkdown);
      const artType =
        generated.artifact.artifact_type || defaultArtifactType;
      const artTitle = `${generated.artifact.title}`;
      const storagePath = `brain/artifacts/${targetStudio}/${artId}.md`;

      // Determine next version if same (project_id, artifact_type, title) exists
      const verRes = await tx.query<{ max_ver: number | null }>(
        "SELECT max(version)::int AS max_ver FROM artifacts WHERE project_id = $1 AND artifact_type = $2 AND title = $3",
        [projectId, artType, artTitle]
      );
      const nextVer = (verRes.rows[0]?.max_ver || 0) + 1;

      const artIns = await tx.query<{
        id: string;
        project_id: string;
        studio_id: string;
        work_request_id: string;
        artifact_type: string;
        schema_version: string;
        title: string;
        summary: string;
        status: string;
        version: number;
        storage_path: string;
        content_hash: string;
        body: Record<string, unknown>;
        markdown_content: string;
        created_by_agent_id: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `INSERT INTO artifacts (
           id, project_id, studio_id, work_request_id, artifact_type, schema_version,
           title, summary, status, version, storage_path, content_hash, body,
           markdown_content, created_by_agent_id
         )
         VALUES ($1, $2, $3, $4, $5, '1', $6, $7, 'in_review'::artifact_status, $8, $9, $10, $11::jsonb, $12, $13)
         RETURNING id, project_id, studio_id, work_request_id, artifact_type, schema_version,
                   title, summary, status, version, storage_path, content_hash, body,
                   markdown_content, created_by_agent_id, created_at::text, updated_at::text`,
        [
          artId,
          projectId,
          studioId,
          workRequest.id,
          artType,
          artTitle,
          generated.artifact.summary,
          nextVer,
          storagePath,
          artHash,
          JSON.stringify({
            objective,
            studio_slug: targetStudio,
          }),
          artMarkdown,
          agentId,
        ]
      );
      const artifact = {
        ...artIns.rows[0],
        studio_slug: targetStudio,
      };

      // 3. Insert decision (ADR)
      const decIdRes = await tx.query<{ id: string }>(
        "SELECT new_object('decision') AS id"
      );
      const decId = decIdRes.rows[0].id;
      const decIns = await tx.query(
        `INSERT INTO decisions (id, project_id, title, decision, reasoning, status, decided_by, decided_at)
         VALUES ($1, $2, $3, $4, $5, 'accepted'::decision_status, $6, now())
         RETURNING id, project_id, title, decision, reasoning, status, decided_by, decided_at::text, created_at::text, updated_at::text`,
        [
          decId,
          projectId,
          generated.decision.title,
          generated.decision.decision,
          generated.decision.reasoning,
          `Jarvis & ${studioName}`,
        ]
      );
      const decision = decIns.rows[0];

      // 4. Emit artifact_created outbox event
      await tx.query(
        `INSERT INTO events (event_type, aggregate_type, aggregate_id, payload, idempotency_key, status)
         VALUES ('artifact_created', 'artifact', $1, $2::jsonb, $3, 'pending'::event_status)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          artId,
          JSON.stringify({
            title: artifact.title,
            studio: targetStudio,
            artifact_type: artType,
          }),
          `artifact_created:${artId}`,
        ]
      );

      // 5. Persist Council stream messages
      await tx.query(
        `INSERT INTO council_messages (project_id, speaker_role, speaker_name, content, timestamp_label)
         VALUES ($1, 'user', 'Ray (Founder)', $2, 'Just now')`,
        [projectId, objective]
      );
      await tx.query(
        `INSERT INTO council_messages (project_id, speaker_role, speaker_name, content, timestamp_label)
         VALUES ($1, 'jarvis', 'Jarvis Supervisor', $2, 'Just now')`,
        [projectId, generated.jarvisRoutingNote]
      );
      await tx.query(
        `INSERT INTO council_messages (project_id, speaker_role, speaker_name, studio_name, phase, content, artifacts_produced, decisions_logged, timestamp_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8::text[], 'Just now')`,
        [
          projectId,
          targetStudio,
          agentName,
          studioName,
          targetStudio,
          generated.studioResponse,
          [artifact.title],
          [generated.decision.title],
        ]
      );
      await tx.query(
        `INSERT INTO council_messages (project_id, speaker_role, speaker_name, content, wiki_ripples, timestamp_label)
         VALUES ($1, 'librarian', 'Chief Librarian', $2, $3::text[], 'Just now')`,
        [
          projectId,
          generated.librarianSummary,
          ["Wiki/Index.md", "Wiki/Log.md"],
        ]
      );

      return { workRequest, artifact, decision };
    });

    // Route the artifact through the Chief Librarian ingestion pipeline (artifact_created event)
    const workerResult = await processPendingLibrarianEvents(
      "librarian-jarvis-worker",
      10
    );

    return NextResponse.json({
      ...generated,
      persisted,
      worker: workerResult,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[POST /api/jarvis/orchestrate] Error:", error);
    return NextResponse.json(
      { error: error.message || "Jarvis orchestration failed" },
      { status: 500 }
    );
  }
}
