import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { Type } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { rawNote, existingCategories } = await req.json();

    const prompt = `You are an LLM Wiki Ingestion Engine following Andrej Karpathy's concept.
Given the new note or idea, analyze its semantic relationships, assign it to an appropriate second brain source, create bi-directional cross-references, and flag staleness thresholds.

Existing Sources:
${JSON.stringify(existingCategories || [
  "Business wiki",
  "Meetings",
  "Video knowledge",
  "Claude memory",
  "Codex memory",
  "Projects",
  "Skills & agents",
])}

Raw Note Content:
${rawNote}

Generate a structured node with connected topics, tags, and cross-reference links.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            summary: { type: Type.STRING },
            fullMarkdown: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            connectedConcepts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Titles or keywords of related nodes in the brain.",
            },
            importance: {
              type: Type.STRING,
              description: "High, Medium, or Low priority",
            },
          },
          required: ["title", "category", "summary", "fullMarkdown", "tags", "connectedConcepts"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Wiki digest error:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: err?.message || "Failed to process wiki note." },
      { status: 500 }
    );
  }
}
