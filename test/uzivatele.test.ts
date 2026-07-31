import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("evidence lidí", () => {
  it("tabulka uzivatele existuje a má jen e-mail, žádné tajemství", async () => {
    const s = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'uzivatele'
       order by column_name`,
    );
    expect(s.map((x) => x.column_name)).toEqual(["email", "id"]);
  });

  it("evidence jde jen číst, ne měnit přes API", async () => {
    // Plní ji spoušť z auth.users. Kdyby šla měnit zvenčí, dal by si
    // kdokoli do zástupu cizí e-mail a získal práva k cizí kampani.
    const p = await db.query<{ cmd: string }>(
      `select cmd from pg_policies where tablename = 'uzivatele'`,
    );
    expect(p.map((x) => x.cmd)).toEqual(["SELECT"]);
  });

  it("RLS je na evidenci zapnuté", async () => {
    const r = await db.query<{ rowsecurity: boolean }>(
      `select rowsecurity from pg_tables where tablename = 'uzivatele'`,
    );
    expect(r[0]?.rowsecurity).toBe(true);
  });

  it("email_uzivatele bez přihlášení vrací prázdno, ne chybu", async () => {
    const r = await db.query<{ e: string | null }>("select public.email_uzivatele() as e");
    expect(r[0]?.e).toBeNull();
  });

  it("spoušť nad auth.users existuje, aby se evidence plnila sama", async () => {
    const t = await db.query<{ tgname: string }>(
      `select tgname from pg_trigger
       where tgrelid = 'auth.users'::regclass and not tgisinternal`,
    );
    expect(t.map((x) => x.tgname)).toContain("uzivatele_sync");
  });

  it("nový účet se do evidence propíše sám", async () => {
    await db.query(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'novy@cantinero.cz')`,
    );
    const u = await db.query<{ email: string }>(
      "select email from uzivatele where email = 'novy@cantinero.cz'",
    );
    expect(u).toHaveLength(1);
  });

  it("změna e-mailu se v evidenci projeví", async () => {
    await db.query(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'stary@cantinero.cz')`,
    );
    await db.query(
      `update auth.users set email = 'zmeneny@cantinero.cz' where email = 'stary@cantinero.cz'`,
    );
    const u = await db.query<{ email: string }>("select email from uzivatele order by email");
    expect(u.map((x) => x.email)).toEqual(["zmeneny@cantinero.cz"]);
  });
});
