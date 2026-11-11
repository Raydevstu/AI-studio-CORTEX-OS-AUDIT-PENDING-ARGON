"use client";

import React, { useState } from "react";
import {
  Bot,
  Send,
  Sparkles,
  Volume2,
  FileCheck,
  Flame,
  ArrowRight,
  Database,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

interface GrillItem {
  questionNumber: number;
  question: string;
  topicFocus: string;
  userAnswer?: string;
  extractedInsight?: string;
  suggestedVaultFile?: string;
}

export default function GrillMeInterviewer() {
  const [topic, setTopic] = useState("Business Bottlenecks & Weekly Priorities");
  const [history, setHistory] = useState<GrillItem[]>([
    {
      questionNumber: 1,
      question:
        "What is the single biggest bottleneck preventing you from publishing two YouTube videos every week while scaling AIS Plus coaching?",
      topicFocus: "Operational Bottlenecks",
      suggestedVaultFile: "/context/business/priorities.md",
    },
  ]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [capturedInsights, setCapturedInsights] = useState<
    { insight: string; file: string; timestamp: string }[]
  >([]);
  const [savedVaultNotice, setSavedVaultNotice] = useState<string | null>(null);

  const activeQuestion = history[history.length - 1];

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || isLoading) return;

    const answer = currentAnswer;
    setCurrentAnswer("");
    setIsLoading(true);

    try {
      // Update history with user's answer
      const updatedHistory = history.map((item, idx) =>
        idx === history.length - 1 ? { ...item, userAnswer: answer } : item
      );

      const res = await fetch("/api/gemini/grill-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          history: updatedHistory.map((h) => ({
            question: h.question,
            answer: h.userAnswer,
            topic: h.topicFocus,
          })),
        }),
      });

      const data = await res.json();

      if (data.nextQuestion) {
        // Save extracted insight if present
        if (data.extractedInsight) {
          const newInsight = {
            insight: data.extractedInsight,
            file: data.suggestedVaultFile || "/context/business/priorities_capture.md",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setCapturedInsights((prev) => [newInsight, ...prev]);
          setSavedVaultNotice(
            `Saved to ${newInsight.file}: "${data.extractedInsight.slice(0, 80)}..."`
          );
          setTimeout(() => setSavedVaultNotice(null), 5000);
        }

        const nextItem: GrillItem = {
          questionNumber: history.length + 1,
          question: data.nextQuestion,
          topicFocus: data.topicFocus || topic,
          suggestedVaultFile: data.suggestedVaultFile,
        };

        setHistory([...updatedHistory, nextItem]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayVoice = async (text: string) => {
    try {
      const res = await fetch("/api/gemini/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
        await audio.play();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-950 to-slate-900 border border-purple-500/30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Flame className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-purple-400 font-semibold">
                CortexOS Interrogation Engine
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                Matt Pocock / Nate Herk Style
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white">
              &ldquo;Grill Me&rdquo; Knowledge Extraction
            </h1>
          </div>
        </div>

        {/* Topic Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Topic:</span>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 outline-none focus:border-purple-500"
          >
            <option value="Business Bottlenecks & Weekly Priorities">
              Business Bottlenecks & Priorities
            </option>
            <option value="Team Coordination & Delegation Rules">
              Team Coordination & Delegation Rules
            </option>
            <option value="YouTube Content Strategy & Production">
              YouTube Content Strategy & Production
            </option>
            <option value="AIOS Architecture & Connector Roadmap">
              AIOS Architecture & Connector Roadmap
            </option>
          </select>
        </div>
      </div>

      {savedVaultNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs font-mono text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {savedVaultNotice}
        </div>
      )}

      {/* Main Grid: Active Question & Captured Vault Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Question and Response (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Question Box */}
          <div className="p-6 rounded-2xl bg-slate-950/85 border border-purple-500/40 backdrop-blur-xl relative shadow-2xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-xs font-mono text-purple-300 uppercase font-bold tracking-wider">
                  Question #{activeQuestion.questionNumber} • {activeQuestion.topicFocus}
                </span>
              </div>
              <button
                onClick={() => handlePlayVoice(activeQuestion.question)}
                title="Hear question via AI TTS"
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-purple-500 text-slate-400 hover:text-purple-300 transition-colors"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-lg font-semibold text-white leading-relaxed mb-4">
              &ldquo;{activeQuestion.question}&rdquo;
            </p>

            {/* Answer Input */}
            <div className="space-y-3">
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Give honest, tactical specifics (e.g. 'I spend 8 hours every Monday triaging Slack...')"
                rows={4}
                className="w-full p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-purple-500 text-sm text-slate-100 placeholder-slate-400 outline-none transition-all resize-y"
              />

              <div className="flex items-center justify-between">
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  Auto-saves to: {activeQuestion.suggestedVaultFile || "context/business/priorities.md"}
                </div>

                <button
                  onClick={handleSubmitAnswer}
                  disabled={!currentAnswer.trim() || isLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Synthesizing...</span>
                  ) : (
                    <>
                      <span>Next Probing Question</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Past Q&A in this session */}
          {history.length > 1 && (
            <div className="rounded-2xl bg-slate-950/80 border border-slate-800/80 p-5 backdrop-blur-xl space-y-4">
              <div className="text-xs font-mono uppercase text-slate-400 font-semibold">
                Session Transcript ({history.length - 1} answered)
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {history
                  .slice(0, history.length - 1)
                  .reverse()
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="font-semibold text-purple-300">
                        Q{item.questionNumber}: {item.question}
                      </div>
                      <div className="text-slate-300 pl-3 border-l-2 border-slate-700">
                        {item.userAnswer}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Captured Durable Insights Vault (1 col) */}
        <div className="rounded-2xl bg-slate-950/80 border border-slate-800/80 p-5 backdrop-blur-xl space-y-4 flex flex-col">
          <div className="border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              Captured Vault Knowledge
            </div>
            <div className="text-xs text-slate-400">
              Durable facts automatically extracted from your answers
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[480px]">
            {capturedInsights.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <Sparkles className="w-6 h-6 text-purple-400 mx-auto opacity-50" />
                <p>Answer the question above to start extracting knowledge into your second brain.</p>
              </div>
            ) : (
              capturedInsights.map((ins, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-slate-900/60 border border-emerald-500/20 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400">
                    <span>{ins.file}</span>
                    <span className="text-slate-400">{ins.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{ins.insight}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
