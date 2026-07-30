import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiBlacklist, pridejPravidlo } from "../src/blacklist.js";
import { zalozOblast } from "../src/oblast.js";
import { nactiProfil, type Profil } from "../src/profil.js";
import { objednejPruzkum } from "../src/pruzkum.js";
import { rozhlednuti, vyridPruzkum, zpracujFirmuVOblasti } from "../src/cmuchal-oblast.js";
import type { AresKlient, AresZaznam } from "../src/ares.js";
import type { Geokoder, Misto } from "../src/geocode.js";
import type { Oblast } from "../src/oblast-tvar.js";
import type { RegistrKlient, RegistrZaznam } from "../src/registr.js";
import type { ResKlient } from "../src/res.js";
import type { CmuchalDeps } from "../src/cmuchal.js";
import { nastavGeo, zacniBeh, zalozFirmu } from "../src/repo.js";

let db: Db;
let pruzkumId: string;

/** Výchozí pravidla kvalifikace pro testy, které je nezkoumají — blacklist a
 *  partnerské jídelny se čtou z databáze (prázdné, dokud test nic nevloží),
 *  profil je aktivní profil z migrace (Cantinero). */
async function vychoziPravidla(db: Db) {
  return {
    partnerskaIca: new Set<string>(),
    blacklist: await nactiBlacklist(db),
    profil: await nactiProfil(db),
  };
}

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("schéma úseků průzkumu", () => {
  beforeEach(async () => {
    const oblastId = await zalozOblast(db, {
      nazev: "Území",
      oblast: { typ: "kruh", stred: { lat: 49.6, lng: 13.2 }, polomerM: 3000 },
    });
    pruzkumId = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
  });

  it("tatáž jednotka se do jedné objednávky nedostane dvakrát", async () => {
    await db.query(
      "insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi) values ($1,554791,'Zbůch',1)",
      [pruzkumId],
    );
    await expect(
      db.query(
        "insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi) values ($1,554791,'Zbůch',2)",
        [pruzkumId],
      ),
    ).rejects.toThrow();
  });

  it("neúspěšný úsek bez popisu chyby neprojde", async () => {
    await expect(
      db.query(
        `insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi, stav)
         values ($1,554791,'Zbůch',1,'selhalo')`,
        [pruzkumId],
      ),
    ).rejects.toThrow();
  });

  it("objednávka smí čekat na rozhodnutí člověka", async () => {
    // Nový stav: tvar nezabírá žádnou obec a čeká se na odpověď.
    await db.query("update pruzkumy set stav = 'ceka_na_rozhodnuti' where id = $1", [pruzkumId]);
    const r = await db.query<{ stav: string }>("select stav from pruzkumy where id = $1", [pruzkumId]);
    expect(r[0]?.stav).toBe("ceka_na_rozhodnuti");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Společná příprava pro testy úkolů 7 a 8.

const STRED = { lat: 49.6, lng: 13.2 };
/** 0,001° zeměpisné šířky ≈ 111 m. */
const severne = (m: number) => ({ lat: STRED.lat + m / 111_320, lng: STRED.lng });

/** Uvnitř kruhu 3 km. */
const uvnitr: AresZaznam = {
  ico: "25232657", nazev: "Blízká s.r.o.", adresa: "Náves 1", obec: "Zbůch",
  czNace: ["25610"], velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
};
/** Sídlí ve stejné jednotce, ale leží 9 km daleko — tvar ji musí odmítnout. */
const mimo: AresZaznam = {
  ico: "17439523", nazev: "Daleká s.r.o.", adresa: "Kraj 9", obec: "Zbůch",
  czNace: ["25610"], velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
};
/** Firma z druhé územní jednotky — pro testy, které potřebují víc úseků. */
const uvnitrDruhy: AresZaznam = {
  ico: "60193531", nazev: "Druhá s.r.o.", adresa: "Hlavní 2", obec: "Druhá obec",
  czNace: ["25610"], velikostKategorie: "stredni", kodObce: 559662, pravniForma: "112",
};
const JEDNOTKA_B = uvnitrDruhy.kodObce!;

const VSECHNY_ARES = [uvnitr, mimo, uvnitrDruhy];

const souradnice: Record<string, { lat: number; lng: number }> = {
  "25232657": severne(500),
  "17439523": severne(9000),
  "60193531": severne(700),
};

/** Výchozí rozdělení firem podle jednotky — jedna jednotka, dvě firmy (uvnitř/mimo). */
const VYCHOZI_JEDNOTKA = 559661;
const VYCHOZI_FIRMY_PODLE_JEDNOTKY: Record<number, AresZaznam[]> = {
  [VYCHOZI_JEDNOTKA]: [uvnitr, mimo],
};

/** Počítá volání, aby šlo ověřit, že se nezaměřuje ani nehledá dvakrát. */
function falesneDeps(
  db: Db,
  opts: {
    mista?: Misto[];
    /** Jednotky, které vrátí `jednotkyPodleMist` — víc jednotek znamená víc úseků. */
    jednotky?: Array<{ jednotka: number; obec: string }>;
    /** Které firmy `zamestnavateleVJednotkach` vrátí pro kterou jednotku. */
    firmyPodleJednotky?: Record<number, AresZaznam[]>;
    /** Jednotky, u kterých má sweep vyhodit chybu (simulace selhání registru). */
    jednotkySeSelhanim?: number[];
  } = {},
) {
  const pocty = { zamereni: 0, sweepu: 0 };
  const mista = opts.mista ?? [{ obec: "Zbůch", psc: "330 22" }];
  const jednotky = opts.jednotky ?? [{ jednotka: VYCHOZI_JEDNOTKA, obec: "Zbůch" }];
  const firmyPodleJednotky = opts.firmyPodleJednotky ?? VYCHOZI_FIRMY_PODLE_JEDNOTKY;
  const selhavajiciJednotky = new Set(opts.jednotkySeSelhanim ?? []);

  const geokoder: Geokoder = {
    geokoduj: async (adresa) => {
      pocty.zamereni++;
      const zaznam = VSECHNY_ARES.find((z) => z.adresa !== null && adresa.includes(z.adresa));
      return zaznam ? souradnice[zaznam.ico]! : null;
    },
    zpetne: async () => mista[0] ?? null,
  };

  const registr: RegistrKlient = {
    zamestnavateleVJednotkach: async (js) => {
      pocty.sweepu++;
      // Selhání se simuluje jen pro dotaz na jeden konkrétní úsek (délka 1) —
      // souhrnný odhad kandidátů v `rozhlednuti` se ptá na všechny jednotky
      // naráz a ten selhat nemá, testuje se jím jiná věc.
      if (js.length === 1 && selhavajiciJednotky.has(js[0]!)) {
        throw new Error("Registr ČSÚ selhal");
      }
      return js.flatMap((j) => firmyPodleJednotky[j] ?? []).map(
        (z): RegistrZaznam => ({
          ico: z.ico, nazev: z.nazev, pravniForma: "112", kategorieKod: "330",
          nace: z.czNace, adresa: z.adresa, obec: z.obec, psc: "330 22",
          jednotka: z.kodObce ?? VYCHOZI_JEDNOTKA, zdrojUrl: "https://csu.gov.cz/registr",
        }),
      );
    },
    jednotkyObce: async () => jednotky.map((j) => j.jednotka),
    jednotkyPodleMist: async () => jednotky,
  };

  const ares: AresKlient = {
    overFirmu: async (ico) => VSECHNY_ARES.find((z) => z.ico === ico) ?? null,
    najdiFirmyVObci: async () => VSECHNY_ARES,
    najdiPodleJmena: async () => null,
    najdiStatutarniOrgany: async () => [],
  };

  const res: ResKlient = {
    nactiUdaje: async () => null,
  };

  return { deps: { db, ares, res, geokoder, registr } as unknown as CmuchalDeps, pocty };
}

// ─────────────────────────────────────────────────────────────────────────

describe("rozhlednuti", () => {
  let oblastId: string;

  beforeEach(async () => {
    oblastId = await zalozOblast(db, {
      nazev: "Území",
      oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    pruzkumId = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
  });

  it("založí jeden úsek na každou nalezenou jednotku, očíslované od 1, ve stavu 'ceka'", async () => {
    const { deps, pocty } = falesneDeps(db);

    const r = await rozhlednuti(deps, pruzkumId);

    expect(r.cekaNaRozhodnuti).toBe(false);
    const useky = await db.query<{ jednotka: number; obec: string; poradi: number; stav: string }>(
      "select jednotka, obec, poradi, stav from pruzkum_useky where pruzkum_id = $1 order by poradi",
      [pruzkumId],
    );
    expect(useky.length).toBe(r.useku);
    useky.forEach((u, i) => {
      expect(u.poradi).toBe(i + 1);
      expect(u.stav).toBe("ceka");
    });
    // Rozhlédnutí nic nezaměřuje — geokoduje se jen adresa firmy při jejím
    // zápisu, ne při odhadu.
    expect(pocty.zamereni).toBe(0);
  });

  it("vrátí počet obcí a počet kandidátů", async () => {
    const { deps } = falesneDeps(db);

    const r = await rozhlednuti(deps, pruzkumId);

    expect(r.obci).toBe(1);
    expect(r.kandidatu).toBe(2); // registr zná uvnitr i mimo v té jednotce
  });

  it("opakované rozhlédnutí úseky nezdvojí — přeskočí, ne spadne", async () => {
    const { deps } = falesneDeps(db);

    await rozhlednuti(deps, pruzkumId);
    // Objednávka je po prvním rozhlédnutí hotová/zahájená — pro test stačí
    // ověřit, že druhé zavolání nespadne na duplicitě úseku.
    await db.query("update pruzkumy set stav = 'ceka' where id = $1", [pruzkumId]);
    await expect(rozhlednuti(deps, pruzkumId)).resolves.toBeDefined();

    const pocet = await db.query<{ pocet: number }>(
      "select count(*)::int as pocet from pruzkum_useky where pruzkum_id = $1",
      [pruzkumId],
    );
    expect(pocet[0]?.pocet).toBe(1);
  });

  it("když tvar nezabírá žádnou obec: čeká na rozhodnutí, žádný úsek — i když se všechny body dohledaly bez chyby", async () => {
    // Normální tvar (mřížka najde spoustu bodů), ale zpětné dohledání u
    // KAŽDÉHO z nich vrátí `null` bez jakékoli chyby — to je legitimní
    // odpověď „na tomhle místě žádná obec není" (odloučená fabrika
    // uprostřed pole), ne porucha mapové služby. Ta by se hlásila výjimkou,
    // ne návratovou hodnotou — viz test níž.
    const { deps, pocty } = falesneDeps(db);
    deps.geokoder.zpetne = async () => null;

    const r = await rozhlednuti(deps, pruzkumId);

    expect(r.cekaNaRozhodnuti).toBe(true);
    expect(r.useku).toBe(0);
    expect(r.nedohledano).toBeGreaterThan(0); // body byly, jen bez obce

    const useky = await db.query("select 1 from pruzkum_useky where pruzkum_id = $1", [pruzkumId]);
    expect(useky.length).toBe(0);

    const stav = await db.query<{ stav: string }>("select stav from pruzkumy where id = $1", [pruzkumId]);
    expect(stav[0]?.stav).toBe("ceka_na_rozhodnuti");
    expect(pocty.zamereni).toBe(0);
  });

  it("když geokodér vyhodí výjimku (mrtvá mapová služba): objednávka skončí 'selhalo' s důvodem", async () => {
    const { deps } = falesneDeps(db);
    // Skutečný geokodér (src/geocode.ts) při selhání služby vyhazuje chybu,
    // nevrací null — null je vyhrazené pro „tady žádná obec není".
    deps.geokoder.zpetne = async () => {
      throw new Error("Nominatim 503");
    };

    await expect(rozhlednuti(deps, pruzkumId)).rejects.toThrow();

    const stav = await db.query<{ stav: string; chyba: string | null }>(
      "select stav, chyba from pruzkumy where id = $1",
      [pruzkumId],
    );
    expect(stav[0]?.stav).toBe("selhalo");
    expect(stav[0]?.chyba).toBeTruthy();
    expect(stav[0]?.chyba).toContain("Nominatim 503");
  });
});

// ─────────────────────────────────────────────────────────────────────────

const OBLAST: Oblast = { typ: "kruh", stred: STRED, polomerM: 3000 };

describe("zpracujFirmuVOblasti", () => {
  let oblastId: string;
  let behId: string;
  let pravidla: Awaited<ReturnType<typeof vychoziPravidla>>;

  beforeEach(async () => {
    oblastId = await zalozOblast(db, { nazev: "Území", oblast: OBLAST });
    behId = await zacniBeh(db, "cmuchal-oblast", { oblastId });
    pravidla = await vychoziPravidla(db);
  });

  it("firma uvnitř tvaru se uloží s prázdnou jídelnou, čeká na jídelnu a nemá skóre", async () => {
    const { deps } = falesneDeps(db);
    const zaznamy = await deps.registr!.zamestnavateleVJednotkach([559661]);
    const zaznamUvnitr = zaznamy.find((z) => z.ico === uvnitr.ico)!;

    const vysledek = await zpracujFirmuVOblasti(deps, {
      zaznam: zaznamUvnitr,
      oblast: OBLAST,
      oblastId,
      behId,
      ...pravidla,
    });

    expect(vysledek).toEqual({ stav: "ulozena", ico: uvnitr.ico });

    const firma = await db.query<{
      nejblizsi_jidelna_id: string | null;
      lat: number | null;
      stav: string;
      skore: number | null;
    }>(
      "select nejblizsi_jidelna_id, lat::float8 as lat, stav, skore from companies where ico = $1",
      [uvnitr.ico],
    );
    expect(firma.length).toBe(1);
    expect(firma[0]?.nejblizsi_jidelna_id).toBeNull();
    expect(firma[0]?.lat).not.toBeNull();
    // Kvalifikovaná firma bez jídelny — přesně tahle situace.
    expect(firma[0]?.stav).toBe("cekajici_na_jidelnu");
    // Skóre počítá vzdálenost k jídelně (src/score.ts) — u oblasti žádná
    // není a vymýšlet ji nesmíme (TP-2). Prázdné je legitimní stav.
    expect(firma[0]?.skore).toBeNull();

    const vOblasti = await db.query(
      "select 1 from oblast_firmy where oblast_id = $1 and ico = $2",
      [oblastId, uvnitr.ico],
    );
    expect(vOblasti.length).toBe(1);
  });

  it("firma mimo tvar se neuloží a přibude řádek do vyrazeni", async () => {
    const { deps } = falesneDeps(db);
    const zaznamy = await deps.registr!.zamestnavateleVJednotkach([559661]);
    const zaznamMimo = zaznamy.find((z) => z.ico === mimo.ico)!;

    const vysledek = await zpracujFirmuVOblasti(deps, {
      zaznam: zaznamMimo,
      oblast: OBLAST,
      oblastId,
      behId,
      ...pravidla,
    });

    expect(vysledek).toEqual({ stav: "mimo_tvar", ico: mimo.ico });

    const firma = await db.query("select 1 from companies where ico = $1", [mimo.ico]);
    expect(firma.length).toBe(0);

    const vOblasti = await db.query(
      "select 1 from oblast_firmy where oblast_id = $1 and ico = $2",
      [oblastId, mimo.ico],
    );
    expect(vOblasti.length).toBe(0);

    const vyrazeniRadky = await db.query<{ duvod: string; jidelna_id: string | null }>(
      "select duvod, jidelna_id from vyrazeni where ico = $1",
      [mimo.ico],
    );
    expect(vyrazeniRadky.length).toBe(1);
    expect(vyrazeniRadky[0]?.duvod).toBe("mimo_zonu");
    expect(vyrazeniRadky[0]?.jidelna_id).toBeNull();
  });

  it("firma, která už má souřadnice, se nezaměřuje podruhé", async () => {
    const { deps, pocty } = falesneDeps(db);
    const zaznamy = await deps.registr!.zamestnavateleVJednotkach([559661]);
    const zaznamUvnitr = zaznamy.find((z) => z.ico === uvnitr.ico)!;

    const prvni = await zpracujFirmuVOblasti(deps, {
      zaznam: zaznamUvnitr,
      oblast: OBLAST,
      oblastId,
      behId,
      ...pravidla,
    });
    expect(prvni.stav).toBe("ulozena");
    expect(pocty.zamereni).toBe(1);

    // Druhé zpracování téhož záznamu — firma už má souřadnice v `companies`,
    // takže se nesmí zaměřovat znovu.
    const druhy = await zpracujFirmuVOblasti(deps, {
      zaznam: zaznamUvnitr,
      oblast: OBLAST,
      oblastId,
      behId,
      ...pravidla,
    });
    expect(druhy.stav).toBe("ulozena");
    expect(pocty.zamereni).toBe(1);
  });

  it("firma, kterou ARES nezná, se neuloží a zapíše se vyřazení", async () => {
    const { deps } = falesneDeps(db);
    const neznama: RegistrZaznam = {
      ico: "99999999",
      nazev: "Neznámá s.r.o.",
      pravniForma: "112",
      kategorieKod: "330",
      nace: ["25610"],
      adresa: "Nikde 1",
      obec: "Zbůch",
      psc: "330 22",
      jednotka: 559661,
      zdrojUrl: "https://csu.gov.cz/registr",
    };

    const vysledek = await zpracujFirmuVOblasti(deps, {
      zaznam: neznama,
      oblast: OBLAST,
      oblastId,
      behId,
      ...pravidla,
    });

    expect(vysledek).toEqual({ stav: "vyrazena", ico: "99999999" });

    const firma = await db.query("select 1 from companies where ico = $1", ["99999999"]);
    expect(firma.length).toBe(0);

    const vyrazeniRadky = await db.query<{ duvod: string }>(
      "select duvod from vyrazeni where ico = $1",
      ["99999999"],
    );
    expect(vyrazeniRadky.length).toBe(1);
    expect(vyrazeniRadky[0]?.duvod).toBe("nesparovano");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Kvalifikace nad oblastí — stejná pravidla jako u cesty kolem jídelny
// (src/kvalifikace.ts). Bez toho by do oblasti mohl spadnout bytový dům,
// firma bez zaměstnanců, blacklistovaná firma nebo naše vlastní jídelna.

describe("zpracujFirmuVOblasti — kvalifikace (koho vůbec chceme)", () => {
  let oblastId: string;
  let behId: string;

  beforeEach(async () => {
    oblastId = await zalozOblast(db, { nazev: "Území", oblast: OBLAST });
    behId = await zacniBeh(db, "cmuchal-oblast", { oblastId });
  });

  /** Kandidát z registru, dostatečně obecný, aby ho šlo v jednotlivých testech přeladit. */
  const zaznamKandidata = (over: Partial<RegistrZaznam> = {}): RegistrZaznam => ({
    ico: "10000003",
    nazev: "Testovací s.r.o.",
    pravniForma: "112",
    kategorieKod: "330",
    nace: ["25610"],
    adresa: "Náves 1",
    obec: "Zbůch",
    psc: "330 22",
    jednotka: VYCHOZI_JEDNOTKA,
    zdrojUrl: "https://csu.gov.cz/registr",
    ...over,
  });

  /** Zaregistruje kandidáta i v ARES — ARES vrací právní formu a obor, na
   *  kterých kvalifikace rozhoduje, registr sám o sobě nestačí. */
  function sAresem(deps: CmuchalDeps, zaznam: RegistrZaznam, over: Partial<AresZaznam> = {}) {
    deps.ares.overFirmu = async (ico) =>
      ico === zaznam.ico
        ? {
            ico: zaznam.ico,
            nazev: zaznam.nazev,
            adresa: zaznam.adresa,
            obec: zaznam.obec,
            czNace: zaznam.nace,
            velikostKategorie: null,
            kodObce: VYCHOZI_JEDNOTKA,
            pravniForma: zaznam.pravniForma,
            ...over,
          }
        : null;
    return deps;
  }

  it("bytový dům se neuloží a zapíše se vyřazení, bez zbytečného zaměření", async () => {
    const { deps, pocty } = falesneDeps(db);
    const zaznam = zaznamKandidata({ ico: "10000003" });
    sAresem(deps, zaznam, { pravniForma: "145" }); // společenství vlastníků jednotek
    const pravidla = await vychoziPravidla(db);

    const vysledek = await zpracujFirmuVOblasti(deps, { zaznam, oblast: OBLAST, oblastId, behId, ...pravidla });

    expect(vysledek).toEqual({ stav: "vyrazena", ico: zaznam.ico });
    expect(await db.query("select 1 from companies where ico = $1", [zaznam.ico])).toHaveLength(0);
    const v = await db.query<{ duvod: string }>("select duvod from vyrazeni where ico = $1", [zaznam.ico]);
    expect(v).toHaveLength(1);
    expect(v[0]?.duvod).toBe("bytovy_dum");
    // Kvalifikace běží před zaměřením adresy — nemá smysl utrácet dotaz na
    // mapovou službu za firmu, kterou stejně nechceme.
    expect(pocty.zamereni).toBe(0);
  });

  it("firma na blacklistu se neuloží a zapíše majitelův důvod", async () => {
    const { deps } = falesneDeps(db);
    const zaznam = zaznamKandidata({ ico: "10000011" });
    sAresem(deps, zaznam);
    await pridejPravidlo(db, {
      typ: "ico",
      hodnota: zaznam.ico,
      duvod: "s touhle firmou jsme už dřív jednali",
    });
    const pravidla = await vychoziPravidla(db);

    const vysledek = await zpracujFirmuVOblasti(deps, { zaznam, oblast: OBLAST, oblastId, behId, ...pravidla });

    expect(vysledek).toEqual({ stav: "vyrazena", ico: zaznam.ico });
    expect(await db.query("select 1 from companies where ico = $1", [zaznam.ico])).toHaveLength(0);
    const v = await db.query<{ duvod: string; detail: string }>(
      "select duvod, detail from vyrazeni where ico = $1",
      [zaznam.ico],
    );
    expect(v).toHaveLength(1);
    expect(v[0]?.duvod).toBe("blacklist");
    expect(v[0]?.detail).toBe("s touhle firmou jsme už dřív jednali");
  });

  it("firma pod prahem velikosti (bez zaměstnanců) se neuloží a zapíše se vyřazení", async () => {
    const { deps } = falesneDeps(db);
    // Kategorie 110 = „bez zaměstnanců" (viz KATEGORIE_PRACOVNIKU v src/res.ts) —
    // hluboko pod prahem profilu (10 zaměstnanců).
    const zaznam = zaznamKandidata({ ico: "10000020", kategorieKod: "110" });
    sAresem(deps, zaznam);
    const pravidla = await vychoziPravidla(db);

    const vysledek = await zpracujFirmuVOblasti(deps, { zaznam, oblast: OBLAST, oblastId, behId, ...pravidla });

    expect(vysledek).toEqual({ stav: "vyrazena", ico: zaznam.ico });
    expect(await db.query("select 1 from companies where ico = $1", [zaznam.ico])).toHaveLength(0);
    const v = await db.query<{ duvod: string }>("select duvod from vyrazeni where ico = $1", [zaznam.ico]);
    expect(v).toHaveLength(1);
    expect(v[0]?.duvod).toBe("bez_zamestnancu");
  });

  it("partnerská jídelna se neuloží a zapíše se vyřazení", async () => {
    const { deps } = falesneDeps(db);
    const zaznam = zaznamKandidata({ ico: "10000038" });
    sAresem(deps, zaznam);
    const pravidla = { ...(await vychoziPravidla(db)), partnerskaIca: new Set([zaznam.ico]) };

    const vysledek = await zpracujFirmuVOblasti(deps, { zaznam, oblast: OBLAST, oblastId, behId, ...pravidla });

    expect(vysledek).toEqual({ stav: "vyrazena", ico: zaznam.ico });
    expect(await db.query("select 1 from companies where ico = $1", [zaznam.ico])).toHaveLength(0);
    const v = await db.query<{ duvod: string }>("select duvod from vyrazeni where ico = $1", [zaznam.ico]);
    expect(v).toHaveLength(1);
    expect(v[0]?.duvod).toBe("partnerska_jidelna");
  });

  it("kvalifikovaná firma nad oblastí dostane stav 'cekajici_na_jidelnu' a žádné skóre", async () => {
    const { deps } = falesneDeps(db);
    const zaznam = zaznamKandidata({ ico: "10000046" });
    sAresem(deps, zaznam);
    const pravidla = await vychoziPravidla(db);

    const vysledek = await zpracujFirmuVOblasti(deps, { zaznam, oblast: OBLAST, oblastId, behId, ...pravidla });

    expect(vysledek.stav).toBe("ulozena");
    const firma = await db.query<{ stav: string; skore: number | null }>(
      "select stav, skore from companies where ico = $1",
      [zaznam.ico],
    );
    expect(firma[0]?.stav).toBe("cekajici_na_jidelnu");
    expect(firma[0]?.skore).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Úkol 8b — přerušitelný běh přes úseky.

/** Dvě jednotky = dva úseky, aby šlo testovat dělení a navazování. */
const DVE_JEDNOTKY = [
  { jednotka: VYCHOZI_JEDNOTKA, obec: "Zbůch" },
  { jednotka: JEDNOTKA_B, obec: "Druhá obec" },
];
const FIRMY_DVOU_JEDNOTEK: Record<number, AresZaznam[]> = {
  [VYCHOZI_JEDNOTKA]: [uvnitr, mimo],
  [JEDNOTKA_B]: [uvnitrDruhy],
};

describe("vyridPruzkum", () => {
  let oblastId: string;

  beforeEach(async () => {
    oblastId = await zalozOblast(db, { nazev: "Území", oblast: OBLAST });
    pruzkumId = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
  });

  it("před prvním úsekem se převezmou už známé firmy z kartotéky, bez jediného zaměření", async () => {
    const { deps, pocty } = falesneDeps(db);
    // Firma uvnitř tvaru, kterou už evidujeme z dřívějška (jiný zdroj, jiný běh).
    await zalozFirmu(db, uvnitr);
    await nastavGeo(db, uvnitr.ico, {
      ...souradnice[uvnitr.ico]!,
      jidelnaId: null,
      vzdalenostM: null,
      vZone: null,
    });

    // nejvyseUseku: 0 — žádný úsek se nezpracuje, ověřuje se jen přepočet.
    const vysledek = await vyridPruzkum(deps, pruzkumId, { nejvyseUseku: 0 });

    expect(vysledek.firemPrevzato).toBeGreaterThan(0);
    expect(pocty.zamereni).toBe(0);
  });

  it("hotový úsek se v dalším běhu nezpracuje podruhé", async () => {
    const { deps, pocty } = falesneDeps(db, {
      jednotky: DVE_JEDNOTKY,
      firmyPodleJednotky: FIRMY_DVOU_JEDNOTEK,
    });

    await vyridPruzkum(deps, pruzkumId, { nejvyseUseku: 1 });
    const sweepuPoPrvnim = pocty.sweepu;

    await vyridPruzkum(deps, pruzkumId);

    // Kdyby se hotový úsek zpracoval znovu, sweepu (počet dotazů na registr
    // po jedné jednotce) by vzrostl o víc než 1 — druhé volání smí zpracovat
    // jen ten úsek, co zbyl.
    expect(pocty.sweepu).toBe(sweepuPoPrvnim + 1);

    const useky = await db.query<{ stav: string }>(
      "select stav from pruzkum_useky where pruzkum_id = $1 order by poradi",
      [pruzkumId],
    );
    expect(useky.map((u) => u.stav)).toEqual(["hotovo", "hotovo"]);
  });

  it("úsek rozdělaný pádem procesu ('bezi') se v dalším běhu dozpracuje, ne navždy uvázne, a objednávka se uzavře až potom", async () => {
    const { deps } = falesneDeps(db, {
      jednotky: DVE_JEDNOTKY,
      firmyPodleJednotky: FIRMY_DVOU_JEDNOTEK,
    });

    await vyridPruzkum(deps, pruzkumId, { nejvyseUseku: 1 });

    // Simulace pádu procesu uprostřed zpracování druhého úseku — krok 4 ho
    // nastaví na 'bezi' hned na začátku a teprve pak zpracovává; tady stejný
    // stav vyrobíme ručně, ať test nezávisí na tom, kdy přesně proces spadl.
    await db.query(
      "update pruzkum_useky set stav = 'bezi' where pruzkum_id = $1 and poradi = 2",
      [pruzkumId],
    );

    const vysledek = await vyridPruzkum(deps, pruzkumId);

    // Rozdělaný úsek se musí dozpracovat, ne zůstat navždy v 'bezi' —
    // to byla chyba, kvůli které by se objednávka mylně uzavřela jako
    // hotová nad neúplně prozkoumaným územím.
    const useky = await db.query<{ stav: string }>(
      "select stav from pruzkum_useky where pruzkum_id = $1 order by poradi",
      [pruzkumId],
    );
    expect(useky.map((u) => u.stav)).toEqual(["hotovo", "hotovo"]);

    expect(vysledek.uzavreno).toBe(true);
    const stavPruzkumu = await db.query<{ stav: string }>(
      "select stav from pruzkumy where id = $1",
      [pruzkumId],
    );
    expect(stavPruzkumu[0]?.stav).toBe("hotovo");
  });

  it("`nejvyseUseku` zpracuje jen zadaný počet úseků, zbytek nechá čekat a objednávka zůstane běžet", async () => {
    const { deps } = falesneDeps(db, {
      jednotky: DVE_JEDNOTKY,
      firmyPodleJednotky: FIRMY_DVOU_JEDNOTEK,
    });

    const vysledek = await vyridPruzkum(deps, pruzkumId, { nejvyseUseku: 1 });

    expect(vysledek.uzavreno).toBe(false);
    const useky = await db.query<{ stav: string }>(
      "select stav from pruzkum_useky where pruzkum_id = $1 order by poradi",
      [pruzkumId],
    );
    expect(useky.map((u) => u.stav)).toEqual(["hotovo", "ceka"]);

    const stavPruzkumu = await db.query<{ stav: string }>(
      "select stav from pruzkumy where id = $1",
      [pruzkumId],
    );
    expect(stavPruzkumu[0]?.stav).toBe("bezi");
  });

  it("po posledním úseku se objednávka uzavře na 'hotovo'", async () => {
    const { deps } = falesneDeps(db, {
      jednotky: DVE_JEDNOTKY,
      firmyPodleJednotky: FIRMY_DVOU_JEDNOTEK,
    });

    await vyridPruzkum(deps, pruzkumId, { nejvyseUseku: 1 });
    const vysledek = await vyridPruzkum(deps, pruzkumId);

    expect(vysledek.uzavreno).toBe(true);
    const stavPruzkumu = await db.query<{ stav: string }>(
      "select stav from pruzkumy where id = $1",
      [pruzkumId],
    );
    expect(stavPruzkumu[0]?.stav).toBe("hotovo");
  });

  it("chyba v úseku ho označí 'selhalo' s popisem, ale běh pokračuje dalším úsekem", async () => {
    const { deps } = falesneDeps(db, {
      jednotky: DVE_JEDNOTKY,
      firmyPodleJednotky: FIRMY_DVOU_JEDNOTEK,
      jednotkySeSelhanim: [VYCHOZI_JEDNOTKA],
    });

    const vysledek = await vyridPruzkum(deps, pruzkumId);

    const useky = await db.query<{ jednotka: number; stav: string; chyba: string | null }>(
      "select jednotka, stav, chyba from pruzkum_useky where pruzkum_id = $1 order by poradi",
      [pruzkumId],
    );
    expect(useky[0]?.stav).toBe("selhalo");
    expect(useky[0]?.chyba).toBeTruthy();
    expect(useky[1]?.stav).toBe("hotovo");

    // Aspoň jeden úsek vyšel, takže objednávka skončí jako hotová, ne
    // selhaná — částečný výsledek je lepší než žádný.
    expect(vysledek.uzavreno).toBe(true);
    const stavPruzkumu = await db.query<{ stav: string }>(
      "select stav from pruzkumy where id = $1",
      [pruzkumId],
    );
    expect(stavPruzkumu[0]?.stav).toBe("hotovo");
  });

  it("načte pravidla kvalifikace z databáze — blacklistovaná firma se úsekem neuloží", async () => {
    const { deps } = falesneDeps(db);
    // Ruční pravidlo majitele, přidané do sdílené databáze — stejné, jaké
    // by ovlivnilo i sběr kolem jídelny (spustCmuchala).
    await pridejPravidlo(db, {
      typ: "ico",
      hodnota: uvnitr.ico,
      duvod: "majitel si nepřeje oslovovat",
    });

    const vysledek = await vyridPruzkum(deps, pruzkumId, { nejvyseUseku: 1 });

    expect(vysledek.firemNovych).toBe(0);
    const firma = await db.query("select 1 from companies where ico = $1", [uvnitr.ico]);
    expect(firma).toHaveLength(0);
    const v = await db.query<{ duvod: string }>("select duvod from vyrazeni where ico = $1", [uvnitr.ico]);
    expect(v).toHaveLength(1);
    expect(v[0]?.duvod).toBe("blacklist");
  });
});
