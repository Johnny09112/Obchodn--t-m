import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { SLOTY, najdiSlot, ulozSablonu, ulozTvrzeni, nactiSchvalenaTvrzeni } from "../src/obsah.js";

/**
 * Knihovna tvrzení a šablon (S0.5). Do téhle chvíle byly texty jen
 * v dokumentu — tohle je cesta, kterou se dostanou do databáze.
 *
 * Dvě věci, které se hlídají při zápisu, ne až při odesílání:
 *  1. text musí projít kontrolou stylu (SPEC kap. 6),
 *  2. každý zástupný údaj musí být známý a jeho zdroj povolený (TP-3).
 *
 * Šablona se schvaluje jednou a posílá tisíckrát; chyba v ní je proto
 * tisíckrát dražší než chyba v jedné zprávě.
 */

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const SABLONA = {
  segment: "vsichni",
  kanal: "email",
  predmet: "obědy ze školní jídelny pár minut od Vás",
  telo: `[osloveni]

[vzdalenost] [od_vasi_firmy] spolupracujeme se školní jídelnou, která navýšila kapacity i pro okolní firmy.

Kompletní menu vychází na [cena] s možností obědvat na místě nebo si jídlo odvážet v jídlonosičích. Veškeré objednávky i podklady pro rozúčtování přitom snadno vyřešíte přes naši aplikaci.

Řešíte aktuálně obědy pro zaměstnance hromadně, nebo si je každý zajišťuje sám?`,
  schvalenoKym: "majitel",
};

describe("uložení šablony", () => {
  it("uloží schválenou šablonu jako verzi 1", async () => {
    await ulozSablonu(db, SABLONA);

    const r = await db.query<{ verze: number; stav: string; telo: string }>(
      "select verze, stav, telo from templates",
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.verze).toBe(1);
    expect(r[0]?.stav).toBe("schvaleno");
    expect(r[0]?.telo).toContain("[osloveni]");
  });

  it("odmítne text, který neprojde kontrolou stylu", async () => {
    await expect(
      ulozSablonu(db, { ...SABLONA, telo: "Dobrý den, rád bych Vás oslovil s nabídkou. Zkusíme to?" }),
    ).rejects.toThrow(/Rád bych Vás oslovil/);

    expect(await db.query("select 1 from templates")).toHaveLength(0);
  });

  it("odmítne neznámý zástupný údaj", async () => {
    await expect(
      ulozSablonu(db, { ...SABLONA, telo: SABLONA.telo.replace("[cena]", "[obrat_firmy]") }),
    ).rejects.toThrow(/obrat_firmy/);
  });

  it("druhé uložení téhož segmentu je verze 2", async () => {
    await ulozSablonu(db, SABLONA);
    await ulozSablonu(db, SABLONA);

    const r = await db.query<{ verze: number }>("select verze from templates order by verze");
    expect(r.map((x) => x.verze)).toEqual([1, 2]);
  });
});

describe("zástupné údaje", () => {
  it("jméno adresáta má náhradu, ostatní povinné údaje ne", () => {
    expect(SLOTY.osloveni?.povinny).toBe(false);
    expect(SLOTY.osloveni?.nahrada).toBe("Dobrý den,");

    for (const kod of ["vzdalenost", "od_vasi_firmy", "cena"]) {
      expect(najdiSlot(kod)?.povinny).toBe(true);
      expect(najdiSlot(kod)?.nahrada).toBeUndefined();
    }
  });
});

describe("uložení tvrzení", () => {
  it("uloží tvrzení jako schválené i s dokladem", async () => {
    await ulozTvrzeni(db, [
      { tvrzeni: "Ve školní jídelně se vaří denně mimo školní prázdniny.", doklad: "Provoz jídelny." },
    ]);

    const r = await nactiSchvalenaTvrzeni(db);
    expect(r).toHaveLength(1);
    expect(r[0]?.tvrzeni).toContain("vaří denně");
    expect(r[0]?.doklad).toBe("Provoz jídelny.");
  });

  it("dvojí uložení téhož tvrzení nezaloží duplicitu", async () => {
    const t = [{ tvrzeni: "Menu je polévka a hlavní jídlo.", doklad: "Jídelníček." }];
    await ulozTvrzeni(db, t);
    await ulozTvrzeni(db, t);

    expect(await nactiSchvalenaTvrzeni(db)).toHaveLength(1);
  });
});

describe("schválený obsah (S0.5)", () => {
  it("osm tvrzení schválených majitelem 18. 8. 2026", async () => {
    const { TVRZENI } = await import("../src/obsah-schvaleny.js");
    expect(TVRZENI).toHaveLength(8);
    expect(TVRZENI.every((t) => t.doklad.length > 0)).toBe(true);
  });

  it("hlavní šablona projde uložením — sloty i kontrola stylu", async () => {
    const { SABLONA_HLAVNI } = await import("../src/obsah-schvaleny.js");
    const verze = await ulozSablonu(db, SABLONA_HLAVNI);
    expect(verze).toBe(1);
  });

  it("hlavní šablona používá jen zástupné údaje, které umíme doplnit", async () => {
    const { SABLONA_HLAVNI } = await import("../src/obsah-schvaleny.js");
    const pouzite = [...SABLONA_HLAVNI.telo.matchAll(/\[([a-z_]+)\]/g)].map((m) => m[1]);
    expect(pouzite.length).toBeGreaterThan(0);
    expect(pouzite.every((k) => k !== undefined && k in SLOTY)).toBe(true);
  });
});
