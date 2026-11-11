import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required for TTS." }, { status: 400 });
    }

    // Limit text length to avoid timeouts
    const sanitizedText = text.slice(0, 1000);

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: sanitizedText,
              speechMetadata: {
                style: "Confident, crisp, professional and warm advisor voice",
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return NextResponse.json({ error: "Failed to generate audio output." }, { status: 500 });
    }

    return NextResponse.json({
      audioBase64: base64Audio,
      mimeType: "audio/wav",
    });
  } catch (error: unknown) {
    console.error("TTS generation error:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: err?.message || "Error generating speech." },
      { status: 500 }
    );
  }
}
