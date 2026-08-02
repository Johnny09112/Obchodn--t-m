import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { prepocitejOblastFirmy, zalozOblast } from "../src/oblast.js";
import { nastavGeo, zalozFirmu, zapisAtribut, zapisKontakt } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;
let oblastId: string;

const STRED = { lat: 49.6, lng: 13.2 };

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  oblastId = await zalozOblast(db, {
    nazev: "Plzeňsko",
    oblast: { typ: "kruh", stred: STRED, polomerM: 5000 },
  });
});

async function firma(ico: string, velikost?: "mikro" | "stredni" | "korporat"): Promise<void> {
  const z: AresZaznam = {
    ico, nazev: `Firma ${ico}`, adresa: "x", obec: "Zbůch",
    czNace: ["25610"], velikostKategorie: null, kodObce: 559661, pravniForma: "112",
  };
  await zalozFirmu(db, z);
  await nastavGeo(db, ico, { ...STRED, jidelnaId: null, vzdalenostM: null, vZone: null });
  if (velikost) {
    await zapisAtribut(db, ico, "velikost_kategorie", velikost, {
      zdrojUrl: "https://csu.example/res", citace: "statistický registr",
    });
  }
}

interface Slozeni {
  firem: number;
  mikro: number;
  stredni: number;
  korporat: number;
  bez_velikosti: number;
  se_spojenim: number;
}

async function slozeni(): Promise<Slozeni> {
  const r = await db.query<Slozeni>(
    `select firem, mikro, stredni, korporat, bez_velikosti, se_spojenim
     from oblasti_prehled where id = $1`,
    [oblastId],
  );
  return r[0]!;
}

describe("složení firem v oblasti", () => {
  it("rozpadne firmy podle velikosti", async () => {
    await firma("25232657", "mikro");
    await firma("26185610", "stredni");
    await firma("48362956", "korporat");
    await prepocitejOblastFirmy(db, oblastId);

    expect(await slozeni()).toMatchObject({
      firem: 3, mikro: 1, stredni: 1, korporat: 1, bez_velikosti: 0,
    });
  });

  it("firmy bez velikosti jsou vlastní kategorie, ne nula", async () => {
    // „Nevíme" a „nula zaměstnanců" jsou dvě různé věci — a právě tenhle
    // rozdíl říká, kolik práce v oblasti ještě zbývá.
    await firma("25232657", "stredni");
    await firma("26185610");
    await firma("48362956");
    await prepocitejOblastFirmy(db, oblastId);

    expect(await slozeni()).toMatchObject({ firem: 3, stredni: 1, bez_velikosti: 2 });
  });

  it("počítá i firmy se jmenným spojením", async () => {
    await firma("25232657", "stredni");
    await firma("26185610", "stredni");
    await zapisKontakt(db, "25232657", {
      jmeno: "Jan", prijmeni: "Novák", urovenAdresy: 3,
      zdrojUrl: "https://ares.gov.cz/x", citace: "veřejný rejstřík: jednatel Jan Novák",
    });
    await prepocitejOblastFirmy(db, oblastId);

    expect(await slozeni()).toMatchObject({ firem: 2, se_spojenim: 1 });
  });

  it("prázdná oblast vrací samé nuly, ne null", async () => {
    expect(await slozeni()).toEqual({
      firem: 0, mikro: 0, stredni: 0, korporat: 0, bez_velikosti: 0, se_spojenim: 0,
    });
  });

  it("součet dílů dá celek", async () => {
    await firma("25232657", "mikro");
    await firma("26185610", "stredni");
    await firma("48362956");
    await prepocitejOblastFirmy(db, oblastId);

    const s = await slozeni();
    expect(s.mikro + s.stredni + s.korporat + s.bez_velikosti).toBe(s.firem);
  });
});
