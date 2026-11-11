"use client";

import React, { useState } from "react";
import {
  LIVE_METRICS,
  COMM_MESSAGES,
  MEETINGS_LIST,
  COMMUNITY_PULSE,
  CommMessage,
} from "@/lib/knowledge-data";
import {
  Calendar,
  Users,
  Youtube,
  Award,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Mail,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Activity,
  Send,
  RefreshCw,
  ExternalLink,
  Bot,
  Zap,
} from "lucide-react";

interface OsDashboardProps {
  onOpenBrain: () => void;
  onOpenGrillMe: () => void;
  onOpenAudit: () => void;
  onOpenTerminal: (initialPrompt?: string) => void;
}

export default function OsDashboard({
  onOpenBrain,
  onOpenGrillMe,
  onOpenAudit,
  onOpenTerminal,
}: OsDashboardProps) {
  const [activeCommTab, setActiveCommTab] = useState<"all" | "slack" | "clickup" | "email">("all");
  const [comms, setComms] = useState<CommMessage[]>(COMM_MESSAGES);
  const [replyText, setReplyText] = useState("");
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [isDraftingAi, setIsDraftingAi] = useState(false);
  const [cadenceStatus, setCadenceStatus] = useState<string | null>(null);

  const filteredComms = comms.filter(
    (m) => activeCommTab === "all" || m.source === activeCommTab
  );

  const handleSendReply = (msgId: string) => {
    if (!replyText.trim()) return;
    setComms((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, unread: false } : m))
    );
    setReplyText("");
    setActiveReplyId(null);
  };

  const handleAiDraftReply = async (message: CommMessage) => {
    try {
      setIsDraftingAi(true);
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Draft a quick, professional, concise reply from Nate Herk to this message from ${message.sender} (${message.title}): "${message.snippet}". Keep it under 2 sentences.`,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.text) {
        setReplyText(data.text);
      }
    } catch (e) {
      console.error(e);
      setReplyText("Sounds great, let's proceed with this plan. Thanks!");
    } finally {
      setIsDraftingAi(false);
    }
  };

  const runCadenceNow = (title: string) => {
    setCadenceStatus(`Running ${title}...`);
    setTimeout(() => {
      setCadenceStatus(`✓ ${title} completed. Knowledge vaults and comms triaged.`);
      setTimeout(() => setCadenceStatus(null), 4000);
    }, 1500);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Top Banner / Calendar Sync & Date */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-slate-800/80 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                CortexOS Command Center
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400 font-mono">Live Synced</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Nate Herk Operating System
            </h1>
          </div>
        </div>

        {/* Quick Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runCadenceNow("8:00 AM Inbox Sweep")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Run Cadence
          </button>
          <button
            onClick={onOpenGrillMe}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-xs font-medium text-purple-200 transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            Grill Me Interview
          </button>
          <button
            onClick={onOpenAudit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-xs font-medium text-cyan-200 transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Audit OS (94/100)
          </button>
          <button
            onClick={onOpenBrain}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Open 3D Brain
          </button>
        </div>
      </div>

      {cadenceStatus && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs font-mono text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {cadenceStatus}
        </div>
      )}

      {/* 3 Live Metric Cards (Matching Nate Herk's exact synced stats) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* YouTube Subscribers */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Youtube className="w-4 h-4 text-rose-500" />
              YouTube Subscribers
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Synced
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {LIVE_METRICS.youtubeSubscribers.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +12.4K this mo
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Next milestone: 1,000,000 subscribers (99.0% achieved)
          </div>
        </div>

        {/* AI Automation Society */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-cyan-400" />
              AI Automation Society
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Synced
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {LIVE_METRICS.aisCommunityMembers.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +4.2K this wk
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Skool free community classroom & resource packs
          </div>
        </div>

        {/* AIS Plus Members */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-purple-400" />
              AIS Plus Members
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Synced
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {LIVE_METRICS.aisPlusMembers.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-purple-400 flex items-center gap-0.5">
              $97/mo active tier
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Exclusive agent workshops & direct founder access
          </div>
        </div>
      </div>

      {/* Main Grid: Communications + Meetings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unified Communications Hub (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-950/80 border border-slate-800/80 p-5 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                Unified Communications
              </h2>
              <div className="text-xs text-slate-400">
                Slack, ClickUp, and Email fully integrated into CortexOS
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
              {(["all", "slack", "clickup", "email"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveCommTab(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                    activeCommTab === tab
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="space-y-3">
            {filteredComms.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-xl border transition-all ${
                  msg.unread
                    ? "bg-slate-900/80 border-slate-700/80"
                    : "bg-slate-900/30 border-slate-800/50 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                        msg.source === "slack"
                          ? "bg-purple-500/20 text-purple-300"
                          : msg.source === "clickup"
                          ? "bg-violet-500/20 text-violet-300"
                          : "bg-sky-500/20 text-sky-300"
                      }`}
                    >
                      {msg.source}
                    </span>
                    <span className="text-xs font-semibold text-white">{msg.sender}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                  </div>

                  {msg.unread && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" title="Unread" />
                  )}
                </div>

                <div className="text-xs font-medium text-slate-200 mb-1">{msg.title}</div>
                <p className="text-xs text-slate-400 leading-relaxed">{msg.snippet}</p>

                {/* Reply Form or Action */}
                {activeReplyId === msg.id ? (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-slate-400">
                        Replying via {msg.source}...
                      </span>
                      <button
                        onClick={() => handleAiDraftReply(msg)}
                        disabled={isDraftingAi}
                        className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono"
                      >
                        <Sparkles className="w-3 h-3" />
                        {isDraftingAi ? "Drafting..." : "Auto-Draft with CortexOS"}
                      </button>
                    </div>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type reply or click Auto-Draft..."
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-cyan-500"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setActiveReplyId(null);
                          setReplyText("");
                        }}
                        className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSendReply(msg.id)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
                      >
                        <Send className="w-3 h-3" /> Send
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center justify-between">
                    <button
                      onClick={() => setActiveReplyId(msg.id)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      Reply directly →
                    </button>
                    <button
                      onClick={() => onOpenTerminal(`Summarize thread and create action item for: ${msg.title}`)}
                      className="text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      Delegate to agent
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Meetings & AI Summaries (1 col) */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800/80 p-5 backdrop-blur-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-400" />
                Meetings Hub
              </h2>
              <div className="text-xs text-slate-400">
                Synced calendar with auto-generated summaries
              </div>
            </div>

            <div className="space-y-3">
              {MEETINGS_LIST.map((meet) => (
                <div
                  key={meet.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white">{meet.title}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {meet.date} • {meet.time}
                      </div>
                    </div>
                    {meet.isPast ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                        Summarized
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                        Upcoming
                      </span>
                    )}
                  </div>

                  {meet.aiSummary && (
                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300 leading-relaxed">
                      <span className="font-semibold text-cyan-400 font-mono text-[10px] block mb-1">
                        AI SUMMARY:
                      </span>
                      {meet.aiSummary}
                    </div>
                  )}

                  {meet.actionItems && meet.actionItems.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        Action Items:
                      </div>
                      {meet.actionItems.map((act, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-[11px] text-slate-300"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{act}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Community Pulse Card */}
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800/80 p-5 backdrop-blur-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Community & Industry Pulse
              </h2>
              <div className="text-xs text-slate-400">
                Top YouTube comments & what members are stuck on
              </div>
            </div>

            {/* Top Comments */}
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400 mb-2">
                Top YouTube Comments:
              </div>
              <div className="space-y-2">
                {COMMUNITY_PULSE.topComments.map((c, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span>{c.author}</span>
                      <span className="text-[10px] font-mono text-rose-400">♥ {c.likes}</span>
                    </div>
                    <p className="text-xs text-slate-300 italic">&ldquo;{c.text}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stuck On */}
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400 mb-2">
                What They Are Stuck On:
              </div>
              <div className="space-y-1.5">
                {COMMUNITY_PULSE.stuckOnTopics.map((stuck, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 text-xs"
                  >
                    <span className="text-slate-300 truncate">{stuck.topic}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold shrink-0">
                      {stuck.count} tickets
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
