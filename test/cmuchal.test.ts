import { beforeEach, describe, expect, it, vi } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { spustCmuchala } from "../src/cmuchal.js";
import type { AresKlient, AresZaznam } from "../src/ares.js";
import type { Geokoder } from "../src/geocode.js";
import type { MpsvKlient } from "../src/mpsv.js";
import type { OsmKlient } from "../src/osm.js";
import type { ResKlient, ResUdaje } from "../src/res.js";

let db: Db;
let jidelnaId: string;

const JIDELNA = { lat: 49.90624, lng: 12.97442 }; // Bezdružice

/** Zaměstnavatel s náborem, sídlí v obci. */
const agrofarmy: AresZaznam = {
  ico: "25242407", nazev: "AGROFARMY BEZDRUŽICE s.r.o.", adresa: "Náves 1",
  obec: "Bezdružice", czNace: ["01500"], velikostKategorie: null, kodObce: 560740,
};
/** Provozovna v obci, ale sídlo jinde — přesně ten případ „zinkovna". */
const zinkovna: AresZaznam = {
  ico: "25489631", nazev: "Zinkovna Bezdružice a.s.", adresa: "Průmyslová 1, Bílina",
  obec: "Bílina", czNace: ["25610"], velikostKategorie: null, kodObce: 567256,
};
/** Prázdná schránka bez zaměstnanců. */
const skorapka: AresZaznam = {
  ico: "05499861", nazev: "LK demolice s.r.o.", adresa: "Revolučních gard 199",
  obec: "Bezdružice", czNace: ["43120"], velikostKategorie: null, kodObce: 560740,
};

const vsechny = [agrofarmy, zinkovna, skorapka];

const ares: AresKlient = {
  overFirmu: async (ico) => vsechny.find((f) => f.ico === ico) ?? null,
  najdiFirmyVObci: async () => [agrofarmy, skorapka],
  najdiPodleJmena: async (n) =>
    vsechny.find((f) => f.nazev.toLowerCase().includes(n.toLowerCase().slice(0, 8))) ?? null,
};

const resData: Record<string, Partial<ResUdaje>> = {
  "25242407": { segment: "mikro", kategoriePopis: "6–9", bezZamestnancu: false },
  "25489631": { segment: "stredni", kategoriePopis: "50–99", bezZamestnancu: false },
  "05499861": { segment: null, kategoriePopis: "bez zaměstnanců", bezZamestnancu: true },
};

const res: ResKlient = {
  nactiUdaje: async (ico) => ({
    ico, kategorieKod: "x", kategoriePopis: null, segment: null,
    bezZamestnancu: false, zdrojUrl: `https://ares.gov.cz/res/${ico}`,
    ...resData[ico],
  }),
};

const geokoder: Geokoder = {
  geokoduj: async (a) => {
    if (a === "Bezdružice") return { lat: 49.9062, lng: 12.9744 }; // střed obce
    if (a.includes("Bílina")) return { lat: 50.5486, lng: 13.7742 }; // sídlo 130 km daleko
    if (a.includes("Bezdružice")) return { lat: 49.907, lng: 12.976 };
    return null;
  },
};

const mpsv: MpsvKlient = {
  zamestnavateleVObci: async () => [
    { ico: "25242407", nazev: agrofarmy.nazev, mist: 8, inzeratu: 2, kodObce: 560740,
      cisloDomovni: 2, jeAgentura: false, proKoho: null,
      zdrojUrl: "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json" },
    { ico: "25489631", nazev: zinkovna.nazev, mist: 12, inzeratu: 3, kodObce: 560740,
      cisloDomovni: 291, jeAgentura: false, proKoho: null,
      zdrojUrl: "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json" },
  ],
};

const osm: OsmKlient = {
  najdiPracoviste: async () => [
    { nazev: "Zinkovna Bezdružice", druh: "works", lat: 49.9095, lng: 12.9781,
      zdrojUrl: "https://www.openstreetmap.org/way/123" },
  ],
};

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  const r = await db.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, kapacita_volna, zona_metru)
     values ('ZŠ Bezdružice', 'Školní 183', 'Bezdružice', $1, $2, 560740, 10, 3000) returning id`,
    [JIDELNA.lat, JIDELNA.lng],
  );
  jidelnaId = r[0]!.id;
});

describe("spustCmuchala — obrácené hledání", () => {
  it("najde zaměstnavatele z obou zdrojů a odfiltruje firmu bez zaměstnanců", async () => {
    const s = await spustCmuchala({ db, ares, res, geokoder, mpsv, osm }, jidelnaId, {
      aresSweep: true,
    });

    expect(s.dleZdroje.mpsv).toBe(2);
    expect(s.dleZdroje.osm).toBe(1);
    expect(s.dleZdroje.ares).toBe(2);
    expect(s.bezZamestnancu).toBe(1); // schránka z ARES sweepu vypadla
    expect(s.preskoceno).toBe(1); // zinkovna z mapy je už zapsaná z MPSV
    expect(s.kvalifikovano).toBe(2);

    const firmy = await db.query<{ ico: string; stav: string }>(
      "select ico, stav from companies order by ico",
    );
    expect(firmy.map((f) => f.ico)).toEqual(["25242407", "25489631"]);
    expect(firmy.every((f) => f.stav === "kvalifikovany")).toBe(true);
  });

  it("provozovnu ze zóny zařadí i když firma sídlí jinde", async () => {
    await spustCmuchala({ db, ares, res, geokoder, osm }, jidelnaId);
    const z = await db.query<{ v_zone: boolean; vzdalenost_m: number; obec: string }>(
      "select v_zone, vzdalenost_m, obec from companies where ico = '25489631'",
    );
    expect(z[0]!.v_zone).toBe(true);
    expect(z[0]!.vzdalenost_m).toBeLessThan(1000); // podle polohy provozovny, ne sídla v Bílině
    expect(z[0]!.obec).toBe("Bílina"); // sídlo zůstává, jak ho vede rejstřík
  });

  it("firmu z MPSV nevyřadí kvůli vzdálenému sídlu — použije střed obce pracoviště", async () => {
    // Zinkovna sídlí v Bílině (130 km), ale MPSV hlásí pracoviště v Bezdružicích.
    // Bez opravy by ji počítání vzdálenosti od sídla zahodilo.
    const s = await spustCmuchala({ db, ares, res, geokoder, mpsv }, jidelnaId);
    expect(s.kvalifikovano).toBe(2);

    const z = await db.query<{ v_zone: boolean; vzdalenost_m: number }>(
      "select v_zone, vzdalenost_m from companies where ico = '25489631'",
    );
    expect(z[0]!.v_zone).toBe(true);
    expect(z[0]!.vzdalenost_m).toBeLessThan(500);

    // Přibližnost polohy musí být v evidenci přiznaná.
    const ev = await db.query<{ citace: string }>(
      "select citace from evidence where ico = '25489631' and atribut = 'adresa'",
    );
    expect(ev[0]!.citace).toContain("střed obce");
    expect(ev[0]!.citace).toContain("MPSV");
  });

  it("nábor z MPSV se propíše do skóre i do evidence", async () => {
    await spustCmuchala({ db, ares, res, geokoder, mpsv }, jidelnaId);
    const f = await db.query<{ skore: number }>(
      "select skore from companies where ico = '25242407'",
    );
    expect(f[0]!.skore).toBeGreaterThan(50);
    const ev = await db.query<{ citace: string }>(
      "select citace from evidence where ico = '25242407' and atribut = 'obor'",
    );
    expect(ev[0]!.citace).toContain("MPSV");
  });

  it("každý zapsaný údaj má zdroj (TP-2)", async () => {
    await spustCmuchala({ db, ares, res, geokoder, mpsv, osm }, jidelnaId);
    const bezZdroje = await db.query(
      "select 1 from evidence where zdroj_url is null or zdroj_url = ''",
    );
    expect(bezZdroje).toHaveLength(0);
  });

  it("výpadek jednoho zdroje běh nepoloží", async () => {
    const rozbityOsm: OsmKlient = {
      najdiPracoviste: async () => { throw new Error("Overpass nedostupný"); },
    };
    const s = await spustCmuchala({ db, ares, res, geokoder, mpsv, osm: rozbityOsm }, jidelnaId);
    expect(s.kvalifikovano).toBe(2); // MPSV dodal svoje, i když mapa selhala
    expect(s.chyby.some((c) => c.kdo === "zdroj OSM")).toBe(true);
  });

  it("odmítne jídelnu bez volné kapacity", async () => {
    const r = await db.query<{ id: string }>(
      `insert into jidelny (nazev, adresa, lat, lng, kod_obce, kapacita_volna)
       values ('Plná', 'x', 50, 14, 1, 0) returning id`,
    );
    await expect(
      spustCmuchala({ db, ares, res, geokoder }, r[0]!.id),
    ).rejects.toThrow(/kapacit/i);
  });

  it("zaznamená běh do agent_runs (TP-13)", async () => {
    await spustCmuchala({ db, ares, res, geokoder, mpsv }, jidelnaId);
    const b = await db.query<{ konec: string | null; vystup: unknown }>(
      "select konec, vystup from agent_runs where agent = 'cmuchal'",
    );
    expect(b).toHaveLength(1);
    expect(b[0]!.konec).not.toBeNull();
  });
});

describe("záchrana firem s nezaměřitelnou adresou", () => {
  it("firmu sídlící v obci nezahodí, když mapy neznají její adresu", async () => {
    const nezamerne: AresZaznam = {
      ico: "48362956", nazev: "ROLDECO, spol. s r.o.", adresa: "č.p. 137",
      obec: "Bezdružice", czNace: ["49410"], velikostKategorie: null, kodObce: 560740,
    };
    const aresLokal: AresKlient = {
      overFirmu: async (i) => (i === nezamerne.ico ? nezamerne : null),
      najdiFirmyVObci: async () => [nezamerne],
      najdiPodleJmena: async () => null,
    };
    const resLokal: ResKlient = {
      nactiUdaje: async (ico) => ({
        ico, kategorieKod: "210", kategoriePopis: "10–19", segment: "mikro",
        bezZamestnancu: false, zdrojUrl: `https://ares.gov.cz/res/${ico}`,
      }),
    };
    // Adresu neumí zaměřit, obec ano — přesně stav z ostrého běhu.
    const geoLokal: Geokoder = {
      geokoduj: async (a) => (a === "Bezdružice" ? { lat: 49.9062, lng: 12.9744 } : null),
    };

    const s = await spustCmuchala(
      { db, ares: aresLokal, res: resLokal, geokoder: geoLokal }, jidelnaId,
    );
    expect(s.kvalifikovano).toBe(1);
    expect(s.zahozeno).toBe(0);

    const ev = await db.query<{ citace: string }>(
      "select citace from evidence where ico = '48362956' and atribut = 'adresa'",
    );
    expect(ev[0]!.citace).toContain("nepodařilo zaměřit");
    expect(ev[0]!.citace).toContain("střed obce");
  });
});

describe("práh velikosti firmy", () => {
  const maly: AresZaznam = {
    ico: "48362956", nazev: "Malá dílna s.r.o.", adresa: "Náves 1",
    obec: "Bezdružice", czNace: ["25610"], velikostKategorie: null, kodObce: 560740,
  };
  const aresMaly: AresKlient = {
    overFirmu: async () => maly,
    najdiFirmyVObci: async () => [maly],
    najdiPodleJmena: async () => null,
  };
  const resSKodem = (kod: string): ResKlient => ({
    nactiUdaje: async (ico) => ({
      ico, kategorieKod: kod, kategoriePopis: kod, segment: "mikro",
      bezZamestnancu: false, zdrojUrl: `https://ares.gov.cz/res/${ico}`,
    }),
  });

  it("mikrofirmu ULOŽÍ, jen ji označí jako podlimitní", async () => {
    // Majitel na mikropodniky cílí jinou formou reklamy, takže se nesmí
    // zahodit — musí zůstat v kartotéce, jen mimo frontu na e-mailové oslovení.
    const s = await spustCmuchala(
      { db, ares: aresMaly, res: resSKodem("120"), geokoder }, // 1–5 zaměstnanců
      jidelnaId, { minZamestnancu: 10 },
    );
    expect(s.podLimitem).toBe(1);
    expect(s.kvalifikovano).toBe(1);

    const f = await db.query("select 1 from companies where ico = '48362956'");
    expect(f).toHaveLength(1);
  });

  it("firmu nad prahem pustí dál", async () => {
    const s = await spustCmuchala(
      { db, ares: aresMaly, res: resSKodem("230"), geokoder }, // 25–49
      jidelnaId, { minZamestnancu: 10 },
    );
    expect(s.podLimitem).toBe(0);
    expect(s.kvalifikovano).toBe(1);
  });

  it("s prahem 0 projdou i nejmenší firmy", async () => {
    const s = await spustCmuchala(
      { db, ares: aresMaly, res: resSKodem("120"), geokoder },
      jidelnaId, { minZamestnancu: 0 },
    );
    expect(s.kvalifikovano).toBe(1);
  });
});

describe("deník vyřazení (kalibrace pravidel)", () => {
  it("u každého vyřazení zapíše důvod i detail", async () => {
    await spustCmuchala({ db, ares, res, geokoder, mpsv, osm }, jidelnaId, {
      aresSweep: true,
    });
    const v = await db.query<{ nazev: string; duvod: string; detail: string; zdroj: string }>(
      "select nazev, duvod, detail, zdroj from vyrazeni order by duvod",
    );
    expect(v.length).toBeGreaterThan(0);
    // Prázdná schránka musí být zapsaná i s důvodem.
    const schranka = v.find((x) => x.duvod === "bez_zamestnancu");
    expect(schranka).toBeTruthy();
    expect(schranka!.detail).toContain("bez zaměstnanců");
    expect(["mpsv", "osm", "ares"]).toContain(schranka!.zdroj);
  });

  it("vyřazení je navázané na běh, takže jde dohledat kdy vzniklo", async () => {
    const s = await spustCmuchala({ db, ares, res, geokoder, mpsv, osm }, jidelnaId, {
      aresSweep: true,
    });
    const v = await db.query<{ pocet: string }>(
      "select count(*)::text as pocet from vyrazeni where beh_id = $1",
      [s.behId],
    );
    expect(Number(v[0]!.pocet)).toBeGreaterThan(0);
  });
});
