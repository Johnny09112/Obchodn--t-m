import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { doplnKontakty } from "../src/kontakty.js";
import { prepocitejOblastFirmy, zalozOblast } from "../src/oblast.js";
import { nastavGeo, nastavStav, zalozFirmu } from "../src/repo.js";
import type { AresKlient, AresZaznam } from "../src/ares.js";
import type { MpsvKlient } from "../src/mpsv.js";

let db: Db;
let oblastId: string;

const STRED = { lat: 49.9, lng: 12.97 };
/** Daleko od oblasti — ať je vidět, že se výběr opravdu řídí územím. */
const JINDE = { lat: 50.6, lng: 15.4 };

const firma = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "Náves 1", obec: "Bezdružice", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 560740, pravniForma: "112",
});

const ares: AresKlient = {
  overFirmu: async (i) => firma(i, "x"),
  najdiFirmyVObci: async () => [],
  najdiPodleJmena: async () => null,
  najdiStatutarniOrgany: async () => [{ jmeno: "TOMÁŠ", prijmeni: "HONZÍK", funkce: "Jednatel" }],
};

const mpsv: MpsvKlient = {
  zamestnavateleVObci: async () => [],
  kontaktZamestnavatele: async () => null,
};

/** Firma sebraná nad oblastí: bez jídelny, bez zóny, čeká na jídelnu. */
async function firmaVOblasti(ico: string, kde = STRED): Promise<void> {
  await zalozFirmu(db, firma(ico, `Firma ${ico}`));
  await nastavGeo(db, ico, { ...kde, jidelnaId: null, vzdalenostM: null, vZone: null });
  await nastavStav(db, ico, "cekajici_na_jidelnu");
}

async function maKontakt(ico: string): Promise<boolean> {
  const r = await db.query("select 1 from contacts where ico = $1", [ico]);
  return r.length > 0;
}

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  oblastId = await zalozOblast(db, {
    nazev: "Plzeňsko",
    oblast: { typ: "kruh", stred: STRED, polomerM: 5000 },
  });
});

describe("doplnění kontaktů nad oblastí", () => {
  it("dosáhne i na firmy, které žádnou jídelnu nemají", async () => {
    // Tohle je ta díra: sběr nad oblastí zakládá firmy bez zóny a ve stavu
    // „čeká na jídelnu". Doplnění kontaktů se dřív ptalo jen na firmy v zóně,
    // takže se k nim nikdy nedostalo — 13 600 firem bez jediného spojení.
    await firmaVOblasti("25232657");
    await prepocitejOblastFirmy(db, oblastId);

    const s = await doplnKontakty({ db, ares, mpsv }, { oblastId });

    expect(s.zpracovano).toBe(1);
    expect(s.zRejstriku).toBe(1);
    expect(await maKontakt("25232657")).toBe(true);
  });

  it("firmy mimo oblast nechá být", async () => {
    await firmaVOblasti("25232657");
    await firmaVOblasti("48362956", JINDE);
    await prepocitejOblastFirmy(db, oblastId);

    const s = await doplnKontakty({ db, ares, mpsv }, { oblastId });

    expect(s.zpracovano).toBe(1);
    expect(await maKontakt("48362956")).toBe(false);
  });

  it("zamítnutou firmu nehledá — dotaz navíc by byl zbytečný", async () => {
    await firmaVOblasti("25232657");
    await firmaVOblasti("48362956");
    await nastavStav(db, "48362956", "zamitnuty");
    await prepocitejOblastFirmy(db, oblastId);

    const s = await doplnKontakty({ db, ares, mpsv }, { oblastId });

    expect(s.zpracovano).toBe(1);
    expect(await maKontakt("48362956")).toBe(false);
  });

  it("firmu, která už jmenný kontakt má, přeskočí", async () => {
    await firmaVOblasti("25232657");
    await prepocitejOblastFirmy(db, oblastId);
    await doplnKontakty({ db, ares, mpsv }, { oblastId });

    const podruhe = await doplnKontakty({ db, ares, mpsv }, { oblastId });

    expect(podruhe.zpracovano).toBe(0);
  });

  it("limit platí — velká oblast se dá zpracovat po dávkách", async () => {
    for (const ico of ["25232657", "48362956", "25242407"]) await firmaVOblasti(ico);
    await prepocitejOblastFirmy(db, oblastId);

    const s = await doplnKontakty({ db, ares, mpsv }, { oblastId, limit: 2 });

    expect(s.zpracovano).toBe(2);
  });

  it("bez zadaného území se chová jako dřív — jen firmy v zóně jídelny", async () => {
    // Výchozí chování se schválně nemění: běh bez omezení by se jinak pustil
    // do celé kartotéky a to je hodina dotazů do ARESu.
    await firmaVOblasti("25232657");
    await prepocitejOblastFirmy(db, oblastId);

    const s = await doplnKontakty({ db, ares, mpsv }, {});

    expect(s.zpracovano).toBe(0);
  });
});
