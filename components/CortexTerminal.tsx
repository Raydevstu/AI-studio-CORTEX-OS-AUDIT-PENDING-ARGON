"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Terminal as TerminalIcon,
  Send,
  Sparkles,
  Volume2,
  Mic,
  MicOff,
  Search,
  Cpu,
  Bot,
  Zap,
  Globe,
  CornerDownLeft,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string;
  timestamp: string;
}

interface CortexTerminalProps {
  initialPrompt?: string;
}

export default function CortexTerminal({ initialPrompt }: CortexTerminalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to CortexOS. I am your strategic advisor, research assistant, and autonomous execution engine. Your entire second brain (935 notes, 7 sources, 3,296 connections) is loaded in memory. How can I assist your business today?",
      model: "Astra (gemini-4-argon)",
      timestamp: "Just now",
    },
  ]);
  const [prevPrompt, setPrevPrompt] = useState(initialPrompt);
  const [inputText, setInputText] = useState(initialPrompt || "");
  const [selectedModel, setSelectedModel] = useState<"gemini-4-argon" | "gemini-3.8-flash">(
    "gemini-4-argon"
  );
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoTts, setAutoTts] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (initialPrompt !== prevPrompt) {
    setPrevPrompt(initialPrompt);
    setInputText(initialPrompt || "");
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
          useSearch: useSearchGrounding,
        }),
      });

      const data = await res.json();
      const assistantText = data.text || "Command executed successfully.";

      const assistantMessage: Message = {
        role: "assistant",
        content: assistantText,
        model: selectedModel === "gemini-4-argon" ? "Astra (gemini-4-argon)" : "5.6 Soul (gemini-3.8-flash)",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (autoTts) {
        speakResponse(assistantText);
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, an error occurred communicating with the CortexOS engine.",
          timestamp: "Just now",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const speakResponse = async (text: string) => {
    try {
      const res = await fetch("/api/gemini/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 500) }),
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

  const toggleMic = () => {
    if (typeof window === "undefined") return;

    interface SpeechRecognitionWindow extends Window {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (e: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (e: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void;
      };
    }

    const win = window as unknown as SpeechRecognitionWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        handleSendMessage(transcript);
      };

      recognition.start();
    } catch (err) {
      console.error("Speech recognition error:", err);
      setIsListening(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-140px)] text-slate-100">
      {/* Top Config Header */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-5 h-5 text-cyan-400" />
          <span className="font-bold text-white text-sm">CortexOS Terminal</span>
          <span className="text-xs font-mono text-slate-400">• Astra Agent Mode</span>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Model Selection */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setSelectedModel("gemini-4-argon")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedModel === "gemini-4-argon"
                  ? "bg-purple-950/80 text-purple-300 border border-purple-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Astra (High Thinking)
            </button>
            <button
              onClick={() => setSelectedModel("gemini-3.8-flash")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedModel === "gemini-3.8-flash"
                  ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              5.6 Soul (Fast)
            </button>
          </div>

          {/* Search Grounding */}
          <button
            onClick={() => setUseSearchGrounding(!useSearchGrounding)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              useSearchGrounding
                ? "bg-sky-950/80 text-sky-300 border-sky-500/40"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Search Grounding
          </button>

          {/* Auto TTS Toggle */}
          <button
            onClick={() => setAutoTts(!autoTts)}
            title="Auto-read responses via Voice TTS"
            className={`p-1.5 rounded-xl border transition-all ${
              autoTts
                ? "bg-cyan-950/80 text-cyan-300 border-cyan-500/40"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 backdrop-blur-xl space-y-4 mb-4 pr-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center gap-2 mb-1 text-[10px] font-mono text-slate-400">
              <span>{msg.role === "user" ? "Nate Herk" : msg.model || "CortexOS"}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <div
              className={`p-4 rounded-2xl max-w-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-cyan-600 text-white rounded-br-none shadow-lg shadow-cyan-950/30"
                  : "bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none shadow-xl"
              }`}
            >
              {msg.content}
            </div>

            {msg.role === "assistant" && (
              <button
                onClick={() => speakResponse(msg.content)}
                className="mt-1 flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-400"
              >
                <Volume2 className="w-3 h-3" /> Play voice
              </button>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 p-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            Astra reasoning engine synthesizing context...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          "What is my Q4 revenue target in the business wiki?",
          "Show me my current top ClickUp bottlenecks",
          "Draft YouTube video title hooks for Claude Code",
          "Run an inbox sweep for unread VIP client inquiries",
        ].map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(chip)}
            className="px-3 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white whitespace-nowrap shrink-0 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 backdrop-blur-xl flex items-center gap-2">
        <button
          onClick={toggleMic}
          className={`p-2.5 rounded-xl border transition-colors ${
            isListening
              ? "bg-rose-500/20 text-rose-400 border-rose-500 animate-pulse"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
          }`}
          title={isListening ? "Listening... click to stop" : "Voice input (mic)"}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Ask CortexOS anything about your second brain, schedule, or code..."
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-400 outline-none"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim() || isLoading}
          className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all disabled:opacity-40"
        >
          <CornerDownLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
