import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import { zalozKampan } from "../src/kampan.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const STRED = { lat: 49.6, lng: 13.2 };

async function oblast(nazev: string): Promise<string> {
  return zalozOblast(db, {
    nazev,
    oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
  });
}

async function sviz(kampanId: string, oblastId: string, poradi = 0): Promise<void> {
  await db.query(
    "insert into kampan_oblasti (kampan_id, oblast_id, poradi) values ($1,$2,$3)",
    [kampanId, oblastId, poradi],
  );
}

describe("vazba kampaň — oblast", () => {
  it("kampaň unese víc oblastí a drží jejich pořadí", async () => {
    const k = await zalozKampan(db, { nazev: "Kraj", spravce: "a@b.cz" });
    const a = await oblast("Plzeňsko");
    const b = await oblast("Rokycansko");
    await sviz(k, a, 0);
    await sviz(k, b, 1);

    const r = await db.query<{ nazev: string }>(
      `select o.nazev from kampan_oblasti ko
       join oblasti o on o.id = ko.oblast_id
       where ko.kampan_id = $1 order by ko.poradi`,
      [k],
    );
    expect(r.map((x) => x.nazev)).toEqual(["Plzeňsko", "Rokycansko"]);
  });

  it("tatáž oblast se do kampaně nedostane dvakrát", async () => {
    const k = await zalozKampan(db, { nazev: "K", spravce: "a@b.cz" });
    const a = await oblast("Plzeňsko");
    await sviz(k, a, 0);

    await expect(sviz(k, a, 1)).rejects.toThrow();
  });

  it("jedna oblast může sloužit víc kampaním", async () => {
    const a = await oblast("Plzeňsko");
    const k1 = await zalozKampan(db, { nazev: "Jaro", spravce: "a@b.cz" });
    const k2 = await zalozKampan(db, { nazev: "Podzim", spravce: "a@b.cz" });
    await sviz(k1, a);
    await sviz(k2, a);

    const r = await db.query("select 1 from kampan_oblasti where oblast_id = $1", [a]);
    expect(r).toHaveLength(2);
  });

  it("smazaná kampaň si vazby odnese s sebou", async () => {
    const k = await zalozKampan(db, { nazev: "K", spravce: "a@b.cz" });
    const a = await oblast("Plzeňsko");
    await sviz(k, a);

    await db.query("delete from kampane where id = $1", [k]);

    expect(await db.query("select 1 from kampan_oblasti where kampan_id = $1", [k])).toHaveLength(0);
    // Oblast přežije — kampaň ji nevlastní, jen používala.
    expect(await db.query("select 1 from oblasti where id = $1", [a])).toHaveLength(1);
  });

  it("oblast použitou kampaní pořád nejde smazat", async () => {
    // Ochranu dřív držel cizí klíč `kampane.oblast_id` (migrace 0028).
    // Sloupec zmizel, ochranu musí převzít vazební tabulka — jinak by se
    // úklid oblastí tiše otevřel.
    const k = await zalozKampan(db, { nazev: "K", spravce: "a@b.cz" });
    const a = await oblast("Plzeňsko");
    await sviz(k, a);

    await expect(db.query("delete from oblasti where id = $1", [a])).rejects.toThrow();
  });

  it("sloupec kampane.oblast_id už neexistuje — jeden zdroj pravdy", async () => {
    const r = await db.query(
      `select 1 from information_schema.columns
       where table_name = 'kampane' and column_name = 'oblast_id'`,
    );
    expect(r).toHaveLength(0);
  });
});

describe("přehled oblastí po přechodu na vazbu", () => {
  it("vyjmenuje kampaně dál", async () => {
    const a = await oblast("Plzeňsko");
    const k = await zalozKampan(db, { nazev: "Zkouška", spravce: "a@b.cz" });
    await sviz(k, a);

    const r = await db.query<{ kampane: { nazev: string }[] }>(
      "select kampane from oblasti_prehled where id = $1",
      [a],
    );
    expect(r[0]!.kampane.map((x) => x.nazev)).toEqual(["Zkouška"]);
  });

  it("oblast bez kampaně má prázdný seznam, ne null", async () => {
    const a = await oblast("Volná");
    const r = await db.query<{ kampane: unknown[] }>(
      "select kampane from oblasti_prehled where id = $1",
      [a],
    );
    expect(r[0]!.kampane).toEqual([]);
  });
});
