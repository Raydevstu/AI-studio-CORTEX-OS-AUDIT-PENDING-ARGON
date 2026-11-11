"use client";

import React, { useState } from "react";
import { BrainNode, SOURCES } from "@/lib/knowledge-data";
import {
  X,
  Volume2,
  Share2,
  Copy,
  Check,
  Clock,
  Link as LinkIcon,
  Sparkles,
  AlertTriangle,
  FileText,
  Tag,
} from "lucide-react";

interface NodeInspectorProps {
  node: BrainNode | null;
  onClose: () => void;
  onSelectConnectedNode: (nodeId: string) => void;
  onAskAiAboutNode: (node: BrainNode) => void;
}

export default function NodeInspector({
  node,
  onClose,
  onSelectConnectedNode,
  onAskAiAboutNode,
}: NodeInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isReviewed, setIsReviewed] = useState(false);

  if (!node) return null;

  const sourceMeta = SOURCES.find((s) => s.name === node.category);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(node.notes || node.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayVoice = async () => {
    try {
      setIsPlayingAudio(true);
      const textToSpeak = `${node.title}. Category: ${node.category}. Summary: ${node.summary}`;
      const res = await fetch("/api/gemini/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => setIsPlayingAudio(false);
        await audio.play();
      } else {
        setIsPlayingAudio(false);
      }
    } catch (e) {
      console.error("Audio playback error:", e);
      setIsPlayingAudio(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-950/95 border-l border-slate-800/80 backdrop-blur-2xl shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
      {/* Top Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: sourceMeta?.color || "#38bdf8" }}
          />
          <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
            {node.category}
          </span>
          {node.needsAttention && !isReviewed && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              Needs Update
            </span>
          )}
          {isReviewed && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
              Reviewed Today
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePlayVoice}
            disabled={isPlayingAudio}
            title="Read with AI Voice (gemini-3.8-flash-lite-tts)"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <Volume2 className={`w-4 h-4 ${isPlayingAudio ? "animate-pulse text-cyan-400" : ""}`} />
          </button>
          <button
            onClick={handleCopyMarkdown}
            title="Copy Markdown"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
            {node.title}
          </h2>
          <div className="flex items-center flex-wrap gap-2 mt-2 text-xs font-mono text-slate-400">
            {node.kind && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 font-semibold uppercase text-[10px]">
                Kind: {node.kind}
              </span>
            )}
            {node.area && (
              <span className="px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-500/40 font-semibold uppercase text-[10px]">
                Area: {node.area}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Updated {isReviewed ? "Just now" : `${node.stalenessDays} days ago`}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
              {node.connections.length} Links
            </span>
          </div>
        </div>

        {/* AI Action CTA */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border border-cyan-500/30 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Query with Astra / CortexOS
            </div>
            <div className="text-[11px] text-slate-300">
              Run strategic queries, cross-check meetings, or generate assets.
            </div>
          </div>
          <button
            onClick={() => onAskAiAboutNode(node)}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors shrink-0"
          >
            Ask AI
          </button>
        </div>

        {/* Executive Summary */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            Executive Summary
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{node.summary}</p>
        </div>

        {/* Markdown Notes */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            Full Knowledge Vault Notes
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {node.notes}
          </div>
        </div>

        {/* Tags */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            System Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {node.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Connected Nodes */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
              Connected Knowledge Nodes ({node.connections.length})
            </span>
            <span className="text-[10px] text-slate-400">Click to inspect</span>
          </div>

          <div className="space-y-1.5">
            {node.connections.map((connId) => (
              <button
                key={connId}
                onClick={() => onSelectConnectedNode(connId)}
                className="w-full text-left p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-cyan-500/50 flex items-center justify-between group transition-all"
              >
                <span className="text-xs font-medium text-slate-200 group-hover:text-cyan-300 truncate">
                  {connId.replace(/^node-/, "").replace(/-/g, " ")}
                </span>
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-white">
                  Inspect →
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950 flex items-center gap-3">
        <button
          onClick={() => setIsReviewed(true)}
          className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-colors"
        >
          {isReviewed ? "✓ Marked as Fresh" : "Mark as Fresh / Reviewed"}
        </button>
        <button
          onClick={onClose}
          className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
