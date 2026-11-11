"use client";

import React from "react";
import { X, Layers, Cpu, Database, Calendar, ShieldCheck, Sparkles } from "lucide-react";

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ArchitectureModal({ isOpen, onClose }: ArchitectureModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="CortexOS Architecture Specification v1"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85"
    >
      <div className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                CortexOS Master Architecture Specification v1
              </h2>
              <p className="text-xs text-slate-400">
                4C Foundation Kernel · Chief Librarian Memory OS · Jarvis Supervisor · 7 Specialist Studios · Dual-Mode Brain &amp; War Room
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Architecture Modal"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4-Layer Dependency Order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
            <div className="text-xs font-mono font-bold text-sky-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> LAYER 1 · 4C KERNEL &amp; BRAIN SCHEMA
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Context, Connections, Capabilities, and Cadence backed by PostgreSQL 15 +{" "}
              <code className="text-cyan-300">pgvector</code> (<code className="text-cyan-300">brain_schema_v1.sql</code>)
              with 11 ObjectTypes, 13 EdgeTypes, and SHA-256 immutable raw sources.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
            <div className="text-xs font-mono font-bold text-purple-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> LAYER 2 · CHIEF LIBRARIAN &amp; LLM WIKI
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sole write-gate into the Second Brain. Performs 10-stage ingestion, extracts Entities
              and Concepts with verbatim evidence claims (<code className="text-cyan-300">claims</code> table),
              and ripples updates across the Karpathy LLM Wiki.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
            <div className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" /> LAYER 3 · JARVIS SUPERVISOR &amp; 7 STUDIOS
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Jarvis governs project lifecycle transitions across Discovery, Product, Design,
              Architecture, Development, QA, and Release Studios. Studios emit typed, versioned
              Artifacts rather than raw chat.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
            <div className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> LAYER 4 · BRAIN MODE &amp; WAR ROOM HUD
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Instant toggle between <strong>Brain Mode</strong> (3D WebGL Knowledge Graph with 7
              Studio anchors) and <strong>War Room Mode</strong> (Left Research Panel, Center
              Jarvis Council, Right Dockable Studio Workbench).
            </p>
          </div>
        </div>

        {/* Provenance & Governance Invariants */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Enforced CortexOS Invariants (`brain_models_v1` &amp; `test_brain_models_v1`)
          </div>
          <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
            <li>
              Every Wiki claim requires a valid <code className="text-cyan-300">source_id</code> or{" "}
              <code className="text-cyan-300">artifact_id</code> provenance pointer.
            </li>
            <li>
              Doctrine pages enforce <code className="text-cyan-300">requires_approval = true</code>{" "}
              and remain hidden from agents until approved.
            </li>
            <li>
              Approved artifacts require both <code className="text-cyan-300">approved_by</code> and{" "}
              <code className="text-cyan-300">approved_at</code>.
            </li>
            <li>
              Transactional outbox events use deterministic{" "}
              <code className="text-cyan-300">idempotency_key = &quot;event_type:object_id&quot;</code>.
            </li>
          </ul>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
}
