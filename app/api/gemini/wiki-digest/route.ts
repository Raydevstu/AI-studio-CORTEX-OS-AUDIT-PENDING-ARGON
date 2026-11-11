import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { Type } from "@google/genai";

function synthesizeLocalWikiDigest(
  rawNote: string,
  existingCategories?: string[]
) {
  const content = rawNote || "";
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let title = "Synthesized Knowledge Node";
  for (const l of lines) {
    if (l.startsWith("#")) {
      const clean = l.replace(/^#+\s*/, "").replace(/[*`_]/g, "").trim();
      if (clean) {
        title = clean;
        break;
      }
    }
  }
  if (title === "Synthesized Knowledge Node" && lines.length > 0) {
    title = lines[0].replace(/[*`_#]/g, "").slice(0, 60).trim();
  }

  const defaultCats = [
    "Business wiki",
    "Meetings",
    "Video knowledge",
    "Claude memory",
    "Codex memory",
    "Projects",
    "Skills & agents",
  ];
  const cats =
    existingCategories && existingCategories.length > 0
      ? existingCategories
      : defaultCats;

  const lower = content.toLowerCase();
  let category = cats[0];
  if (
    lower.includes("meeting") ||
    lower.includes("transcript") ||
    lower.includes("sync")
  ) {
    category =
      cats.find((c) => c.toLowerCase().includes("meeting")) || "Meetings";
  } else if (
    lower.includes("skill") ||
    lower.includes("agent") ||
    lower.includes("prompt")
  ) {
    category =
      cats.find(
        (c) =>
          c.toLowerCase().includes("skill") || c.toLowerCase().includes("agent")
      ) || "Skills & agents";
  } else if (
    lower.includes("project") ||
    lower.includes("roadmap") ||
    lower.includes("sprint")
  ) {
    category =
      cats.find((c) => c.toLowerCase().includes("project")) || "Projects";
  } else if (
    lower.includes("code") ||
    lower.includes("database") ||
    lower.includes("sql") ||
    lower.includes("api")
  ) {
    category =
      cats.find((c) => c.toLowerCase().includes("codex")) || "Codex memory";
  }

  const nonHeadingLines = lines.filter(
    (l) => !l.startsWith("#") && l.length > 10
  );
  const summary =
    nonHeadingLines.slice(0, 2).join(" ") ||
    `${title} ingested into CortexOS Second Brain knowledge base.`;

  const hashtagMatches = Array.from(content.matchAll(/#([a-zA-Z0-9_-]+)/g)).map(
    (m) => m[1]
  );
  const codeMatches = Array.from(
    content.matchAll(/`([a-zA-Z0-9_-]{3,25})`/g)
  ).map((m) => m[1]);
  const combinedTags = Array.from(
    new Set([
      ...hashtagMatches,
      ...codeMatches,
      category.toLowerCase().replace(/\s+/g, "-"),
    ])
  ).slice(0, 5);
  const tags =
    combinedTags.length > 0
      ? combinedTags
      : ["knowledge-node", "cortex-os", "second-brain"];

  const wikilinkMatches = Array.from(
    content.matchAll(/\[\[([^\]]+)\]\]/g)
  ).map((m) => m[1].trim());
  const defaultAnchors = [
    "Jarvis Supervisor",
    "Chief Librarian",
    "4C Foundation",
    "Specialist Studios",
  ];
  const connectedConcepts = Array.from(
    new Set([...wikilinkMatches, ...defaultAnchors])
  ).slice(0, 4);

  const fullMarkdown = content.includes("# ")
    ? content
    : `# ${title}\n\n${content}\n\n## Cross-References\n- Connected: ${connectedConcepts
        .map((c) => `[[${c}]]`)
        .join(", ")}`;

  const importance =
    lower.includes("urgent") ||
    lower.includes("critical") ||
    lower.includes("p0")
      ? "High"
      : "Medium";

  return {
    title,
    category,
    summary,
    fullMarkdown,
    tags,
    connectedConcepts,
    importance,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { rawNote, existingCategories } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        const prompt = `You are an LLM Wiki Ingestion Engine following Andrej Karpathy's concept.
Given the new note or idea, analyze its semantic relationships, assign it to an appropriate second brain source, create bi-directional cross-references, and flag staleness thresholds.

Existing Sources:
${JSON.stringify(
  existingCategories || [
    "Business wiki",
    "Meetings",
    "Video knowledge",
    "Claude memory",
    "Codex memory",
    "Projects",
    "Skills & agents",
  ]
)}

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
                  description:
                    "Titles or keywords of related nodes in the brain.",
                },
                importance: {
                  type: Type.STRING,
                  description: "High, Medium, or Low priority",
                },
              },
              required: [
                "title",
                "category",
                "summary",
                "fullMarkdown",
                "tags",
                "connectedConcepts",
              ],
            },
          },
        });

        const parsed = JSON.parse(response.text || "{}");
        if (parsed.title) {
          return NextResponse.json(parsed);
        }
      } catch (geminiError: unknown) {
        console.warn(
          "Gemini API returned error (billing, quota or offline), activating deterministic Karpathy wiki synthesis:",
          (geminiError as Error)?.message || geminiError
        );
      }
    }

    // Deterministic fallback synthesis
    const fallback = synthesizeLocalWikiDigest(rawNote, existingCategories);
    return NextResponse.json(fallback);
  } catch (error: unknown) {
    console.error("Wiki digest unexpected error:", error);
    // Even on total exception, return safe structured note
    const safeNote = synthesizeLocalWikiDigest("Untitled Note");
    return NextResponse.json(safeNote);
  }
}
