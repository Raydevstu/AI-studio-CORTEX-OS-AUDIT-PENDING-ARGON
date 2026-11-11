import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { Type } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { osSnapshot } = await req.json();

    const prompt = `Perform an official CortexOS 4C Framework Audit (Context, Connections, Capabilities, Cadence).
Evaluate the current system status and grade it from 0 to 100 overall and for each of the 4Cs.

Current System Snapshot:
${JSON.stringify(osSnapshot || {})}

Provide:
1. Overall Score (0-100)
2. Four C Scores: Context Score (0-100), Connections Score (0-100), Capabilities Score (0-100), Cadence Score (0-100)
3. Key Strengths (3 bullet points)
4. Critical Gaps & Vulnerabilities (3 bullet points)
5. Level Up Roadmap: 3 high-impact, immediate action steps with specific skills or connector integrations to deploy
6. Executive Summary Markdown Report formatted like Nate Herk's official audit log.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.INTEGER },
            contextScore: { type: Type.INTEGER },
            connectionsScore: { type: Type.INTEGER },
            capabilitiesScore: { type: Type.INTEGER },
            cadenceScore: { type: Type.INTEGER },
            grade: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            vulnerabilities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            levelUpTasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  action: { type: Type.STRING },
                },
                required: ["title", "category", "action"],
              },
            },
            markdownReport: { type: Type.STRING },
          },
          required: [
            "overallScore",
            "contextScore",
            "connectionsScore",
            "capabilitiesScore",
            "cadenceScore",
            "grade",
            "strengths",
            "vulnerabilities",
            "levelUpTasks",
            "markdownReport",
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Audit generation error:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: err?.message || "Failed to generate system audit." },
      { status: 500 }
    );
  }
}
