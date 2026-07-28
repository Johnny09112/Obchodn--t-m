import { describe, expect, it } from "vitest";
import { bodVOblasti, type Oblast } from "../src/oblast.js";

/** Jídelna ve Zbůchu. 0,001° zeměpisné šířky ≈ 111 m. */
const STRED = { lat: 49.6, lng: 13.2 };
const severne = (metru: number) => ({ lat: STRED.lat + metru / 111_320, lng: STRED.lng });

const kruh: Oblast = { typ: "kruh", stred: STRED, polomerM: 3000 };

describe("kruhová oblast", () => {
  it("bod uvnitř přijme, bod venku ne", () => {
    expect(bodVOblasti(kruh, severne(1000))).toBe(true);
    expect(bodVOblasti(kruh, severne(5000))).toBe(false);
  });

  it("bod přesně na hranici počítá dovnitř", () => {
    // Hranice musí patřit dovnitř, jinak by firma přesně na okraji zóny
    // jednou spadla dovnitř a podruhé ven podle zaokrouhlení.
    expect(bodVOblasti(kruh, severne(3000))).toBe(true);
  });
});

describe("nakreslená oblast (polygon)", () => {
  // Obdélník kolem středu: zhruba 4 km na výšku, 4 km na šířku.
  const ctverec: Oblast = {
    typ: "polygon",
    body: [
      { lat: 49.58, lng: 13.17 },
      { lat: 49.62, lng: 13.17 },
      { lat: 49.62, lng: 13.23 },
      { lat: 49.58, lng: 13.23 },
    ],
  };

  it("pozná bod uvnitř i venku", () => {
    expect(bodVOblasti(ctverec, { lat: 49.6, lng: 13.2 })).toBe(true);
    expect(bodVOblasti(ctverec, { lat: 49.7, lng: 13.2 })).toBe(false);
    expect(bodVOblasti(ctverec, { lat: 49.6, lng: 13.4 })).toBe(false);
  });

  it("zvládne tvar natažený jedním směrem — kvůli tomu to celé vzniklo", () => {
    // Kruh by usekl sousední město v půlce; tenhle tvar se natáhne
    // na východ, ale na západě zůstane úzký.
    const natazeny: Oblast = {
      typ: "polygon",
      body: [
        { lat: 49.59, lng: 13.19 },
        { lat: 49.61, lng: 13.19 },
        { lat: 49.61, lng: 13.40 }, // výběžek na východ
        { lat: 49.59, lng: 13.40 },
      ],
    };
    expect(bodVOblasti(natazeny, { lat: 49.60, lng: 13.38 })).toBe(true); // ve výběžku
    expect(bodVOblasti(natazeny, { lat: 49.60, lng: 13.15 })).toBe(false); // na západ ne
  });

  it("nenechá se zmást tvarem do L", () => {
    // Konkávní tvar je přesně ten případ, kdy naivní výpočet selže:
    // bod ve výřezu je „mezi“ hranami, ale uvnitř být nemá.
    const lTvar: Oblast = {
      typ: "polygon",
      body: [
        { lat: 49.58, lng: 13.17 },
        { lat: 49.62, lng: 13.17 },
        { lat: 49.62, lng: 13.19 },
        { lat: 49.60, lng: 13.19 },
        { lat: 49.60, lng: 13.23 },
        { lat: 49.58, lng: 13.23 },
      ],
    };
    expect(bodVOblasti(lTvar, { lat: 49.59, lng: 13.22 })).toBe(true); // ve spodním rameni
    expect(bodVOblasti(lTvar, { lat: 49.615, lng: 13.18 })).toBe(true); // v levém rameni
    expect(bodVOblasti(lTvar, { lat: 49.615, lng: 13.22 })).toBe(false); // ve výřezu — VEN
  });

  it("polygon se dvěma body není oblast", () => {
    const nesmysl: Oblast = {
      typ: "polygon",
      body: [{ lat: 49.6, lng: 13.2 }, { lat: 49.61, lng: 13.21 }],
    };
    expect(bodVOblasti(nesmysl, { lat: 49.6, lng: 13.2 })).toBe(false);
  });

  it("nezáleží na tom, kterým směrem se kreslilo", () => {
    const opacne: Oblast = { typ: "polygon", body: [...ctverec.body!].reverse() };
    expect(bodVOblasti(opacne, { lat: 49.6, lng: 13.2 })).toBe(true);
  });
});
