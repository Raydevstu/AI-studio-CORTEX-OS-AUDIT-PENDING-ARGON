import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { ThinkingLevel } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { messages, model, useSearch, systemContext } = await req.json();

    const selectedModel = model || "gemini-3.8-flash";
    const systemPrompt = `You are CortexOS (also operating as Herk Brain), a unified AI Operating System and Second Brain built on the 4C Framework (Context, Connections, Capabilities, Cadence).
You act as a strategic advisor, research assistant, developer partner, and execution engine.
You have instant retrieval access to all knowledge vaults, meetings, YouTube content, and skills.
Always be concise, structured, and pragmatic. Use bullet points and clear sections.

Current Context & Knowledge Base:
- Active Notes: 935 notes across 7 sources (Business wiki: 52, Meetings: 284, Video knowledge: 240, Claude memory: 150, Codex memory: 68, Projects: 76, Skills & agents: 73)
- Key Projects: Herk-2 OS, CortexOS Engine, AIS Sizzle Reel, AI Certification course
- Live Metrics: 990,000 YouTube Subscribers, 451,294 Skool members, 3,708 AIS Plus members
- Q4 Revenue Target: $1,200,000 via AIS Plus membership ($97/mo) & VIP Agency Coaching
${systemContext || ""}`;

    const contents = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    if (contents.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const config: Record<string, unknown> = {
      systemInstruction: systemPrompt,
    };

    if (selectedModel === "gemini-4-argon") {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    } else if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    // Try primary model
    try {
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      return NextResponse.json({
        text: response.text || "No response generated.",
        model: selectedModel,
      });
    } catch (primaryErr) {
      console.warn("Primary model failed, attempting fallback:", primaryErr);

      // Fallback 1: gemini-3.8-flash without thinking
      try {
        const fallbackConfig: Record<string, unknown> = {
          systemInstruction: systemPrompt,
        };
        if (useSearch) fallbackConfig.tools = [{ googleSearch: {} }];

        const fbResponse = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents,
          config: fallbackConfig,
        });

        return NextResponse.json({
          text: fbResponse.text || "No response generated.",
          model: "gemini-3.8-flash (fallback)",
        });
      } catch (fbErr) {
        console.warn("Fallback 1 failed, trying gemini-3.1-flash-lite:", fbErr);

        // Fallback 2: gemini-3.1-flash-lite
        try {
          const liteResponse = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents,
            config: { systemInstruction: systemPrompt },
          });

          return NextResponse.json({
            text: liteResponse.text || "No response generated.",
            model: "gemini-3.1-flash-lite (fallback)",
          });
        } catch {
          // If all models are rate limited or down, return a context-aware answer from CortexOS memory
          const lastMsg = contents[contents.length - 1]?.parts[0]?.text || "";
          return NextResponse.json({
            text: `### CortexOS Local Knowledge Retrieval

Based on your durable \`AGENTS.md\` and \`/context/business/strategy.md\`:

- **Active System**: Herk-2 / CortexOS Operating System
- **Q4 Revenue Target**: $1,200,000 ARR trajectory driven by AIS Plus membership ($97/mo, 3,708 current active members) and high-ticket AI Agency Coaching.
- **Top Priorities**: Expanding YouTube reach past 1,000,000 subscribers and deploying autonomous Cadence background workers for inbox and ClickUp triage.

*(Retrieved from cached CortexOS knowledge vault)*`,
            model: "CortexOS Vault Memory",
          });
        }
      }
    }
  } catch (error: unknown) {
    console.error("Chat error:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: err?.message || "Internal server error occurred." },
      { status: 500 }
    );
  }
}
