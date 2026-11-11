import { NextRequest, NextResponse } from "next/server";

export const DEFAULT_OWNER_KEY = "cortex-owner-key-v1";

export function getExpectedOwnerKey(): string {
  return process.env.OWNER_KEY || DEFAULT_OWNER_KEY;
}

/**
 * Verifies the OWNER_KEY secret on all mutating routes (POST, PATCH, PUT, DELETE)
 * and /api/admin/* endpoints.
 * Accepts either:
 *   - Header `x-owner-key: <OWNER_KEY>`
 *   - Header `Authorization: Bearer <OWNER_KEY>`
 * Returns null if authorized, or a 401 NextResponse if unauthorized.
 */
export function requireOwnerKey(req: NextRequest): NextResponse | null {
  const expected = getExpectedOwnerKey();
  const headerKey = req.headers.get("x-owner-key")?.trim();
  const authHeader = req.headers.get("authorization")?.trim();
  const bearerKey =
    authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

  const provided = headerKey || bearerKey;
  if (!provided || provided !== expected) {
    return NextResponse.json(
      { error: "Unauthorized: valid OWNER_KEY required" },
      { status: 401 }
    );
  }
  return null;
}

// Sliding-window rate limiter for ingestion endpoints
interface RateWindow {
  timestamps: number[];
}

const rateBuckets = new Map<string, RateWindow>();

export function checkRateLimit(
  bucketKey: string,
  maxRequests = 25,
  windowMs = 60_000
): NextResponse | null {
  const now = Date.now();
  const entry = rateBuckets.get(bucketKey) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    return NextResponse.json(
      { error: "Rate limit exceeded for ingestion route. Please retry shortly." },
      { status: 429 }
    );
  }

  entry.timestamps.push(now);
  rateBuckets.set(bucketKey, entry);
  return null;
}
