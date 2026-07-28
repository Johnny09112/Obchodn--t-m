import { beforeEach, describe, expect, it, vi } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { spustCmuchala } from "../src/cmuchal.js";
import type { AresKlient, AresZaznam } from "../src/ares.js";
import type { Geokoder } from "../src/geocode.js";
import type { MpsvKlient } from "../src/mpsv.js";
import type { OsmKlient } from "../src/osm.js";
import type { ResKlient, ResUdaje } from "../src/res.js";
import type { RegistrKlient } from "../src/registr.js";

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
  najdiStatutarniOrgany: async () => [],
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
    najdiStatutarniOrgany: async () => [],
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
    najdiStatutarniOrgany: async () => [],
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

describe("jednatel z obchodního rejstříku", () => {
  const aresSJednatelem: AresKlient = {
    ...ares,
    najdiStatutarniOrgany: async () => [
      { jmeno: "TOMÁŠ", prijmeni: "HONZÍK", funkce: "Jednatel" },
    ],
  };

  it("u firmy bez jiného kontaktu zapíše aspoň jméno a funkci", async () => {
    await spustCmuchala(
      { db, ares: aresSJednatelem, res, geokoder, mpsv }, jidelnaId,
    );
    const k = await db.query<{ jmeno: string; prijmeni: string; pozice: string; email: string | null }>(
      "select jmeno, prijmeni, pozice, email from contacts where ico = '25242407'",
    );
    expect(k[0]).toMatchObject({
      jmeno: "TOMÁŠ", prijmeni: "HONZÍK", pozice: "Jednatel", email: null,
    });
  });

  it("nehledá jednatele tam, kde už kontakt máme — je to dotaz navíc", async () => {
    let dotazu = 0;
    const aresPocitajici: AresKlient = {
      ...ares,
      najdiStatutarniOrgany: async () => {
        dotazu++;
        return [{ jmeno: "TOMÁŠ", prijmeni: "HONZÍK", funkce: "Jednatel" }];
      },
    };
    const mpsvSKontaktem: MpsvKlient = {
      zamestnavateleVObci: async () => [
        { ico: "25242407", nazev: agrofarmy.nazev, mist: 8, inzeratu: 1, kodObce: 560740,
          cisloDomovni: 2, jeAgentura: false, proKoho: null,
          kontakt: { jmeno: "Radek", prijmeni: "Ondrušek", pozice: "personalista",
                     email: "r@a.cz", telefon: null },
          zdrojUrl: "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json" },
      ],
    };
    await spustCmuchala(
      { db, ares: aresPocitajici, res, geokoder, mpsv: mpsvSKontaktem }, jidelnaId,
    );
    expect(dotazu).toBe(0);
  });

  it("výpadek rejstříku běh nepoloží", async () => {
    const rozbity: AresKlient = {
      ...ares,
      najdiStatutarniOrgany: async () => { throw new Error("ARES rejstřík 503"); },
    };
    const s = await spustCmuchala({ db, ares: rozbity, res, geokoder, mpsv }, jidelnaId);
    expect(s.kvalifikovano).toBeGreaterThan(0);
  });
});

describe("kontaktní osoba z dat úřadu práce", () => {
  const mpsvSKontaktem: MpsvKlient = {
    zamestnavateleVObci: async () => [
      { ico: "25242407", nazev: agrofarmy.nazev, mist: 8, inzeratu: 2, kodObce: 560740,
        cisloDomovni: 2, jeAgentura: false, proKoho: null,
        kontakt: {
          jmeno: "Ing. Radek", prijmeni: "Ondrušek", pozice: "personalista",
          email: "radek.ondrusek@agrofarmy.cz", telefon: "608 200 094",
        },
        zdrojUrl: "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json" },
    ],
  };

  it("zapíše jméno, pozici, e-mail i telefon rovnou při sběru", async () => {
    await spustCmuchala({ db, ares, res, geokoder, mpsv: mpsvSKontaktem }, jidelnaId);

    const k = await db.query<{
      jmeno: string; prijmeni: string; pozice: string; email: string;
      telefon: string; uroven_adresy: number; zdroj_url: string;
    }>("select jmeno, prijmeni, pozice, email, telefon, uroven_adresy, zdroj_url from contacts where ico = '25242407'");

    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({
      jmeno: "Ing. Radek", prijmeni: "Ondrušek", pozice: "personalista",
      email: "radek.ondrusek@agrofarmy.cz", telefon: "608 200 094",
      uroven_adresy: 3, // jmenná adresa konkrétní osoby
    });
    expect(k[0]!.zdroj_url).toContain("data.mpsv.cz");
  });

  it("přizná, k čemu byla adresa zveřejněná — je pro uchazeče, ne pro nabídky", async () => {
    // Bez toho by se při schvalování oslovení nedalo poznat, že člověk
    // svůj kontakt vystavil kvůli náboru, ne kvůli dodavatelům.
    await spustCmuchala({ db, ares, res, geokoder, mpsv: mpsvSKontaktem }, jidelnaId);

    const ev = await db.query<{ hodnota: string; citace: string }>(
      "select hodnota, citace from evidence where ico = '25242407' and atribut = 'ucel_adresy'",
    );
    expect(ev).toHaveLength(1);
    expect(ev[0]!.hodnota).toMatch(/uchazeč/i);
    expect(ev[0]!.citace).toMatch(/inzer|volné místo|nábor/i);
  });

  it("bez kontaktu v datech nic nezapíše", async () => {
    await spustCmuchala({ db, ares, res, geokoder, mpsv }, jidelnaId);
    expect(await db.query("select 1 from contacts")).toHaveLength(0);
  });
});

describe("kompletní registr ČSÚ jako zdroj kandidátů", () => {
  const zaznam = (ico: string, nazev: string, kategorieKod: string) => ({
    ico, nazev, pravniForma: "112", kategorieKod, nace: ["25610"],
    adresa: "Náves 1", obec: "Bezdružice", psc: "34901", jednotka: 560740,
    zdrojUrl: "https://opendata.csu.gov.cz/soubory/od/od_org03/res_data.csv",
  });

  it("nahradí sweep rejstříku a použije jeho územní jednotky", async () => {
    let dostalJednotky: number[] | undefined;
    const registr: RegistrKlient = {
      jednotkyObce: async () => [560740, 560741],
      zamestnavateleVJednotkach: async (j) => {
        dostalJednotky = j;
        return [zaznam("25242407", agrofarmy.nazev, "130")];
      },
    };
    await db.query("update jidelny set ico = '75007126' where id = $1", [jidelnaId]);

    const s = await spustCmuchala({ db, ares, res, geokoder, registr }, jidelnaId, {
      aresSweep: true,
    });

    expect(dostalJednotky).toEqual([560740, 560741]);
    expect(s.dleZdroje.registr).toBe(1);
    expect(s.dleZdroje.ares).toBe(0); // starý sweep se už nepoužil
    expect(s.kvalifikovano).toBe(1);
  });

  it("malé firmy nepustí ani k ověřování — velikost zná dopředu", async () => {
    // V tom je celá úspora: dnes se velikost zjišťuje až dotazem na každou
    // firmu zvlášť, takže se nedá filtrovat dřív, než se firma stáhne.
    let overovano = 0;
    const aresPocitajici: AresKlient = {
      ...ares,
      overFirmu: async (i) => {
        overovano++;
        return vsechny.find((f) => f.ico === i) ?? null;
      },
    };
    const registr: RegistrKlient = {
      jednotkyObce: async () => [560740],
      zamestnavateleVJednotkach: async (_j, o) => {
        expect(o?.minZamestnancu).toBe(25); // práh se předává do registru
        return [zaznam("25489631", zinkovna.nazev, "240")];
      },
    };
    await db.query("update jidelny set ico = '75007126' where id = $1", [jidelnaId]);

    await spustCmuchala({ db, ares: aresPocitajici, res, geokoder, registr }, jidelnaId, {
      minZamestnancu: 25,
    });
    expect(overovano).toBe(1); // jen ta jedna, co prošla prahem v registru
  });

  it("bez IČO jídelny vezme aspoň její obec, ať se běh nezastaví", async () => {
    let dostalJednotky: number[] | undefined;
    const registr: RegistrKlient = {
      jednotkyObce: async () => [],
      zamestnavateleVJednotkach: async (j) => {
        dostalJednotky = j;
        return [];
      },
    };
    await db.query("update jidelny set ico = null where id = $1", [jidelnaId]);

    await spustCmuchala({ db, ares, res, geokoder, registr }, jidelnaId);
    expect(dostalJednotky).toEqual([560740]); // kod_obce jídelny
  });
});

describe("velké město: sweep rejstříku nestačí", () => {
  it("běh pokračuje z ostatních zdrojů a řekne to lidsky", async () => {
    // Plzeň má 49 831 subjektů, po zúžení na formy zaměstnavatelů 13 600 —
    // pořád přes limit. Nesmí to vypadat jako úspěšný sběr.
    const aresVelke: AresKlient = {
      overFirmu: async (i) => vsechny.find((f) => f.ico === i) ?? null,
      najdiFirmyVObci: async () => {
        throw new Error(
          "Obec 554791 má 13 600 subjektů a rejstřík vydá nejvýš 1 000 na dotaz. " +
            "Pracoviště v ní hledej přes otevřená data MPSV a OpenStreetMap.",
        );
      },
      najdiPodleJmena: async () => null,
    najdiStatutarniOrgany: async () => [],
    };

    const s = await spustCmuchala(
      { db, ares: aresVelke, res, geokoder, mpsv }, jidelnaId, { aresSweep: true },
    );

    expect(s.kvalifikovano).toBe(2); // MPSV svoje dodal
    expect(s.poznamkyProPlaybook.join(" ")).toMatch(/13 600/);
    expect(s.poznamkyProPlaybook.join(" ")).toMatch(/MPSV/);
  });

  it("sweep posílá do rejstříku zúžení na formy zaměstnavatelů", async () => {
    let zachyceno: readonly string[] | undefined;
    const aresSpy: AresKlient = {
      overFirmu: async () => null,
      najdiFirmyVObci: async (_kod, o) => {
        zachyceno = o?.pravniFormy;
        return [];
      },
      najdiPodleJmena: async () => null,
    najdiStatutarniOrgany: async () => [],
    };
    await spustCmuchala({ db, ares: aresSpy, res, geokoder }, jidelnaId, { aresSweep: true });

    expect(zachyceno).toContain("112"); // s.r.o. chceme
    expect(zachyceno).not.toContain("101"); // živnostníka ne
    expect(zachyceno).not.toContain("145"); // bytový dům ne
  });
});

describe("bytové domy a živnostníci", () => {
  const svj: AresZaznam = {
    ico: "26352524", nazev: "Společenství vlastníků jednotek Hrádek, 1. máje 180",
    adresa: "1. máje 180", obec: "Bezdružice", czNace: ["68200"],
    velikostKategorie: null, kodObce: 560740, pravniForma: "145",
  };
  const zivnostnik: AresZaznam = {
    ico: "45407070", nazev: "KATEŘINA POHLOTOVÁ", adresa: "Náves 5",
    obec: "Bezdružice", czNace: ["47790"], velikostKategorie: null,
    kodObce: 560740, pravniForma: "101",
  };
  const resMaly: ResKlient = {
    nactiUdaje: async (ico) => ({
      ico, kategorieKod: "120", kategoriePopis: "1–5", segment: "mikro",
      bezZamestnancu: false, zdrojUrl: `https://ares.gov.cz/res/${ico}`,
    }),
  };
  const aresObojí = (zaznamy: AresZaznam[]): AresKlient => ({
    overFirmu: async (i) => zaznamy.find((z) => z.ico === i) ?? null,
    najdiFirmyVObci: async () => zaznamy,
    najdiPodleJmena: async () => null,
    najdiStatutarniOrgany: async () => [],
  });

  it("bytový dům vyřadí — formálně zaměstnavatel, fakticky dům", async () => {
    const s = await spustCmuchala(
      { db, ares: aresObojí([svj]), res: resMaly, geokoder }, jidelnaId,
    );
    expect(s.bytovychDomu).toBe(1);
    expect(s.kvalifikovano).toBe(0);
    expect(await db.query("select 1 from companies where ico = '26352524'")).toHaveLength(0);

    const v = await db.query<{ duvod: string; detail: string }>(
      "select duvod, detail from vyrazeni where ico = '26352524'",
    );
    expect(v[0]!.duvod).toBe("bytovy_dum");
    expect(v[0]!.detail).toContain("Společenství vlastníků");
  });

  it("živnostníka NEVYŘADÍ — bude se oslovovat jinou formou", async () => {
    // Rozhodnutí majitele 2026-07-27: OSVČ se zachovají v samostatné
    // kartotéce, stejně jako mikropodniky. Neuložit ≠ nezahodit.
    const s = await spustCmuchala(
      { db, ares: aresObojí([zivnostnik]), res: resMaly, geokoder }, jidelnaId,
    );
    expect(s.kvalifikovano).toBe(1);

    const f = await db.query<{ pravni_forma: string }>(
      "select pravni_forma from companies where ico = '45407070'",
    );
    expect(f[0]!.pravni_forma).toBe("101"); // ať jde kartotéka členit
  });
});

describe("partnerská jídelna se nesmí objevit mezi firmami", () => {
  // Naši partneři (školy, které pro nás vaří) vyjdou ze sweepu rejstříku jako
  // běžní zaměstnavatelé. Nabízet obědy vlastní jídelně nedává smysl.
  const skola: AresZaznam = {
    ico: "69974012", nazev: "Základní škola s mateřskou školou Bezdružice",
    adresa: "Školní 183", obec: "Bezdružice", czNace: ["85200"],
    velikostKategorie: null, kodObce: 560740,
  };
  const aresSeSkolou: AresKlient = {
    overFirmu: async (i) => (i === skola.ico ? skola : null),
    najdiFirmyVObci: async () => [skola],
    najdiPodleJmena: async () => null,
    najdiStatutarniOrgany: async () => [],
  };
  const resSkola: ResKlient = {
    nactiUdaje: async (ico) => ({
      ico, kategorieKod: "230", kategoriePopis: "25–49", segment: "stredni",
      bezZamestnancu: false, zdrojUrl: `https://ares.gov.cz/res/${ico}`,
    }),
  };

  it("firmu s IČO partnerské jídelny nezaloží a zapíše důvod", async () => {
    await db.query("update jidelny set ico = $1 where id = $2", [skola.ico, jidelnaId]);

    const s = await spustCmuchala(
      { db, ares: aresSeSkolou, res: resSkola, geokoder }, jidelnaId,
    );

    expect(s.kvalifikovano).toBe(0);
    expect(s.partnerskychJidelen).toBe(1);
    expect(await db.query("select 1 from companies where ico = '69974012'")).toHaveLength(0);

    const v = await db.query<{ duvod: string; detail: string }>(
      "select duvod, detail from vyrazeni where ico = '69974012'",
    );
    expect(v[0]!.duvod).toBe("partnerska_jidelna");
    expect(v[0]!.detail).toContain("jídelna");
  });

  it("vyřazuje i jídelnu z jiné obce — partner je partner všude", async () => {
    // Škola v Tlučné se objeví i při běhu na Zbůchu (sousední obec v zóně).
    const jina = await db.query<{ id: string }>(
      `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, ico)
       values ('ZŠ jinde','x','Tlučná',$1,$2,559491,$3) returning id`,
      [JIDELNA.lat, JIDELNA.lng, skola.ico],
    );
    expect(jina).toHaveLength(1);

    const s = await spustCmuchala(
      { db, ares: aresSeSkolou, res: resSkola, geokoder }, jidelnaId,
    );
    expect(s.partnerskychJidelen).toBe(1);
    expect(await db.query("select 1 from companies where ico = '69974012'")).toHaveLength(0);
  });

  it("běžnou firmu bez vazby na jídelnu nechá projít", async () => {
    await db.query("update jidelny set ico = '25242407' where id = $1", [jidelnaId]);
    const s = await spustCmuchala(
      { db, ares: aresSeSkolou, res: resSkola, geokoder }, jidelnaId,
    );
    expect(s.partnerskychJidelen).toBe(0);
    expect(s.kvalifikovano).toBe(1);
  });
});

describe("kapacita jídelny není podmínkou sběru", () => {
  it("běh projde i když kapacita není známá", async () => {
    const r = await db.query<{ id: string }>(
      `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, kapacita_volna)
       values ('Bez kapacity','x','Bezdružice',$1,$2,560740,null) returning id`,
      [JIDELNA.lat, JIDELNA.lng],
    );
    const s = await spustCmuchala({ db, ares, res, geokoder, mpsv }, r[0]!.id);
    expect(s.kvalifikovano).toBeGreaterThan(0);
    expect(s.poznamkyProPlaybook.join(" ")).toMatch(/kapacita.*není známá/i);
  });

  it("nulová kapacita sběr nezastaví, jen upozorní", async () => {
    const r = await db.query<{ id: string }>(
      `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, kapacita_volna)
       values ('Plná','x','Bezdružice',$1,$2,560740,0) returning id`,
      [JIDELNA.lat, JIDELNA.lng],
    );
    const s = await spustCmuchala({ db, ares, res, geokoder, mpsv }, r[0]!.id);
    expect(s.kvalifikovano).toBeGreaterThan(0);
    expect(s.poznamkyProPlaybook.join(" ")).toMatch(/nemá volnou kapacitu/i);
  });

  it("neaktivní jídelnu pořád odmítne", async () => {
    const r = await db.query<{ id: string }>(
      `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, aktivni)
       values ('Zrušená','x','Bezdružice',50,14,560740,false) returning id`,
    );
    await expect(
      spustCmuchala({ db, ares, res, geokoder }, r[0]!.id),
    ).rejects.toThrow(/není aktivní/i);
  });
});
