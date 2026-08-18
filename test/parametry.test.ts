import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import {
  naSeznam,
  nactiHodnoty,
  nactiParametry,
  ulozHodnotu,
  zeSeznamu,
  zavedParametr,
  zkontrolujHodnotu,
  kodZNazvu,
} from "../src/parametry.js";

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

/** Založí jídelnu a vrátí id její nabídky. */
async function zalozNabidku(db: Db, nazev = "ZŠ Zkušební"): Promise<string> {
  const r = await db.query<{ nabidka_id: string }>(
    `insert into jidelny (nazev, adresa, lat, lng, zona_metru)
     values ($1, 'Zkušební 1', 49.7, 13.4, 3000) returning nabidka_id`,
    [nazev],
  );
  return r[0]!.nabidka_id;
}

describe("čtení parametrů", () => {
  it("vrátí parametry produktu v pořadí, v jakém se mají ukazovat", async () => {
    const p = await nactiParametry(db, "cantinero");
    expect(p.map((x) => x.kod)).toEqual([
      "cena_obeda",
      "provize",
      "moznosti_vydeje",
      "vari_o_prazdninach",
    ]);
    expect(p[0]?.jednotka).toBe("Kč");
    expect(p[2]?.moznosti).toHaveLength(4);
  });

  it("cizí produkt nevrátí nic", async () => {
    expect(await nactiParametry(db, "dochazka")).toEqual([]);
  });

  it("hodnoty se vracejí pod kódem parametru, ne pod jeho id", async () => {
    const nabidka = await zalozNabidku(db);
    const [p] = await db.query<{ id: string }>(
      `select id from parametry_nabidky where kod = 'cena_obeda'`,
    );
    await db.query(
      `insert into hodnoty_parametru (nabidka_id, parametr_id, hodnota)
       values ($1, $2, '115')`,
      [nabidka, p!.id],
    );

    expect(await nactiHodnoty(db, nabidka)).toEqual({ cena_obeda: "115" });
  });

  it("nabídka bez vyplněných hodnot vrátí prázdno, ne chybu", async () => {
    const nabidka = await zalozNabidku(db, "ZŠ Prázdná");
    expect(await nactiHodnoty(db, nabidka)).toEqual({});
  });
});

describe("kontrola hodnoty podle druhu", () => {
  it("do čísla nepustí slovo a řekne proč", async () => {
    const [cena] = await nactiParametry(db, "cantinero");
    expect(zkontrolujHodnotu(cena!, "draho")).toMatch(/číslo/i);
    expect(zkontrolujHodnotu(cena!, "115")).toBeNull();
  });

  it("záporná cena je chyba", async () => {
    const [cena] = await nactiParametry(db, "cantinero");
    expect(zkontrolujHodnotu(cena!, "-5")).toMatch(/záporn/i);
  });

  it("ano/ne bere jen ano nebo ne", async () => {
    const p = await nactiParametry(db, "cantinero");
    const prazdniny = p.find((x) => x.kod === "vari_o_prazdninach")!;
    expect(zkontrolujHodnotu(prazdniny, "ano")).toBeNull();
    expect(zkontrolujHodnotu(prazdniny, "ne")).toBeNull();
    expect(zkontrolujHodnotu(prazdniny, "možná")).toMatch(/ano/i);
  });

  it("výběr nepustí volbu, která není v nabídce", async () => {
    const p = await nactiParametry(db, "cantinero");
    const vydej = p.find((x) => x.kod === "moznosti_vydeje")!;
    expect(zkontrolujHodnotu(vydej, zeSeznamu(["na místě"]))).toBeNull();
    expect(zkontrolujHodnotu(vydej, zeSeznamu(["poštou"]))).toMatch(/poštou/);
  });

  it("prázdný výběr je platný — jídelna zatím neví, co umí", async () => {
    const p = await nactiParametry(db, "cantinero");
    const vydej = p.find((x) => x.kod === "moznosti_vydeje")!;
    expect(zkontrolujHodnotu(vydej, zeSeznamu([]))).toBeNull();
  });

  it("seznam voleb přežije uložení a načtení", () => {
    expect(naSeznam(zeSeznamu(["na místě", "do jednorázového obalu"]))).toEqual([
      "na místě",
      "do jednorázového obalu",
    ]);
  });
});

describe("uložení hodnoty", () => {
  it("uloží hodnotu a druhé uložení ji přepíše", async () => {
    const nabidka = await zalozNabidku(db, "ZŠ Uložená");
    await ulozHodnotu(db, nabidka, "cena_obeda", "115");
    await ulozHodnotu(db, nabidka, "cena_obeda", "120");

    expect(await nactiHodnoty(db, nabidka)).toEqual({ cena_obeda: "120" });
  });

  it("neplatnou hodnotu neuloží a řekne proč", async () => {
    const nabidka = await zalozNabidku(db, "ZŠ Odmítnutá");
    await expect(ulozHodnotu(db, nabidka, "cena_obeda", "draho")).rejects.toThrow(/číslo/i);
    expect(await nactiHodnoty(db, nabidka)).toEqual({});
  });

  it("neznámý parametr je chyba, ne tiché nic", async () => {
    const nabidka = await zalozNabidku(db, "ZŠ Neznámá");
    await expect(ulozHodnotu(db, nabidka, "vymysleny", "1")).rejects.toThrow(/vymysleny/);
  });
});

describe("zavedení parametru", () => {
  it("kód vznikne z názvu bez diakritiky a mezer", () => {
    expect(kodZNazvu("Rozvoz zdarma od")).toBe("rozvoz_zdarma_od");
    expect(kodZNazvu("Počet zaměstnanců v ceně")).toBe("pocet_zamestnancu_v_cene");
  });

  it("zavedený parametr je hned vidět v seznamu produktu", async () => {
    await zavedParametr(db, {
      produktKod: "cantinero",
      nazev: "Rozvoz zdarma od",
      druh: "cislo",
      jednotka: "obědů",
    });

    const p = await nactiParametry(db, "cantinero");
    expect(p.map((x) => x.kod)).toContain("rozvoz_zdarma_od");
    expect(p[p.length - 1]?.nazev).toBe("Rozvoz zdarma od");
  });

  it("druhý parametr téhož názvu se odmítne", async () => {
    await expect(
      zavedParametr(db, { produktKod: "cantinero", nazev: "Cena oběda", druh: "cislo" }),
    ).rejects.toThrow(/už existuje/i);
  });

  it("výběr bez možností se odmítne — nebylo by z čeho vybírat", async () => {
    await expect(
      zavedParametr(db, { produktKod: "cantinero", nazev: "Balení", druh: "vyber" }),
    ).rejects.toThrow(/možnost/i);
  });

  it("zavedený parametr jde rovnou vyplnit", async () => {
    await zavedParametr(db, {
      produktKod: "cantinero",
      nazev: "Rozvoz zdarma od",
      druh: "cislo",
      jednotka: "obědů",
    });
    const nabidka = await zalozNabidku(db, "ZŠ Nová");
    await ulozHodnotu(db, nabidka, "rozvoz_zdarma_od", "30");

    expect(await nactiHodnoty(db, nabidka)).toEqual({ rozvoz_zdarma_od: "30" });
  });
});
