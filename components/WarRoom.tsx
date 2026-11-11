"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  isWikiPageVisibleToAgents,
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

const OWNER_SESSION_KEY = "OWNER_KEY";

function getStoredOwnerKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return (
      window.sessionStorage.getItem(OWNER_SESSION_KEY) ||
      window.sessionStorage.getItem("x-owner-key") ||
      window.sessionStorage.getItem("owner_key") ||
      window.sessionStorage.getItem("cortex_owner_key") ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

function setStoredOwnerKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = key.trim();
    window.sessionStorage.setItem(OWNER_SESSION_KEY, trimmed);
    window.sessionStorage.setItem("x-owner-key", trimmed);
  } catch {
    // Ignore storage errors
  }
}

function clearStoredOwnerKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(OWNER_SESSION_KEY);
    window.sessionStorage.removeItem("x-owner-key");
    window.sessionStorage.removeItem("owner_key");
    window.sessionStorage.removeItem("cortex_owner_key");
  } catch {
    // Ignore storage errors
  }
}

function buildMutationHeaders(): Record<string, string> {
  const key = getStoredOwnerKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (key) {
    headers["x-owner-key"] = key;
  }
  return headers;
}

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
  // Core CortexOS Domain State (React cache hydrated from PostgreSQL source of truth)
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
  const [dbNeighbors, setDbNeighbors] = useState<
    Array<{
      depth: number;
      edge_type: string;
      direction: "outgoing" | "incoming";
      neighbor_id: string;
      neighbor_label: string;
      confidence: number;
    }> | null
  >(null);

  // New Project Modal State
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  // Owner Key Unlock Modal State (sessionStorage only)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [ownerKeyInput, setOwnerKeyInput] = useState("");
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState(false);
  const [unlockPromptReason, setUnlockPromptReason] = useState<string | null>(null);

  // Right Panel (Studio Workbench) State
  const [rightPanelMode, setRightPanelMode] = useState<"docked" | "wide" | "detached" | "collapsed">("docked");
  const [selectedStudioSlug, setSelectedStudioSlug] = useState<StudioSlug>("design");
  const [activePackFile, setActivePackFile] = useState<
    "agent_md" | "mission_md" | "rules_md" | "constraints_md" | "knowledge_md"
  >("agent_md");
  const [editingPackContent, setEditingPackContent] = useState<string | null>(null);

  // Sync all domain tables from PostgreSQL backend
  const syncFromDatabase = useCallback(async () => {
    try {
      const res = await fetch("/api/projects?include=all", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.projects) && data.projects.length > 0) setProjects(data.projects);
      if (Array.isArray(data.studios) && data.studios.length > 0) setStudios(data.studios);
      if (Array.isArray(data.sources)) setSources(data.sources);
      if (Array.isArray(data.artifacts)) setArtifacts(data.artifacts);
      if (Array.isArray(data.entities)) setEntities(data.entities);
      if (Array.isArray(data.concepts)) setConcepts(data.concepts);
      if (Array.isArray(data.decisions)) setDecisions(data.decisions);
      if (Array.isArray(data.wikiPages)) setWikiPages(data.wikiPages);
      if (Array.isArray(data.claims)) setClaims(data.claims);
      if (Array.isArray(data.relationships)) setRelationships(data.relationships);
      if (Array.isArray(data.workRequests)) setWorkRequests(data.workRequests);
      if (Array.isArray(data.events)) setEvents(data.events);
      if (Array.isArray(data.auditFindings)) setAuditFindings(data.auditFindings);
      if (Array.isArray(data.councilMessages)) setCouncilMessages(data.councilMessages);
    } catch {
      // Fallback to current cache if transient error
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setIsOwnerUnlocked(Boolean(getStoredOwnerKey()));
        void syncFromDatabase();
      }
    });
    return () => {
      active = false;
    };
  }, [syncFromDatabase]);

  // Fetch 2-hop graph_neighbors() from PostgreSQL when neighborRootId changes
  useEffect(() => {
    let active = true;
    fetch(`/api/graph/${encodeURIComponent(neighborRootId)}?depth=2`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data && Array.isArray(data.neighbors)) {
          setDbNeighbors(data.neighbors);
        }
      })
      .catch(() => {
        // Ignore
      });
    return () => {
      active = false;
    };
  }, [neighborRootId, relationships.length]);

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

  const computedNeighbors = useMemo(() => {
    if (dbNeighbors && dbNeighbors.length > 0) return dbNeighbors;
    return findGraphNeighbors(neighborRootId, relationships, 2);
  }, [dbNeighbors, neighborRootId, relationships]);

  const showBanner = (type: "info" | "success" | "warning", text: string) => {
    setStatusBanner({ type, text });
  };

  const handleUnauthorizedResponse = useCallback((actionLabel?: string) => {
    clearStoredOwnerKey();
    setIsOwnerUnlocked(false);
    setStatusBanner(null);
    setUnlockPromptReason(
      actionLabel
        ? `Authentication required (401): enter OWNER_KEY to authorize "${actionLabel}".`
        : "Authentication required (401): enter a valid OWNER_KEY to authorize mutations."
    );
    setIsUnlockModalOpen(true);
  }, []);

  const handleUnlockSession = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = ownerKeyInput.trim();
    if (!trimmed) return;
    setStoredOwnerKey(trimmed);
    setIsOwnerUnlocked(true);
    setOwnerKeyInput("");
    setUnlockPromptReason(null);
    setStatusBanner(null);
    setIsUnlockModalOpen(false);
  };

  const handleClearOwnerSession = () => {
    clearStoredOwnerKey();
    setIsOwnerUnlocked(false);
    setOwnerKeyInput("");
    setUnlockPromptReason(null);
    setIsUnlockModalOpen(false);
  };

  // --------------------------------------------------------------------------
  // HANDLER 1: Jarvis Lifecycle Phase Transition (Enforces Quality Gates + DB)
  // --------------------------------------------------------------------------
  const handleSelectPhase = async (targetPhase: StudioSlug) => {
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

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}`, {
        method: "PATCH",
        headers: buildMutationHeaders(),
        body: JSON.stringify({ current_phase: targetPhase }),
      });

      if (res.status === 401) {
        handleUnauthorizedResponse(`Transition Phase to ${targetPhase}`);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showBanner("warning", errData.error || "Failed to transition lifecycle phase.");
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
      await syncFromDatabase();
    } catch (err: unknown) {
      showBanner("warning", (err as Error).message || "Failed to transition phase.");
    }
  };

  // --------------------------------------------------------------------------
  // HANDLER 2: Chief Librarian Source Ingestion (POST /api/sources -> Postgres)
  // --------------------------------------------------------------------------
  const handleIngestSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceTitle.trim() || !newSourceContent.trim()) {
      showBanner(
        "warning",
        "Please provide both a Source Title and Raw Content for Chief Librarian ingestion."
      );
      return;
    }

    setIsIngestingSource(true);
    const cleanTitle = newSourceTitle.startsWith("R - ")
      ? newSourceTitle.trim()
      : `R - ${newSourceTitle.trim()}`;

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: buildMutationHeaders(),
        body: JSON.stringify({
          title: cleanTitle,
          kind: newSourceKind,
          uri: newSourceUri.trim() || null,
          raw_content: newSourceContent,
          project_id: activeProject.id,
          trust: newSourceTrust,
        }),
      });

      if (res.status === 401) {
        handleUnauthorizedResponse("Ingest Source");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        showBanner("warning", data.error || `Failed to ingest source (${res.status}).`);
        return;
      }

      await syncFromDatabase();

      if (data.source?.id) {
        setSelectedSourceId(data.source.id);
        onPublishNodeToBrain({
          id: data.source.id,
          title: cleanTitle,
          category: "Claude memory",
          kind: "memory",
          area: "system",
          summary: `Ingested source (${newSourceKind}, trust=${newSourceTrust})`,
          notes: newSourceContent,
          stalenessDays: 0,
          needsAttention: false,
          connections: [],
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
        `Chief Librarian ingested "${cleanTitle}" into PostgreSQL, extracted entities & claims, and rippled updates to LLM Wiki & 3D Brain.`
      );
    } catch (err: unknown) {
      const error = err as Error;
      showBanner("warning", error.message || "Failed to ingest source.");
    } finally {
      setIsIngestingSource(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLER 3: Jarvis Supervisor Council & WorkRequest Orchestration (Postgres)
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

    setIsOrchestrating(true);

    try {
      const res = await fetch("/api/jarvis/orchestrate", {
        method: "POST",
        headers: buildMutationHeaders(),
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

      if (res.status === 401) {
        handleUnauthorizedResponse("Dispatch Jarvis Directive");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        showBanner("warning", data.error || "Jarvis orchestration failed.");
        return;
      }

      setJarvisDirective("");
      await syncFromDatabase();

      if (data.persisted?.artifact?.id) {
        const persistedArt = data.persisted.artifact;
        setSelectedArtifactId(persistedArt.id);
        onPublishNodeToBrain({
          id: persistedArt.id,
          title: persistedArt.title,
          category: "Projects",
          kind: "project",
          area: "system",
          summary: persistedArt.summary,
          notes: persistedArt.markdown_content || "",
          stalenessDays: 0,
          needsAttention: false,
          connections: [],
          tags: ["artifact", targetStudio.slug],
          x: (Math.random() - 0.5) * 160,
          y: (Math.random() - 0.5) * 120,
          z: (Math.random() - 0.5) * 160,
          radius: 6.5,
          isKeyAnchor: true,
        });
      }

      showBanner(
        "success",
        `Jarvis & ${targetStudio.name} persisted artifact "${data.artifact?.title}" and synced with Chief Librarian.`
      );
    } catch (err: unknown) {
      const error = err as Error;
      showBanner("warning", error.message || "Jarvis orchestration failed.");
    } finally {
      setIsOrchestrating(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLER 4: Approve Artifact (PATCH /api/artifacts/[id] -> Postgres)
  // --------------------------------------------------------------------------
  const handleApproveArtifact = async (artifactId: string) => {
    const nowIso = new Date().toISOString();

    try {
      const res = await fetch(`/api/artifacts/${encodeURIComponent(artifactId)}`, {
        method: "PATCH",
        headers: buildMutationHeaders(),
        body: JSON.stringify({
          status: "approved",
          approved_by: "Ray (Founder) & Jarvis Supervisor",
          approved_at: nowIso,
        }),
      });

      if (res.status === 401) {
        handleUnauthorizedResponse("Approve Artifact");
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showBanner("warning", errData.error || "Artifact approval rejected.");
        return;
      }

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
      await syncFromDatabase();
      showBanner(
        "success",
        "Artifact approved in PostgreSQL with provenance signature (approved_by & approved_at recorded)."
      );
    } catch (err: unknown) {
      showBanner("warning", (err as Error).message || "Failed to approve artifact.");
    }
  };

  // --------------------------------------------------------------------------
  // HANDLER 5: Approve Doctrine Wiki Page (PATCH /api/wiki/[id] -> Postgres)
  // --------------------------------------------------------------------------
  const handleApproveWikiPage = async (pageId: string) => {
    const nowIso = new Date().toISOString();

    try {
      const res = await fetch(`/api/wiki/${encodeURIComponent(pageId)}`, {
        method: "PATCH",
        headers: buildMutationHeaders(),
        body: JSON.stringify({
          review_state: "approved",
          resolved_by: "Ray (Founder)",
        }),
      });

      if (res.status === 401) {
        handleUnauthorizedResponse("Approve Doctrine Page");
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showBanner("warning", errData.error || "Doctrine approval rejected.");
        return;
      }

      setWikiPages((prev) =>
        prev.map((w) =>
          w.id === pageId ? { ...w, review_state: "approved", updated_at: nowIso } : w
        )
      );
      await syncFromDatabase();
      showBanner(
        "success",
        "Doctrine page approved by human owner in PostgreSQL and exposed to Studio agents."
      );
    } catch (err: unknown) {
      showBanner("warning", (err as Error).message || "Failed to approve doctrine page.");
    }
  };

  // --------------------------------------------------------------------------
  // HANDLER 6: Save Studio Environment Pack File
  // --------------------------------------------------------------------------
  const handleSaveStudioPackFile = async () => {
    if (editingPackContent === null) return;
    const nowIso = new Date().toISOString();
    const updatedPack = { ...selectedStudio.pack, [activePackFile]: editingPackContent };

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}`, {
        method: "PATCH",
        headers: buildMutationHeaders(),
        body: JSON.stringify({
          studio_pack_update: {
            studio_slug: selectedStudio.slug,
            pack: updatedPack,
          },
        }),
      });

      if (res.status === 401) {
        handleUnauthorizedResponse("Update Studio Pack");
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showBanner("warning", errData.error || "Failed to save Studio Pack.");
        return;
      }

      setStudios((prev) =>
        prev.map((s) => {
          if (s.slug !== selectedStudio.slug) return s;
          return {
            ...s,
            pack: updatedPack,
            manifest_hash: sha256Hex(JSON.stringify(updatedPack)),
            updated_at: nowIso,
          };
        })
      );
      setEditingPackContent(null);
      showBanner(
        "success",
        `Updated ${activePackFile} in ${selectedStudio.name} and recomputed SHA-256 manifest hash.`
      );
    } catch (err: unknown) {
      showBanner("warning", (err as Error).message || "Failed to save Studio Pack.");
    }
  };

  // --------------------------------------------------------------------------
  // HANDLER 7: Create New Project (POST /api/projects -> Postgres)
  // --------------------------------------------------------------------------
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const slug =
      newProjectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "new-project";

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: buildMutationHeaders(),
        body: JSON.stringify({
          slug,
          name: newProjectName.trim(),
          description:
            newProjectDesc.trim() ||
            "Managed by Jarvis Supervisor across the 7 CortexOS Studios.",
          status: "active",
          current_phase: "discovery",
        }),
      });

      if (res.status === 401) {
        handleUnauthorizedResponse("Create New Project");
        return;
      }

      const created = await res.json();
      if (res.ok && created.id) {
        await syncFromDatabase();
        setActiveProjectId(created.id);
        setIsCreatingProject(false);
        setNewProjectName("");
        setNewProjectDesc("");
        showBanner(
          "success",
          `Created project "${created.name}" in PostgreSQL and initialized Discovery phase.`
        );
      } else {
        showBanner("warning", created.error || "Failed to create project.");
      }
    } catch (err: unknown) {
      showBanner("warning", (err as Error).message || "Failed to create project.");
    }
  };

  const handleResolveAuditFinding = async (findingId: string) => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}`, {
        method: "PATCH",
        headers: buildMutationHeaders(),
        body: JSON.stringify({
          resolve_finding_id: findingId,
          resolved_by: "Ray (Founder)",
        }),
      });

      if (res.status === 401) {
        handleUnauthorizedResponse("Resolve Audit Finding");
        return;
      }

      if (!res.ok) return;

      setAuditFindings((prev) =>
        prev.map((f) =>
          f.id === findingId
            ? {
                ...f,
                status: "resolved",
                resolved_at: new Date().toISOString(),
                resolved_by: "Ray (Founder)",
              }
            : f
        )
      );
      await syncFromDatabase();
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#0c0d0f] text-[#e4e6eb] overflow-hidden">
      {/* ==================================================================== */}
      {/* PINNED JARVIS SUPERVISOR GOVERNANCE BAR                              */}
      {/* ==================================================================== */}
      <div className="shrink-0 px-5 py-2.5 bg-[#0c0d0f] border-b border-[#e4e6eb]/15 flex items-center justify-between gap-3">
        {/* Left: Active Project Selector */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-wider text-[#00ffa3]">
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>JARVIS_SVC</span>
          </div>
          <span className="text-[#e4e6eb]/30" aria-hidden="true">
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
            className="bg-black border border-[#e4e6eb]/20 rounded-[2px] px-2.5 py-1 text-xs font-mono text-white outline-none focus:border-[#00ffa3]"
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
            className="px-2.5 py-1 rounded-[2px] bg-transparent hover:bg-[#e4e6eb]/10 border border-[#e4e6eb]/20 text-[10px] font-mono uppercase tracking-wider text-[#e4e6eb] transition-colors whitespace-nowrap shrink-0"
          >
            + New Project
          </button>
        </div>

        {/* Center: 7-Phase Lifecycle Stepper */}
        <div
          className="flex items-center gap-1 overflow-x-auto py-0.5"
          role="group"
          aria-label="Project Lifecycle Phases"
        >
          {LIFECYCLE_PHASES.map((phase, idx) => {
            const isCurrent = activeProject.current_phase === phase;
            const currentIdx = LIFECYCLE_PHASES.indexOf(activeProject.current_phase);
            const isCompleted = idx < currentIdx;
            return (
              <button
                key={phase}
                type="button"
                onClick={() => handleSelectPhase(phase)}
                className={`px-2.5 py-1 rounded-[2px] text-[10px] font-mono uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  isCurrent
                    ? "bg-[#00ffa3] text-black font-bold"
                    : isCompleted
                    ? "bg-[#003322] text-[#00ffa3] border border-[#00ffa3]/40 hover:bg-[#003322]/80"
                    : "bg-[#e4e6eb]/10 text-[#e4e6eb]/55 hover:text-[#e4e6eb] border border-transparent"
                }`}
              >
                <span className="tabular-nums">{idx + 1}.</span>
                <span>{phase}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Quick Stats, Unlock Button & Right Panel Toggle */}
        <div className="flex items-center gap-2.5 text-[11px] text-[#e4e6eb]/60 font-mono tabular-nums shrink-0">
          <span className="hidden xl:inline">
            {sources.length} SOURCES · {artifacts.length} ARTIFACTS · {wikiPages.length} WIKI PAGES
          </span>
          <button
            type="button"
            onClick={() => {
              setUnlockPromptReason(null);
              setIsUnlockModalOpen(true);
            }}
            aria-label="Unlock"
            className={`px-2.5 py-1 rounded-[2px] border text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              isOwnerUnlocked
                ? "bg-[#003322] border-[#00ffa3] text-[#00ffa3]"
                : "bg-black border-[#e4e6eb]/25 text-[#e4e6eb] hover:border-[#00ffa3] hover:text-[#00ffa3]"
            }`}
          >
            {isOwnerUnlocked ? (
              <Unlock className="w-3 h-3 text-[#00ffa3]" />
            ) : (
              <Lock className="w-3 h-3 text-amber-400" />
            )}
            <span>Unlock</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setRightPanelMode((m) => (m === "collapsed" ? "docked" : "collapsed"))
            }
            aria-label="Toggle Studio Workbench Panel"
            className="p-1.5 rounded-[2px] bg-black border border-[#e4e6eb]/20 text-[#e4e6eb]/80 hover:text-[#00ffa3] hover:border-[#00ffa3] transition-colors"
          >
            {rightPanelMode === "collapsed" ? (
              <PanelRightOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelRightClose className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Owner Key Unlock Modal (sessionStorage only) */}
      {isUnlockModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unlock-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <form
            onSubmit={handleUnlockSession}
            className="w-full max-w-md rounded-[2px] bg-[#0c0d0f] border-[1.5px] border-[#00ffa3] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="unlock-modal-title"
                  className="text-sm font-mono font-bold uppercase tracking-wider text-[#00ffa3] flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>Unlock Owner Session</span>
                </h2>
                <p className="text-xs text-[#e4e6eb]/65 mt-1">
                  Enter the <code className="text-[#00ffa3]">OWNER_KEY</code> once to authorize
                  mutating requests (POST / PATCH / DELETE). Stored in{" "}
                  <code className="text-[#00ffa3]">sessionStorage</code> only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUnlockModalOpen(false)}
                className="text-xs font-mono text-[#e4e6eb]/55 hover:text-white"
              >
                Close
              </button>
            </div>

            {unlockPromptReason && (
              <div
                role="alert"
                className="p-2.5 rounded-[2px] bg-amber-950/70 border border-amber-500/50 text-xs font-mono text-amber-200"
              >
                {unlockPromptReason}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="war-room-owner-key-input"
                className="block text-[10px] font-mono uppercase tracking-wider text-[#e4e6eb]/70"
              >
                Owner Key
              </label>
              <input
                id="war-room-owner-key-input"
                type="password"
                aria-label="Owner Key"
                placeholder="Enter OWNER_KEY..."
                value={ownerKeyInput}
                onChange={(e) => setOwnerKeyInput(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 rounded-[2px] bg-black border border-[#e4e6eb]/30 text-xs font-mono text-[#00ffa3] placeholder-[#e4e6eb]/35 outline-none focus:border-[#00ffa3]"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {isOwnerUnlocked ? (
                <button
                  type="button"
                  onClick={handleClearOwnerSession}
                  className="px-3 py-1.5 rounded-[2px] bg-black border border-rose-500/50 text-[10px] font-mono uppercase tracking-wider text-rose-300 hover:bg-rose-950/50"
                >
                  Clear Session Key
                </button>
              ) : (
                <span className="text-[10px] font-mono text-[#e4e6eb]/45">
                  Session currently locked
                </span>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsUnlockModalOpen(false)}
                  className="px-3 py-1.5 rounded-[2px] bg-transparent border border-[#e4e6eb]/20 text-[10px] font-mono uppercase tracking-wider text-[#e4e6eb]/70 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[2px] bg-[#00ffa3] hover:brightness-110 text-black font-mono font-extrabold text-[11px] uppercase tracking-wider"
                >
                  Save &amp; Unlock
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Status Notification Bar */}
      {statusBanner && (
        <div
          role="status"
          className={`shrink-0 px-5 py-2 border-b text-xs font-mono flex items-center justify-between gap-4 ${
            statusBanner.type === "warning"
              ? "bg-amber-950/80 border-amber-500/50 text-amber-200"
              : statusBanner.type === "success"
              ? "bg-[#003322] border-[#00ffa3]/50 text-[#00ffa3]"
              : "bg-black border-[#e4e6eb]/20 text-[#e4e6eb]"
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
          className="shrink-0 px-5 py-3 bg-black border-b border-[#e4e6eb]/20 flex flex-wrap items-center gap-3"
        >
          <span className="text-xs font-mono uppercase tracking-wider text-[#00ffa3]">
            Initialize New CortexOS Project:
          </span>
          <input
            type="text"
            placeholder="Project Name (e.g., FinTech Autonomous Treasury)"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="px-3 py-1.5 rounded-[2px] bg-[#0c0d0f] border border-[#e4e6eb]/25 text-xs font-mono text-white outline-none focus:border-[#00ffa3] min-w-[240px]"
          />
          <input
            type="text"
            placeholder="Brief scope or industry description..."
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
            className="px-3 py-1.5 rounded-[2px] bg-[#0c0d0f] border border-[#e4e6eb]/25 text-xs font-mono text-white outline-none focus:border-[#00ffa3] flex-1 min-w-[240px]"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-[2px] bg-[#00ffa3] text-black font-extrabold text-[11px] uppercase tracking-wider whitespace-nowrap"
          >
            Create &amp; Start Discovery
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingProject(false)}
            className="px-2.5 py-1.5 text-xs font-mono text-[#e4e6eb]/60 hover:text-white"
          >
            Cancel
          </button>
        </form>
      )}

      {/* ==================================================================== */}
      {/* THREE-COLUMN WAR ROOM WORKSPACE (320px · 1fr · 320px)                */}
      {/* ==================================================================== */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* ------------------------------------------------------------------ */}
        {/* LEFT PANEL: [01] RESEARCH SOURCES                                  */}
        {/* ------------------------------------------------------------------ */}
        <aside
          aria-label="Research and Sources Panel"
          className="w-80 shrink-0 border-r border-[#e4e6eb]/15 bg-[#0c0d0f] flex flex-col min-h-0"
        >
          <div className="p-4 border-b border-[#e4e6eb]/15 bg-white/[0.02] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#e4e6eb]">
                  01. Research Sources
                </h2>
                <p className="text-[10px] font-mono text-[#e4e6eb]/50 mt-0.5">
                  Immutable Layer 1 (`brain/raw/`) · Chief Librarian
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingSource(!isAddingSource)}
                className="px-3 py-1.5 rounded-[2px] bg-transparent border border-[#00ffa3] text-[#00ffa3] hover:bg-[#003322] font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>Add Source</span>
              </button>
            </div>

            {/* Search & Trust Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#e4e6eb]/40 absolute left-2.5 top-2" />
                <input
                  type="text"
                  aria-label="Search Knowledge Sources"
                  placeholder="SEARCH HASHES..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-[2px] bg-black border border-[#e4e6eb]/15 font-mono text-[11px] text-[#00ffa3] placeholder-[#e4e6eb]/35 outline-none focus:border-[#00ffa3]"
                />
              </div>
              <select
                aria-label="Filter Source Trust Level"
                value={trustFilter}
                onChange={(e) => setTrustFilter(e.target.value as "all" | TrustLevel)}
                className="bg-black border border-[#e4e6eb]/15 rounded-[2px] px-2 py-1.5 font-mono text-[10px] uppercase text-[#e4e6eb]/80 outline-none focus:border-[#00ffa3]"
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
              className="p-4 border-b border-[#e4e6eb]/15 bg-black space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#00ffa3]">
                  Ingest Source via Chief Librarian
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingSource(false)}
                  className="text-xs font-mono text-[#e4e6eb]/50 hover:text-white"
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
                className="w-full px-2.5 py-1.5 rounded-[2px] bg-[#0c0d0f] border border-[#e4e6eb]/20 text-xs font-mono text-white outline-none focus:border-[#00ffa3]"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="New Source Kind"
                  value={newSourceKind}
                  onChange={(e) => setNewSourceKind(e.target.value as SourceKind)}
                  className="px-2 py-1.5 rounded-[2px] bg-[#0c0d0f] border border-[#e4e6eb]/20 text-xs font-mono text-[#e4e6eb] outline-none"
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
                  className="px-2 py-1.5 rounded-[2px] bg-[#0c0d0f] border border-[#e4e6eb]/20 text-xs font-mono text-[#e4e6eb] outline-none"
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
                className="w-full px-2.5 py-1.5 rounded-[2px] bg-[#0c0d0f] border border-[#e4e6eb]/20 text-xs font-mono text-white outline-none focus:border-[#00ffa3]"
              />
              <textarea
                rows={4}
                aria-label="Raw Source Content"
                placeholder="Paste raw markdown, research findings, or transcript text. Chief Librarian will compute SHA-256, extract Entities/Concepts with verbatim quotes, and ripple into the LLM Wiki..."
                value={newSourceContent}
                onChange={(e) => setNewSourceContent(e.target.value)}
                className="w-full p-2.5 rounded-[2px] bg-[#0c0d0f] border border-[#e4e6eb]/20 text-xs text-[#e4e6eb] outline-none focus:border-[#00ffa3] font-mono"
              />
              <button
                type="submit"
                disabled={isIngestingSource}
                className="w-full py-2 rounded-[2px] bg-[#00ffa3] hover:brightness-110 disabled:opacity-50 text-black font-extrabold text-[11px] uppercase tracking-wider transition-all"
              >
                {isIngestingSource
                  ? "Chief Librarian Extracting & Rippling..."
                  : "Ingest & Ripple into Brain"}
              </button>
            </form>
          )}

          {/* Sources List (Vertical Stack) */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#e4e6eb]/10 [scrollbar-width:thin] [scrollbar-color:rgba(228,230,235,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e4e6eb]/20 hover:[&::-webkit-scrollbar-thumb]:bg-[#00ffa3]/60">
            {filteredSources.map((src) => {
              const isSelected = selectedSource?.id === src.id;
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setSelectedSourceId(src.id)}
                  className={`block w-full text-left px-5 py-3 transition-colors ${
                    isSelected
                      ? "bg-white/[0.06] ring-1 ring-inset ring-[#00ffa3]/50"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="text-xs font-mono font-bold text-[#e4e6eb] line-clamp-1">
                    {src.title}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#e4e6eb]/50 tabular-nums">
                    <span
                      className={
                        src.trust === "trusted" ? "text-[#00ffa3]" : "text-amber-400"
                      }
                    >
                      {src.trust}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{src.kind}</span>
                    <span aria-hidden="true">·</span>
                    <span>{src.content_hash.slice(0, 8)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Source Immutable Inspector Footer */}
          {selectedSource && (
            <div className="p-4 border-t border-[#e4e6eb]/15 bg-black space-y-2 shrink-0 [scrollbar-width:thin] [scrollbar-color:rgba(228,230,235,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e4e6eb]/20">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-[#e4e6eb]/50">
                <span className="truncate">{selectedSource.storage_path}</span>
                <span className="text-[#00ffa3] shrink-0">{selectedSource.ingest_status}</span>
              </div>
              <pre className="h-36 overflow-y-auto text-[10px] text-[#88edff] font-mono whitespace-pre-wrap leading-relaxed bg-[#050608] p-3 rounded-[4px] border border-[#e4e6eb]/15 [scrollbar-width:thin] [scrollbar-color:rgba(228,230,235,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e4e6eb]/20 hover:[&::-webkit-scrollbar-thumb]:bg-[#00ffa3]/60">
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
          className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0c0d0f] border-r border-[#e4e6eb]/15"
        >
          {/* Center Panel Mode Tabs */}
          <div className="shrink-0 px-5 py-3 border-b border-[#e4e6eb]/15 bg-white/[0.02] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-0.5 bg-black border border-[#e4e6eb]/15">
              <button
                type="button"
                onClick={() => setCenterTab("council")}
                className={`px-3 py-1 rounded-[2px] text-[10px] font-mono uppercase tracking-wider transition-colors whitespace-nowrap ${
                  centerTab === "council"
                    ? "bg-[#00ffa3] text-black font-bold"
                    : "text-[#e4e6eb]/70 hover:text-white"
                }`}
              >
                Agent Council ({projectMessages.length})
              </button>
              <button
                type="button"
                onClick={() => setCenterTab("artifacts")}
                className={`px-3 py-1 rounded-[2px] text-[10px] font-mono uppercase tracking-wider transition-colors whitespace-nowrap ${
                  centerTab === "artifacts"
                    ? "bg-[#00ffa3] text-black font-bold"
                    : "text-[#e4e6eb]/70 hover:text-white"
                }`}
              >
                Artifacts &amp; Gates ({projectArtifacts.length})
              </button>
              <button
                type="button"
                onClick={() => setCenterTab("wiki")}
                className={`px-3 py-1 rounded-[2px] text-[10px] font-mono uppercase tracking-wider transition-colors whitespace-nowrap ${
                  centerTab === "wiki"
                    ? "bg-[#00ffa3] text-black font-bold"
                    : "text-[#e4e6eb]/70 hover:text-white"
                }`}
              >
                LLM Wiki &amp; Claims ({wikiPages.length})
              </button>
              <button
                type="button"
                onClick={() => setCenterTab("schema")}
                className={`px-3 py-1 rounded-[2px] text-[10px] font-mono uppercase tracking-wider transition-colors whitespace-nowrap ${
                  centerTab === "schema"
                    ? "bg-[#00ffa3] text-black font-bold"
                    : "text-[#e4e6eb]/70 hover:text-white"
                }`}
              >
                Schema &amp; Audit ({auditFindings.filter((f) => f.status === "open").length})
              </button>
            </div>

            <button
              type="button"
              onClick={onSwitchToBrainMode}
              className="px-3 py-1.5 rounded-[2px] bg-transparent hover:bg-white/[0.05] border border-[#e4e6eb]/20 text-[10px] font-mono uppercase tracking-wider text-[#00ffa3] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Inspect in 3D Brain</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* ================================================================ */}
          {/* TAB 1: AGENT COUNCIL & MISSION CONTROL                           */}
          {/* ================================================================ */}
          {centerTab === "council" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Pinned Jarvis Executive Summary Card */}
              <div className="shrink-0 mx-5 mt-4 p-3.5 rounded-[2px] bg-white/[0.02] border border-[#e4e6eb]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] text-[#00ffa3] font-mono uppercase tracking-wider">
                    <span>JARVIS SUPERVISOR · EXECUTIVE SUMMARY</span>
                    <span aria-hidden="true">·</span>
                    <span>PHASE: {activeProject.current_phase.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-[#e4e6eb]/80">
                    {activeProject.description}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-[#e4e6eb]/60 shrink-0">
                  <span>
                    Approved Gates:{" "}
                    <strong className="text-[#00ffa3]">
                      {projectArtifacts.filter((a) => a.status === "approved").length}/
                      {projectArtifacts.length}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    ADRs: <strong className="text-white">{projectDecisions.length}</strong>
                  </span>
                </div>
              </div>

              {/* Council Stream */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 [scrollbar-width:thin] [scrollbar-color:rgba(228,230,235,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e4e6eb]/20 hover:[&::-webkit-scrollbar-thumb]:bg-[#00ffa3]/60">
                {projectMessages.map((msg) => {
                  const isJarvis = msg.speaker_role === "jarvis";
                  const isLibrarian = msg.speaker_role === "librarian";
                  const isUser = msg.speaker_role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-[2px] border ${
                        isJarvis
                          ? "bg-[#003322]/65 border-[#00ffa3]/60"
                          : isLibrarian
                          ? "bg-[#9d00ff]/[0.06] border-[#9d00ff]/50"
                          : isUser
                          ? "bg-black border-[#e4e6eb]/25"
                          : "bg-white/[0.02] border-[#e4e6eb]/15"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
                          <span
                            className={`font-bold ${
                              isJarvis
                                ? "text-[#00ffa3]"
                                : isLibrarian
                                ? "text-[#c084fc]"
                                : "text-[#e4e6eb]"
                            }`}
                          >
                            {msg.speaker_name}
                          </span>
                          {msg.studio_name && (
                            <>
                              <span className="text-[#e4e6eb]/30" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-[#00ffa3]">{msg.studio_name}</span>
                            </>
                          )}
                          {isJarvis && (
                            <>
                              <span className="text-[#e4e6eb]/30" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-[#00ffa3]">Governor &amp; Router</span>
                            </>
                          )}
                          {isLibrarian && (
                            <>
                              <span className="text-[#e4e6eb]/30" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-[#c084fc]">Memory OS Gate</span>
                            </>
                          )}
                        </div>
                        <span className="text-[10px] font-mono tabular-nums text-[#e4e6eb]/50">
                          {msg.timestamp}
                        </span>
                      </div>

                      <p className="text-[13px] text-[#e4e6eb] leading-relaxed">
                        {renderFormattedText(msg.content)}
                      </p>

                      {(msg.artifacts_produced?.length ||
                        msg.decisions_logged?.length ||
                        msg.wiki_ripples?.length) && (
                        <div className="mt-3 pt-2.5 border-t border-[#e4e6eb]/15 flex flex-wrap items-center gap-3 text-[10px] font-mono text-[#e4e6eb]/60">
                          {msg.artifacts_produced?.map((art) => (
                            <button
                              key={art}
                              type="button"
                              onClick={() => setCenterTab("artifacts")}
                              className="text-[#00ffa3] hover:underline flex items-center gap-1"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>[VIEW_ARTIFACT: {art}]</span>
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
                              className="text-[#c084fc] hover:underline"
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
                className="shrink-0 p-5 bg-[#0c0d0f] border-t-[1.5px] border-[#e4e6eb] space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="jarvis-studio-target"
                      className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#e4e6eb]/55"
                    >
                      Target Studio:
                    </label>
                    <select
                      id="jarvis-studio-target"
                      value={targetStudioOverride}
                      onChange={(e) =>
                        setTargetStudioOverride(e.target.value as "auto" | StudioSlug)
                      }
                      className="bg-black border border-[#e4e6eb]/20 rounded-[2px] px-2.5 py-1 text-[11px] font-mono text-[#00ffa3] outline-none focus:border-[#00ffa3]"
                    >
                      <option value="auto">
                        AUTO ({activeProject.current_phase.toUpperCase()})
                      </option>
                      {studios.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.name} ({s.agent_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Directives */}
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() =>
                        setJarvisDirective(
                          "Generate OpenAPI 3.1 contract for /librarian/ingest and /brain/search endpoints"
                        )
                      }
                      className="px-2.5 py-1 rounded-[2px] bg-transparent hover:bg-white/[0.05] border border-[#e4e6eb]/20 text-[10px] font-mono uppercase text-[#e4e6eb] whitespace-nowrap"
                    >
                      + OpenAPI
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setJarvisDirective(
                          "Design NEM 3.0 solar + battery payback comparison UI component contract"
                        )
                      }
                      className="px-2.5 py-1 rounded-[2px] bg-transparent hover:bg-white/[0.05] border border-[#e4e6eb]/20 text-[10px] font-mono uppercase text-[#e4e6eb] whitespace-nowrap"
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
                      className="px-2.5 py-1 rounded-[2px] bg-transparent hover:bg-white/[0.05] border border-[#e4e6eb]/20 text-[10px] font-mono uppercase text-[#e4e6eb] whitespace-nowrap"
                    >
                      + QA Gate
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    aria-label="Command Jarvis Supervisor"
                    placeholder="CMD: System instruction (e.g., 'Design the satellite roof array wireframe spec')..."
                    value={jarvisDirective}
                    onChange={(e) => setJarvisDirective(e.target.value)}
                    className="flex-1 p-3 rounded-[4px] bg-[#111] border-[1.5px] border-[#e4e6eb] text-xs font-mono text-white placeholder-[#e4e6eb]/40 outline-none focus:border-[#00ffa3]"
                  />
                  <button
                    type="submit"
                    disabled={isOrchestrating}
                    className="px-6 py-3 rounded-[2px] bg-[#00ffa3] hover:brightness-110 disabled:opacity-50 text-black font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isOrchestrating ? "Orchestrating..." : "Dispatch"}</span>
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
              <div className="lg:col-span-5 border-r border-[#e4e6eb]/15 overflow-y-auto divide-y divide-[#e4e6eb]/10">
                {artifacts.map((art) => {
                  const isSel = selectedArtifact?.id === art.id;
                  return (
                    <button
                      key={art.id}
                      type="button"
                      onClick={() => setSelectedArtifactId(art.id)}
                      className={`block w-full text-left p-4 transition-colors ${
                        isSel
                          ? "bg-white/[0.06] ring-1 ring-inset ring-[#00ffa3]/50"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-[#00ffa3]">
                          {art.artifact_type} · v{art.version}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase ${
                            art.status === "approved"
                              ? "text-[#00ffa3]"
                              : art.status === "in_review"
                              ? "text-amber-400"
                              : "text-[#e4e6eb]/50"
                          }`}
                        >
                          {art.status}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white mt-1">
                        {art.title}
                      </div>
                      <p className="text-xs text-[#e4e6eb]/65 mt-1 line-clamp-2">
                        {art.summary}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-mono tabular-nums text-[#e4e6eb]/50">
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
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#e4e6eb]/15">
                    <div>
                      <div className="text-xs font-mono text-[#00ffa3]">
                        {selectedArtifact.storage_path}
                      </div>
                      <h3 className="text-lg font-bold text-white mt-1">
                        {selectedArtifact.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-[#e4e6eb]/60">
                        <span>Type: {selectedArtifact.artifact_type}</span>
                        <span aria-hidden="true">·</span>
                        <span>Status: {selectedArtifact.status}</span>
                        {selectedArtifact.approved_by && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#00ffa3]">
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
                        className="px-4 py-2 rounded-[2px] bg-[#00ffa3] hover:brightness-110 text-black font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve Artifact (Unlock Gate)</span>
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-[#00ffa3] flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Gate Verified</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#e4e6eb]/70">
                      Artifact Markdown Specification
                    </div>
                    <pre className="p-4 rounded-[4px] bg-black border border-[#e4e6eb]/15 text-xs font-mono text-[#88edff] whitespace-pre-wrap leading-relaxed">
                      {selectedArtifact.markdown_content}
                    </pre>
                  </div>

                  {selectedArtifact.body && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-[#e4e6eb]/70">
                        Structured JSON Payload (`artifacts.body`)
                      </div>
                      <pre className="p-3.5 rounded-[4px] bg-black border border-[#e4e6eb]/15 text-xs font-mono text-[#00ffa3] whitespace-pre-wrap">
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
              <div className="lg:col-span-5 border-r border-[#e4e6eb]/15 flex flex-col min-h-0">
                <div className="p-3.5 border-b border-[#e4e6eb]/15 flex items-center justify-between bg-black">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#e4e6eb]">
                    Karpathy LLM Wiki (`brain/wiki/`)
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] font-mono text-[#e4e6eb]/75 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyAgentVisibleWiki}
                      onChange={(e) => setOnlyAgentVisibleWiki(e.target.checked)}
                      className="rounded border-[#e4e6eb]/30"
                    />
                    <span>`agent_visible_wiki_pages` only</span>
                  </label>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[#e4e6eb]/10">
                  {displayedWikiPages.map((page) => {
                    const visible = isWikiPageVisibleToAgents(page);
                    const isSel = selectedWikiPage?.id === page.id;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => setSelectedWikiId(page.id)}
                        className={`block w-full text-left p-3.5 transition-colors ${
                          isSel
                            ? "bg-white/[0.06] ring-1 ring-inset ring-[#00ffa3]/50"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="text-[#00ffa3]">wiki/{page.path}</span>
                          <span className={visible ? "text-[#00ffa3]" : "text-amber-400"}>
                            {visible ? "Agent-Visible" : "Hidden (Needs Approval)"}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-white mt-1">
                          {page.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-[#e4e6eb]/55">
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
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#e4e6eb]/15">
                    <div>
                      <div className="text-xs font-mono text-[#c084fc]">
                        brain/wiki/{selectedWikiPage.path} · v{selectedWikiPage.current_version}
                      </div>
                      <h3 className="text-lg font-bold text-white mt-1">
                        {selectedWikiPage.title}
                      </h3>
                      <p className="text-xs text-[#e4e6eb]/65 mt-1">
                        {selectedWikiPage.summary}
                      </p>
                    </div>

                    {selectedWikiPage.requires_approval &&
                      selectedWikiPage.review_state !== "approved" && (
                        <button
                          type="button"
                          onClick={() => handleApproveWikiPage(selectedWikiPage.id)}
                          className="px-4 py-2 rounded-[2px] bg-[#00ffa3] hover:brightness-110 text-black font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Approve Doctrine (Expose to Agents)</span>
                        </button>
                      )}
                  </div>

                  <pre className="p-4 rounded-[4px] bg-black border border-[#e4e6eb]/15 text-xs font-mono text-[#88edff] whitespace-pre-wrap leading-relaxed">
                    {selectedWikiPage.markdown_body}
                  </pre>

                  {/* Provenance Claims Table */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-white">
                      Provenance Claims Ledger (`claims` Table — Zero Editorial Trap Guarantee)
                    </h4>
                    <div className="border border-[#e4e6eb]/15 rounded-[2px] overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-black border-b border-[#e4e6eb]/15 text-[#e4e6eb]/60 font-mono text-[10px] uppercase">
                            <th className="py-2 px-3">Verbatim Claim / Evidence</th>
                            <th className="py-2 px-3">Provenance Ref</th>
                            <th className="py-2 px-3 text-right">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e4e6eb]/10">
                          {claims.map((c) => (
                            <tr key={c.id} className="hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3 text-[#e4e6eb]">{c.claim_text}</td>
                              <td className="py-2.5 px-3 font-mono text-[#00ffa3]">
                                {c.source_id || c.artifact_id} ({c.locator})
                              </td>
                              <td className="py-2.5 px-3 font-mono tabular-nums text-right text-[#00ffa3]">
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
                      Chief Librarian Health &amp; Drift Audit Findings (`audit_findings`)
                    </h3>
                    <p className="text-xs text-[#e4e6eb]/60">
                      Detects conflicting architecture, unapproved doctrines, orphan pages, and stale claims.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {auditFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="p-4 rounded-[2px] bg-white/[0.02] border border-[#e4e6eb]/15 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-amber-400">{finding.finding_type}</span>
                        <span
                          className={
                            finding.status === "resolved"
                              ? "text-[#00ffa3]"
                              : "text-amber-300"
                          }
                        >
                          {finding.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {finding.object_title}
                      </div>
                      <p className="text-xs text-[#e4e6eb]/80">
                        {finding.details.description}
                      </p>
                      <div className="text-[11px] font-mono text-[#00ffa3]">
                        Fix: {finding.details.recommended_fix}
                      </div>
                      {finding.status === "open" && (
                        <button
                          type="button"
                          onClick={() => void handleResolveAuditFinding(finding.id)}
                          className="mt-2 px-3 py-1 rounded-[2px] bg-black border border-[#00ffa3] text-[10px] font-mono uppercase text-[#00ffa3]"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cycle-Safe Graph Neighbors Explorer */}
              <div className="p-4 rounded-[2px] bg-white/[0.02] border border-[#e4e6eb]/15 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      PostgreSQL Recursive Graph Walk (`graph_neighbors(start_id, max_depth=2)`)
                    </h4>
                    <p className="text-[11px] text-[#e4e6eb]/60">
                      Cycle-safe bidirectional traversal over the `relationships` table.
                    </p>
                  </div>
                  <select
                    aria-label="Select Graph Walk Start Node"
                    value={neighborRootId}
                    onChange={(e) => setNeighborRootId(e.target.value)}
                    className="bg-black border border-[#e4e6eb]/20 rounded-[2px] px-2.5 py-1 text-xs text-[#00ffa3] font-mono"
                  >
                    <option value="proj-cortex-os">proj-cortex-os (CortexOS v1)</option>
                    <option value="art-librarian-prd">art-librarian-prd (Librarian PRD)</option>
                    <option value="proj-solar-crm">proj-solar-crm (Helios Solar CRM)</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  {computedNeighbors.map((n, idx) => {
                    const objId =
                      "neighbor_id" in n
                        ? (n as { neighbor_id: string; neighbor_label?: string }).neighbor_label ||
                          (n as { neighbor_id: string }).neighbor_id
                        : (n as { object_id: string }).object_id;
                    return (
                      <div
                        key={`${objId}-${idx}`}
                        className="px-3 py-1.5 rounded-[2px] bg-black border border-[#e4e6eb]/15 text-xs font-mono tabular-nums"
                      >
                        <span className="text-[#00ffa3]">{objId}</span>
                        <span className="text-[#e4e6eb]/40 mx-1.5">·</span>
                        <span className="text-[#e4e6eb]/80">depth={n.depth}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transactional Outbox Events Table */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-white">
                  Transactional Event Outbox (`events` Table — `FOR UPDATE SKIP LOCKED`)
                </h4>
                <div className="border border-[#e4e6eb]/15 rounded-[2px] overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-black border-b border-[#e4e6eb]/15 text-[#e4e6eb]/60">
                        <th className="py-2 px-3">ID</th>
                        <th className="py-2 px-3">Event Type</th>
                        <th className="py-2 px-3">Idempotency Key</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Attempts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e4e6eb]/10">
                      {events.map((ev) => (
                        <tr key={ev.id} className="hover:bg-white/[0.02]">
                          <td className="py-2 px-3 text-[#e4e6eb]/50">#{ev.id}</td>
                          <td className="py-2 px-3 text-[#00ffa3]">{ev.event_type}</td>
                          <td className="py-2 px-3 text-[#e4e6eb]">{ev.idempotency_key}</td>
                          <td className="py-2 px-3 text-[#00ffa3]">{ev.status}</td>
                          <td className="py-2 px-3 text-right text-[#e4e6eb]/70">
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
                ? "fixed right-5 top-28 bottom-6 w-[420px] z-40 rounded-[2px] shadow-2xl border border-[#00ffa3]"
                : rightPanelMode === "wide"
                ? "w-[420px]"
                : "w-80"
            } shrink-0 bg-[#0c0d0f] flex flex-col min-h-0 overflow-hidden`}
          >
            {/* Workbench Header with Studio Selector */}
            <div className="p-4 border-b border-[#e4e6eb]/15 bg-white/[0.02] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#e4e6eb]/55">
                  STUDIO WORKBENCH
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setRightPanelMode((m) => (m === "wide" ? "docked" : "wide"))
                    }
                    title="Resize Workbench Width"
                    aria-label="Resize Workbench Width"
                    className="p-1 rounded-[2px] bg-black border border-[#e4e6eb]/20 text-[#e4e6eb]/70 hover:text-white text-xs"
                  >
                    {rightPanelMode === "wide" ? (
                      <Minimize2 className="w-3 h-3" />
                    ) : (
                      <Maximize2 className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRightPanelMode((m) => (m === "detached" ? "docked" : "detached"))
                    }
                    className="px-2 py-0.5 rounded-[2px] bg-black border border-[#e4e6eb]/20 text-[10px] font-mono text-[#00ffa3] hover:text-white"
                  >
                    {rightPanelMode === "detached" ? "Dock" : "Detach"}
                  </button>
                </div>
              </div>

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
                className="w-full p-2.5 rounded-[2px] bg-black border-[1.5px] border-[#00ffa3] text-xs font-mono font-bold text-white uppercase outline-none"
              >
                {studios.map((s, idx) => (
                  <option key={s.id} value={s.slug}>
                    {idx + 1}. {s.name} ({s.agent_name})
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-between text-[10px] font-mono text-[#e4e6eb]/50 tabular-nums">
                <span>{selectedStudio.manifest_path}</span>
                <span>sha256:{selectedStudio.manifest_hash.slice(0, 8)}</span>
              </div>
            </div>

            {/* Studio Operating Environment Files */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 [scrollbar-width:thin] [scrollbar-color:rgba(228,230,235,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e4e6eb]/20 hover:[&::-webkit-scrollbar-thumb]:bg-[#00ffa3]/60">
              {/* File Tabs inside Studio Pack */}
              <div className="space-y-2.5">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#e4e6eb]/50">
                  ACTIVE BUFFERS
                </div>
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
                      className={`px-2 py-1 rounded-[2px] text-[10px] font-mono transition-colors ${
                        activePackFile === key
                          ? "bg-[#00ffa3] text-black font-bold"
                          : "bg-[#e4e6eb]/10 text-[#e4e6eb]/75 hover:text-white"
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
                      className="w-full p-2.5 rounded-[2px] bg-black border border-[#00ffa3] text-xs font-mono text-[#88edff] outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPackContent(null)}
                        className="px-2.5 py-1 text-xs font-mono text-[#e4e6eb]/60 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveStudioPackFile}
                        className="px-3 py-1 rounded-[2px] bg-[#00ffa3] text-black font-extrabold text-[10px] uppercase"
                      >
                        Save to Studio Pack
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative group">
                    <pre className="p-3 rounded-[4px] bg-black border border-[#00ffa3]/60 text-[10px] font-mono text-[#88edff] whitespace-pre-wrap leading-relaxed">
                      {selectedStudio.pack[activePackFile]}
                    </pre>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPackContent(selectedStudio.pack[activePackFile])
                      }
                      className="mt-1.5 text-[10px] font-mono text-[#00ffa3] hover:underline"
                    >
                      Edit {activePackFile.replace("_md", ".md")}
                    </button>
                  </div>
                )}
              </div>

              {/* Studio Skills & Playbooks */}
              <div className="space-y-2.5 pt-3 border-t border-[#e4e6eb]/10">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#e4e6eb]/50">
                  PLAYBOOKS
                </div>
                <div className="space-y-2">
                  {selectedStudio.pack.skills.map((sk) => (
                    <div
                      key={sk.name}
                      className="p-2.5 rounded-[2px] bg-white/[0.02] border border-[#e4e6eb]/15"
                    >
                      <div className="text-[10px] font-mono text-[#00ffa3]">
                        skills/{sk.name}
                      </div>
                      <p className="text-[11px] text-[#e4e6eb]/75 mt-0.5">
                        {sk.content.replace(/^#.*\n/, "")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Gates */}
              <div className="space-y-2 pt-3 border-t border-[#e4e6eb]/10">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#e4e6eb]/50">
                  QUALITY GATES
                </div>
                <ul className="space-y-1.5 text-[11px] text-[#e4e6eb]/85 font-mono">
                  {selectedStudio.quality_checks.map((qc) => (
                    <li key={qc} className="flex items-start gap-2">
                      <span className="text-[#00ffa3] shrink-0">[✓]</span>
                      <span>{qc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Live WorkRequest Activity Feed */}
              <div className="space-y-2 pt-3 border-t border-[#e4e6eb]/10">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#e4e6eb]/50">
                  LIVE WORKREQUEST QUEUE
                </div>
                <div className="space-y-2">
                  {workRequests.map((wr) => (
                    <div
                      key={wr.id}
                      className="p-2.5 rounded-[2px] bg-black border border-[#e4e6eb]/15 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-[#00ffa3] uppercase">{wr.studio_slug}</span>
                        <span
                          className={
                            wr.status === "done"
                              ? "text-[#00ffa3]"
                              : wr.status === "running"
                              ? "text-[#88edff]"
                              : "text-amber-400"
                          }
                        >
                          {wr.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[#e4e6eb]/85 text-[11px] line-clamp-2">{wr.objective}</p>
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
