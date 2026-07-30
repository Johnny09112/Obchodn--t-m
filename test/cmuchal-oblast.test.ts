import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import { objednejPruzkum } from "../src/pruzkum.js";
import { rozhlednuti } from "../src/cmuchal-oblast.js";
import type { AresKlient, AresZaznam } from "../src/ares.js";
import type { Geokoder, Misto } from "../src/geocode.js";
import type { RegistrKlient, RegistrZaznam } from "../src/registr.js";
import type { ResKlient } from "../src/res.js";
import type { CmuchalDeps } from "../src/cmuchal.js";

let db: Db;
let pruzkumId: string;

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

const souradnice: Record<string, { lat: number; lng: number }> = {
  "25232657": severne(500),
  "17439523": severne(9000),
};

/** Počítá volání, aby šlo ověřit, že se nezaměřuje ani nehledá dvakrát. */
function falesneDeps(db: Db, opts: { mista?: Misto[] } = {}) {
  const pocty = { zamereni: 0, sweepu: 0 };
  const mista = opts.mista ?? [{ obec: "Zbůch", psc: "330 22" }];

  const geokoder: Geokoder = {
    geokoduj: async (adresa) => {
      pocty.zamereni++;
      const zaznam = [uvnitr, mimo].find((z) => z.adresa !== null && adresa.includes(z.adresa));
      return zaznam ? souradnice[zaznam.ico]! : null;
    },
    zpetne: async () => mista[0] ?? null,
  };

  const registr: RegistrKlient = {
    zamestnavateleVJednotkach: async () => {
      pocty.sweepu++;
      return [uvnitr, mimo].map(
        (z): RegistrZaznam => ({
          ico: z.ico, nazev: z.nazev, pravniForma: "112", kategorieKod: "330",
          nace: z.czNace, adresa: z.adresa, obec: z.obec, psc: "330 22",
          jednotka: 559661, zdrojUrl: "https://csu.gov.cz/registr",
        }),
      );
    },
    jednotkyObce: async () => [559661],
    jednotkyPodleMist: async () => [{ jednotka: 559661, obec: "Zbůch" }],
  };

  const ares: AresKlient = {
    overFirmu: async (ico) => [uvnitr, mimo].find((z) => z.ico === ico) ?? null,
    najdiFirmyVObci: async () => [uvnitr, mimo],
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
    const { deps } = falesneDeps(db);

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

  it("když tvar nezabírá žádnou obec a body se dohledaly: čeká na rozhodnutí, žádný úsek", async () => {
    // Tvar tak malý (~1 m), že do něj nespadne ani jeden bod mřížky na žádné
    // úrovni zjemnění — to je „prázdná krajina", ne selhání mapové služby.
    const drobnyTvarId = await zalozOblast(db, {
      nazev: "Nepatrný útvar",
      oblast: {
        typ: "polygon",
        body: [
          { lat: STRED.lat, lng: STRED.lng },
          { lat: STRED.lat + 0.00001, lng: STRED.lng },
          { lat: STRED.lat, lng: STRED.lng + 0.00001 },
        ],
      },
    });
    const drobnyPruzkumId = await objednejPruzkum(db, { oblastId: drobnyTvarId, pozadal: "a@b.cz" });
    const { deps } = falesneDeps(db);

    const r = await rozhlednuti(deps, drobnyPruzkumId);

    expect(r.cekaNaRozhodnuti).toBe(true);
    expect(r.useku).toBe(0);

    const useky = await db.query("select 1 from pruzkum_useky where pruzkum_id = $1", [drobnyPruzkumId]);
    expect(useky.length).toBe(0);

    const stav = await db.query<{ stav: string }>("select stav from pruzkumy where id = $1", [drobnyPruzkumId]);
    expect(stav[0]?.stav).toBe("ceka_na_rozhodnuti");
  });

  it("když se nedohledal ANI JEDEN bod: objednávka skončí 'selhalo' s důvodem", async () => {
    const { deps } = falesneDeps(db);
    // Zpětné dohledání selže úplně napořád — to je mrtvá služba, ne prázdná krajina.
    deps.geokoder.zpetne = async () => null;

    await expect(rozhlednuti(deps, pruzkumId)).rejects.toThrow();

    const stav = await db.query<{ stav: string; chyba: string | null }>(
      "select stav, chyba from pruzkumy where id = $1",
      [pruzkumId],
    );
    expect(stav[0]?.stav).toBe("selhalo");
    expect(stav[0]?.chyba).toBeTruthy();
  });
});
