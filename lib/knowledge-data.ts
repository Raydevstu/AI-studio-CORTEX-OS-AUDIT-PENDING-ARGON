export type GraphLayoutMode =
  | "orbit"
  | "rings"
  | "circle"
  | "areas"
  | "links"
  | "timeline";
export type NodeKind =
  | "skill"
  | "project"
  | "note"
  | "memory"
  | "routine"
  | "app"
  | "run";
export type NodeArea =
  | "business"
  | "clients"
  | "career"
  | "content"
  | "youtube"
  | "personal"
  | "system";
export type GraphTheme =
  | "obsidian"
  | "blueprint"
  | "neon"
  | "phosphor"
  | "amber";

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
  stalenessDays: number;
  needsAttention: boolean;
  connections: string[];
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

export const AREA_HUBS: Record<
  NodeArea,
  { x: number; y: number; z: number; color: string; label: string }
> = {
  business: { x: -170, y: 10, z: -110, color: "#38bdf8", label: "Business" },
  clients: {
    x: -190,
    y: -10,
    z: 110,
    color: "#f43f5e",
    label: "Clients & Community",
  },
  career: {
    x: -50,
    y: 20,
    z: 200,
    color: "#34d399",
    label: "Career & Identity",
  },
  content: {
    x: 130,
    y: 15,
    z: 170,
    color: "#eab308",
    label: "Content & Media",
  },
  youtube: {
    x: 200,
    y: -15,
    z: -40,
    color: "#f97316",
    label: "Knowledge Engine",
  },
  personal: {
    x: 30,
    y: -20,
    z: -200,
    color: "#c084fc",
    label: "Personal & Life",
  },
  system: { x: 0, y: 25, z: 0, color: "#a855f7", label: "System & Agents" },
};

export const KIND_LABELS: Record<
  NodeKind,
  { label: string; iconShape: string; color: string }
> = {
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
    count: 6,
    color: "#38bdf8",
    glowColor: "rgba(56, 189, 248, 0.4)",
    description: "Karpathy LLM Wiki pages (`brain/wiki/`) maintained by the Chief Librarian.",
    offsetAngle: 0,
    orbitalRadius: 150,
  },
  {
    name: "Meetings",
    count: 0,
    color: "#f43f5e",
    glowColor: "rgba(244, 63, 94, 0.4)",
    description: "Ingested meeting transcripts and discovery interviews.",
    offsetAngle: Math.PI * 0.3,
    orbitalRadius: 190,
  },
  {
    name: "Video knowledge",
    count: 0,
    color: "#eab308",
    glowColor: "rgba(234, 179, 8, 0.4)",
    description: "Media & technical reference documentation.",
    offsetAngle: Math.PI * 0.6,
    orbitalRadius: 170,
  },
  {
    name: "Claude memory",
    count: 4,
    color: "#c084fc",
    glowColor: "rgba(192, 132, 252, 0.4)",
    description: "Immutable content-addressed raw sources (`brain/raw/`).",
    offsetAngle: Math.PI * 0.9,
    orbitalRadius: 185,
  },
  {
    name: "Codex memory",
    count: 7,
    color: "#22d3ee",
    glowColor: "rgba(34, 211, 238, 0.4)",
    description: "Extracted Entities & Concepts (`entities` and `concepts` tables).",
    offsetAngle: Math.PI * 1.2,
    orbitalRadius: 165,
  },
  {
    name: "Projects",
    count: 10,
    color: "#34d399",
    glowColor: "rgba(52, 211, 153, 0.4)",
    description: "Projects, versioned Studio Artifacts, and Architectural Decisions (ADRs).",
    offsetAngle: Math.PI * 1.5,
    orbitalRadius: 175,
  },
  {
    name: "Skills & agents",
    count: 14,
    color: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.4)",
    description: "7 Specialist Studios and their registered Studio Agents.",
    offsetAngle: Math.PI * 1.8,
    orbitalRadius: 145,
  },
];

// Empty initial array: Brain3D hydrates all nodes & relationships directly from /api/graph
export const KEY_NODES: BrainNode[] = [];

/**
 * Computes the 6 3D layout coordinates (orbit, rings, circle, areas, links, timeline)
 * for a set of real Postgres BrainNodes and edges.
 */
export function computeBrainNodeLayouts(
  rawNodes: BrainNode[],
  rawConnections?: [string, string][]
): { nodes: BrainNode[]; connections: [string, string][] } {
  const nodes: BrainNode[] = rawNodes.map((n) => ({
    ...n,
    connections: [...(n.connections || [])],
  }));

  const connections: [string, string][] = [];
  if (rawConnections && rawConnections.length > 0) {
    connections.push(...rawConnections);
  } else {
    const seen = new Set<string>();
    for (const n of nodes) {
      for (const tgt of n.connections) {
        const key = [n.id, tgt].sort().join("::");
        if (!seen.has(key)) {
          seen.add(key);
          connections.push([n.id, tgt]);
        }
      }
    }
  }

  const categoryOrder: Record<SourceCategory, number> = {
    "Business wiki": 0,
    Meetings: 1,
    "Video knowledge": 2,
    "Claude memory": 3,
    "Codex memory": 4,
    Projects: 5,
    "Skills & agents": 6,
  };

  const ringBandRadii: Record<string, { min: number; max: number }> = {
    core: { min: 18, max: 48 },
    memory: { min: 75, max: 120 },
    projects: { min: 130, max: 175 },
    skills: { min: 185, max: 230 },
    routines: { min: 240, max: 280 },
    apps: { min: 290, max: 330 },
    runs: { min: 340, max: 380 },
  };

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
    if (node.tags.includes("project")) {
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

  Object.entries(bandBuckets).forEach(([bandKey, bucketNodes]) => {
    const bandRange = ringBandRadii[bandKey];
    const count = bucketNodes.length;
    bucketNodes.forEach((node, bIdx) => {
      const angle = (2 * Math.PI * bIdx) / Math.max(1, count);
      const r = (bandRange.min + bandRange.max) / 2;
      const rx = r * Math.cos(angle);
      const rz = r * Math.sin(angle);
      const ry = Math.sin(angle * 3) * 8;

      node.targetPositions = {
        orbit: { x: node.x, y: node.y, z: node.z },
        rings: { x: rx, y: ry, z: rz },
        circle: { x: 0, y: 0, z: 0 },
        areas: { x: 0, y: 0, z: 0 },
        links: { x: 0, y: 0, z: 0 },
        timeline: { x: 0, y: 0, z: 0 },
      };
    });
  });

  const sortedForCircle = [...nodes].sort((a, b) =>
    a.category.localeCompare(b.category)
  );
  sortedForCircle.forEach((node, cIdx) => {
    const angle = (2 * Math.PI * cIdx) / Math.max(1, nodes.length);
    const r = 240;
    if (node.targetPositions) {
      node.targetPositions.circle = {
        x: r * Math.cos(angle),
        y: 0,
        z: r * Math.sin(angle),
      };
    }
  });

  nodes.forEach((node, idx) => {
    const areaKey = node.area || "system";
    const hub = AREA_HUBS[areaKey] || AREA_HUBS.system;
    const angle = (2 * Math.PI * idx) / Math.max(1, nodes.length);
    const dist = 35 + (idx % 5) * 12;
    if (node.targetPositions) {
      node.targetPositions.areas = {
        x: hub.x + dist * Math.cos(angle),
        y: hub.y,
        z: hub.z + dist * Math.sin(angle),
      };
    }

    const degree = Math.max(1, node.connections.length);
    const lr = node.isKeyAnchor ? 55 : Math.min(260, 80 + (12 / degree) * 35);
    const catOffset =
      SOURCES.find((s) => s.name === node.category)?.offsetAngle || 0;
    const lAngle = catOffset + (idx % 7) * 0.35;
    if (node.targetPositions) {
      node.targetPositions.links = {
        x: lr * Math.cos(lAngle),
        y: ((idx % 5) - 2) * 14,
        z: lr * Math.sin(lAngle),
      };
    }

    const tx = -280 + (idx / Math.max(1, nodes.length)) * 560;
    const laneIdx = categoryOrder[node.category] ?? 3;
    const ty = (laneIdx - 3) * 48;
    const tz = Math.sin(tx * 0.025) * 30;
    if (node.targetPositions) {
      node.targetPositions.timeline = { x: tx, y: ty, z: tz };
    }
  });

  return { nodes, connections };
}

export function generateFullBrainGraph(): {
  nodes: BrainNode[];
  connections: [string, string][];
} {
  return computeBrainNodeLayouts(KEY_NODES);
}

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
    lastUpdated: "Active",
    content: `# CortexOS Master Routing & Governance Manifest

## Architecture Hierarchy
1. **CORTEX OS BUILD BLUEPRINT** (\`brain_schema_v1.sql\`, \`brain_models_v1.py\`)
2. **Chief Librarian & Karpathy LLM Wiki** (\`brain/raw/\`, \`brain/wiki/\`, \`claims\`)
3. **Jarvis Supervisor & 7 Specialist Studios** (\`Discovery -> Product -> Design -> Architecture -> Development -> QA -> Release\`)`,
  },
  {
    path: "/studios/design/AGENT.md",
    name: "AGENT.md",
    category: "skills",
    lastUpdated: "Active",
    content: `# Design Studio Operating Environment
Transform approved PRDs into screen maps, user flows, wireframes, and accessible component specifications.`,
  },
  {
    path: "/studios/architecture/AGENT.md",
    name: "architecture-agent.md",
    category: "skills",
    lastUpdated: "Active",
    content: `# Architecture Studio Operating Environment
Maintain PostgreSQL 15+ schema (\`brain_schema_v1.sql\`), pgvector embeddings (\`1536\` dims), and transactional outbox invariants.`,
  },
  {
    path: "/brain/wiki/index.md",
    name: "index.md",
    category: "memory",
    lastUpdated: "Live DB",
    content: `# Karpathy LLM Wiki Master Catalog
Stored in PostgreSQL \`wiki_pages.markdown_body\` with SHA-256 content hashes and \`claims\` provenance pointers.`,
  },
];

export const LIVE_METRICS = {
  youtubeSubscribers: 0,
  aisCommunityMembers: 0,
  aisPlusMembers: 0,
  systemScore: 98,
  connectedToolsCount: 7,
  activeRoutinesCount: 7,
  totalSavedNotes: 0,
  totalConnections: 0,
};

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

export const COMM_MESSAGES: CommMessage[] = [];

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

export const MEETINGS_LIST: MeetingItem[] = [];

export const COMMUNITY_PULSE: {
  topComments: { author: string; likes: number; text: string }[];
  stuckOnTopics: { topic: string; count: number }[];
  industryPulse: string[];
} = {
  topComments: [],
  stuckOnTopics: [],
  industryPulse: [],
};
