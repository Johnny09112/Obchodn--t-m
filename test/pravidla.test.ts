import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("role a pravidla přístupu", () => {
  it("bez přihlášení je role „host“ — a ten nesmí nic", async () => {
    const r = await db.query<{ role: string }>("select public.role_uzivatele() as role");
    expect(r[0]!.role).toBe("host");
  });

  it("migrace projde i na lokální databázi bez Supabase Auth", async () => {
    // Kdyby se opřela o auth.jwt(), testy by přestaly fungovat bez sítě.
    const f = await db.query("select 1 from pg_proc where proname = 'role_uzivatele'");
    expect(f).toHaveLength(1);
  });

  it("RLS je zapnuté na všech tabulkách", async () => {
    const bez = await db.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and rowsecurity is false`,
    );
    expect(bez.map((x) => x.tablename)).toEqual([]);
  });

  it("kartotéka jde číst, ale ne měnit přes API", async () => {
    const p = await db.query<{ cmd: string }>(
      `select cmd from pg_policies where tablename = 'companies'`,
    );
    expect(p.map((x) => x.cmd)).toEqual(["SELECT"]);
  });

  it("oblasti smí tým i zakládat — kvůli tomu aplikace vzniká", async () => {
    const p = await db.query<{ policyname: string; cmd: string }>(
      `select policyname, cmd from pg_policies where tablename = 'oblasti' order by policyname`,
    );
    expect(p.map((x) => x.cmd).sort()).toEqual(["ALL", "SELECT"]);
  });

  it("blacklist a jídelny mění jen správci", async () => {
    for (const tabulka of ["blacklist", "jidelny", "profily"]) {
      const p = await db.query<{ qual: string | null; cmd: string }>(
        `select qual, cmd from pg_policies where tablename = $1 and cmd = 'ALL'`,
        [tabulka],
      );
      expect(p, tabulka).toHaveLength(1);
      expect(p[0]!.qual, tabulka).toContain("'admin'");
      // Běžný uživatel tu být nesmí. Hledáme roli v uvozovkách — samotné
      // slovo je i v názvu funkce `role_uzivatele`, takže by test lhal.
      expect(p[0]!.qual, tabulka).not.toContain("'uzivatel'");
    }
  });

  it("evidence schématu zůstává bez pravidel — přes API tam nemá nikdo co dělat", async () => {
    const p = await db.query(`select 1 from pg_policies where tablename = '_migrace'`);
    expect(p).toHaveLength(0);
  });
});
