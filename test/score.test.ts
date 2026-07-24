import { describe, expect, it } from "vitest";
import { spocitejSkore } from "../src/score.js";

describe("spocitejSkore", () => {
  it("ideální firma má skóre 100", () => {
    expect(
      spocitejSkore({
        vzdalenostM: 0,
        velikostKategorie: "stredni",
        maVlastniJidelnu: false,
        czNace: ["62010"],
        urovenAdresy: 1,
      }),
    ).toBe(100);
  });

  it("firma bez dat dostane jen body za vzdálenost a NULL bonusy", () => {
    const s = spocitejSkore({
      vzdalenostM: 0,
      velikostKategorie: null,
      maVlastniJidelnu: null,
      czNace: [],
      urovenAdresy: null,
    });
    // 35 (vzdálenost) + 0 + 7 (jídelna NULL) + 0 + 0
    expect(s).toBe(42);
  });

  it("skóre klesá se vzdáleností", () => {
    const zaklad = {
      velikostKategorie: "stredni" as const,
      maVlastniJidelnu: false,
      czNace: ["69200"],
      urovenAdresy: 1 as const,
    };
    const blizko = spocitejSkore({ ...zaklad, vzdalenostM: 200 });
    const daleko = spocitejSkore({ ...zaklad, vzdalenostM: 2500 });
    expect(blizko).toBeGreaterThan(daleko);
  });

  it("za 3000 m a víc je za vzdálenost 0 bodů", () => {
    const s = spocitejSkore({
      vzdalenostM: 3000,
      velikostKategorie: null,
      maVlastniJidelnu: null,
      czNace: [],
      urovenAdresy: null,
    });
    expect(s).toBe(7);
  });

  it("kancelářský NACE se pozná podle prefixu oddílu", () => {
    const bez = spocitejSkore({
      vzdalenostM: 3000,
      velikostKategorie: null,
      maVlastniJidelnu: true,
      czNace: ["10110"], // výroba masa — ne kancelář
      urovenAdresy: null,
    });
    const s = spocitejSkore({
      vzdalenostM: 3000,
      velikostKategorie: null,
      maVlastniJidelnu: true,
      czNace: ["62010"], // programování
      urovenAdresy: null,
    });
    expect(bez).toBe(0);
    expect(s).toBe(15);
  });
});
