import { describe, expect, it } from "vitest";
import { mrizkaVOblasti } from "../src/uzemi.js";
import { bodVOblasti, type Oblast } from "../src/oblast-tvar.js";

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
});
