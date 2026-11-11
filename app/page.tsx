"use client";

import React, { useState, useCallback } from "react";
import Brain3D from "@/components/Brain3D";
import WarRoom from "@/components/WarRoom";
import OsDashboard from "@/components/OsDashboard";
import VaultExplorer from "@/components/VaultExplorer";
import GrillMeInterviewer from "@/components/GrillMeInterviewer";
import AuditEngine from "@/components/AuditEngine";
import CortexTerminal from "@/components/CortexTerminal";
import NodeInspector from "@/components/NodeInspector";
import ArchitectureModal from "@/components/ArchitectureModal";
import { BrainNode, KEY_NODES } from "@/lib/knowledge-data";

type ActiveSurface =
  | "warroom"
  | "brain"
  | "dashboard"
  | "vault"
  | "grillme"
  | "audit"
  | "terminal";

export default function CortexOSApp() {
  // Default to War Room or Brain Mode with instant toggle
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>("warroom");
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [terminalPrompt, setTerminalPrompt] = useState<string | undefined>(undefined);
  const [customBrainNodes, setCustomBrainNodes] = useState<BrainNode[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handlePublishNodeToBrain = useCallback((newNode: BrainNode) => {
    setCustomBrainNodes((prev) => [newNode, ...prev]);
  }, []);

  const handleSelectConnectedNode = (nodeId: string) => {
    const found =
      customBrainNodes.find((n) => n.id === nodeId) ||
      KEY_NODES.find((n) => n.id === nodeId);
    if (found) {
      setSelectedNode(found);
    } else {
      setSelectedNode({
        id: nodeId,
        title: nodeId
          .replace("node-", "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        category: "Business wiki",
        summary:
          "Connected knowledge node in the CortexOS Second Brain constellation.",
        notes: `# Connected Node: ${nodeId}\n\nAutomatically cross-referenced via Chief Librarian & AGENTS.md.`,
        stalenessDays: 8,
        needsAttention: false,
        connections: ["node-jarvis-supervisor", "node-chief-librarian"],
        tags: ["connected", "wiki-node"],
        x: 10,
        y: 20,
        z: 30,
        radius: 5,
      });
    }
  };

  const handleAskAiAboutNode = (node: BrainNode) => {
    setSelectedNode(null);
    setTerminalPrompt(
      `Analyze the "${node.title}" node (${node.category}). Summary: ${node.summary}. How does it connect to Jarvis Supervisor, the 7 Studios, and our active projects?`
    );
    setActiveSurface("terminal");
  };

  const handleOpenTerminalWithPrompt = (prompt?: string) => {
    setTerminalPrompt(prompt);
    setActiveSurface("terminal");
  };

  return (
    <main className="flex flex-col w-full h-screen bg-[#0c0d0f] text-[#e4e6eb] overflow-hidden select-none">
      {/* ==================================================================== */}
      {/* TOP BAR CONTRACT: 3 ZONES (Brand Wordmark — 5 Nav Links — 1 CTA)     */}
      {/* ==================================================================== */}
      <header className="h-16 shrink-0 px-6 bg-[#0c0d0f] border-b-[1.5px] border-[#e4e6eb] flex items-center justify-between gap-8 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSurface("warroom");
          }}
          className="font-[family-name:var(--font-display)] text-2xl font-extrabold uppercase tracking-[-0.04em] text-[#e4e6eb] whitespace-nowrap shrink-0"
        >
          Cortex<span className="text-[#00ffa3]">OS</span>
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#e4e6eb]/50"
        >
          <button
            type="button"
            onClick={() => setActiveSurface("warroom")}
            className={`hover:text-[#e4e6eb] transition-colors whitespace-nowrap shrink-0 py-2 border-b-2 ${
              activeSurface === "warroom"
                ? "border-[#00ffa3] text-[#00ffa3]"
                : "border-transparent"
            }`}
          >
            War Room
          </button>
          <button
            type="button"
            onClick={() => setActiveSurface("brain")}
            className={`hover:text-[#e4e6eb] transition-colors whitespace-nowrap shrink-0 py-2 border-b-2 ${
              activeSurface === "brain"
                ? "border-[#00ffa3] text-[#00ffa3]"
                : "border-transparent"
            }`}
          >
            3D Brain
          </button>
          <button
            type="button"
            onClick={() => setActiveSurface("dashboard")}
            className={`hover:text-[#e4e6eb] transition-colors whitespace-nowrap shrink-0 py-2 border-b-2 ${
              activeSurface === "dashboard"
                ? "border-[#00ffa3] text-[#00ffa3]"
                : "border-transparent"
            }`}
          >
            4C Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveSurface("vault")}
            className={`hover:text-[#e4e6eb] transition-colors whitespace-nowrap shrink-0 py-2 border-b-2 ${
              activeSurface === "vault"
                ? "border-[#00ffa3] text-[#00ffa3]"
                : "border-transparent"
            }`}
          >
            Knowledge Vault
          </button>
          <button
            type="button"
            onClick={() => setActiveSurface("terminal")}
            className={`hover:text-[#e4e6eb] transition-colors whitespace-nowrap shrink-0 py-2 border-b-2 ${
              activeSurface === "terminal"
                ? "border-[#00ffa3] text-[#00ffa3]"
                : "border-transparent"
            }`}
          >
            Astra Terminal
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-[2px] bg-[#00ffa3] hover:brightness-110 text-black font-extrabold text-[11px] uppercase tracking-wider transition-all whitespace-nowrap shrink-0"
          >
            Blueprint Spec
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* WORKSPACE MODE TOGGLE BAR (BRAIN MODE <-> WAR ROOM MODE + TOOLS)     */}
      {/* ==================================================================== */}
      <div className="h-12 shrink-0 px-6 bg-[#e4e6eb]/[0.06] border-b border-[#e4e6eb]/10 flex items-center justify-between gap-4 z-20">
        {/* Primary Mode Toggle: Brain Mode vs War Room Mode */}
        <div className="flex items-center gap-4">
          <div
            role="group"
            aria-label="Primary Operating Mode Toggle"
            className="flex items-center gap-0.5 p-0.5 bg-black border border-[#e4e6eb]/15"
          >
            <button
              type="button"
              onClick={() => setActiveSurface("brain")}
              className={`px-3 py-1 rounded-[2px] text-[10px] uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                activeSurface === "brain"
                  ? "bg-[#00ffa3] text-black font-extrabold"
                  : "text-[#e4e6eb]/80 hover:text-white"
              }`}
            >
              Brain Mode
            </button>
            <button
              type="button"
              onClick={() => setActiveSurface("warroom")}
              className={`px-3 py-1 rounded-[2px] text-[10px] uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                activeSurface === "warroom"
                  ? "bg-[#00ffa3] text-black font-extrabold"
                  : "text-[#e4e6eb]/80 hover:text-white"
              }`}
            >
              War Room Mode
            </button>
          </div>

          <span className="hidden lg:inline font-mono text-[10px] uppercase tracking-[0.14em] text-[#e4e6eb]/55">
            {activeSurface === "warroom"
              ? "Execution Layer: L-Research · C-Council · R-Workbench"
              : activeSurface === "brain"
              ? "Memory Layer: 3D Second Brain · 7 Studio Anchors · Chief Librarian"
              : "4C Foundation Layer: Context · Connections · Capabilities · Cadence"}
          </span>
        </div>

        {/* Secondary Second Brain Modules */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSurface("grillme")}
            className={`px-3 py-1.5 border text-[10px] uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
              activeSurface === "grillme"
                ? "bg-[#003322] text-[#00ffa3] border-[#00ffa3]"
                : "border-[#e4e6eb]/15 text-[#e4e6eb]/70 hover:text-[#e4e6eb]"
            }`}
          >
            Grill-Me Stress Test
          </button>
          <button
            type="button"
            onClick={() => setActiveSurface("audit")}
            className={`px-3 py-1.5 border text-[10px] uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
              activeSurface === "audit"
                ? "bg-[#003322] text-[#00ffa3] border-[#00ffa3]"
                : "border-[#e4e6eb]/15 text-[#e4e6eb]/70 hover:text-[#e4e6eb]"
            }`}
          >
            4C Audit Engine
          </button>
        </div>
      </div>

      {/* Optional Toast Banner */}
      {toastMessage && (
        <div className="shrink-0 px-6 py-2 bg-[#003322] border-b border-[#00ffa3]/40 text-xs text-[#00ffa3] font-mono flex items-center justify-between">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="underline hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MAIN VIEWPORT                                                        */}
      {/* ==================================================================== */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        {activeSurface === "warroom" && (
          <WarRoom
            onPublishNodeToBrain={handlePublishNodeToBrain}
            onSwitchToBrainMode={() => setActiveSurface("brain")}
          />
        )}

        {activeSurface === "brain" && (
          <Brain3D
            onSelectNode={(node) => setSelectedNode(node)}
            selectedNodeId={selectedNode?.id}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            customNodes={customBrainNodes}
          />
        )}

        {activeSurface === "dashboard" && (
          <div className="w-full h-full overflow-y-auto">
            <OsDashboard
              onOpenBrain={() => setActiveSurface("brain")}
              onOpenGrillMe={() => setActiveSurface("grillme")}
              onOpenAudit={() => setActiveSurface("audit")}
              onOpenTerminal={handleOpenTerminalWithPrompt}
            />
          </div>
        )}

        {activeSurface === "vault" && (
          <div className="w-full h-full overflow-y-auto">
            <VaultExplorer
              onIngestToGraph={(title, summary) => {
                handlePublishNodeToBrain({
                  id: `node-vault-${Date.now()}`,
                  title,
                  category: "Business wiki",
                  kind: "note",
                  area: "system",
                  summary,
                  notes: `# ${title}\n\n${summary}`,
                  stalenessDays: 0,
                  needsAttention: false,
                  connections: ["node-chief-librarian", "node-cortex-engine"],
                  tags: ["vault-ingested", "karpathy-wiki"],
                  x: 35,
                  y: 25,
                  z: -25,
                  radius: 6.5,
                  isKeyAnchor: true,
                });
                setToastMessage(
                  `Chief Librarian ingested "${title}" from 4C Vault and linked it into the 3D Brain Graph.`
                );
              }}
            />
          </div>
        )}

        {activeSurface === "grillme" && (
          <div className="w-full h-full overflow-y-auto">
            <GrillMeInterviewer />
          </div>
        )}

        {activeSurface === "audit" && (
          <div className="w-full h-full overflow-y-auto">
            <AuditEngine />
          </div>
        )}

        {activeSurface === "terminal" && (
          <div className="w-full h-full overflow-y-auto">
            <CortexTerminal initialPrompt={terminalPrompt} />
          </div>
        )}

        {/* Slide-over Node Inspector */}
        <NodeInspector
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSelectConnectedNode={handleSelectConnectedNode}
          onAskAiAboutNode={handleAskAiAboutNode}
        />

        {/* Architecture & Blueprint Spec Modal */}
        <ArchitectureModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </main>
  );
}
