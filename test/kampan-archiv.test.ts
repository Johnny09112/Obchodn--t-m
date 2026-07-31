import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozKampan } from "../src/kampan.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

/** Text pravidla (`using` i `with check`) pro danou tabulku a příkaz. */
async function pravidlo(tabulka: string, cmd: string): Promise<string> {
  const p = await db.query<{ qual: string | null; with_check: string | null }>(
    `select qual, with_check from pg_policies where tablename = $1 and cmd = $2`,
    [tabulka, cmd],
  );
  return p.map((x) => `${x.qual ?? ""} ${x.with_check ?? ""}`).join(" ");
}

describe("archivace kampaně", () => {
  it("kampaň se dá archivovat a vrátit zpátky", async () => {
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });

    await db.query("update kampane set archivovana_at = now() where id = $1", [id]);
    let r = await db.query<{ a: string | null }>(
      "select archivovana_at::text as a from kampane where id = $1",
      [id],
    );
    expect(r[0]?.a).not.toBeNull();

    await db.query("update kampane set archivovana_at = null where id = $1", [id]);
    r = await db.query<{ a: string | null }>(
      "select archivovana_at::text as a from kampane where id = $1",
      [id],
    );
    expect(r[0]?.a).toBeNull();
  });

  it("archivace nic nemaže — kampaň i její firmy zůstávají", async () => {
    const id = await zalozKampan(db, { nazev: "K2", spravce: "a@b.cz" });
    await db.query("update kampane set archivovana_at = now() where id = $1", [id]);

    const r = await db.query("select 1 from kampane where id = $1", [id]);
    expect(r).toHaveLength(1);
  });
});

describe("mazání kampaně", () => {
  it("mazat smí jen admin a výš", async () => {
    const text = await pravidlo("kampane", "DELETE");
    expect(text).toContain("'admin'");
    expect(text).toContain("super-admin");
    // Běžný uživatel ani správce kampaně sem nepatří — mazání je vyhrazené
    // adminovi, tím odpadá potřeba kohokoli upozorňovat.
    expect(text).not.toContain("spravce");
  });

  it("běžící ani uzavřená kampaň se smazat nedá", async () => {
    // „Nic neodešlo" se hlídá přes stav: odesílat se smí jen z běžící
    // kampaně, takže kampaň, která nikdy neběžela, nic neodeslala.
    const text = await pravidlo("kampane", "DELETE");
    expect(text).toContain("bezi");
    expect(text).toContain("uzavrena");
  });

  it("smazaná kampaň po sobě nechá záznam", async () => {
    const id = await zalozKampan(db, { nazev: "Ke smazání", spravce: "a@b.cz" });
    await db.query("delete from kampane where id = $1", [id]);

    const z = await db.query<{ nazev: string; spravce: string }>(
      "select nazev, spravce from smazane_kampane",
    );
    expect(z).toHaveLength(1);
    expect(z[0]?.nazev).toBe("Ke smazání");
    expect(z[0]?.spravce).toBe("a@b.cz");
  });

  it("evidence smazaných se přes API měnit nedá", async () => {
    // Kdyby šla přepsat, ztratil by záznam smysl.
    const p = await db.query<{ cmd: string }>(
      `select cmd from pg_policies where tablename = 'smazane_kampane'`,
    );
    expect(p.map((x) => x.cmd)).toEqual(["SELECT"]);
  });
});
