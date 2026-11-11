import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const DEFAULT_OWNER_KEY = "cortex-owner-key-v1";

export function getExpectedOwnerKey(): string {
  const envKey = process.env.OWNER_KEY?.trim();
  return envKey && envKey.length > 0 ? envKey : DEFAULT_OWNER_KEY;
}

/**
 * Constant-time comparison of the provided key against the expected OWNER_KEY
 * using Node's crypto.timingSafeEqual. Never logs either key.
 */
export function timingSafeCompareKeys(
  provided: string,
  expected: string
): boolean {
  if (!provided || !expected) {
    return false;
  }
  const bufProvided = Buffer.from(provided, "utf8");
  const bufExpected = Buffer.from(expected, "utf8");

  if (bufProvided.length !== bufExpected.length) {
    const hashProvided = crypto
      .createHash("sha256")
      .update(bufProvided)
      .digest();
    const hashExpected = crypto
      .createHash("sha256")
      .update(bufExpected)
      .digest();
    crypto.timingSafeEqual(hashProvided, hashExpected);
    return false;
  }

  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

/**
 * Verifies the `x-owner-key` header (or `Authorization: Bearer`) on all mutating
 * routes (POST, PATCH, PUT, DELETE).
 * Uses timing-safe comparison against process.env.OWNER_KEY and returns 401 otherwise.
 * Never logs the key.
 */
export function requireOwnerKey(req: NextRequest): NextResponse | null {
  const expected = getExpectedOwnerKey();
  const headerKey = req.headers.get("x-owner-key")?.trim() || "";
  const authHeader = req.headers.get("authorization")?.trim() || "";
  const bearerKey = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const provided = headerKey || bearerKey;
  if (!provided || !timingSafeCompareKeys(provided, expected)) {
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
      {
        error: "Rate limit exceeded for ingestion route. Please retry shortly.",
      },
      { status: 429 }
    );
  }

  entry.timestamps.push(now);
  rateBuckets.set(bucketKey, entry);
  return null;
}
