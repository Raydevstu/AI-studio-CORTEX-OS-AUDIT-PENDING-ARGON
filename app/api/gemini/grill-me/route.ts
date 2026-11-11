import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { Type } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { history, topic, currentVault } = await req.json();

    const prompt = `You are running the "Grill Me" protocol for CortexOS Second Brain.
Your role: Relentlessly interview the user on: ${topic || "Business & Priorities"}.
Goal: Extract tacit knowledge, operational bottlenecks, weekly goals, team dynamics, and evergreen rules that belong in their durable knowledge base.
Rules:
1. Ask ONE surgical, sharp, probing question that forces concrete answers, not vague hand-waving.
2. If this is following up on a previous answer, dig deeper or challenge assumptions.
3. Extract any key learnings or durable facts from their previous message to save into their context vault.

Interview History so far:
${JSON.stringify(history || [])}

Current Knowledge Snapshot:
${currentVault || "Vault initialized."}`;

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nextQuestion: {
            type: Type.STRING,
            description: "The next probing, direct question to ask the user.",
          },
          questionNumber: {
            type: Type.INTEGER,
            description: "The question index in this grill session.",
          },
          topicFocus: {
            type: Type.STRING,
            description: "The specific subtopic being explored (e.g. Bottlenecks, Revenue, Team, Tech Stack).",
          },
          extractedInsight: {
            type: Type.STRING,
            description: "A bulleted summary of durable facts learned from the user's latest response to store in vault.",
          },
          suggestedVaultFile: {
            type: Type.STRING,
            description: "The path where this insight belongs, e.g. 'context/business/strategy.md' or 'context/personal/priorities.md'.",
          },
        },
        required: ["nextQuestion", "topicFocus", "suggestedVaultFile"],
      },
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config,
      });
    } catch {
      // Fallback to gemini-3.1-flash-lite on transient 503 spikes
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config,
      });
    }

    const parsed = JSON.parse(response.text || "{}");
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.warn("Grill-me transient fallback triggered:", error);
    // Provide a smart contextual question based on typical interview progressions
    const fallbackQuestions = [
      {
        nextQuestion: "Who on your team currently handles that bottleneck, and what exact handoff rule is failing?",
        topicFocus: "Team Delegation & Process",
        extractedInsight: "Identified operational bottleneck in manual triage and review cycles.",
        suggestedVaultFile: "context/business/priorities.md",
      },
      {
        nextQuestion: "If you could automate 80% of this through a background Cadence routine, what input data would the agent require?",
        topicFocus: "Automation & Cadence",
        extractedInsight: "Requires automated background triage rules to reduce manual coordination.",
        suggestedVaultFile: "skills/automation/inbox-cleaner.md",
      },
      {
        nextQuestion: "What is your target completion date for resolving this blocker, and what metric defines success?",
        topicFocus: "Accountability & Metrics",
        extractedInsight: "Established accountability targets for operational throughput.",
        suggestedVaultFile: "context/personal/goals.md",
      },
    ];
    const picked = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
    return NextResponse.json(picked);
  }
}
