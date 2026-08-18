import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

/**
 * Parametry nabídky — co o prodávané věci sledujeme (migrace 0045).
 *
 * Vyžádal si majitel 18. 8. 2026: údaje o nabídce se nemají psát do kódu,
 * ale zavádět v aplikaci, protože jindy bude nabídkou docházkový systém
 * nebo on-line služba, ne školní jídelna.
 *
 * Zadání: docs/superpowers/specs/2026-08-18-nastaveni-zpravy-design.md
 */

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("migrace parametrů nabídky", () => {
  it("každá jídelna má po migraci svoji nabídku", async () => {
    await db.query(
      `insert into jidelny (nazev, adresa, lat, lng, zona_metru)
       values ('ZŠ Zkušební', 'Zkušební 1', 49.7, 13.4, 3000)`,
    );
    // Nabídka vzniká spouští při zápisu jídelny — jinak by ji musel
    // zakládat každý, kdo jídelnu vytváří, a někdo by na to zapomněl.
    const r = await db.query<{ pocet: number }>(
      `select count(*)::int as pocet from jidelny j
        join nabidky n on n.id = j.nabidka_id`,
    );
    expect(r[0]?.pocet).toBe(1);
  });

  it("výchozí parametry Cantinera jsou čtyři a mají svůj druh", async () => {
    const r = await db.query<{ kod: string; druh: string }>(
      `select kod, druh from parametry_nabidky
        where produkt_kod = 'cantinero' order by poradi`,
    );
    expect(r.map((x) => x.kod)).toEqual([
      "cena_obeda",
      "provize",
      "moznosti_vydeje",
      "vari_o_prazdninach",
    ]);
    expect(r.map((x) => x.druh)).toEqual(["cislo", "cislo", "vyber", "ano_ne"]);
  });

  it("možnosti výdeje nabízejí čtyři volby", async () => {
    const r = await db.query<{ moznosti: string[] }>(
      `select moznosti from parametry_nabidky where kod = 'moznosti_vydeje'`,
    );
    expect(r[0]?.moznosti).toEqual([
      "na místě",
      "do vlastního jídlonosiče",
      "do jednorázového obalu",
      "hromadný odvoz nebo rozvoz",
    ]);
  });

  it("tentýž kód parametru nejde v jednom produktu zavést dvakrát", async () => {
    await expect(
      db.query(
        `insert into parametry_nabidky (produkt_kod, kod, nazev, druh)
         values ('cantinero', 'cena_obeda', 'Cena podruhé', 'cislo')`,
      ),
    ).rejects.toThrow();
  });
});
