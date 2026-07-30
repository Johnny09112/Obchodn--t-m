import { describe, expect, it } from "vitest";
import { mrizkaVOblasti, obceVOblasti } from "../src/uzemi.js";
import { bodVOblasti, type Oblast } from "../src/oblast-tvar.js";
import type { Geokoder, Misto } from "../src/geocode.js";

const STRED = { lat: 49.6, lng: 13.2 };
const kruh: Oblast = { typ: "kruh", stred: STRED, polomerM: 12_000 };

describe("mřížka bodů uvnitř tvaru", () => {
  it("vrátí jen body, které leží uvnitř", () => {
    const body = mrizkaVOblasti(kruh, 3000);
    expect(body.length).toBeGreaterThan(5);
    for (const b of body) expect(bodVOblasti(kruh, b)).toBe(true);
  });

  it("u konkávního tvaru nedá body do zálivu", () => {
    // Písmeno L: pravý horní roh do tvaru nepatří.
    const eL: Oblast = {
      typ: "polygon",
      body: [
        { lat: 49.60, lng: 13.20 },
        { lat: 49.70, lng: 13.20 },
        { lat: 49.70, lng: 13.25 },
        { lat: 49.65, lng: 13.25 },
        { lat: 49.65, lng: 13.35 },
        { lat: 49.60, lng: 13.35 },
      ],
    };
    const body = mrizkaVOblasti(eL, 2000);
    expect(body.length).toBeGreaterThan(3);
    for (const b of body) expect(bodVOblasti(eL, b)).toBe(true);
    // V zálivu (vpravo nahoře) nesmí být nic.
    expect(body.some((b) => b.lat > 49.66 && b.lng > 13.28)).toBe(false);
  });

  it("malý tvar nezůstane bez jediného bodu", () => {
    // Kruh o 400 m je menší než krok 3 km — mřížka ho musí zjemnit,
    // jinak by se území tvářilo jako prázdné.
    const drobek: Oblast = { typ: "kruh", stred: STRED, polomerM: 400 };
    const body = mrizkaVOblasti(drobek, 3000);
    expect(body.length).toBeGreaterThan(0);
    for (const b of body) expect(bodVOblasti(drobek, b)).toBe(true);
  });

  it("nesmyslný krok skončí chybou, ne nekonečným během", () => {
    expect(() => mrizkaVOblasti(kruh, 0)).toThrow();
    expect(() => mrizkaVOblasti(kruh, -100)).toThrow();
  });

  it("uzoučký diagonální pruh dostane dost bodů po celé délce, ne jen jeden", () => {
    // 8 km dlouhý, 200 m široký pruh po diagonále — typicky údolí nebo
    // koridor podél silnice. Obal tvaru je skoro čtvercový (obě strany ~8 km),
    // takže podle rozměrů obalu se úzkost tvaru nepozná — zjemňování se musí
    // řídit počtem nalezených bodů, ne rozměry.
    const pruh: Oblast = {
      typ: "polygon",
      body: [
        { lat: 49.575227, lng: 13.159818 },
        { lat: 49.573957, lng: 13.161777 },
        { lat: 49.624773, lng: 13.240183 },
        { lat: 49.626043, lng: 13.238222 },
      ],
    };
    const body = mrizkaVOblasti(pruh, 3000);
    expect(body.length).toBeGreaterThan(5);
    for (const b of body) expect(bodVOblasti(pruh, b)).toBe(true);

    // Musí být rozeseté po celé délce pruhu, ne namačkané na jednom místě.
    const laty = body.map((b) => b.lat);
    const rozpeti = Math.max(...laty) - Math.min(...laty);
    expect(rozpeti).toBeGreaterThan(0.03);
  });

  it("velký tvar, který má dost bodů hned napoprvé, se dál nezjemňuje", () => {
    // Poloměr 50 km, krok 3 km — dnes dá 874 bodů a to musí zůstat: víc
    // zjemňování by tu jen zbytečně násobilo dotazy na mapovou službu.
    const velkyKruh: Oblast = { typ: "kruh", stred: STRED, polomerM: 50_000 };
    const body = mrizkaVOblasti(velkyKruh, 3000);
    expect(body.length).toBe(874);
  });
});

/** Falešný geokodér: vrací obec podle zeměpisné šířky. */
function falesny(mapa: (b: { lat: number; lng: number }) => Misto | null): Geokoder {
  return {
    geokoduj: async () => null,
    zpetne: async (b) => mapa(b),
  };
}

describe("obce, které tvar zabírá", () => {
  it("stejnou obec vrátí jednou, i když ji trefí víc bodů", async () => {
    const g = falesny(() => ({ obec: "Zbůch", psc: "330 22" }));
    const v = await obceVOblasti(g, kruh, { krokM: 3000 });
    expect(v.mista).toEqual([{ obec: "Zbůch", psc: "330 22" }]);
    expect(v.bodu).toBeGreaterThan(1);
    expect(v.nedohledano).toBe(0);
  });

  it("stejná obec s jiným PSČ je jiné místo", async () => {
    // Hrádek je v ČR šestkrát; PSČ je to, co je rozliší.
    const g = falesny((b) =>
      b.lat > 49.6 ? { obec: "Hrádek", psc: "330 01" } : { obec: "Hrádek", psc: "338 42" },
    );
    const v = await obceVOblasti(g, kruh, { krokM: 3000 });
    expect(v.mista).toHaveLength(2);
  });

  it("nedohledané body spočítá a nespadne", async () => {
    const g = falesny((b) => (b.lat > 49.6 ? { obec: "Zbůch", psc: null } : null));
    const v = await obceVOblasti(g, kruh, { krokM: 3000 });
    expect(v.mista).toEqual([{ obec: "Zbůch", psc: null }]);
    expect(v.nedohledano).toBeGreaterThan(0);
  });

  it("když nevyjde ani jeden bod, řekne to zvlášť", async () => {
    // Rozdíl mezi „tady nic není" a „služba neodpovídá" je podstatný.
    const g = falesny(() => null);
    const v = await obceVOblasti(g, kruh, { krokM: 3000 });
    expect(v.mista).toEqual([]);
    expect(v.nedohledano).toBe(v.bodu);
  });
});
