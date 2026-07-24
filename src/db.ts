import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import postgresJs from "postgres";

/** Minimální DB rozhraní — stejné nad PGlite (testy) i Postgres/Supabase (provoz). */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Vše uvnitř fn běží v jedné transakci; výjimka = rollback. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  /** Spustí víc SQL příkazů najednou (migrace). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

function obalPglite(pg: PGlite): Db {
  const obalTx = (t: Transaction): Db => ({
    async query<T>(sql: string, params?: unknown[]) {
      const res = await t.query<T>(sql, params);
      return res.rows;
    },
    // Vnořené transakce PGlite nepodporuje — vnitřní tx sdílí vnější.
    tx: async (fn) => fn(obalTx(t)),
    exec: async (sql) => {
      await t.exec(sql);
    },
    close: async () => {},
  });

  return {
    async query<T>(sql: string, params?: unknown[]) {
      const res = await pg.query<T>(sql, params);
      return res.rows;
    },
    tx: (fn) => pg.transaction((t) => fn(obalTx(t))) as Promise<ReturnType<typeof fn> extends Promise<infer R> ? R : never>,
    exec: async (sql) => {
      await pg.exec(sql);
    },
    close: () => pg.close(),
  };
}

/** In-process Postgres pro testy a lokální běh bez Supabase. */
export async function pripojPglite(): Promise<Db> {
  return obalPglite(new PGlite());
}

/** Připojení na skutečný Postgres (Supabase) přes DATABASE_URL. */
export function pripojPostgres(url: string): Db {
  const sql = postgresJs(url, { max: 5, onnotice: () => {} });

  const obal = (q: postgresJs.Sql | postgresJs.TransactionSql): Db => ({
    async query<T>(text: string, params: unknown[] = []) {
      return (await q.unsafe(text, params as never[])) as unknown as T[];
    },
    tx: (fn) => sql.begin((t) => fn(obal(t))) as Promise<never>,
    exec: async (text) => {
      await q.unsafe(text);
    },
    close: () => sql.end(),
  });

  return obal(sql);
}

/** Spustí migrace ze supabase/migrations v abecedním pořadí. */
export async function spustMigrace(db: Db, dir = "supabase/migrations"): Promise<void> {
  const soubory = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const soubor of soubory) {
    const sql = await readFile(join(dir, soubor), "utf8");
    await db.exec(sql);
  }
}
