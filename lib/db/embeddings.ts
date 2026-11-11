import { GoogleGenAI } from "@google/genai";
import { sha256Hex } from "../cortex-os-data.ts";

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIM = 1536;

/**
 * Generates a normalized 1536-dimensional deterministic token-hashed vector
 * when GEMINI_API_KEY is unavailable or offline, preserving cosine similarity
 * between chunks sharing vocabulary.
 */
export function generateDeterministicEmbedding(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    vec[0] = 1;
    return Array.from(vec);
  }

  for (const token of tokens) {
    const hash = sha256Hex(token);
    for (let i = 0; i < 8; i++) {
      const slice = hash.slice(i * 8, (i + 1) * 8);
      const num = parseInt(slice, 16);
      const idx = num % EMBEDDING_DIM;
      const sign = (num & 1) === 0 ? 1 : -1;
      vec[idx] += sign * (1 / (i + 1));
    }
  }

  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1;

  const out = new Array<number>(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    out[i] = Number((vec[i] / norm).toFixed(6));
  }
  return out;
}

/**
 * Embeds text using gemini-embedding-001 with outputDimensionality=1536 explicitly
 * (MUST pass explicitly; the default is 3072). Matches vector(1536) column.
 */
export async function embedText1536(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: {
          outputDimensionality: EMBEDDING_DIM,
        },
      });
      const values = res.embeddings?.[0]?.values;
      if (Array.isArray(values) && values.length === EMBEDDING_DIM) {
        return values;
      }
    } catch {
      // Fallback to deterministic 1536-dim embedding if network/key is unavailable
    }
  }
  return generateDeterministicEmbedding(text);
}

/**
 * Splits a document into overlapping chunks for hybrid FTS + vector indexing.
 */
export function chunkText(
  text: string,
  maxChars = 900,
  overlapChars = 150
): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + maxChars, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    if (end >= cleaned.length) break;
    start = Math.max(start + 1, end - overlapChars);
  }
  return chunks;
}
