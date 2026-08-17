import { describe, expect, it } from "vitest";
import { nejblizsiJidelny, type JidelnaVOkoli } from "../src/nejblizsi-jidelny.js";

/**
 * Souřadnice jsou skutečné — Zbůch, Tlučná, Plzeň, Bezdružice — aby
 * vzdálenosti v testu odpovídaly tomu, co uvidí majitel na obrazovce.
 */
const ZBUCH = { lat: 49.6203, lng: 13.2247 };

function jidelna(o: Partial<Parametry> & { nazev: string; lat: number; lng: number }): Parametry {
  return {
    id: o.nazev,
    nazev: o.nazev,
    obec: o.obec ?? null,
    lat: o.lat,
    lng: o.lng,
    zona_metru: o.zona_metru ?? 3000,
    stav: o.stav ?? "v_provozu",
    aktivni: o.aktivni ?? true,
  };
}

type Parametry = Parameters<typeof nejblizsiJidelny>[1][number];

const JIDELNY = [
  jidelna({ nazev: "ZŠ Zbůch", obec: "Zbůch", lat: 49.6203, lng: 13.2247, stav: "priprava" }),
  jidelna({ nazev: "ZŠ a MŠ Tlučná", obec: "Tlučná", lat: 49.7147, lng: 13.2461, stav: "priprava" }),
  jidelna({ nazev: "34. ZŠ Plzeň", obec: "Plzeň", lat: 49.7684, lng: 13.3818 }),
  jidelna({ nazev: "ZŠ a MŠ Hrádek", obec: "Hrádek", lat: 49.7128, lng: 13.6519 }),
  jidelna({ nazev: "ZŠ Bezdružice", obec: "Bezdružice", lat: 49.9033, lng: 12.9714 }),
];

/** Ostrava — od plzeňských jídelen stovky kilometrů. */
const DALEKO = { lat: 49.8209, lng: 18.2625 };

describe("nejbližší jídelny u firmy", () => {
  it("řadí od nejbližší a počítá vzdálenost", () => {
    const v = nejblizsiJidelny(ZBUCH, JIDELNY);
    expect(v.map((j) => j.nazev)).toEqual([
      "ZŠ Zbůch",
      "ZŠ a MŠ Tlučná",
      "34. ZŠ Plzeň",
      "ZŠ a MŠ Hrádek",
      "ZŠ Bezdružice",
    ]);
    expect(v[0]!.metru).toBe(0);
    expect(v[1]!.metru).toBeGreaterThan(10_000);
  });

  it("vrátí nejvýš pět jídelen", () => {
    const hodneJidelen = [...JIDELNY, jidelna({ nazev: "šestá", lat: 49.62, lng: 13.23 })];
    expect(nejblizsiJidelny(ZBUCH, hodneJidelen)).toHaveLength(5);
  });

  it("dál než padesát kilometrů se nenabízí", () => {
    expect(nejblizsiJidelny(DALEKO, JIDELNY)).toEqual([]);
  });

  it("bez souřadnic firmy se nedá počítat — a nic se nepředstírá", () => {
    expect(nejblizsiJidelny({ lat: null, lng: null }, JIDELNY)).toEqual([]);
  });

  it("jídelna bez souřadnic nebo mimo provoz se přeskočí", () => {
    const zvlastni = [
      jidelna({ nazev: "bez polohy", lat: 49.62, lng: 13.22 }),
      jidelna({ nazev: "vypnutá", lat: 49.621, lng: 13.225, aktivni: false }),
    ];
    zvlastni[0]!.lat = null as unknown as number;
    const v = nejblizsiJidelny(ZBUCH, zvlastni);
    expect(v).toEqual([]);
  });

  it("řekne, jestli firma leží v zóně jídelny", () => {
    const v = nejblizsiJidelny(ZBUCH, JIDELNY);
    const zbuch = v.find((j) => j.nazev === "ZŠ Zbůch")!;
    const plzen = v.find((j) => j.nazev === "34. ZŠ Plzeň")!;
    expect(zbuch.vZone).toBe(true);
    expect(plzen.vZone).toBe(false);
  });

  it("nese stav jídelny — v přípravě se nesmí tvářit jako v provozu", () => {
    const v: JidelnaVOkoli[] = nejblizsiJidelny(ZBUCH, JIDELNY);
    expect(v.find((j) => j.nazev === "ZŠ Zbůch")!.stav).toBe("priprava");
    expect(v.find((j) => j.nazev === "34. ZŠ Plzeň")!.stav).toBe("v_provozu");
  });

  it("dosah i počet jdou nastavit — obojí má rozumný výchozí stav", () => {
    const blizko = nejblizsiJidelny(ZBUCH, JIDELNY, { dosahM: 15_000 });
    expect(blizko.map((j) => j.nazev)).toEqual(["ZŠ Zbůch", "ZŠ a MŠ Tlučná"]);
    expect(nejblizsiJidelny(ZBUCH, JIDELNY, { limit: 2 })).toHaveLength(2);
  });
});
