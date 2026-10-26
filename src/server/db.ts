import { Pool, types } from "pg";
import { readFile, readdir } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { ServiceError } from "./config";
types.setTypeParser(1082, (v) => v);
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
const state = globalThis as typeof globalThis & { marketDatabase?: Promise<Db> | undefined };
function pgDb(pool: Pool): Db {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => ({
      rows: (await pool.query(sql, params)).rows as T[],
    }),
    exec: (sql) => pool.query(sql),
    transaction: async (fn) => {
      const client = await pool.connect();
      const tx: Db = {
        query: async <T>(sql: string, params: unknown[] = []) => ({
          rows: (await client.query(sql, params)).rows as T[],
        }),
        exec: (sql) => client.query(sql),
        transaction: async () => {
          throw new Error("Nested transaction");
        },
      };
      try {
        await client.query("BEGIN");
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

function postgresPoolOptions(connectionString: string) {
  const configuredMax = Number(process.env["DATABASE_POOL_MAX"] ?? 3);
  const max = Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : 3;
  const url = new URL(connectionString);
  const urlSslMode = url.searchParams.get("sslmode")?.toLowerCase();
  url.searchParams.delete("sslmode");
  const configuredSsl = process.env["DATABASE_SSL"];
  const sslEnabled =
    configuredSsl === "true" ||
    (configuredSsl === undefined &&
      (process.env["NODE_ENV"] === "production" || (urlSslMode && urlSslMode !== "disable")));
  const caBase64 = process.env["DATABASE_CA_BASE64"];
  const ca = caBase64 ? Buffer.from(caBase64, "base64").toString("utf8") : undefined;
  if (caBase64 && !ca?.includes("-----BEGIN CERTIFICATE-----"))
    throw new ServiceError("DATABASE_CA_INVALID", 500);
  return {
    connectionString: url.toString(),
    max,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
    ssl: sslEnabled ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) } : undefined,
  };
}
export function embeddedDb(pg: PGlite): Db {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => ({
      rows: (await pg.query(sql, params)).rows as T[],
    }),
    exec: (sql) => pg.exec(sql),
    transaction: (fn) =>
      pg.transaction((tx) =>
        fn({
          query: async <T>(sql: string, params: unknown[] = []) => ({
            rows: (await tx.query(sql, params)).rows as T[],
          }),
          exec: (sql) => tx.exec(sql),
          transaction: async () => {
            throw new Error("Nested transaction");
          },
        }),
      ),
  };
}
export async function migrate(db: Db) {
  const directory = new URL("../db/migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(file, directory), "utf8"));
  }
}
export function getDb(): Promise<Db> {
  if (!state.marketDatabase)
    state.marketDatabase = (async () => {
      if (process.env["DATABASE_URL"])
        return pgDb(new Pool(postgresPoolOptions(process.env["DATABASE_URL"])));
      if (process.env["DATABASE_MODE"] === "pglite" && process.env["NODE_ENV"] !== "production") {
        const { PGlite } = await import("@electric-sql/pglite");
        const db = embeddedDb(new PGlite(process.env["PGLITE_PATH"] || ".local/market-db"));
        await migrate(db);
        return db;
      }
      throw new ServiceError("DATABASE_NOT_CONFIGURED");
    })().catch((e) => {
      state.marketDatabase = undefined;
      throw e;
    });
  return state.marketDatabase;
}
