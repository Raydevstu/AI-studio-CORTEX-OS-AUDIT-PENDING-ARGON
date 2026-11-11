export type GraphLayoutMode = "orbit" | "rings" | "circle" | "areas" | "links" | "timeline";
export type NodeKind = "skill" | "project" | "note" | "memory" | "routine" | "app" | "run";
export type NodeArea = "business" | "clients" | "career" | "content" | "youtube" | "personal" | "system";
export type GraphTheme = "obsidian" | "blueprint" | "neon" | "phosphor" | "amber";

export interface NodePositions {
  orbit: { x: number; y: number; z: number };
  rings: { x: number; y: number; z: number };
  circle: { x: number; y: number; z: number };
  areas: { x: number; y: number; z: number };
  links: { x: number; y: number; z: number };
  timeline: { x: number; y: number; z: number };
}

export interface BrainNode {
  id: string;
  title: string;
  category: SourceCategory;
  kind?: NodeKind;
  area?: NodeArea;
  summary: string;
  notes: string;
  stalenessDays: number; // e.g. 12 = fresh, 45 = needs update
  needsAttention: boolean;
  connections: string[]; // Node IDs
  tags: string[];
  x: number;
  y: number;
  z: number;
  radius: number;
  isKeyAnchor?: boolean;
  targetPositions?: NodePositions;
}

export type SourceCategory =
  | "Business wiki"
  | "Meetings"
  | "Video knowledge"
  | "Claude memory"
  | "Codex memory"
  | "Projects"
  | "Skills & agents";

export const AREA_HUBS: Record<NodeArea, { x: number; y: number; z: number; color: string; label: string }> = {
  business: { x: -170, y: 10, z: -110, color: "#38bdf8", label: "Business" },
  clients: { x: -190, y: -10, z: 110, color: "#f43f5e", label: "Clients & Community" },
  career: { x: -50, y: 20, z: 200, color: "#34d399", label: "Career & Identity" },
  content: { x: 130, y: 15, z: 170, color: "#eab308", label: "Content & Media" },
  youtube: { x: 200, y: -15, z: -40, color: "#f97316", label: "YouTube Engine" },
  personal: { x: 30, y: -20, z: -200, color: "#c084fc", label: "Personal & Life" },
  system: { x: 0, y: 25, z: 0, color: "#a855f7", label: "System & Agents" },
};

export const KIND_LABELS: Record<NodeKind, { label: string; iconShape: string; color: string }> = {
  skill: { label: "Skill", iconShape: "diamond", color: "#a855f7" },
  project: { label: "Project", iconShape: "cube", color: "#34d399" },
  note: { label: "Note", iconShape: "sphere", color: "#38bdf8" },
  memory: { label: "Memory", iconShape: "sphere-ring", color: "#c084fc" },
  routine: { label: "Routine", iconShape: "torus", color: "#eab308" },
  app: { label: "App", iconShape: "cylinder", color: "#22d3ee" },
  run: { label: "Run", iconShape: "small-octa", color: "#f43f5e" },
};

export const GRAPH_THEMES: Record<
  GraphTheme,
  {
    name: string;
    bg: string;
    canvasBg: string;
    fogColor: string;
    gridColor: string;
    textColor: string;
    accentColor: string;
    lineOpacity: number;
  }
> = {
  obsidian: {
    name: "Stealth Obsidian",
    bg: "#050814",
    canvasBg: "#050814",
    fogColor: "#050814",
    gridColor: "#1e293b",
    textColor: "#e2e8f0",
    accentColor: "#38bdf8",
    lineOpacity: 0.28,
  },
  blueprint: {
    name: "Paper Blueprint / MAPS",
    bg: "#081528",
    canvasBg: "#081528",
    fogColor: "#081528",
    gridColor: "#1e3a5f",
    textColor: "#f8fafc",
    accentColor: "#38bdf8",
    lineOpacity: 0.35,
  },
  neon: {
    name: "Cyberpunk Neon",
    bg: "#030014",
    canvasBg: "#030014",
    fogColor: "#030014",
    gridColor: "#2e1065",
    textColor: "#f43f5e",
    accentColor: "#f43f5e",
    lineOpacity: 0.38,
  },
  phosphor: {
    name: "Matrix Phosphor",
    bg: "#020d04",
    canvasBg: "#020d04",
    fogColor: "#020d04",
    gridColor: "#14532d",
    textColor: "#4ade80",
    accentColor: "#22c55e",
    lineOpacity: 0.35,
  },
  amber: {
    name: "Solar Amber",
    bg: "#0f0701",
    canvasBg: "#0f0701",
    fogColor: "#0f0701",
    gridColor: "#78350f",
    textColor: "#fbbf24",
    accentColor: "#f59e0b",
    lineOpacity: 0.35,
  },
};

export interface SourceMeta {
  name: SourceCategory;
  count: number;
  color: string;
  glowColor: string;
  description: string;
  offsetAngle: number;
  orbitalRadius: number;
}

export const SOURCES: SourceMeta[] = [
  {
    name: "Business wiki",
    count: 52,
    color: "#38bdf8", // Sky blue
    glowColor: "rgba(56, 189, 248, 0.4)",
    description: "Corporate structure, revenue models, AIS Coaching, and evergreen operating wikis.",
    offsetAngle: 0,
    orbitalRadius: 180,
  },
  {
    name: "Meetings",
    count: 284,
    color: "#f43f5e", // Coral rose
    glowColor: "rgba(244, 63, 94, 0.4)",
    description: "Transcripts, all-hands syncs, partner negotiations, and investor debriefs.",
    offsetAngle: Math.PI * 0.3,
    orbitalRadius: 240,
  },
  {
    name: "Video knowledge",
    count: 240,
    color: "#eab308", // Gold yellow
    glowColor: "rgba(234, 179, 8, 0.4)",
    description: "YouTube video scripts, research-backed breakdowns, and thumbnail strategies.",
    offsetAngle: Math.PI * 0.6,
    orbitalRadius: 210,
  },
  {
    name: "Claude memory",
    count: 150,
    color: "#c084fc", // Lavender purple
    glowColor: "rgba(192, 132, 252, 0.4)",
    description: "Claude Code instructions, system prompts, reasoning heuristics, and tool configs.",
    offsetAngle: Math.PI * 0.9,
    orbitalRadius: 230,
  },
  {
    name: "Codex memory",
    count: 68,
    color: "#22d3ee", // Cyan ice
    glowColor: "rgba(34, 211, 238, 0.4)",
    description: "Terminal sandboxes, automation scripts, Docker environments, and CLI state.",
    offsetAngle: Math.PI * 1.2,
    orbitalRadius: 190,
  },
  {
    name: "Projects",
    count: 76,
    color: "#34d399", // Emerald teal
    glowColor: "rgba(52, 211, 153, 0.4)",
    description: "Herk-2, CortexOS, AIS Sizzle Reel, AI Certification course, and MVP sprints.",
    offsetAngle: Math.PI * 1.5,
    orbitalRadius: 200,
  },
  {
    name: "Skills & agents",
    count: 73,
    color: "#a855f7", // Violet magenta
    glowColor: "rgba(168, 85, 247, 0.4)",
    description: "clickup-searcher, YouTube Strategist, Code Architect, Grill Me, and audit engines.",
    offsetAngle: Math.PI * 1.8,
    orbitalRadius: 170,
  },
];

// Key Anchor Nodes specifically shown in the video and screenshots
export const KEY_NODES: BrainNode[] = [
  {
    id: "node-funnel-map",
    title: "Funnel Map",
    category: "Business wiki",
    summary: "End-to-end customer journey from YouTube viewer to AI Automation Society Plus member.",
    notes: `# Funnel Map & Conversion Architecture

## Stages
1. **Awareness**: High-leverage YouTube breakdowns on AI agents, Claude Code, and autonomous AIOS.
2. **Community Ingestion**: Free Skool community invitation in video descriptions.
3. **Core Education**: 5-part AIOS starter kit and classroom resources.
4. **Monetization & Mastery**: AIS Coaching & AIS Plus membership tier ($97/mo).

## Metrics
- Conversion rate from view to Skool signup: 4.8%
- Free Skool to AIS Plus conversion: 2.1%
- Retention rate: 91% month-over-month.

## Connected Assets
- YouTube Strategist skill
- AIS Coaching wiki
- clickup-searcher agent`,
    stalenessDays: 14,
    needsAttention: false,
    connections: ["node-youtube-strategist", "node-ais-coaching", "node-ais-plus", "node-yt-scripts"],
    tags: ["revenue", "funnel", "conversion", "skool"],
    x: 45,
    y: 12,
    z: -30,
    radius: 7.5,
    isKeyAnchor: true,
  },
  {
    id: "node-claude-code",
    title: "Claude Code",
    category: "Claude memory",
    summary: "System prompt conventions, CLI workflows, subagent coordination, and MCP tool orchestration.",
    notes: `# Claude Code Knowledge Base

## Core Principles
- File-first architecture: Always maintain durable markdown logs.
- Memory hygiene: Run periodic context compression routines.
- Tools: Terminal execution, file inspection, and MCP server bridges.

## Model Routing
- Use Claude 3.7 Sonnet with extended thinking for architecture and complex debugging.
- Use Claude 3.5 Haiku for rapid micro-tasks and lint checks.`,
    stalenessDays: 8,
    needsAttention: false,
    connections: ["node-codex-sandbox", "node-cortex-engine", "node-code-architect"],
    tags: ["claude", "coding", "mcp", "cli"],
    x: -80,
    y: 35,
    z: 40,
    radius: 7.0,
    isKeyAnchor: true,
  },
  {
    id: "node-clickup-searcher",
    title: "clickup-searcher (agent)",
    category: "Skills & agents",
    summary: "Autonomous ClickUp integration skill that searches workspaces, creates sprint tasks, and unblocks blockers.",
    notes: `# clickup-searcher Agent Skill

## Capabilities
- Search active sprint tasks across team boards.
- Parse priority bottlenecks and map to developer schedules.
- Create automated task reminders based on cadence rules.

## Connector Dependency
- ClickUp Personal Token API
- Webhook trigger on task status change to 'In Review'.`,
    stalenessDays: 42,
    needsAttention: true,
    connections: ["node-funnel-map", "node-herk2-os", "node-all-hands"],
    tags: ["skills", "agents", "clickup", "automation"],
    x: -20,
    y: 85,
    z: -60,
    radius: 6.8,
    isKeyAnchor: true,
  },
  {
    id: "node-yt-scripts",
    title: "Research-backed YouTube scripts",
    category: "Video knowledge",
    summary: "Framework for high-retention video scripts: Hook -> Tension -> 4C Demonstration -> Tactical Proof -> Free Resource CTA.",
    notes: `# Research-backed YouTube Scripts

## Scripting Template
1. **0:00 - 0:45**: The Bold Claim & Visual Proof (e.g. 3D Brain spinning).
2. **0:45 - 3:00**: The Theoretical Model (The 4Cs Framework).
3. **3:00 - 8:00**: Hands-on walkthrough with real project files.
4. **8:00 - 14:00**: Practical skills (Grill Me, Audit, Level Up).
5. **14:00 - 18:00**: Model selection & long-term knowledge asset thesis.

## Retention Goal
- 60% retention at the 3-minute mark.
- Over 15,000 views in the first 48 hours.`,
    stalenessDays: 19,
    needsAttention: false,
    connections: ["node-funnel-map", "node-youtube-strategist", "node-one-off-calls"],
    tags: ["youtube", "content", "scripts", "retention"],
    x: 60,
    y: -70,
    z: 50,
    radius: 7.2,
    isKeyAnchor: true,
  },
  {
    id: "node-one-off-calls",
    title: "One-off calls",
    category: "Meetings",
    summary: "Transcripts, decision logs, and tactical takeaways from VIP advisory calls and creator collabs.",
    notes: `# One-Off Advisory Calls Vault

## Key Insights Logged
- **Collab with AI Creator X**: Agreed to cross-promote AIOS resource packs in September.
- **Enterprise Client Consultation**: Built a prototype 4C Second Brain on private AWS VPC.
- **Feedback on Grill Me Skill**: Users requested ability to pause and edit captured insights in real-time.`,
    stalenessDays: 38,
    needsAttention: true,
    connections: ["node-yt-scripts", "node-all-hands", "node-ais-coaching"],
    tags: ["meetings", "calls", "transcripts", "advisory"],
    x: -35,
    y: -80,
    z: -30,
    radius: 6.5,
    isKeyAnchor: true,
  },
  {
    id: "node-ais-coaching",
    title: "AIS Coaching",
    category: "Business wiki",
    summary: "Curriculum, coaching schedule, tier privileges, and mentor guidelines for AI Automation Society.",
    notes: `# AIS Coaching Program

## Structure
- Weekly Office Hours: Tuesdays 10:00 AM PST.
- Project Reviews: Code review and prompt tuning for client systems.
- Private Discord Channel: Direct access to Nate and Senior AI Architects.

## Notice
- Current mentor documentation needs update! Pricing revised from $497 to $697 for Q4.`,
    stalenessDays: 55,
    needsAttention: true,
    connections: ["node-funnel-map", "node-ais-plus", "node-all-hands"],
    tags: ["coaching", "business", "education", "skool"],
    x: 80,
    y: 20,
    z: -70,
    radius: 6.8,
    isKeyAnchor: true,
  },
  {
    id: "node-ais-plus",
    title: "AIS Plus",
    category: "Business wiki",
    summary: "Premium tier community hub with 3,708 active members. Custom agent templates & private repos.",
    notes: `# AIS Plus Member Hub

## Current Stats
- Active Members: 3,708
- Monthly Churn: < 2.3%
- Top Requested Feature: Pre-built connectors for Notion and Telegram.`,
    stalenessDays: 5,
    needsAttention: false,
    connections: ["node-ais-coaching", "node-funnel-map", "node-herk2-os"],
    tags: ["community", "revenue", "membership"],
    x: 90,
    y: -30,
    z: 20,
    radius: 6.5,
    isKeyAnchor: true,
  },
  {
    id: "node-youtube-strategist",
    title: "YouTube Strategist (agent)",
    category: "Skills & agents",
    summary: "Autonomous agent skill that analyzes trending AI topics, produces high-CTR titles, and plans upload cadence.",
    notes: `# YouTube Strategist Agent

## Prompt & Workflow
- Scrapes trending papers, Claude releases, and OpenAI announcements.
- Generates 10 thumbnail title hooks with predicted CTR scores.
- Outlines comprehensive video arcs based on Nate's voice guidelines.`,
    stalenessDays: 12,
    needsAttention: false,
    connections: ["node-yt-scripts", "node-funnel-map"],
    tags: ["skills", "agent", "youtube", "automation"],
    x: 30,
    y: 75,
    z: 40,
    radius: 6.4,
    isKeyAnchor: true,
  },
  {
    id: "node-code-architect",
    title: "Code Architect (agent)",
    category: "Skills & agents",
    summary: "Designs system architecture, database schemas, Next.js routes, and Three.js visualizers.",
    notes: `# Code Architect Skill

## Capabilities
- Produces Prisma and Drizzle schemas.
- Plans modular Next.js App Router codebases.
- Implements WebGL & Three.js canvas optimizations.`,
    stalenessDays: 9,
    needsAttention: false,
    connections: ["node-claude-code", "node-herk2-os", "node-cortex-engine"],
    tags: ["coding", "architecture", "engineering"],
    x: -60,
    y: 60,
    z: 10,
    radius: 6.4,
    isKeyAnchor: true,
  },
  {
    id: "node-herk2-os",
    title: "Herk-2 Operating System",
    category: "Projects",
    summary: "The flagship local AIOS directory structure running across personal desktop, Codeex, and cloud.",
    notes: `# Herk-2 Project Overview

## Core System
- Root folder: \`~/Desktop/Herk-2\`
- Contains full \`AGENTS.md\`, \`context/\`, \`memory/\`, and \`skills/\`.
- Syncs automatically with 3D Brain visualization.`,
    stalenessDays: 3,
    needsAttention: false,
    connections: ["node-cortex-engine", "node-clickup-searcher", "node-ais-plus"],
    tags: ["project", "os", "aios", "flagship"],
    x: 0,
    y: 30,
    z: 50,
    radius: 7.0,
    isKeyAnchor: true,
  },
  {
    id: "node-cortex-engine",
    title: "CortexOS Core Engine",
    category: "Projects",
    summary: "Unified 4C framework runtime: Context ingestion, Connector pooling, Capability execution, and Cadence scheduling.",
    notes: `# CortexOS Core Engine

## 4C Layers
1. **Context**: Markdown durable storage.
2. **Connections**: OAuth & API integrations.
3. **Capabilities**: Skill registry & agent tools.
4. **Cadence**: Autonomous scheduled background workers.`,
    stalenessDays: 4,
    needsAttention: false,
    connections: ["node-herk2-os", "node-claude-code", "node-code-architect"],
    tags: ["cortex", "engine", "core"],
    x: -25,
    y: -25,
    z: 45,
    radius: 7.2,
    isKeyAnchor: true,
  },
  {
    id: "node-all-hands",
    title: "All Hands Sync (Weekly)",
    category: "Meetings",
    summary: "Weekly alignment meeting with community moderators, video editors, and engineering contractors.",
    notes: `# Weekly All Hands Meeting

## Recurring Agenda
1. Community health metrics and Skool engagement.
2. Production status of the week's YouTube video.
3. AIS Plus member questions and coaching hot topics.
4. Engineering blockers and API connector updates.`,
    stalenessDays: 7,
    needsAttention: false,
    connections: ["node-one-off-calls", "node-ais-coaching", "node-clickup-searcher"],
    tags: ["meetings", "team", "sync"],
    x: -50,
    y: -50,
    z: -40,
    radius: 6.2,
    isKeyAnchor: true,
  },
  {
    id: "node-codex-sandbox",
    title: "Codex Memory & Sandbox",
    category: "Codex memory",
    summary: "Terminal session history, bash execution memory, and temporary artifact scratchpads.",
    notes: `# Codex Memory & CLI Sandboxes

## Features
- Preserves bash session state across agent runs.
- Stores test results and build logs.
- Manages local SQLite and Postgres dev instances.`,
    stalenessDays: 15,
    needsAttention: false,
    connections: ["node-claude-code", "node-herk2-os"],
    tags: ["codex", "memory", "cli", "terminal"],
    x: 40,
    y: 50,
    z: -70,
    radius: 6.0,
    isKeyAnchor: true,
  },
  {
    id: "node-jarvis-supervisor",
    title: "Jarvis Supervisor (Governor)",
    category: "Skills & agents",
    kind: "skill",
    area: "system",
    summary: "Central CortexOS Governor & Orchestrator. Enforces the 5 Governance Rules, sequences the 7 Studios, and manages lifecycle gates.",
    notes: `# Jarvis Supervisor (Operating Model v1)

## 5 Core Governance Rules
1. User directs Jarvis; Jarvis routes WorkRequests to Studios.
2. Only Jarvis assigns Studio work.
3. Every Studio output becomes a typed, versioned Artifact.
4. No Studio modifies the Brain directly; all writes pass through Chief Librarian.
5. Jarvis tracks Project Lifecycle transitions (Discovery -> Product -> Design -> Architecture -> Development -> QA -> Release).`,
    stalenessDays: 1,
    needsAttention: false,
    connections: [
      "node-cortex-engine",
      "node-chief-librarian",
      "node-studio-discovery",
      "node-studio-product",
      "node-studio-design",
      "node-studio-architecture",
      "node-studio-development",
      "node-studio-qa",
      "node-studio-release",
    ],
    tags: ["jarvis", "supervisor", "governor", "orchestrator", "kernel"],
    x: 0,
    y: 45,
    z: 0,
    radius: 8.5,
    isKeyAnchor: true,
  },
  {
    id: "node-chief-librarian",
    title: "Chief Librarian (Memory OS)",
    category: "Claude memory",
    kind: "memory",
    area: "system",
    summary: "Sole gate into the Second Brain. Performs 10-stage ingestion, entity/concept extraction with verbatim provenance claims, and Karpathy LLM Wiki ripple synthesis.",
    notes: `# Chief Librarian (brain-service)

## Pipeline
Source Upload -> Normalizer -> Classifier -> Entity Extraction -> Concept Extraction -> Relationship Mapping -> Wiki Ripple Update -> Graph Sync -> Hybrid Vector/FTS Index -> Audit Engine.

## Invariants
- Raw sources in \`brain/raw/\` are immutable (SHA-256 content-addressed).
- Every Wiki claim requires a \`source_id\` or \`artifact_id\` provenance record.`,
    stalenessDays: 1,
    needsAttention: false,
    connections: [
      "node-jarvis-supervisor",
      "node-cortex-engine",
      "node-claude-code",
      "node-studio-discovery",
      "node-studio-architecture",
    ],
    tags: ["librarian", "wiki", "provenance", "memory", "karpathy"],
    x: 0,
    y: -45,
    z: 0,
    radius: 8.2,
    isKeyAnchor: true,
  },
  {
    id: "node-studio-discovery",
    title: "1. Discovery Studio",
    category: "Skills & agents",
    kind: "skill",
    area: "business",
    summary: "Problem validation, market & competitor teardown, ICP user personas, and opportunity scoring.",
    notes: `# Discovery Studio Environment

- **Agent**: Discovery Specialist
- **Inputs**: Raw Idea, Transcripts, Competitor URLs
- **Outputs**: \`ResearchReport\`, \`PersonaSpec\`, \`OpportunityScorecard\``,
    stalenessDays: 2,
    needsAttention: false,
    connections: ["node-jarvis-supervisor", "node-chief-librarian", "node-studio-product"],
    tags: ["studio", "discovery", "research", "personas"],
    x: 0,
    y: 85,
    z: 75,
    radius: 7.4,
    isKeyAnchor: true,
  },
  {
    id: "node-studio-product",
    title: "2. Product Studio",
    category: "Projects",
    kind: "project",
    area: "business",
    summary: "Converts validated opportunities into Technical PRDs, MVP vertical slices, Gherkin user stories, and roadmaps.",
    notes: `# Product Studio Environment

- **Agent**: Product Strategist
- **Inputs**: Approved \`ResearchReport\`, \`PersonaSpec\`
- **Outputs**: \`PRD\`, \`Roadmap\`, \`UserStories\``,
    stalenessDays: 2,
    needsAttention: false,
    connections: ["node-jarvis-supervisor", "node-studio-discovery", "node-studio-design"],
    tags: ["studio", "product", "prd", "roadmap"],
    x: -75,
    y: 55,
    z: 65,
    radius: 7.4,
    isKeyAnchor: true,
  },
  {
    id: "node-studio-design",
    title: "3. Design Studio",
    category: "Skills & agents",
    kind: "skill",
    area: "content",
    summary: "UX flows, 12-screen wireframes, design systems, component contracts, and WCAG AA accessibility rules.",
    notes: `# Design Studio Environment (Reference Pack)

- **Agent**: Design Architect
- **Pack**: \`design.md\`, \`ui-rules.md\`, \`ux-rules.md\`, \`accessibility.md\`, \`design-system.md\`
- **Outputs**: \`Wireframe\`, \`DesignSystem\`, \`ComponentMap\``,
    stalenessDays: 1,
    needsAttention: false,
    connections: ["node-jarvis-supervisor", "node-studio-product", "node-studio-architecture"],
    tags: ["studio", "design", "wireframes", "ui", "ux"],
    x: 75,
    y: 55,
    z: 65,
    radius: 7.6,
    isKeyAnchor: true,
  },
  {
    id: "node-studio-architecture",
    title: "4. Architecture Studio",
    category: "Codex memory",
    kind: "app",
    area: "system",
    summary: "System design, PostgreSQL 15 + pgvector schema, Pydantic v2 models, OpenAPI contracts, and transactional event outbox.",
    notes: `# Architecture Studio Environment

- **Agent**: Principal Systems Architect
- **Outputs**: \`ArchitectureBlueprint\`, \`DatabaseSchema\` (\`brain_schema_v1.sql\`), \`OpenAPISpec\``,
    stalenessDays: 1,
    needsAttention: false,
    connections: ["node-jarvis-supervisor", "node-chief-librarian", "node-studio-design", "node-studio-development", "node-code-architect"],
    tags: ["studio", "architecture", "postgres", "openapi", "schema"],
    x: -85,
    y: -15,
    z: 50,
    radius: 7.6,
    isKeyAnchor: true,
  },
  {
    id: "node-studio-development",
    title: "5. Development Studio",
    category: "Codex memory",
    kind: "app",
    area: "system",
    summary: "Full-stack implementation of brain-service, Chief Librarian workers, Next.js War Room UI, and database migrations.",
    notes: `# Development Studio Environment

- **Agent**: Lead Full-Stack Engineer
- **Outputs**: \`ServiceImplementation\`, \`Component\`, \`MigrationScript\``,
    stalenessDays: 2,
    needsAttention: false,
    connections: ["node-jarvis-supervisor", "node-studio-architecture", "node-studio-qa", "node-codex-sandbox"],
    tags: ["studio", "development", "code", "fastapi", "nextjs"],
    x: 85,
    y: -15,
    z: 50,
    radius: 7.4,
    isKeyAnchor: true,
  },
  {
    id: "node-studio-qa",
    title: "6. QA & Security Studio",
    category: "Skills & agents",
    kind: "run",
    area: "system",
    summary: "Domain invariant unit testing, prompt-injection sandboxing audits, accessibility checks, and SOC2 readiness.",
    notes: `# QA & Security Studio Environment

- **Agent**: QA & Security Auditor
- **Outputs**: \`TestSuite\` (\`test_brain_models_v1\`), \`SecurityAudit\`, \`BugReport\``,
    stalenessDays: 2,
    needsAttention: false,
    connections: ["node-jarvis-supervisor", "node-studio-development", "node-studio-release"],
    tags: ["studio", "qa", "security", "testing", "soc2"],
    x: -55,
    y: -65,
    z: -45,
    radius: 7.2,
    isKeyAnchor: true,
  },
  {
    id: "node-studio-release",
    title: "7. Release & Growth Studio",
    category: "Projects",
    kind: "routine",
    area: "system",
    summary: "Zero-downtime Cloud Run / Vercel deployments, human-gated release approvals, runbooks, and telemetry feedback loops.",
    notes: `# Release & Growth Studio Environment

- **Agent**: Release & SRE Governor
- **Outputs**: \`DeploymentPlan\`, \`Runbook\`, \`AnalyticsReport\``,
    stalenessDays: 3,
    needsAttention: false,
    connections: ["node-jarvis-supervisor", "node-studio-qa", "node-studio-discovery"],
    tags: ["studio", "release", "devops", "deployment", "telemetry"],
    x: 55,
    y: -65,
    z: -45,
    radius: 7.2,
    isKeyAnchor: true,
  },
];

// Deterministic Mulberry32 seeded pseudo-random number generator
function createDeterministicRng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Helper to generate full 935 nodes with realistic clustering in 3D deterministically
export function generateFullBrainGraph(): { nodes: BrainNode[]; connections: [string, string][] } {
  const rng = createDeterministicRng(42);
  const nodes: BrainNode[] = [...KEY_NODES];
  const connections: [string, string][] = [];

  // Seed connections from KEY_NODES
  KEY_NODES.forEach((node) => {
    node.connections.forEach((targetId) => {
      connections.push([node.id, targetId]);
    });
  });

  // Calculate remaining nodes to generate per category
  SOURCES.forEach((source) => {
    const existingCount = KEY_NODES.filter((n) => n.category === source.name).length;
    const remaining = source.count - existingCount;

    for (let i = 0; i < remaining; i++) {
      const id = `node-${source.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${i + 1}`;
      
      // Compute 3D clustered position on an orbital shell with deterministic dispersion
      const phi = Math.acos(2 * rng() - 1);
      const theta = source.offsetAngle + (rng() - 0.5) * 1.4;
      const radius = source.orbitalRadius * (0.75 + rng() * 0.5);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const stalenessDays = Math.floor(rng() * 90) + 1;
      const needsAttention = stalenessDays > 35 && rng() > 0.4;

      const randomTags = [
        source.name.toLowerCase(),
        stalenessDays > 35 ? "review-needed" : "synced",
        i % 2 === 0 ? "core-asset" : "operational",
      ];

      const newNode: BrainNode = {
        id,
        title: `${source.name.split(" ")[0]} Doc #${i + 1} (${source.name})`,
        category: source.name,
        summary: `Automated second brain entry for ${source.name} documenting operational workflows, decisions, and system memory.`,
        notes: `# ${source.name} Note #${i + 1}\n\nCaptured automatically via Karpathy LLM Wiki crawler.\n- Category: ${source.name}\n- Staleness: ${stalenessDays} days ago\n- Status: ${needsAttention ? "Needs review" : "Optimal"}`,
        stalenessDays,
        needsAttention,
        connections: [],
        tags: randomTags,
        x,
        y,
        z,
        radius: 2.2 + rng() * 1.8,
        isKeyAnchor: false,
      };

      nodes.push(newNode);
    }
  });

  // Generate inter-connections (target ~3,296 total connections like Herk Brain)
  const totalTargetConnections = 3296;
  const existingConnCount = connections.length;
  const needed = totalTargetConnections - existingConnCount;

  for (let c = 0; c < needed; c++) {
    const srcIndex = Math.floor(rng() * nodes.length);
    let tgtIndex = Math.floor(rng() * nodes.length);
    if (tgtIndex === srcIndex) tgtIndex = (srcIndex + 1) % nodes.length;

    const srcNode = nodes[srcIndex];
    const tgtNode = nodes[tgtIndex];

    connections.push([srcNode.id, tgtNode.id]);
    if (!srcNode.connections.includes(tgtNode.id)) {
      srcNode.connections.push(tgtNode.id);
    }
  }

  // Pre-calculate categories lane order for timeline
  const categoryOrder: Record<SourceCategory, number> = {
    "Business wiki": 0,
    Meetings: 1,
    "Video knowledge": 2,
    "Claude memory": 3,
    "Codex memory": 4,
    Projects: 5,
    "Skills & agents": 6,
  };

  // Assign kind and area classification
  nodes.forEach((node, idx) => {
    // Determine kind
    if (!node.kind) {
      if (node.category === "Skills & agents") {
        node.kind = "skill";
      } else if (node.category === "Projects") {
        node.kind = "project";
      } else if (node.category === "Claude memory") {
        node.kind = "memory";
      } else if (node.category === "Codex memory") {
        node.kind = "app";
      } else if (node.category === "Meetings") {
        node.kind = idx % 4 === 0 ? "routine" : "run";
      } else if (node.category === "Business wiki") {
        node.kind = idx % 5 === 0 ? "app" : "note";
      } else {
        node.kind = "note";
      }
    }

    // Determine area
    if (!node.area) {
      if (node.category === "Business wiki") {
        node.area = idx % 4 === 0 ? "career" : "business";
      } else if (node.category === "Video knowledge") {
        node.area = idx % 2 === 0 ? "youtube" : "content";
      } else if (node.category === "Meetings") {
        node.area = idx % 3 === 0 ? "personal" : "clients";
      } else if (node.category === "Claude memory" || node.category === "Codex memory") {
        node.area = "system";
      } else if (node.category === "Skills & agents") {
        node.area = idx % 3 === 0 ? "content" : "system";
      } else {
        node.area = idx % 2 === 0 ? "system" : "career";
      }
    }
  });

  // Calculate rings band mapping
  const ringBandRadii: Record<string, { min: number; max: number }> = {
    core: { min: 18, max: 48 },
    memory: { min: 80, max: 130 },
    projects: { min: 145, max: 195 },
    skills: { min: 210, max: 260 },
    routines: { min: 275, max: 320 },
    apps: { min: 335, max: 380 },
    runs: { min: 390, max: 435 },
  };

  // Group nodes by their ring band
  const bandBuckets: Record<string, BrainNode[]> = {
    core: [],
    memory: [],
    projects: [],
    skills: [],
    routines: [],
    apps: [],
    runs: [],
  };

  nodes.forEach((node) => {
    if (node.isKeyAnchor && (node.id === "node-herk2-os" || node.id === "node-cortex-engine")) {
      bandBuckets.core.push(node);
    } else if (node.kind === "memory") {
      bandBuckets.memory.push(node);
    } else if (node.kind === "project") {
      bandBuckets.projects.push(node);
    } else if (node.kind === "skill") {
      bandBuckets.skills.push(node);
    } else if (node.kind === "routine") {
      bandBuckets.routines.push(node);
    } else if (node.kind === "app") {
      bandBuckets.apps.push(node);
    } else {
      bandBuckets.runs.push(node);
    }
  });

  // Compute ring positions
  Object.entries(bandBuckets).forEach(([bandKey, bucketNodes]) => {
    const bandRange = ringBandRadii[bandKey];
    const count = bucketNodes.length;
    bucketNodes.forEach((node, bIdx) => {
      const angle = (2 * Math.PI * bIdx) / Math.max(1, count) + (rng() - 0.5) * 0.15;
      const r = bandRange.min + rng() * (bandRange.max - bandRange.min);
      const rx = r * Math.cos(angle);
      const rz = r * Math.sin(angle);
      const ry = Math.sin(angle * 3) * 8 + (rng() - 0.5) * 6;

      if (!node.targetPositions) {
        node.targetPositions = {
          orbit: { x: node.x, y: node.y, z: node.z },
          rings: { x: rx, y: ry, z: rz },
          circle: { x: 0, y: 0, z: 0 },
          areas: { x: 0, y: 0, z: 0 },
          links: { x: 0, y: 0, z: 0 },
          timeline: { x: 0, y: 0, z: 0 },
        };
      } else {
        node.targetPositions.rings = { x: rx, y: ry, z: rz };
      }
    });
  });

  // Sort nodes for perimeter circle so same category sit consecutively
  const sortedForCircle = [...nodes].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.stalenessDays - b.stalenessDays;
  });

  sortedForCircle.forEach((node, cIdx) => {
    const angle = (2 * Math.PI * cIdx) / nodes.length;
    const r = 330 + (rng() - 0.5) * 35;
    const cx = r * Math.cos(angle);
    const cz = r * Math.sin(angle);
    const cy = (rng() - 0.5) * 20;

    if (!node.targetPositions) {
      node.targetPositions = {
        orbit: { x: node.x, y: node.y, z: node.z },
        rings: { x: 0, y: 0, z: 0 },
        circle: { x: cx, y: cy, z: cz },
        areas: { x: 0, y: 0, z: 0 },
        links: { x: 0, y: 0, z: 0 },
        timeline: { x: 0, y: 0, z: 0 },
      };
    } else {
      node.targetPositions.circle = { x: cx, y: cy, z: cz };
    }
  });

  // Compute areas cluster positions
  nodes.forEach((node) => {
    const areaKey = node.area || "system";
    const hub = AREA_HUBS[areaKey] || AREA_HUBS.system;
    const dist = 14 + rng() * 64;
    const angle = rng() * 2 * Math.PI;
    const ax = hub.x + dist * Math.cos(angle);
    const az = hub.z + dist * Math.sin(angle);
    const ay = hub.y + (rng() - 0.5) * 28;

    if (node.targetPositions) {
      node.targetPositions.areas = { x: ax, y: ay, z: az };
    }
  });

  // Compute force-directed links positions
  nodes.forEach((node) => {
    const degree = node.connections.length;
    // Core high-degree anchors are central; lower degree branches outward
    const r = node.isKeyAnchor ? 25 + rng() * 50 : Math.min(360, 70 + (20 / Math.max(1, degree)) * 40 + rng() * 60);
    const catOffset = SOURCES.find((s) => s.name === node.category)?.offsetAngle || 0;
    const angle = catOffset + (rng() - 0.5) * 1.5;
    const lx = r * Math.cos(angle) + (rng() - 0.5) * 24;
    const lz = r * Math.sin(angle) + (rng() - 0.5) * 24;
    const ly = (rng() - 0.5) * 44;

    if (node.targetPositions) {
      node.targetPositions.links = { x: lx, y: ly, z: lz };
    }
  });

  // Compute timeline recency positions
  nodes.forEach((node) => {
    const tx = -360 + (node.stalenessDays / 90) * 720 + (rng() - 0.5) * 16;
    const laneIdx = categoryOrder[node.category] ?? 3;
    const ty = (laneIdx - 3) * 52 + (rng() - 0.5) * 18;
    const tz = Math.sin(tx * 0.025) * 35 + (rng() - 0.5) * 20;

    if (node.targetPositions) {
      node.targetPositions.timeline = { x: tx, y: ty, z: tz };
    }
  });

  return { nodes, connections };
}

// 4C File System Structure & Default Files
export interface VirtualFile {
  path: string;
  name: string;
  category: "context" | "connectors" | "skills" | "routines" | "memory" | "root";
  content: string;
  lastUpdated: string;
}

export const VIRTUAL_FILES: VirtualFile[] = [
  {
    path: "/AGENTS.md",
    name: "AGENTS.md",
    category: "root",
    lastUpdated: "Just now",
    content: `# CortexOS AI Operating System

## Identity
You are CortexOS.
Purpose: Act as strategic advisor, research assistant, developer partner, and autonomous execution engine.

## Navigation Rules
- Context: \`./context\`
- Projects: \`./projects\`
- Skills: \`./skills\`
- Routines: \`./routines\`
- Memory: \`./memory\`
- Logs: \`./logs\`

## Task Routing Map
If user asks about:
- Coding & Engineering → \`skills/coding/code-architect.md\`
- YouTube Strategy & Content → \`skills/content/youtube-strategist.md\`
- Product Planning & Roadmaps → \`skills/planning/sprint-master.md\`
- Market Research & Competitors → \`skills/research/market-intel.md\`
- Inbox & Comms Automation → \`skills/automation/inbox-cleaner.md\`
- System Auditing & Health → \`skills/system/audit-os.md\`

## Operating Constraints
1. Never delete files without explicit confirmation.
2. Request confirmation before external publishing or financial actions.
3. Always update durable markdown logs in \`/memory\` after every multi-step decision.
4. Enforce Oxford comma, concise bullet points, and pragmatic action steps.`,
  },
  {
    path: "/context/personal/profile.md",
    name: "profile.md",
    category: "context",
    lastUpdated: "Yesterday",
    content: `# Personal Profile

- **Name**: Nate Herk (Founder & AI Architect)
- **Role**: Creator of AI Automation Society (AIS) & CortexOS
- **Focus**: AI Operating Systems, autonomous multi-agent workflows, developer productivity, and YouTube education.
- **Audience**: 990,000 YouTube subscribers, 451,000 Skool community members.
- **Mission**: Transition work from fragmented SaaS tabs into a durable, file-first second brain that any AI model can navigate without vendor lock-in.`,
  },
  {
    path: "/context/personal/goals.md",
    name: "goals.md",
    category: "context",
    lastUpdated: "3 days ago",
    content: `# Current Strategic Goals (Q3 - Q4)

1. **Reach 1,000,000 YouTube Subscribers**
   - Publish 2 high-retention breakdowns per month.
   - Core topic focus: GPT-6 Astra, Claude Code, and Local LLM Wikis.

2. **Scale AI Automation Society Plus to 5,000 Members**
   - Launch weekly live agent coding workshops.
   - Release plug-and-play connector templates for Slack & ClickUp.

3. **Autonomous Cadence Expansion**
   - Automate 80% of daily comms triage through morning and evening cadence bots.
   - Zero unread messages older than 24 hours.`,
  },
  {
    path: "/context/business/strategy.md",
    name: "strategy.md",
    category: "context",
    lastUpdated: "5 days ago",
    content: `# Business Strategy & Monetization Matrix

## Ecosystem Pillars
1. **The Second Brain Asset**: File-first markdown knowledge layer that belongs to the user, preventing vendor lock-in.
2. **Community & Mentorship**: Skool free community as the top of funnel; AIS Plus for serious practitioners.
3. **Enterprise AI Advisory**: High-ticket bespoke second brain implementations for technical founders.

## Competitive Moat
- We don't build closed chatbots; we build durable knowledge assets.
- If a new AI model drops tomorrow, CortexOS plugs into it with zero migration friction.`,
  },
  {
    path: "/context/preferences/ai-rules.md",
    name: "ai-rules.md",
    category: "context",
    lastUpdated: "1 week ago",
    content: `# AI Behavior Rules & Tone Guidelines

- **Tone**: Crisp, razor-sharp, strategic, and optimistic.
- **Format**: Headings, short paragraphs, bullet points, checklists.
- **Banned Words**: 'Delve', 'Tapestry', 'Testament', 'Beacon', 'Synergy'.
- **Decision Heuristic**: Prioritize simplicity and durable markdown files over complex proprietary database schemas.`,
  },
  {
    path: "/connectors/overview.md",
    name: "overview.md",
    category: "connectors",
    lastUpdated: "Today",
    content: `# Connector Integrations Registry

| Connector | Status | Sync Frequency | Data Pulled |
| :--- | :--- | :--- | :--- |
| **YouTube API** | Active (990K) | Real-time | Subs, Analytics, Top Comments |
| **Google Calendar** | Synced | Every 15 min | Daily schedule, upcoming calls |
| **Gmail** | Active | Instant Push | VIP inquiries, triage backlog |
| **Slack** | Connected | Webhook | Team discussions, client feedback |
| **ClickUp** | Connected | Every 30 min | Sprint tasks, blockers, priorities |
| **GitHub** | Synced | On push | Commits, pull requests, CI status |
| **Postgres** | Ready | On-demand | Analytics cache, historical audits |`,
  },
  {
    path: "/skills/system/audit-os.md",
    name: "audit-os.md",
    category: "skills",
    lastUpdated: "2 days ago",
    content: `# Skill: Audit AIOS

## Purpose
Inspect all 4 layers of the AIOS (Context, Connections, Capabilities, Cadence).
Calculate a 0-100 system grade. Flag stale files (>30 days). Suggest level-up actions.

## Execution
Run \`/audit\` in terminal or click 'Run 4C Audit' in the Command Center.`,
  },
];

// OS Command Center Live Metrics
export const LIVE_METRICS = {
  youtubeSubscribers: 990000,
  aisCommunityMembers: 451294,
  aisPlusMembers: 3708,
  systemScore: 94,
  connectedToolsCount: 8,
  activeRoutinesCount: 6,
  totalSavedNotes: 935,
  totalConnections: 3296,
};

// Sample Communications Feed
export interface CommMessage {
  id: string;
  source: "slack" | "clickup" | "email";
  sender: string;
  title: string;
  snippet: string;
  timestamp: string;
  unread: boolean;
  priority: "high" | "medium" | "low";
}

export const COMM_MESSAGES: CommMessage[] = [
  {
    id: "msg-1",
    source: "slack",
    sender: "Sarah (Video Editor)",
    title: "#production - Rough Cut Ready",
    snippet: "Just uploaded the 1080p rough cut for 'I Turned GPT-6 Astra Into My Second Brain'. Timeline markers for 3D Brain demo are at 1:39.",
    timestamp: "12m ago",
    unread: true,
    priority: "high",
  },
  {
    id: "msg-2",
    source: "clickup",
    sender: "ClickUp Bot",
    title: "[Sprint 44] CortexOS 3D Graph Optimization",
    snippet: "Task status moved to 'QA Review'. Particle count capped at 935 nodes with GPU instancing enabled.",
    timestamp: "45m ago",
    unread: true,
    priority: "medium",
  },
  {
    id: "msg-3",
    source: "email",
    sender: "david@anthropic-partner.io",
    title: "Partnership Inquiry: Claude Code AIOS Template",
    snippet: "Hey Nate, loved your recent video on agents.md. Would love to feature your 4C framework in our upcoming developer spotlight.",
    timestamp: "2h ago",
    unread: false,
    priority: "high",
  },
  {
    id: "msg-4",
    source: "slack",
    sender: "Alex (AIS Community Lead)",
    title: "#ais-plus - Member Question on MCP",
    snippet: "Multiple members in Skool asking how to bridge ClickUp MCP server with local Codex. Do we have a script for that?",
    timestamp: "3h ago",
    unread: false,
    priority: "medium",
  },
];

// Sample Meetings Feed
export interface MeetingItem {
  id: string;
  title: string;
  time: string;
  date: string;
  isPast: boolean;
  attendees: string[];
  aiSummary?: string;
  actionItems?: string[];
}

export const MEETINGS_LIST: MeetingItem[] = [
  {
    id: "meet-1",
    title: "AIS Leadership & Sprint Planning",
    time: "10:00 AM - 10:45 AM",
    date: "Today",
    isPast: true,
    attendees: ["Nate Herk", "Sarah", "Alex", "Dev Team"],
    aiSummary: "Reviewed YouTube production schedule for Astra AIOS release. Confirmed AIS Plus member growth to 3,708. Unblocked clickup-searcher agent deployment.",
    actionItems: [
      "Publish resource pack link in YouTube description",
      "Update AIS Coaching documentation pricing",
      "Deploy 3D Brain interactive demo to Vercel/Cloud Run",
    ],
  },
  {
    id: "meet-2",
    title: "1-on-1 VIP Strategy Call: Scaling AI Agencies",
    time: "2:00 PM - 2:30 PM",
    date: "Today",
    isPast: false,
    attendees: ["Nate Herk", "Marcus Vance"],
  },
  {
    id: "meet-3",
    title: "Weekly All-Hands & Community Review",
    time: "11:00 AM - 12:00 PM",
    date: "Tomorrow",
    isPast: false,
    attendees: ["Entire AIS Core Team"],
  },
];

// Community Pulse Data
export const COMMUNITY_PULSE = {
  topComments: [
    {
      author: "@ai_builder_99",
      text: "The concept of AGENTS.md acting as a routing table rather than dumping everything into prompt memory is pure genius.",
      likes: 842,
    },
    {
      author: "@founder_dan",
      text: "The 3D Brain graph visualization makes knowledge retrieval tangible. Watching relationships form in real time is wild.",
      likes: 615,
    },
  ],
  stuckOnTopics: [
    { topic: "Bridging ClickUp MCP with Claude Code", count: 87 },
    { topic: "Writing proper AGENTS.md routing logic", count: 64 },
    { topic: "Automating Daily 8am Cadence Routines", count: 49 },
  ],
  industryPulse: [
    { title: "OpenAI Astra Reasoning Benchmark Updates", platform: "X (Twitter)", impact: "High" },
    { title: "Karpathy publishes new notes on LLM Wiki synthesis", platform: "GitHub", impact: "High" },
    { title: "Google releases Gemini 4 Argon with high reasoning", platform: "YouTube", impact: "High" },
  ],
};
