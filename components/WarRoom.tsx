"use client";

import React, { useState, useMemo } from "react";
import {
  Project,
  Studio,
  StudioSlug,
  LIFECYCLE_PHASES,
  Source,
  SourceKind,
  TrustLevel,
  Artifact,
  Entity,
  Concept,
  Decision,
  WikiPage,
  Claim,
  Relationship,
  WorkRequest,
  OutboxEvent,
  AuditFinding,
  CouncilMessage,
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
  validateArtifact,
  validateClaimCreate,
  isWikiPageVisibleToAgents,
  createDeterministicEvent,
  findGraphNeighbors,
  canTransitionLifecyclePhase,
} from "@/lib/cortex-os-data";
import { BrainNode } from "@/lib/knowledge-data";
import {
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  FileCheck2,
  FileCode,
  FileText,
  Filter,
  FolderGit2,
  GitBranch,
  Layers,
  Lock,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  Unlock,
  Workflow,
} from "lucide-react";

interface WarRoomProps {
  onPublishNodeToBrain: (node: BrainNode) => void;
  onSwitchToBrainMode: () => void;
}

function renderFormattedText(text: string): React.ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
      return (
        <strong key={i} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    return tok;
  });
}

export default function WarRoom({
  onPublishNodeToBrain,
  onSwitchToBrainMode,
}: WarRoomProps) {
  // Core CortexOS Domain State
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>("proj-solar-crm");
  const [studios, setStudios] = useState<Studio[]>(INITIAL_STUDIOS);
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES);
  const [artifacts, setArtifacts] = useState<Artifact[]>(INITIAL_ARTIFACTS);
  const [entities, setEntities] = useState<Entity[]>(INITIAL_ENTITIES);
  const [concepts, setConcepts] = useState<Concept[]>(INITIAL_CONCEPTS);
  const [decisions, setDecisions] = useState<Decision[]>(INITIAL_DECISIONS);
  const [wikiPages, setWikiPages] = useState<WikiPage[]>(INITIAL_WIKI_PAGES);
  const [claims, setClaims] = useState<Claim[]>(INITIAL_CLAIMS);
  const [relationships, setRelationships] = useState<Relationship[]>(INITIAL_RELATIONSHIPS);
  const [workRequests, setWorkRequests] = useState<WorkRequest[]>(INITIAL_WORK_REQUESTS);
  const [events, setEvents] = useState<OutboxEvent[]>(INITIAL_EVENTS);
  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>(INITIAL_AUDIT_FINDINGS);
  const [councilMessages, setCouncilMessages] = useState<CouncilMessage[]>(INITIAL_COUNCIL_MESSAGES);

  // Status banner notification
  const [statusBanner, setStatusBanner] = useState<{
    type: "info" | "success" | "warning";
    text: string;
  } | null>(null);

  // Left Panel (Research & Sources) State
  const [sourceSearch, setSourceSearch] = useState("");
  const [trustFilter, setTrustFilter] = useState<"all" | TrustLevel>("all");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>("src-karpathy-wiki");
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceTitle, setNewSourceTitle] = useState("");
  const [newSourceKind, setNewSourceKind] = useState<SourceKind>("markdown");
  const [newSourceTrust, setNewSourceTrust] = useState<TrustLevel>("untrusted");
  const [newSourceUri, setNewSourceUri] = useState("");
  const [newSourceContent, setNewSourceContent] = useState("");
  const [isIngestingSource, setIsIngestingSource] = useState(false);

  // Center Panel (Mission Control) State
  const [centerTab, setCenterTab] = useState<"council" | "artifacts" | "wiki" | "schema">("council");
  const [jarvisDirective, setJarvisDirective] = useState("");
  const [targetStudioOverride, setTargetStudioOverride] = useState<"auto" | StudioSlug>("auto");
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>("art-solar-wireframes");
  const [selectedWikiId, setSelectedWikiId] = useState<string>("wiki-index");
  const [onlyAgentVisibleWiki, setOnlyAgentVisibleWiki] = useState(false);
  const [neighborRootId, setNeighborRootId] = useState<string>("proj-cortex-os");

  // New Project Modal State
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  // Right Panel (Studio Workbench) State
  const [rightPanelMode, setRightPanelMode] = useState<"docked" | "wide" | "detached" | "collapsed">("docked");
  const [selectedStudioSlug, setSelectedStudioSlug] = useState<StudioSlug>("design");
  const [activePackFile, setActivePackFile] = useState<
    "agent_md" | "mission_md" | "rules_md" | "constraints_md" | "knowledge_md"
  >("agent_md");
  const [editingPackContent, setEditingPackContent] = useState<string | null>(null);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const selectedStudio = useMemo(
    () => studios.find((s) => s.slug === selectedStudioSlug) || studios[2],
    [studios, selectedStudioSlug]
  );

  const projectArtifacts = useMemo(
    () => artifacts.filter((a) => a.project_id === activeProject.id),
    [artifacts, activeProject.id]
  );

  const projectMessages = useMemo(
    () => councilMessages.filter((m) => m.project_id === activeProject.id),
    [councilMessages, activeProject.id]
  );

  const projectDecisions = useMemo(
    () => decisions.filter((d) => d.project_id === activeProject.id),
    [decisions, activeProject.id]
  );

  const filteredSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    return sources.filter((s) => {
      const matchesQuery =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.raw_content.toLowerCase().includes(q) ||
        s.storage_path.toLowerCase().includes(q);
      const matchesTrust = trustFilter === "all" || s.trust === trustFilter;
      return matchesQuery && matchesTrust;
    });
  }, [sources, sourceSearch, trustFilter]);

  const selectedSource = useMemo(
    () => sources.find((s) => s.id === selectedSourceId) || filteredSources[0] || null,
    [sources, selectedSourceId, filteredSources]
  );

  const selectedArtifact = useMemo(
    () =>
      artifacts.find((a) => a.id === selectedArtifactId) ||
      projectArtifacts[0] ||
      artifacts[0],
    [artifacts, selectedArtifactId, projectArtifacts]
  );

  const displayedWikiPages = useMemo(() => {
    if (!onlyAgentVisibleWiki) return wikiPages;
    return wikiPages.filter((p) => isWikiPageVisibleToAgents(p));
  }, [wikiPages, onlyAgentVisibleWiki]);

  const selectedWikiPage = useMemo(
    () =>
      displayedWikiPages.find((w) => w.id === selectedWikiId) ||
      displayedWikiPages[0] ||
      wikiPages[0],
    [displayedWikiPages, selectedWikiId, wikiPages]
  );

  const computedNeighbors = useMemo(
    () => findGraphNeighbors(neighborRootId, relationships, 2),
    [neighborRootId, relationships]
  );

  const showBanner = (type: "info" | "success" | "warning", text: string) => {
    setStatusBanner({ type, text });
  };

  // --------------------------------------------------------------------------
  // HANDLER 1: Jarvis Lifecycle Phase Transition (Enforces Quality Gates)
  // --------------------------------------------------------------------------
  const handleSelectPhase = (targetPhase: StudioSlug) => {
    const approvedTypes = projectArtifacts
      .filter((a) => a.status === "approved")
      .map((a) => a.artifact_type);

    const check = canTransitionLifecyclePhase(
      activeProject.current_phase,
      targetPhase,
      approvedTypes
    );

    if (!check.allowed) {
      showBanner("warning", check.reason);
      return;
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? { ...p, current_phase: targetPhase, updated_at: new Date().toISOString() }
          : p
      )
    );
    setSelectedStudioSlug(targetPhase);
    showBanner("success", check.reason);
  };

  // --------------------------------------------------------------------------
  // HANDLER 2: Chief Librarian Source Ingestion (5-Stage Pipeline + Ripple)
  // --------------------------------------------------------------------------
  const handleIngestSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceTitle.trim() || !newSourceContent.trim()) {
      showBanner("warning", "Please provide both a Source Title and Raw Content for Chief Librarian ingestion.");
      return;
    }

    setIsIngestingSource(true);
    const sourceId = `src-${Date.now()}`;
    const cleanTitle = newSourceTitle.startsWith("R - ")
      ? newSourceTitle.trim()
      : `R - ${newSourceTitle.trim()}`;
    const contentHash = sha256Hex(newSourceContent.trim());
    const nowIso = new Date().toISOString();

    try {
      const res = await fetch("/api/librarian/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          title: cleanTitle,
          kind: newSourceKind,
          rawContent: newSourceContent,
          projectId: activeProject.id,
          trust: newSourceTrust,
        }),
      });
      const data = await res.json();

      const createdSource: Source = {
        id: sourceId,
        project_id: activeProject.id,
        kind: newSourceKind,
        title: cleanTitle,
        uri: newSourceUri.trim() || null,
        storage_path: `brain/raw/${cleanTitle}.md`,
        content_hash: contentHash,
        raw_content: newSourceContent.trim(),
        mime_type: "text/markdown",
        byte_size: newSourceContent.length,
        trust: newSourceTrust,
        ingest_status: "processed",
        metadata: { ingested_by: "Chief Librarian" },
        ingested_at: nowIso,
      };

      setSources((prev) => [createdSource, ...prev]);
      setSelectedSourceId(sourceId);

      // Process extraction result into Entities, Concepts, Claims, WikiPage, Relationships, Outbox Event
      if (data.extraction && data.wikiPage) {
        const newWikiId = `wiki-${Date.now()}`;
        const createdWiki: WikiPage = {
          id: newWikiId,
          page_type: data.wikiPage.page_type || "summary",
          path: data.wikiPage.path,
          title: data.wikiPage.title,
          summary: data.wikiPage.summary,
          markdown_body: data.wikiPage.markdown_body,
          project_id: activeProject.id,
          current_version: 1,
          body_hash: sha256Hex(data.wikiPage.markdown_body),
          review_state: "approved",
          requires_approval: false,
          created_at: nowIso,
          updated_at: nowIso,
        };

        // Update Wiki/Index.md and Wiki/Log.md + add new summary page
        setWikiPages((prev) => {
          const updated = prev.map((w) => {
            if (w.id === "wiki-index") {
              const updatedBody = `${w.markdown_body}\n- [[${createdWiki.path}]] — ${createdWiki.title}`;
              return {
                ...w,
                markdown_body: updatedBody,
                current_version: w.current_version + 1,
                body_hash: sha256Hex(updatedBody),
                updated_at: nowIso,
              };
            }
            if (w.id === "wiki-log") {
              const logLine = `- **${nowIso.slice(0, 10)}** | \`INGEST\` | *${cleanTitle}* -> Extracted ${data.extraction.entities?.length || 1} entities, ${data.extraction.concepts?.length || 1} concepts; created \`${createdWiki.path}\`.`;
              const updatedBody = `${w.markdown_body}\n${logLine}`;
              return {
                ...w,
                markdown_body: updatedBody,
                current_version: w.current_version + 1,
                body_hash: sha256Hex(updatedBody),
                updated_at: nowIso,
              };
            }
            return w;
          });
          return [createdWiki, ...updated];
        });

        // Add Extracted Entities
        const addedEntities: Entity[] = (data.extraction.entities || []).map(
          (e: { name: string; entity_type: string; description: string; confidence: number }, idx: number) => ({
            id: `ent-${Date.now()}-${idx}`,
            canonical_name: e.name,
            entity_type: e.entity_type || "technology",
            description: e.description,
            aliases: [],
            metadata: { source_id: sourceId },
            review_state: "unreviewed" as const,
            confidence: e.confidence || 0.9,
            created_at: nowIso,
            updated_at: nowIso,
          })
        );
        if (addedEntities.length > 0) {
          setEntities((prev) => [...addedEntities, ...prev]);
        }

        // Add Extracted Concepts
        const addedConcepts: Concept[] = (data.extraction.concepts || []).map(
          (c: { name: string; summary: string; domain?: string; confidence: number }, idx: number) => ({
            id: `con-${Date.now()}-${idx}`,
            name: c.name,
            summary: c.summary,
            domain: c.domain || "Extracted Knowledge",
            aliases: [],
            review_state: "unreviewed" as const,
            confidence: c.confidence || 0.9,
            created_at: nowIso,
            updated_at: nowIso,
          })
        );
        if (addedConcepts.length > 0) {
          setConcepts((prev) => [...addedConcepts, ...prev]);
        }

        // Create Provenance Claim
        const firstEvidence =
          data.extraction.entities?.[0]?.evidence ||
          data.extraction.concepts?.[0]?.evidence ||
          data.extraction.summary;
        const validatedClaim = validateClaimCreate({
          wiki_page_id: newWikiId,
          page_version: 1,
          claim_text: firstEvidence,
          source_id: sourceId,
          locator: "Chief Librarian Verbatim Quote",
          confidence: 0.95,
        });
        const newClaim: Claim = {
          ...validatedClaim,
          id: `claim-${Date.now()}`,
          confidence: validatedClaim.confidence ?? 0.95,
          review_state: "approved",
          created_at: nowIso,
        };
        setClaims((prev) => [newClaim, ...prev]);

        // Add Relationship in Graph
        const newRel: Relationship = {
          id: `rel-${Date.now()}`,
          from_id: activeProject.id,
          from_label: activeProject.name,
          to_id: newWikiId,
          to_label: createdWiki.title,
          edge_type: "references",
          confidence: 0.95,
          source_id: sourceId,
          review_state: "approved",
          created_at: nowIso,
        };
        setRelationships((prev) => [newRel, ...prev]);

        // Deterministic Outbox Event
        const outboxEvt = createDeterministicEvent(
          "source_created",
          "source",
          sourceId,
          { title: cleanTitle, trust: newSourceTrust, wiki_path: createdWiki.path },
          events.length + 101
        );
        setEvents((prev) => [{ ...outboxEvt, status: "done", attempts: 1, processed_at: nowIso }, ...prev]);

        // Log in Agent Council
        const libMsg: CouncilMessage = {
          id: `cm-${Date.now()}`,
          project_id: activeProject.id,
          speaker_role: "librarian",
          speaker_name: "Chief Librarian",
          content: `Ingested immutable source **${cleanTitle}** (\`sha256:${contentHash.slice(0, 12)}...\`, \`trust=${newSourceTrust}\`). Extracted **${addedEntities.length} entities** and **${addedConcepts.length} concepts** with verbatim provenance quotes, rippled updates to \`${createdWiki.path}\`, \`Wiki/Index.md\`, and \`Wiki/Log.md\`, and linked node into the 3D Knowledge Graph.`,
          wiki_ripples: [createdWiki.path, "index.md", "log.md"],
          timestamp: "Just now",
        };
        setCouncilMessages((prev) => [...prev, libMsg]);

        // Publish new node to 3D Brain Graph
        onPublishNodeToBrain({
          id: `node-${sourceId}`,
          title: cleanTitle,
          category: "Claude memory",
          kind: "memory",
          area: "system",
          summary: data.extraction.summary,
          notes: createdWiki.markdown_body,
          stalenessDays: 0,
          needsAttention: false,
          connections: ["node-chief-librarian", "node-jarvis-supervisor", "node-cortex-engine"],
          tags: ["librarian-ingested", newSourceKind, newSourceTrust],
          x: (Math.random() - 0.5) * 140,
          y: -35 + (Math.random() - 0.5) * 40,
          z: (Math.random() - 0.5) * 140,
          radius: 6.8,
          isKeyAnchor: true,
        });
      }

      setIsAddingSource(false);
      setNewSourceTitle("");
      setNewSourceUri("");
      setNewSourceContent("");
      showBanner(
        "success",
        `Chief Librarian ingested "${cleanTitle}", verified provenance claims, and rippled updates to LLM Wiki & 3D Brain.`
      );
    } catch (err: unknown) {
      const error = err as Error;
      showBanner("warning", error.message || "Failed to ingest source.");
    } finally {
      setIsIngestingSource(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLER 3: Jarvis Supervisor Council & WorkRequest Orchestration
  // --------------------------------------------------------------------------
  const handleRunJarvisOrchestration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jarvisDirective.trim()) {
      showBanner("warning", "Enter a directive or objective for Jarvis Supervisor.");
      return;
    }

    const targetSlug: StudioSlug =
      targetStudioOverride === "auto" ? activeProject.current_phase : targetStudioOverride;
    const targetStudio = studios.find((s) => s.slug === targetSlug) || studios[0];
    const directiveText = jarvisDirective.trim();
    const nowIso = new Date().toISOString();

    setIsOrchestrating(true);
    setJarvisDirective("");

    // 1. Append User Message & Create Running WorkRequest
    const userMsg: CouncilMessage = {
      id: `cm-user-${Date.now()}`,
      project_id: activeProject.id,
      speaker_role: "user",
      speaker_name: "Ray (Founder)",
      content: directiveText,
      timestamp: "Just now",
    };
    setCouncilMessages((prev) => [...prev, userMsg]);

    const workReqId = `wr-${Date.now()}`;
    const newWorkReq: WorkRequest = {
      id: workReqId,
      project_id: activeProject.id,
      studio_id: targetStudio.id,
      studio_slug: targetStudio.slug,
      objective: directiveText,
      context_ids: projectArtifacts.map((a) => a.id),
      constraints: targetStudio.quality_checks,
      requested_by: "jarvis",
      status: "running",
      created_at: nowIso,
      updated_at: nowIso,
    };
    setWorkRequests((prev) => [newWorkReq, ...prev]);

    try {
      const res = await fetch("/api/jarvis/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          projectName: activeProject.name,
          objective: directiveText,
          targetStudio: targetStudio.slug,
          studioName: targetStudio.name,
          studioMission: targetStudio.mission,
          studioRules: targetStudio.pack.rules_md,
          contextTitles: projectArtifacts.map((a) => a.title),
        }),
      });
      const data = await res.json();

      // 2. Create Produced Artifact
      const artId = `art-${Date.now()}`;
      const artMarkdown =
        data.artifact?.markdown_content ||
        `# ${data.artifact?.title || "Studio Artifact"}\n\n${data.studioResponse || ""}`;
      const createdArtifact: Artifact = {
        id: artId,
        project_id: activeProject.id,
        studio_id: targetStudio.id,
        studio_slug: targetStudio.slug,
        work_request_id: workReqId,
        artifact_type: data.artifact?.artifact_type || targetStudio.outputs[0] || "Spec",
        schema_version: "1",
        title: data.artifact?.title || `${activeProject.name} — ${targetStudio.name} Spec`,
        summary: data.artifact?.summary || `Produced by ${targetStudio.name}`,
        status: "in_review",
        version: 1,
        storage_path: `brain/artifacts/${activeProject.slug}/${artId}.md`,
        content_hash: sha256Hex(artMarkdown),
        body: { objective: directiveText, studio: targetStudio.slug },
        markdown_content: artMarkdown,
        created_by_agent_id: targetStudio.agent_id,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setArtifacts((prev) => [createdArtifact, ...prev]);
      setSelectedArtifactId(artId);

      // 3. Create Decision Record
      const decId = `dec-${Date.now()}`;
      const createdDecision: Decision = {
        id: decId,
        project_id: activeProject.id,
        title: data.decision?.title || `ADR: ${targetStudio.name} Execution`,
        decision: data.decision?.decision || `Adopted ${createdArtifact.title}`,
        reasoning: data.decision?.reasoning || "Verified against Studio constraints.",
        status: "accepted",
        decided_by: `Jarvis & ${targetStudio.name}`,
        decided_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setDecisions((prev) => [createdDecision, ...prev]);

      // 4. Mark WorkRequest awaiting_approval / done & emit Outbox Event
      setWorkRequests((prev) =>
        prev.map((wr) =>
          wr.id === workReqId
            ? { ...wr, status: "done", updated_at: nowIso, completed_at: nowIso }
            : wr
        )
      );

      const artEvt = createDeterministicEvent(
        "artifact_created",
        "artifact",
        artId,
        { title: createdArtifact.title, studio: targetStudio.slug },
        events.length + 105
      );
      setEvents((prev) => [{ ...artEvt, status: "done", attempts: 1, processed_at: nowIso }, ...prev]);

      // 5. Append Jarvis -> Studio -> Librarian messages to Council
      const jarvisMsg: CouncilMessage = {
        id: `cm-jarvis-${Date.now()}`,
        project_id: activeProject.id,
        speaker_role: "jarvis",
        speaker_name: "Jarvis Supervisor",
        content: data.jarvisRoutingNote,
        timestamp: "Just now",
      };
      const studioMsg: CouncilMessage = {
        id: `cm-studio-${Date.now() + 1}`,
        project_id: activeProject.id,
        speaker_role: targetStudio.slug,
        speaker_name: targetStudio.agent_name,
        studio_name: targetStudio.name,
        phase: targetStudio.slug,
        content: data.studioResponse,
        artifacts_produced: [createdArtifact.title],
        decisions_logged: [createdDecision.title],
        timestamp: "Just now",
      };
      const libMsg: CouncilMessage = {
        id: `cm-lib-${Date.now() + 2}`,
        project_id: activeProject.id,
        speaker_role: "librarian",
        speaker_name: "Chief Librarian",
        content: data.librarianSummary,
        wiki_ripples: ["Wiki/Index.md", "Wiki/Log.md"],
        timestamp: "Just now",
      };
      setCouncilMessages((prev) => [...prev, jarvisMsg, studioMsg, libMsg]);

      // 6. Publish Artifact Node to 3D Brain
      onPublishNodeToBrain({
        id: `node-${artId}`,
        title: createdArtifact.title,
        category: "Projects",
        kind: "project",
        area: "system",
        summary: createdArtifact.summary,
        notes: createdArtifact.markdown_content,
        stalenessDays: 0,
        needsAttention: false,
        connections: [
          `node-studio-${targetStudio.slug}`,
          "node-jarvis-supervisor",
          "node-chief-librarian",
        ],
        tags: ["artifact", targetStudio.slug, createdArtifact.artifact_type.toLowerCase()],
        x: (Math.random() - 0.5) * 160,
        y: (Math.random() - 0.5) * 120,
        z: (Math.random() - 0.5) * 160,
        radius: 6.5,
        isKeyAnchor: true,
      });

      showBanner(
        "success",
        `Jarvis & ${targetStudio.name} produced artifact "${createdArtifact.title}" and synced with Chief Librarian.`
      );
    } catch (err: unknown) {
      const error = err as Error;
      showBanner("warning", error.message || "Jarvis orchestration failed.");
    } finally {
      setIsOrchestrating(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLER 4: Approve Artifact (Validates approved_by & approved_at)
  // --------------------------------------------------------------------------
  const handleApproveArtifact = (artifactId: string) => {
    const nowIso = new Date().toISOString();
    setArtifacts((prev) =>
      prev.map((a) => {
        if (a.id !== artifactId) return a;
        const updated: Artifact = {
          ...a,
          status: "approved",
          approved_by: "Ray (Founder) & Jarvis Supervisor",
          approved_at: nowIso,
          updated_at: nowIso,
        };
        return validateArtifact(updated);
      })
    );
    showBanner("success", "Artifact approved with provenance signature (approved_by & approved_at recorded).");
  };

  // --------------------------------------------------------------------------
  // HANDLER 5: Approve Doctrine Wiki Page (Unlocks agent_visible_wiki_pages)
  // --------------------------------------------------------------------------
  const handleApproveWikiPage = (pageId: string) => {
    const nowIso = new Date().toISOString();
    setWikiPages((prev) =>
      prev.map((w) =>
        w.id === pageId ? { ...w, review_state: "approved", updated_at: nowIso } : w
      )
    );
    setAuditFindings((prev) =>
      prev.map((f) =>
        f.object_id === pageId
          ? { ...f, status: "resolved", resolved_at: nowIso, resolved_by: "Ray (Founder)" }
          : f
      )
    );
    showBanner("success", "Doctrine page approved by human owner and exposed to Studio agents.");
  };

  // --------------------------------------------------------------------------
  // HANDLER 6: Save Studio Environment Pack File
  // --------------------------------------------------------------------------
  const handleSaveStudioPackFile = () => {
    if (editingPackContent === null) return;
    const nowIso = new Date().toISOString();
    setStudios((prev) =>
      prev.map((s) => {
        if (s.slug !== selectedStudio.slug) return s;
        const updatedPack = { ...s.pack, [activePackFile]: editingPackContent };
        return {
          ...s,
          pack: updatedPack,
          manifest_hash: sha256Hex(JSON.stringify(updatedPack)),
          updated_at: nowIso,
        };
      })
    );
    setEditingPackContent(null);
    showBanner("success", `Updated ${activePackFile} in ${selectedStudio.name} and recomputed SHA-256 manifest hash.`);
  };

  // --------------------------------------------------------------------------
  // HANDLER 7: Create New Project
  // --------------------------------------------------------------------------
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const nowIso = new Date().toISOString();
    const slug =
      newProjectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "new-project";
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      slug,
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || "Managed by Jarvis Supervisor across the 7 CortexOS Studios.",
      status: "active",
      current_phase: "discovery",
      created_at: nowIso,
      updated_at: nowIso,
    };
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setCouncilMessages((prev) => [
      ...prev,
      {
        id: `cm-init-${Date.now()}`,
        project_id: newProj.id,
        speaker_role: "jarvis",
        speaker_name: "Jarvis Supervisor",
        content: `Initialized **${newProj.name}** (\`${newProj.slug}\`) in **1. Discovery Studio**. All 7 Studios and Chief Librarian are standing by.`,
        timestamp: "Just now",
      },
    ]);
    setIsCreatingProject(false);
    setNewProjectName("");
    setNewProjectDesc("");
    showBanner("success", `Created project "${newProj.name}" and initialized Discovery phase.`);
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#050814] text-slate-100 overflow-hidden">
      {/* ==================================================================== */}
      {/* PINNED JARVIS SUPERVISOR GOVERNANCE BAR                              */}
      {/* ==================================================================== */}
      <div className="shrink-0 px-4 py-2 bg-slate-950 border-b border-slate-800/90 flex items-center justify-between gap-2">
        {/* Left: Active Project Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400">
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">JARVIS</span>
          </div>
          <span className="text-slate-700" aria-hidden="true">
            ·
          </span>
          <label htmlFor="war-room-project-select" className="sr-only">
            Active Project
          </label>
          <select
            id="war-room-project-select"
            aria-label="Active Project"
            value={activeProject.id}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs font-semibold text-white outline-none focus:border-cyan-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsCreatingProject(!isCreatingProject)}
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            + New Project
          </button>
        </div>

        {/* Center: 7-Phase Lifecycle Stepper */}
        <div
          className="flex items-center gap-0.5 overflow-x-auto py-0.5"
          role="group"
          aria-label="Project Lifecycle Phases"
        >
          {LIFECYCLE_PHASES.map((phase, idx) => {
            const isCurrent = activeProject.current_phase === phase;
            const currentIdx = LIFECYCLE_PHASES.indexOf(activeProject.current_phase);
            const isCompleted = idx < currentIdx;
            return (
              <React.Fragment key={phase}>
                <button
                  type="button"
                  onClick={() => handleSelectPhase(phase)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                    isCurrent
                      ? "bg-cyan-500 text-slate-950 font-semibold"
                      : isCompleted
                      ? "bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/50"
                      : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  <span className="font-mono tabular-nums text-[10px]">{idx + 1}.</span>
                  <span className="capitalize">{phase}</span>
                </button>
                {idx < LIFECYCLE_PHASES.length - 1 && (
                  <ChevronRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: Quick Stats & Right Panel Toggle */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
          <span className="hidden 2xl:inline">{sources.length} Sources</span>
          <span className="hidden 2xl:inline" aria-hidden="true">·</span>
          <span className="hidden 2xl:inline">{artifacts.length} Artifacts</span>
          <span className="hidden 2xl:inline" aria-hidden="true">·</span>
          <span className="hidden 2xl:inline">{wikiPages.length} Wiki Pages</span>
          <button
            type="button"
            onClick={() =>
              setRightPanelMode((m) => (m === "collapsed" ? "docked" : "collapsed"))
            }
            aria-label="Toggle Studio Workbench Panel"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white transition-colors"
          >
            {rightPanelMode === "collapsed" ? (
              <PanelRightOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelRightClose className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Status Notification Bar */}
      {statusBanner && (
        <div
          role="status"
          className={`shrink-0 px-4 py-2 border-b text-xs flex items-center justify-between gap-4 ${
            statusBanner.type === "warning"
              ? "bg-amber-950/70 border-amber-700/60 text-amber-200"
              : statusBanner.type === "success"
              ? "bg-emerald-950/70 border-emerald-700/60 text-emerald-200"
              : "bg-slate-900 border-slate-700 text-slate-200"
          }`}
        >
          <span>{statusBanner.text}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-xs underline hover:text-white shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create New Project Inline Bar */}
      {isCreatingProject && (
        <form
          onSubmit={handleCreateProject}
          className="shrink-0 px-4 py-3 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center gap-3"
        >
          <span className="text-xs font-semibold text-white">Initialize New CortexOS Project:</span>
          <input
            type="text"
            placeholder="Project Name (e.g., FinTech Autonomous Treasury)"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500 min-w-[240px]"
          />
          <input
            type="text"
            placeholder="Brief scope or industry description..."
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500 flex-1 min-w-[240px]"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs whitespace-nowrap"
          >
            Create & Start Discovery
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingProject(false)}
            className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        </form>
      )}

      {/* ==================================================================== */}
      {/* THREE-COLUMN WAR ROOM WORKSPACE                                      */}
      {/* ==================================================================== */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* ------------------------------------------------------------------ */}
        {/* LEFT PANEL: RESEARCH & SOURCES (NotebookLM Context -> Librarian)   */}
        {/* ------------------------------------------------------------------ */}
        <aside
          aria-label="Research and Sources Panel"
          className="w-72 xl:w-80 shrink-0 border-r border-slate-800/90 bg-slate-950/70 flex flex-col min-h-0"
        >
          <div className="p-3.5 border-b border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Research & Raw Sources</h2>
                <p className="text-[11px] text-slate-400">
                  Immutable Layer 1 (`brain/raw/`) · Chief Librarian Gate
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingSource(!isAddingSource)}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Source</span>
              </button>
            </div>

            {/* Search & Trust Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  aria-label="Search Knowledge Sources"
                  placeholder="Search sources, hashes..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-cyan-500"
                />
              </div>
              <select
                aria-label="Filter Source Trust Level"
                value={trustFilter}
                onChange={(e) => setTrustFilter(e.target.value as "all" | TrustLevel)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none"
              >
                <option value="all">All Trust</option>
                <option value="trusted">Trusted</option>
                <option value="untrusted">Untrusted</option>
              </select>
            </div>
          </div>

          {/* Add & Ingest Source Form */}
          {isAddingSource && (
            <form
              onSubmit={handleIngestSource}
              className="p-3.5 border-b border-slate-800 bg-slate-900/90 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-300">
                  Ingest Source via Chief Librarian
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingSource(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <input
                type="text"
                aria-label="New Source Title"
                placeholder="Source Title (e.g. Q4 Enterprise Security Requirements)"
                value={newSourceTitle}
                onChange={(e) => setNewSourceTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="New Source Kind"
                  value={newSourceKind}
                  onChange={(e) => setNewSourceKind(e.target.value as SourceKind)}
                  className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 outline-none"
                >
                  <option value="markdown">Markdown Note</option>
                  <option value="url">Web URL</option>
                  <option value="pdf">PDF Document</option>
                  <option value="repo">GitHub Repo</option>
                  <option value="transcript">Meeting Transcript</option>
                </select>
                <select
                  aria-label="New Source Trust Level"
                  value={newSourceTrust}
                  onChange={(e) => setNewSourceTrust(e.target.value as TrustLevel)}
                  className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 outline-none"
                >
                  <option value="untrusted">Untrusted (Data Only)</option>
                  <option value="trusted">Trusted</option>
                </select>
              </div>
              <input
                type="text"
                aria-label="Source URI or Path"
                placeholder="Optional URL or GitHub Repo URI"
                value={newSourceUri}
                onChange={(e) => setNewSourceUri(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500"
              />
              <textarea
                rows={4}
                aria-label="Raw Source Content"
                placeholder="Paste raw markdown, research findings, or transcript text. Chief Librarian will compute SHA-256, extract Entities/Concepts with verbatim quotes, and ripple into the LLM Wiki..."
                value={newSourceContent}
                onChange={(e) => setNewSourceContent(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 outline-none focus:border-cyan-500 font-mono"
              />
              <button
                type="submit"
                disabled={isIngestingSource}
                className="w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-colors"
              >
                {isIngestingSource
                  ? "Chief Librarian Extracting & Rippling..."
                  : "Ingest & Ripple into Brain"}
              </button>
            </form>
          )}

          {/* Sources List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredSources.map((src) => {
              const isSelected = selectedSource?.id === src.id;
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setSelectedSourceId(src.id)}
                  className={`w-full text-left p-3.5 transition-colors ${
                    isSelected
                      ? "bg-slate-900/95"
                      : "hover:bg-slate-900/40"
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-100 line-clamp-1">
                    {src.title}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
                    <span className="uppercase">{src.kind}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        src.trust === "trusted" ? "text-emerald-400" : "text-amber-400"
                      }
                    >
                      {src.trust}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>sha256:{src.content_hash.slice(0, 8)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Source Immutable Inspector Footer */}
          {selectedSource && (
            <div className="p-3.5 border-t border-slate-800 bg-slate-900/75 space-y-2 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="truncate">{selectedSource.storage_path}</span>
                <span className="text-emerald-400 shrink-0">{selectedSource.ingest_status}</span>
              </div>
              <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                {selectedSource.raw_content}
              </pre>
            </div>
          )}
        </aside>

        {/* ------------------------------------------------------------------ */}
        {/* CENTER PANEL: MISSION CONTROL & AGENT COUNCIL                      */}
        {/* ------------------------------------------------------------------ */}
        <section
          aria-label="Mission Control and Agent Council"
          className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#050814]"
        >
          {/* Center Panel Mode Tabs */}
          <div className="shrink-0 px-3 py-2 border-b border-slate-800/90 bg-slate-950/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setCenterTab("council")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  centerTab === "council"
                    ? "bg-cyan-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Agent Council ({projectMessages.length})
              </button>
              <button
                type="button"
                onClick={() => setCenterTab("artifacts")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  centerTab === "artifacts"
                    ? "bg-cyan-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Artifacts & Gates ({projectArtifacts.length})
              </button>
              <button
                type="button"
                onClick={() => setCenterTab("wiki")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  centerTab === "wiki"
                    ? "bg-cyan-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                LLM Wiki & Claims ({wikiPages.length})
              </button>
              <button
                type="button"
                onClick={() => setCenterTab("schema")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  centerTab === "schema"
                    ? "bg-cyan-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Schema & Audit ({auditFindings.filter((f) => f.status === "open").length})
              </button>
            </div>

            <button
              type="button"
              onClick={onSwitchToBrainMode}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-cyan-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Inspect in 3D Brain</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ================================================================ */}
          {/* TAB 1: AGENT COUNCIL & MISSION CONTROL                           */}
          {/* ================================================================ */}
          {centerTab === "council" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Pinned Jarvis Executive Summary Card */}
              <div className="shrink-0 mx-4 mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-cyan-400 font-mono">
                    <span>PINNED · JARVIS SUPERVISOR EXECUTIVE SUMMARY</span>
                    <span aria-hidden="true">·</span>
                    <span>PHASE: {activeProject.current_phase.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {activeProject.description}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-400 shrink-0">
                  <span>
                    Approved Gates:{" "}
                    <strong className="text-emerald-400">
                      {projectArtifacts.filter((a) => a.status === "approved").length}/
                      {projectArtifacts.length}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    ADRs: <strong className="text-slate-200">{projectDecisions.length}</strong>
                  </span>
                </div>
              </div>

              {/* Council Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {projectMessages.map((msg) => {
                  const isJarvis = msg.speaker_role === "jarvis";
                  const isLibrarian = msg.speaker_role === "librarian";
                  const isUser = msg.speaker_role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-xl border ${
                        isJarvis
                          ? "bg-slate-900/95 border-cyan-500/40"
                          : isLibrarian
                          ? "bg-slate-900/80 border-purple-500/40"
                          : isUser
                          ? "bg-slate-950 border-slate-700"
                          : "bg-slate-900/60 border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-white">{msg.speaker_name}</span>
                          {msg.studio_name && (
                            <>
                              <span className="text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-cyan-400 font-mono">{msg.studio_name}</span>
                            </>
                          )}
                          {isJarvis && (
                            <>
                              <span className="text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-cyan-400 font-mono">Governor & Router</span>
                            </>
                          )}
                          {isLibrarian && (
                            <>
                              <span className="text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-purple-400 font-mono">Memory OS Gate</span>
                            </>
                          )}
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-slate-400">
                          {msg.timestamp}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                        {renderFormattedText(msg.content)}
                      </p>

                      {(msg.artifacts_produced?.length ||
                        msg.decisions_logged?.length ||
                        msg.wiki_ripples?.length) && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
                          {msg.artifacts_produced?.map((art) => (
                            <button
                              key={art}
                              type="button"
                              onClick={() => setCenterTab("artifacts")}
                              className="text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>Artifact: {art}</span>
                            </button>
                          ))}
                          {msg.decisions_logged?.map((dec) => (
                            <span key={dec} className="text-amber-300">
                              Decision: {dec}
                            </span>
                          ))}
                          {msg.wiki_ripples?.map((wp) => (
                            <button
                              key={wp}
                              type="button"
                              onClick={() => setCenterTab("wiki")}
                              className="text-purple-300 hover:underline"
                            >
                              Wiki Ripple: {wp}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Jarvis Supervisor Command Input Bar */}
              <form
                onSubmit={handleRunJarvisOrchestration}
                className="shrink-0 p-3.5 bg-slate-950 border-t border-slate-800/90 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <label htmlFor="jarvis-studio-target" className="text-slate-400 font-mono">
                      Route via Jarvis to:
                    </label>
                    <select
                      id="jarvis-studio-target"
                      value={targetStudioOverride}
                      onChange={(e) =>
                        setTargetStudioOverride(e.target.value as "auto" | StudioSlug)
                      }
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-cyan-500"
                    >
                      <option value="auto">
                        Auto (Current Phase: {activeProject.current_phase})
                      </option>
                      {studios.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.name} ({s.agent_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Directives */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() =>
                        setJarvisDirective(
                          "Generate OpenAPI 3.1 contract for /librarian/ingest and /brain/search endpoints"
                        )
                      }
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 whitespace-nowrap"
                    >
                      + OpenAPI Spec
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setJarvisDirective(
                          "Design NEM 3.0 solar + battery payback comparison UI component contract"
                        )
                      }
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 whitespace-nowrap"
                    >
                      + Design Spec
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setJarvisDirective(
                          "Run SOC2 prompt-injection boundary & provenance claim audit"
                        )
                      }
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 whitespace-nowrap"
                    >
                      + QA Security Gate
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="Command Jarvis Supervisor"
                    placeholder="Command Jarvis Supervisor (e.g., 'Design the satellite roof array wireframe spec' or 'Create database migration plan')..."
                    value={jarvisDirective}
                    onChange={(e) => setJarvisDirective(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-400 outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={isOrchestrating}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isOrchestrating ? "Orchestrating..." : "Dispatch WorkRequest"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: ARTIFACTS & QUALITY GATES                                 */}
          {/* ================================================================ */}
          {centerTab === "artifacts" && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
              {/* Artifact List (5 cols) */}
              <div className="lg:col-span-5 border-r border-slate-800 overflow-y-auto divide-y divide-slate-800/70">
                {artifacts.map((art) => {
                  const isSel = selectedArtifact?.id === art.id;
                  return (
                    <button
                      key={art.id}
                      type="button"
                      onClick={() => setSelectedArtifactId(art.id)}
                      className={`w-full text-left p-4 transition-colors ${
                        isSel ? "bg-slate-900" : "hover:bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-cyan-400">
                          {art.artifact_type} · v{art.version}
                        </span>
                        <span
                          className={`text-[11px] font-mono ${
                            art.status === "approved"
                              ? "text-emerald-400"
                              : art.status === "in_review"
                              ? "text-amber-400"
                              : "text-slate-400"
                          }`}
                        >
                          {art.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white mt-1">
                        {art.title}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {art.summary}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                        <span>Studio: {art.studio_slug || "system"}</span>
                        <span aria-hidden="true">·</span>
                        <span>sha256:{art.content_hash.slice(0, 10)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Artifact Inspector (7 cols) */}
              {selectedArtifact && (
                <div className="lg:col-span-7 p-5 overflow-y-auto space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-800">
                    <div>
                      <div className="text-xs font-mono text-cyan-400">
                        {selectedArtifact.storage_path}
                      </div>
                      <h3 className="text-lg font-bold text-white mt-1">
                        {selectedArtifact.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-400">
                        <span>Type: {selectedArtifact.artifact_type}</span>
                        <span aria-hidden="true">·</span>
                        <span>Status: {selectedArtifact.status}</span>
                        {selectedArtifact.approved_by && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-400">
                              Approved by {selectedArtifact.approved_by}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {selectedArtifact.status !== "approved" ? (
                      <button
                        type="button"
                        onClick={() => handleApproveArtifact(selectedArtifact.id)}
                        className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve Artifact (Unlock Gate)</span>
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Gate Verified</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">
                      Artifact Markdown Specification
                    </div>
                    <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {selectedArtifact.markdown_content}
                    </pre>
                  </div>

                  {selectedArtifact.body && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-300">
                        Structured JSON Payload (`artifacts.body`)
                      </div>
                      <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-200 whitespace-pre-wrap">
                        {JSON.stringify(selectedArtifact.body, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: LLM WIKI & PROVENANCE CLAIMS                              */}
          {/* ================================================================ */}
          {centerTab === "wiki" && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
              {/* Left Wiki Catalog (5 cols) */}
              <div className="lg:col-span-5 border-r border-slate-800 flex flex-col min-h-0">
                <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                  <span className="text-xs font-semibold text-slate-200">
                    Karpathy LLM Wiki (`brain/wiki/`)
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyAgentVisibleWiki}
                      onChange={(e) => setOnlyAgentVisibleWiki(e.target.checked)}
                      className="rounded border-slate-700"
                    />
                    <span>`agent_visible_wiki_pages` only</span>
                  </label>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70">
                  {displayedWikiPages.map((page) => {
                    const visible = isWikiPageVisibleToAgents(page);
                    const isSel = selectedWikiPage?.id === page.id;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => setSelectedWikiId(page.id)}
                        className={`w-full text-left p-3.5 transition-colors ${
                          isSel ? "bg-slate-900" : "hover:bg-slate-900/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                          <span className="text-cyan-400">wiki/{page.path}</span>
                          <span className={visible ? "text-emerald-400" : "text-amber-400"}>
                            {visible ? "Agent-Visible" : "Hidden (Needs Approval)"}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-white mt-1">
                          {page.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] font-mono text-slate-400">
                          <span>Type: {page.page_type}</span>
                          <span aria-hidden="true">·</span>
                          <span>v{page.current_version}</span>
                          <span aria-hidden="true">·</span>
                          <span>Review: {page.review_state}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Wiki Page & Provenance Claims Viewer (7 cols) */}
              {selectedWikiPage && (
                <div className="lg:col-span-7 p-5 overflow-y-auto space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-800">
                    <div>
                      <div className="text-xs font-mono text-purple-400">
                        brain/wiki/{selectedWikiPage.path} · v{selectedWikiPage.current_version}
                      </div>
                      <h3 className="text-lg font-bold text-white mt-1">
                        {selectedWikiPage.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedWikiPage.summary}
                      </p>
                    </div>

                    {selectedWikiPage.requires_approval &&
                      selectedWikiPage.review_state !== "approved" && (
                        <button
                          type="button"
                          onClick={() => handleApproveWikiPage(selectedWikiPage.id)}
                          className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Approve Doctrine (Expose to Agents)</span>
                        </button>
                      )}
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {selectedWikiPage.markdown_body}
                  </pre>

                  {/* Provenance Claims Table */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-white">
                      Provenance Claims Ledger (`claims` Table — Zero Editorial Trap Guarantee)
                    </h4>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-mono">
                            <th className="py-2 px-3">Verbatim Claim / Evidence</th>
                            <th className="py-2 px-3">Provenance Ref</th>
                            <th className="py-2 px-3 text-right">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {claims.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-900/40">
                              <td className="py-2.5 px-3 text-slate-200">{c.claim_text}</td>
                              <td className="py-2.5 px-3 font-mono text-cyan-400">
                                {c.source_id || c.artifact_id} ({c.locator})
                              </td>
                              <td className="py-2.5 px-3 font-mono tabular-nums text-right text-emerald-400">
                                {(c.confidence * 100).toFixed(0)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: SCHEMA, OUTBOX & AUDIT ENGINE                             */}
          {/* ================================================================ */}
          {centerTab === "schema" && (
            <div className="flex-1 p-5 overflow-y-auto space-y-6">
              {/* Audit Findings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Chief Librarian Health & Drift Audit Findings (`audit_findings`)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Detects conflicting architecture, unapproved doctrines, orphan pages, and stale claims.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {auditFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-amber-400">{finding.finding_type}</span>
                        <span
                          className={
                            finding.status === "resolved"
                              ? "text-emerald-400"
                              : "text-amber-300"
                          }
                        >
                          {finding.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {finding.object_title}
                      </div>
                      <p className="text-xs text-slate-300">
                        {finding.details.description}
                      </p>
                      <div className="text-[11px] font-mono text-cyan-300">
                        Fix: {finding.details.recommended_fix}
                      </div>
                      {finding.status === "open" && (
                        <button
                          type="button"
                          onClick={() =>
                            setAuditFindings((prev) =>
                              prev.map((f) =>
                                f.id === finding.id
                                  ? {
                                      ...f,
                                      status: "resolved",
                                      resolved_at: new Date().toISOString(),
                                      resolved_by: "Ray (Founder)",
                                    }
                                  : f
                              )
                            )
                          }
                          className="mt-2 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cycle-Safe Graph Neighbors Explorer */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      PostgreSQL Recursive Graph Walk (`graph_neighbors(start_id, max_depth=2)`)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Cycle-safe bidirectional traversal over the `relationships` table.
                    </p>
                  </div>
                  <select
                    aria-label="Select Graph Walk Start Node"
                    value={neighborRootId}
                    onChange={(e) => setNeighborRootId(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                  >
                    <option value="proj-cortex-os">proj-cortex-os (CortexOS v1)</option>
                    <option value="art-librarian-prd">art-librarian-prd (Librarian PRD)</option>
                    <option value="proj-solar-crm">proj-solar-crm (Helios Solar CRM)</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  {computedNeighbors.map((n) => (
                    <div
                      key={n.object_id}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums"
                    >
                      <span className="text-cyan-400">{n.object_id}</span>
                      <span className="text-slate-500 mx-1.5">·</span>
                      <span className="text-slate-300">depth={n.depth}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transactional Outbox Events Table */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-white">
                  Transactional Event Outbox (`events` Table — `FOR UPDATE SKIP LOCKED`)
                </h4>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                        <th className="py-2 px-3">ID</th>
                        <th className="py-2 px-3">Event Type</th>
                        <th className="py-2 px-3">Idempotency Key</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Attempts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {events.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 text-slate-400">#{ev.id}</td>
                          <td className="py-2 px-3 text-cyan-300">{ev.event_type}</td>
                          <td className="py-2 px-3 text-slate-200">{ev.idempotency_key}</td>
                          <td className="py-2 px-3 text-emerald-400">{ev.status}</td>
                          <td className="py-2 px-3 text-right text-slate-300">
                            {ev.attempts}/{ev.max_attempts}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT PANEL: STUDIO WORKBENCH & ACTIVITY FEED                      */}
        {/* ------------------------------------------------------------------ */}
        {rightPanelMode !== "collapsed" && (
          <aside
            aria-label="Studio Workbench and Activity Panel"
            className={`${
              rightPanelMode === "detached"
                ? "fixed right-5 top-28 bottom-6 w-[420px] z-40 rounded-2xl shadow-2xl border border-cyan-500/40"
                : rightPanelMode === "wide"
                ? "w-[420px] border-l border-slate-800/90"
                : "w-76 xl:w-84 border-l border-slate-800/90"
            } shrink-0 bg-slate-950 flex flex-col min-h-0 overflow-hidden`}
          >
            {/* Workbench Header with Dock/Detach Controls */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Studio Workbench & Environment
                </h2>
                <p className="text-[11px] text-slate-400">
                  7 Specialist Studios · Rules, Skills & Activity
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setRightPanelMode((m) => (m === "wide" ? "docked" : "wide"))
                  }
                  title="Resize Workbench Width"
                  aria-label="Resize Workbench Width"
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs"
                >
                  {rightPanelMode === "wide" ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRightPanelMode((m) => (m === "detached" ? "docked" : "detached"))
                  }
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300 hover:text-white"
                >
                  {rightPanelMode === "detached" ? "Dock" : "Detach"}
                </button>
              </div>
            </div>

            {/* Studio Selector Pills */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/50">
              <label htmlFor="workbench-studio-select" className="sr-only">
                Select Studio Environment
              </label>
              <select
                id="workbench-studio-select"
                aria-label="Select Studio Environment"
                value={selectedStudio.slug}
                onChange={(e) => {
                  setSelectedStudioSlug(e.target.value as StudioSlug);
                  setEditingPackContent(null);
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-white outline-none focus:border-cyan-500"
              >
                {studios.map((s, idx) => (
                  <option key={s.id} value={s.slug}>
                    {idx + 1}. {s.name} ({s.agent_name})
                  </option>
                ))}
              </select>

              <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>{selectedStudio.manifest_path}</span>
                <span>sha256:{selectedStudio.manifest_hash.slice(0, 8)}</span>
              </div>
            </div>

            {/* Studio Operating Environment Files */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
              {/* File Tabs inside Studio Pack */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["agent_md", "AGENT.md"],
                      ["mission_md", "mission.md"],
                      ["rules_md", "rules.md"],
                      ["constraints_md", "constraints.md"],
                      ["knowledge_md", "knowledge.md"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setActivePackFile(key);
                        setEditingPackContent(null);
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                        activePackFile === key
                          ? "bg-cyan-500 text-slate-950 font-semibold"
                          : "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {editingPackContent !== null ? (
                  <div className="space-y-2">
                    <textarea
                      rows={7}
                      aria-label="Edit Studio Pack Markdown"
                      value={editingPackContent}
                      onChange={(e) => setEditingPackContent(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-slate-900 border border-cyan-500/60 text-xs font-mono text-white outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPackContent(null)}
                        className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveStudioPackFile}
                        className="px-3 py-1 rounded bg-cyan-500 text-slate-950 font-semibold text-xs"
                      >
                        Save to Studio Pack
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative group">
                    <pre className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {selectedStudio.pack[activePackFile]}
                    </pre>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPackContent(selectedStudio.pack[activePackFile])
                      }
                      className="mt-1.5 text-[11px] font-mono text-cyan-400 hover:underline"
                    >
                      Edit {activePackFile.replace("_md", ".md")}
                    </button>
                  </div>
                )}
              </div>

              {/* Studio Skills, Templates & Tools */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-white">
                  Equipped Studio Skills & Playbooks
                </div>
                <div className="space-y-1.5">
                  {selectedStudio.pack.skills.map((sk) => (
                    <div
                      key={sk.name}
                      className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/90"
                    >
                      <div className="text-xs font-mono text-cyan-300">
                        skills/{sk.name}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {sk.content.replace(/^#.*\n/, "")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Checks Contract */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-white">
                  Executable Quality Gate Checks
                </div>
                <ul className="space-y-1 text-xs text-slate-300">
                  {selectedStudio.quality_checks.map((qc) => (
                    <li key={qc} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{qc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Live WorkRequest Activity Feed */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-white">
                  Live Agent & Studio WorkRequest Queue
                </div>
                <div className="space-y-2">
                  {workRequests.map((wr) => (
                    <div
                      key={wr.id}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-cyan-400 uppercase">{wr.studio_slug}</span>
                        <span
                          className={
                            wr.status === "done"
                              ? "text-emerald-400"
                              : wr.status === "running"
                              ? "text-cyan-300"
                              : "text-amber-400"
                          }
                        >
                          {wr.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-200 line-clamp-2">{wr.objective}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
