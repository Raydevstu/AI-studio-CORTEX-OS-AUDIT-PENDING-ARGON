"use client";

import React, { useState } from "react";
import { VIRTUAL_FILES, VirtualFile } from "@/lib/knowledge-data";
import {
  Folder,
  FileCode,
  FileText,
  Save,
  Plus,
  Sparkles,
  Check,
  Search,
  BookOpen,
  Settings,
  Database,
  Calendar,
  Layers,
  ChevronRight,
  Terminal,
} from "lucide-react";

interface VaultExplorerProps {
  onIngestToGraph?: (title: string, content: string) => void;
}

export default function VaultExplorer({ onIngestToGraph }: VaultExplorerProps) {
  const [files, setFiles] = useState<VirtualFile[]>(VIRTUAL_FILES);
  const [activeFilePath, setActiveFilePath] = useState<string>("/AGENTS.md");
  const [editedContent, setEditedContent] = useState<string>(
    VIRTUAL_FILES[0]?.content || ""
  );
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileCategory, setNewFileCategory] = useState<VirtualFile["category"]>("context");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];

  const handleSelectFile = (file: VirtualFile) => {
    setActiveFilePath(file.path);
    setEditedContent(file.content);
    setSavedSuccess(false);
    setIngestStatus(null);
  };

  const handleSaveFile = () => {
    setFiles((prev) =>
      prev.map((f) =>
        f.path === activeFilePath
          ? { ...f, content: editedContent, lastUpdated: "Just now" }
          : f
      )
    );
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    const cleanName = newFileName.endsWith(".md") ? newFileName : `${newFileName}.md`;
    const fullPath = `/${newFileCategory}/${cleanName}`;

    const newFile: VirtualFile = {
      path: fullPath,
      name: cleanName,
      category: newFileCategory,
      lastUpdated: "Just now",
      content: `# ${cleanName.replace(".md", "")}\n\nCreated in CortexOS 4C Vault.\n\n## Overview\nAdd durable context, instructions, or rules here.`,
    };

    setFiles((prev) => [...prev, newFile]);
    setActiveFilePath(fullPath);
    setEditedContent(newFile.content);
    setIsCreatingFile(false);
    setNewFileName("");
  };

  const handleIngestKarpathyWiki = async () => {
    try {
      setIsIngesting(true);
      setIngestStatus("Crawling entities & creating cross-references...");

      const res = await fetch("/api/gemini/wiki-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawNote: editedContent }),
      });
      const data = await res.json();

      if (data.title) {
        setIngestStatus(
          `✓ Ingested into LLM Wiki: "${data.title}" linked with ${data.connectedConcepts?.length || 2} graph nodes.`
        );
        if (onIngestToGraph) {
          onIngestToGraph(data.title, data.summary);
        }
      } else {
        setIngestStatus("✓ Note synchronized with knowledge graph.");
      }
    } catch (e) {
      console.error(e);
      setIngestStatus("Failed to ingest note.");
    } finally {
      setIsIngesting(false);
    }
  };

  const filteredFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.path.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold mb-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            4C File Architecture & Vault Explorer
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Context, Skills & AGENTS.md Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Durable, vendor-agnostic Markdown knowledge base. Ready for any AI model.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingFile(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Markdown File
        </button>
      </div>

      {/* New File Modal */}
      {isCreatingFile && (
        <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-3">
          <div className="text-sm font-bold text-white flex items-center justify-between">
            <span>Create New 4C Vault File</span>
            <button
              onClick={() => setIsCreatingFile(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Directory / Category
              </label>
              <select
                value={newFileCategory}
                onChange={(e) =>
                  setNewFileCategory(e.target.value as VirtualFile["category"])
                }
                className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none"
              >
                <option value="context">context/ (Goals, Company, Profile)</option>
                <option value="connectors">connectors/ (APIs, Sync Configs)</option>
                <option value="skills">skills/ (Custom Agent Workflows)</option>
                <option value="routines">routines/ (Cadence Schedules)</option>
                <option value="memory">memory/ (Learnings & Decisions)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                File Name
              </label>
              <input
                type="text"
                placeholder="e.g. market-expansion.md"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsCreatingFile(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFile}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
            >
              Add File to Vault
            </button>
          </div>
        </div>
      )}

      {/* Explorer Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: File Tree (1 col) */}
        <div className="rounded-2xl bg-slate-950/80 border border-slate-800/80 p-4 backdrop-blur-xl space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-400 outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[600px] pr-1">
            {filteredFiles.map((f) => {
              const isSelected = f.path === activeFilePath;
              return (
                <button
                  key={f.path}
                  onClick={() => handleSelectFile(f)}
                  className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                    isSelected
                      ? "bg-cyan-950/60 border border-cyan-500/50 text-cyan-200 font-semibold"
                      : "hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {f.name === "AGENTS.md" ? (
                      <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
                    ) : f.category === "context" ? (
                      <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : f.category === "skills" ? (
                      <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : f.category === "connectors" ? (
                      <Database className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{f.path}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Markdown Editor & Actions (2 cols) */}
        <div className="md:col-span-2 rounded-2xl bg-slate-950/80 border border-slate-800/80 p-5 backdrop-blur-xl flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {activeFile.path}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  • Updated {activeFile.lastUpdated}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Markdown format • Direct read access for CortexOS
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleIngestKarpathyWiki}
                disabled={isIngesting}
                title="Crawl semantic relationships and update 3D Brain"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-xs font-medium text-purple-200 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                {isIngesting ? "Crawling..." : "Karpathy LLM Ingest"}
              </button>
              <button
                onClick={handleSaveFile}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-slate-950" /> Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>

          {ingestStatus && (
            <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-500/40 text-xs font-mono text-purple-300">
              {ingestStatus}
            </div>
          )}

          {/* Textarea Editor */}
          <div className="flex-1 min-h-[420px] flex flex-col">
            <textarea
              value={editedContent}
              onChange={(e) => {
                setEditedContent(e.target.value);
                setSavedSuccess(false);
              }}
              className="w-full flex-1 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono text-slate-200 leading-relaxed outline-none focus:border-cyan-500/50 resize-y"
              rows={20}
              placeholder="Enter markdown knowledge content..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
