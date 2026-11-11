import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import path from "node:path";
import fs from "node:fs";
import { sha256Hex } from "../cortex-os-data.ts";

export interface QueryExecutor {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
  exec(rawSql: string): Promise<void>;
}

declare global {
  var __cortexPgSql: ReturnType<typeof postgres> | undefined;
  var __cortexPglite: PGlite | undefined;
  var __cortexDbInitPromise: Promise<QueryExecutor> | undefined;
  var __cortexMigrated: boolean | undefined;
  var __cortexMutexPromise: Promise<unknown> | undefined;
}

/**
 * Deterministic UUID v5-style mapper so human-readable seed aliases
 * (e.g. 'proj-solar-crm', 'wiki-index') map 1:1 to valid Postgres UUIDs
 * while existing RFC-4122 UUIDs pass through unchanged.
 */
export function toUuid(idOrSeed: string): string {
  const trimmed = (idOrSeed || "").trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed
    )
  ) {
    return trimmed.toLowerCase();
  }
  const h = sha256Hex(trimmed || "cortex-default");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(
    17,
    20
  )}-${h.slice(20, 32)}`;
}

export function isRemotePostgresUrl(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return false;
  if (
    url === "postgresql://postgres:postgres@localhost:5432/cortexos" ||
    url === "MY_DATABASE_URL"
  ) {
    return false;
  }
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

async function createExecutor(): Promise<QueryExecutor> {
  if (isRemotePostgresUrl()) {
    const connStr = process.env.DATABASE_URL!.trim();
    if (!global.__cortexPgSql) {
      global.__cortexPgSql = postgres(connStr, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 15,
      });
    }
    const sqlClient = global.__cortexPgSql;
    return {
      async query<T = Record<string, unknown>>(
        text: string,
        params: unknown[] = []
      ): Promise<{ rows: T[] }> {
        const result = await sqlClient.unsafe<T[]>(
          text,
          params as postgres.ParameterOrJSON<never>[]
        );
        return { rows: Array.from(result) };
      },
      async exec(rawSql: string): Promise<void> {
        await sqlClient.unsafe(rawSql);
      },
    };
  }

  // Persistent on-disk PostgreSQL 16 (PGlite + pg_trgm + pgcrypto)
  if (!global.__cortexPglite) {
    const customDir = process.env.CORTEX_PGDATA_DIR?.trim();
    const dataDir =
      customDir || path.join(process.cwd(), ".aistudio", "pgdata");
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    global.__cortexPglite = await PGlite.create({
      dataDir,
      extensions: { pg_trgm, pgcrypto },
    });
  }

  const pgl = global.__cortexPglite;
  return {
    async query<T = Record<string, unknown>>(
      text: string,
      params: unknown[] = []
    ): Promise<{ rows: T[] }> {
      const res = await pgl.query<T>(text, params);
      return { rows: res.rows };
    },
    async exec(rawSql: string): Promise<void> {
      await pgl.exec(rawSql);
    },
  };
}

export async function getRawExecutor(): Promise<QueryExecutor> {
  if (!global.__cortexDbInitPromise) {
    global.__cortexDbInitPromise = createExecutor();
  }
  return global.__cortexDbInitPromise;
}

/**
 * Serializes operations when running on embedded PGlite so concurrent
 * transactions never overlap on the single connection.
 */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  if (isRemotePostgresUrl()) {
    return fn();
  }
  const prev = global.__cortexMutexPromise || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  global.__cortexMutexPromise = prev.then(() => next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function dbQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[] }> {
  const exec = await getRawExecutor();
  if (!global.__cortexMigrated) {
    const { ensureDatabaseMigrated } = await import("./migrate.ts");
    await ensureDatabaseMigrated();
  }
  return withLock(() => exec.query<T>(text, params));
}

export const query = dbQuery;

export async function ensureDatabaseMigrated() {
  const { ensureDatabaseMigrated: runEnsure } = await import("./migrate.ts");
  return runEnsure();
}

export async function dbTransaction<T>(
  fn: (tx: QueryExecutor) => Promise<T>
): Promise<T> {
  const exec = await getRawExecutor();
  if (!global.__cortexMigrated) {
    const { ensureDatabaseMigrated: runEnsure } = await import("./migrate.ts");
    await runEnsure();
  }

  if (isRemotePostgresUrl() && global.__cortexPgSql) {
    const sqlClient = global.__cortexPgSql;
    return (await sqlClient.begin(async (txSql) => {
      const txExec: QueryExecutor = {
        async query<R = Record<string, unknown>>(
          text: string,
          params: unknown[] = []
        ): Promise<{ rows: R[] }> {
          const rows = await txSql.unsafe<R[]>(
            text,
            params as postgres.ParameterOrJSON<never>[]
          );
          return { rows: Array.from(rows) };
        },
        async exec(rawSql: string): Promise<void> {
          await txSql.unsafe(rawSql);
        },
      };
      return fn(txExec);
    })) as T;
  }

  return withLock(async () => {
    await exec.exec("BEGIN");
    try {
      const result = await fn(exec);
      await exec.exec("COMMIT");
      return result;
    } catch (err) {
      await exec.exec("ROLLBACK");
      throw err;
    }
  });
}
