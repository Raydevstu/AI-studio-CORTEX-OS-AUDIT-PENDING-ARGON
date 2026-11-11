"use client";

import React, { useState } from "react";
import {
  Activity,
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileText,
  Sparkles,
  Zap,
  Play,
  RotateCcw,
} from "lucide-react";

interface AuditResult {
  overallScore: number;
  contextScore: number;
  connectionsScore: number;
  capabilitiesScore: number;
  cadenceScore: number;
  grade: string;
  strengths: string[];
  vulnerabilities: string[];
  levelUpTasks: {
    title: string;
    category: string;
    impact: string;
    action: string;
  }[];
  markdownReport: string;
}

export default function AuditEngine() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditData, setAuditData] = useState<AuditResult>({
    overallScore: 94,
    contextScore: 96,
    connectionsScore: 92,
    capabilitiesScore: 95,
    cadenceScore: 91,
    grade: "A (Enterprise Ready)",
    strengths: [
      "Durable 4C file-first architecture with zero vendor lock-in",
      "Real-time 3D knowledge graph connecting 935 nodes across 7 sources",
      "Autonomous cadence routines for 8am inbox review and 6pm summaries",
    ],
    vulnerabilities: [
      "ClickUp-searcher agent token requires periodic OAuth re-authentication",
      "AIS Coaching wiki documentation has not been refreshed in 55 days",
      "Notion connector is currently set to polling mode instead of instant push",
    ],
    levelUpTasks: [
      {
        title: "Automate Team Bottleneck Action List",
        category: "Cadence & Skills",
        impact: "Saves 4 hours/week in Slack coordination",
        action: "Deploy background agent to parse unread Slack threads at 9:00 AM",
      },
      {
        title: "Refresh AIS Coaching Tier Pricing in Business Wiki",
        category: "Context Layer",
        impact: "Prevents customer support pricing misalignment",
        action: "Update /context/business/strategy.md to reflect $697 Q4 rate",
      },
      {
        title: "Link YouTube Video Transcripts directly to Karpathy LLM Wiki",
        category: "Connections Layer",
        impact: "Expands graph cross-references by ~450 connections",
        action: "Run bulk ingest on recent 5 video markdown files",
      },
    ],
    markdownReport: `# CortexOS 4C Framework Official Audit Log
**Date**: November 9, 2026
**Target**: Nate Herk Second Brain & Operating System

## System Health: 94/100 (Grade: A)
- **Context Score**: 96/100 (Strong evergreen wikis, rich personal profile)
- **Connections Score**: 92/100 (8 live active tools, minor stale token)
- **Capabilities Score**: 95/100 (73 agent skills, robust AGENTS.md routing)
- **Cadence Score**: 91/100 (Daily & weekly autonomous routines operational)

## Audit Conclusion
The AIOS demonstrates elite context retention. Teammate queries can be answered with greater precision than manual human recall. Moving from passive notes to autonomous background routines is 90% achieved.`,
  });

  const [activeTab, setActiveTab] = useState<"overview" | "report" | "levelup">("overview");
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  const handleRunFreshAudit = async () => {
    try {
      setIsAuditing(true);
      const res = await fetch("/api/gemini/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          osSnapshot: {
            notesCount: 935,
            connectionsCount: 3296,
            activeSources: 7,
            staleCount: 8,
            tools: ["YouTube", "Google Calendar", "Gmail", "Slack", "ClickUp", "GitHub"],
          },
        }),
      });
      const data = await res.json();
      if (data.overallScore) {
        setAuditData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuditing(false);
    }
  };

  const toggleTask = (title: string) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-cyan-950/70 via-slate-950 to-slate-900 border border-cyan-500/30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold mb-1">
              Continuous Improvement Protocol
            </div>
            <h1 className="text-2xl font-extrabold text-white">
              AIOS 4C Health Audit & Level Up Engine
            </h1>
          </div>
        </div>

        <button
          onClick={handleRunFreshAudit}
          disabled={isAuditing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 shrink-0"
        >
          <RotateCcw className={`w-4 h-4 ${isAuditing ? "animate-spin" : ""}`} />
          {isAuditing ? "Auditing System..." : "Run Fresh 4C Audit"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "overview"
              ? "bg-slate-900 text-cyan-400 border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Scorecard & Radar
        </button>
        <button
          onClick={() => setActiveTab("levelup")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "levelup"
              ? "bg-slate-900 text-cyan-400 border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Level Up Recommendations ({auditData.levelUpTasks.length})
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "report"
              ? "bg-slate-900 text-cyan-400 border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Full Markdown Audit Log
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Overall Score Banner */}
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6 backdrop-blur-xl">
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24 rounded-full bg-slate-900 border-4 border-cyan-500 flex flex-col items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
                <span className="text-3xl font-extrabold text-white font-mono leading-none">
                  {auditData.overallScore}
                </span>
                <span className="text-[10px] font-mono text-cyan-400 mt-1 uppercase">/ 100</span>
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-slate-400 mb-1">
                  Overall System Readiness
                </div>
                <div className="text-xl font-bold text-white mb-1">{auditData.grade}</div>
                <div className="text-xs text-slate-400 max-w-md">
                  Audit verifies your Second Brain against Nate Herk&apos;s 3 tests: teammate question
                  answering, context-switching reduction, and mental offloading.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="text-xs font-mono text-slate-400">Context</div>
                <div className="text-lg font-bold text-sky-400 font-mono">
                  {auditData.contextScore}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="text-xs font-mono text-slate-400">Connections</div>
                <div className="text-lg font-bold text-cyan-400 font-mono">
                  {auditData.connectionsScore}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="text-xs font-mono text-slate-400">Capabilities</div>
                <div className="text-lg font-bold text-purple-400 font-mono">
                  {auditData.capabilitiesScore}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="text-xs font-mono text-slate-400">Cadence</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  {auditData.cadenceScore}%
                </div>
              </div>
            </div>
          </div>

          {/* Strengths & Vulnerabilities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 backdrop-blur-xl space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Validated System Strengths
              </div>
              <div className="space-y-2">
                {auditData.strengths.map((str, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{str}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/80 border border-amber-500/30 backdrop-blur-xl space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Critical Gaps & Attention Areas
              </div>
              <div className="space-y-2">
                {auditData.vulnerabilities.map((vuln, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{vuln}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "levelup" && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400">
            Action items identified by the audit engine. Execute these to level up your score from{" "}
            {auditData.overallScore}/100 to 98/100:
          </div>

          <div className="space-y-3">
            {auditData.levelUpTasks.map((task, i) => {
              const isDone = completedTasks[task.title];
              return (
                <div
                  key={i}
                  className={`p-4 rounded-xl border transition-all ${
                    isDone
                      ? "bg-emerald-950/30 border-emerald-500/40 opacity-80"
                      : "bg-slate-950/80 border-slate-800"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                        {task.category}
                      </span>
                      <h3
                        className={`text-sm font-bold ${
                          isDone ? "text-emerald-300 line-through" : "text-white"
                        }`}
                      >
                        {task.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => toggleTask(task.title)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                        isDone
                          ? "bg-slate-800 text-slate-400"
                          : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                      }`}
                    >
                      {isDone ? "✓ Completed" : "Execute Level Up →"}
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 mb-1">{task.action}</p>
                  <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Impact: {task.impact}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "report" && (
        <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <span className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Markdown Report (/audits/audit-2026-11-09.md)
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(auditData.markdownReport)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300"
            >
              Copy Markdown
            </button>
          </div>
          <div className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {auditData.markdownReport}
          </div>
        </div>
      )}
    </div>
  );
}
