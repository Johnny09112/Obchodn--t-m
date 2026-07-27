import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { firmyKObohaceni, zapisDavku } from "../src/nalezy.js";
import { nastavGeo, nastavStav, zalozFirmu } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;
let jidelnaId: string;

const firma = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "Náves 1", obec: "Bezdružice",
  czNace: ["62010"], velikostKategorie: "mikro", kodObce: 560740,
});

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  const j = await db.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, kapacita_volna)
     values ('ZŠ','x','Bezdružice',49.9,12.97,560740,10) returning id`,
  );
  jidelnaId = j[0]!.id;

  for (const [ico, nazev] of [
    ["25242407", "AGROFARMY BEZDRUŽICE s.r.o."],
    ["17255686", "Café Kryštof Harant s.r.o."],
  ] as const) {
    await zalozFirmu(db, firma(ico, nazev));
    await nastavGeo(db, ico, {
      lat: 49.9, lng: 12.97, jidelnaId, vzdalenostM: 100, vZone: true,
    });
    await nastavStav(db, ico, "kvalifikovany");
  }
});

describe("firmyKObohaceni", () => {
  it("vrátí kvalifikované firmy v zóně, které ještě neprošly rešerší", async () => {
    const f = await firmyKObohaceni(db, {});
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ nazev: expect.any(String), obec: "Bezdružice" });
    expect(f[0]!.chybi).toContain("zpusob_stravovani");
  });

  it("po zápisu dávky už firmu podruhé nenabídne", async () => {
    await zapisDavku(db, {
      nalezy: [{
        ico: "25242407", atribut: "zpusob_stravovani", hodnota: "stravenky",
        zdrojUrl: "https://agrofarmy.cz/kariera", citace: "Zaměstnancům přispíváme stravenkami.",
      }],
      kontakty: [],
    });
    const f = await firmyKObohaceni(db, {});
    expect(f.map((x) => x.ico)).toEqual(["17255686"]);
  });

  it("umí frontu zúžit na velké firmy — u drobných se rešerše nevyplatí", async () => {
    await db.query("update companies set velikost_kategorie = 'stredni' where ico = '25242407'");
    await db.query("update companies set velikost_kategorie = 'mikro' where ico = '17255686'");

    const f = await firmyKObohaceni(db, { segmenty: ["stredni", "korporat"] });
    expect(f.map((x) => x.ico)).toEqual(["25242407"]);
  });

  it("bez zúžení vrátí i firmy s neznámou velikostí", async () => {
    await db.query("update companies set velikost_kategorie = null");
    expect(await firmyKObohaceni(db, {})).toHaveLength(2);
    expect(await firmyKObohaceni(db, { segmenty: ["stredni"] })).toHaveLength(0);
  });

  it("respektuje limit a firmy mimo zónu nenabízí", async () => {
    expect(await firmyKObohaceni(db, { limit: 1 })).toHaveLength(1);
    await db.query("update companies set v_zone = false where ico = '17255686'");
    const f = await firmyKObohaceni(db, {});
    expect(f.map((x) => x.ico)).toEqual(["25242407"]);
  });
});

describe("zapisDavku", () => {
  it("zapíše platný nález i kontakt a doplní evidenci", async () => {
    const v = await zapisDavku(db, {
      nalezy: [{
        ico: "25242407", atribut: "ma_vlastni_jidelnu", hodnota: "false",
        zdrojUrl: "https://agrofarmy.cz/o-nas",
        citace: "Vlastní jídelnu nemáme, obědy dovážíme.",
      }],
      kontakty: [{
        ico: "25242407", email: "poptavky@agrofarmy.cz", urovenAdresy: 1,
        zdrojUrl: "https://agrofarmy.cz/kontakt",
        citace: "Nabídky posílejte na poptavky@agrofarmy.cz",
      }],
    });
    expect(v.zapsanoNalezu).toBe(1);
    expect(v.zapsanoKontaktu).toBe(1);
    expect(v.odmitnuto).toHaveLength(0);

    const f = await db.query<{ ma_vlastni_jidelnu: boolean }>(
      "select ma_vlastni_jidelnu from companies where ico = '25242407'",
    );
    expect(f[0]!.ma_vlastni_jidelnu).toBe(false);
    const ev = await db.query("select 1 from evidence where ico = '25242407'");
    expect(ev.length).toBeGreaterThanOrEqual(2);
  });

  it("odmítne nález bez zdroje, s prázdnou citací i mimo whitelist (TP-2, TP-3)", async () => {
    const v = await zapisDavku(db, {
      nalezy: [
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "x", zdrojUrl: "", citace: "y" },
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "x", zdrojUrl: "https://a.cz", citace: "" },
        { ico: "25242407", atribut: "obrat_firmy" as never, hodnota: "x", zdrojUrl: "https://a.cz", citace: "y" },
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "x", zdrojUrl: "neni-url", citace: "y" },
      ],
      kontakty: [],
    });
    expect(v.zapsanoNalezu).toBe(0);
    expect(v.odmitnuto).toHaveLength(4);
    expect(v.odmitnuto.map((o) => o.duvod).join(" ")).toMatch(/zdroj|citac|whitelist|url/i);
  });

  it("jedna vadná položka nezruší zápis ostatních", async () => {
    const v = await zapisDavku(db, {
      nalezy: [
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "stravenky",
          zdrojUrl: "https://a.cz/kariera", citace: "Přispíváme stravenkami." },
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "x", zdrojUrl: "", citace: "y" },
      ],
      kontakty: [],
    });
    expect(v.zapsanoNalezu).toBe(1);
    expect(v.odmitnuto).toHaveLength(1);
  });

  it("odmítne nález k firmě, která v kartotéce není", async () => {
    const v = await zapisDavku(db, {
      nalezy: [{
        ico: "27604977", atribut: "zpusob_stravovani", hodnota: "x",
        zdrojUrl: "https://a.cz", citace: "y",
      }],
      kontakty: [],
    });
    expect(v.zapsanoNalezu).toBe(0);
    expect(v.odmitnuto[0]!.duvod).toMatch(/kartotéce|neexistuje/i);
  });

  it("zkrátí citaci na 200 znaků, aby prošla přes tvrdé pravidlo", async () => {
    const v = await zapisDavku(db, {
      nalezy: [{
        ico: "25242407", atribut: "zpusob_stravovani", hodnota: "stravenky",
        zdrojUrl: "https://a.cz/k", citace: "A".repeat(400),
      }],
      kontakty: [],
    });
    expect(v.zapsanoNalezu).toBe(1);
    const ev = await db.query<{ citace: string }>(
      "select citace from evidence where ico = '25242407' and atribut = 'zpusob_stravovani'",
    );
    expect(ev[0]!.citace.length).toBe(200);
  });

  it("firmy bez nálezu označí jako prověřené a zapíše běh (TP-13)", async () => {
    const v = await zapisDavku(db, {
      nalezy: [], kontakty: [], bezNalezu: ["17255686"],
      poznamkyProPlaybook: ["web firmy neexistuje"],
    });
    expect(v.oznacenoBezNalezu).toBe(1);
    const f = await firmyKObohaceni(db, {});
    expect(f.map((x) => x.ico)).toEqual(["25242407"]);

    const behy = await db.query<{ agent: string; konec: string | null }>(
      "select agent, konec from agent_runs",
    );
    expect(behy[0]!.agent).toBe("cmuchal-obohaceni");
    expect(behy[0]!.konec).not.toBeNull();
  });
});
