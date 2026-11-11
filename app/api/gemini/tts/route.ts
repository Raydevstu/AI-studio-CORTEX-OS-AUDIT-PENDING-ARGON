import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required for TTS." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
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
                    style:
                      "Confident, crisp, professional and warm advisor voice",
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

        const base64Audio =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Audio) {
          return NextResponse.json({
            audioBase64: base64Audio,
            mimeType: "audio/wav",
          });
        }
      } catch (geminiError) {
        console.warn(
          "TTS model unavailable or billing restricted, advising client synthesis:",
          (geminiError as Error)?.message || geminiError
        );
      }
    }

    // Graceful response indicating client-side fallback
    return NextResponse.json({
      fallback: true,
      message: "TTS model unavailable; client-side speech synthesis recommended.",
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({
      fallback: true,
      message: err?.message || "TTS service unavailable.",
    });
  }
}
