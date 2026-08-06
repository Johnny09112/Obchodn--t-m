import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

// Čerstvá databáze na každý test — stejný vzor jako test/kampan-souhrn.test.ts.
let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("tabulka objednávek rešerše", () => {
  it("nová objednávka je ve stavu ceka", async () => {
    const k = await db.query<{ id: string }>(
      `insert into kampane (nazev, spravce) values ('K1','a@b.cz') returning id`,
    );
    const r = await db.query<{ stav: string; firem_zadano: number }>(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 20, 'dohledej kontakt', 'a@b.cz')
       returning stav, firem_zadano`,
      [k[0]!.id],
    );
    expect(r[0]!.stav).toBe("ceka");
    expect(r[0]!.firem_zadano).toBe(20);
  });

  // Bez téhle podmínky by selhaná objednávka nikomu neřekla proč.
  it("selhání bez důvodu databáze nepustí", async () => {
    const k = await db.query<{ id: string }>(
      `insert into kampane (nazev, spravce) values ('K2','a@b.cz') returning id`,
    );
    await expect(
      db.query(
        `insert into reserse (kampan_id, firem_zadano, zadani, pozadal, stav)
         values ($1, 5, 'z', 'a@b.cz', 'selhalo')`,
        [k[0]!.id],
      ),
    ).rejects.toThrow();
  });

  it("dávka musí být kladná", async () => {
    const k = await db.query<{ id: string }>(
      `insert into kampane (nazev, spravce) values ('K3','a@b.cz') returning id`,
    );
    await expect(
      db.query(
        `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
         values ($1, 0, 'z', 'a@b.cz')`,
        [k[0]!.id],
      ),
    ).rejects.toThrow();
  });
});
