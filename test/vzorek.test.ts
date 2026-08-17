import { describe, expect, it } from "vitest";
import { vyberVzorek, type FirmaVzorku } from "../src/vzorek.js";

function firma(ico: string, velikost: string | null, spojeni: number): FirmaVzorku {
  return { ico, nazev: `Firma ${ico}`, velikost_kategorie: velikost, spojeni };
}

/** Kartotéka nakřivo: samé mikro se spojením, pár korporátů, pár bez spojení. */
const KARTOTEKA: FirmaVzorku[] = [
  ...Array.from({ length: 40 }, (_, i) => firma(`mikro${i}`, "mikro", 1)),
  ...Array.from({ length: 10 }, (_, i) => firma(`stredni${i}`, "stredni", 0)),
  ...Array.from({ length: 3 }, (_, i) => firma(`korporat${i}`, "korporat", 2)),
  ...Array.from({ length: 5 }, (_, i) => firma(`nezname${i}`, null, 0)),
];

describe("výběr vzorku ke kontrole kvality", () => {
  it("vrátí požadovaný počet firem", () => {
    expect(vyberVzorek(KARTOTEKA, 30)).toHaveLength(30);
  });

  it("nevybere dvakrát tutéž firmu", () => {
    const v = vyberVzorek(KARTOTEKA, 30);
    expect(new Set(v.map((f) => f.ico)).size).toBe(30);
  });

  /**
   * Tohle je celý smysl vzorku: kdyby se bralo prvních třicet, byla by to
   * samá mikro se spojením a kontrola by změřila jen ten jeden případ.
   */
  it("zastoupí všechny velikosti, i tu nejmenší skupinu", () => {
    const v = vyberVzorek(KARTOTEKA, 30);
    const velikosti = new Set(v.map((f) => f.velikost_kategorie));
    expect(velikosti).toContain("mikro");
    expect(velikosti).toContain("stredni");
    expect(velikosti).toContain("korporat");
    expect(velikosti).toContain(null);
  });

  it("vezme firmy se spojením i bez něj — chyba se pozná i v prázdnu", () => {
    const v = vyberVzorek(KARTOTEKA, 30);
    expect(v.some((f) => f.spojeni > 0)).toBe(true);
    expect(v.some((f) => f.spojeni === 0)).toBe(true);
  });

  it("je opakovatelný — dvakrát spuštěný dá totéž", () => {
    expect(vyberVzorek(KARTOTEKA, 30)).toEqual(vyberVzorek(KARTOTEKA, 30));
  });

  it("když je firem míň než požadovaný vzorek, vrátí všechny", () => {
    const malo = KARTOTEKA.slice(0, 7);
    expect(vyberVzorek(malo, 30)).toHaveLength(7);
  });

  it("prázdná kartotéka nevrátí nic a nespadne", () => {
    expect(vyberVzorek([], 30)).toEqual([]);
  });
});
