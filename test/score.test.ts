import { describe, expect, it } from "vitest";
import { jeKancelarskyObor, jeVyloucenyObor, oddilNace, spocitejSkore } from "../src/score.js";

describe("oddilNace", () => {
  it("normalizuje kódy různých délek na oddíl", () => {
    expect(oddilNace("62010")).toBe("62");
    expect(oddilNace("55")).toBe("55");
    expect(oddilNace("00")).toBe("00");
  });

  it("zahodí sekce zapsané písmenem", () => {
    expect(oddilNace("G")).toBeNull();
    expect(oddilNace("")).toBeNull();
    expect(oddilNace("A1")).toBeNull();
  });
});

describe("jeKancelarskyObor", () => {
  it("pozná kancelářské oddíly bez ohledu na délku kódu", () => {
    expect(jeKancelarskyObor(["62010"])).toBe(true); // programování
    expect(jeKancelarskyObor(["69"])).toBe(true); // právo a účetnictví
    expect(jeKancelarskyObor(["82100", "00"])).toBe(true); // administrativa
  });

  it("nenechá se zmást ubytováním ani sekcí", () => {
    expect(jeKancelarskyObor(["55"])).toBe(false); // ubytování
    expect(jeKancelarskyObor(["10110"])).toBe(false); // výroba masa
    expect(jeKancelarskyObor(["G"])).toBe(false); // sekce, ne oddíl
    expect(jeKancelarskyObor([])).toBe(false);
  });
});

describe("spocitejSkore", () => {
  it("ideální firma dosáhne 100", () => {
    expect(
      spocitejSkore({
        vzdalenostM: 0,
        segment: "stredni",
        maVlastniJidelnu: false,
        czNace: ["62010"],
        urovenAdresy: 1,
        nabizenychMist: 8,
      }),
    ).toBe(100);
  });

  it("neuvedená velikost nedostane body za velikost", () => {
    const s = spocitejSkore({
      vzdalenostM: 0,
      segment: null,
      maVlastniJidelnu: null,
      czNace: [],
      urovenAdresy: null,
    });
    expect(s).toBe(37); // 30 vzdálenost + 7 za nejistotu u jídelny
  });

  it("živý nábor přidá body podle počtu míst", () => {
    const zaklad = {
      vzdalenostM: 3000,
      segment: null,
      maVlastniJidelnu: true,
      czNace: [],
      urovenAdresy: null,
    };
    expect(spocitejSkore({ ...zaklad })).toBe(0);
    expect(spocitejSkore({ ...zaklad, nabizenychMist: 1 })).toBe(4);
    expect(spocitejSkore({ ...zaklad, nabizenychMist: 3 })).toBe(7);
    expect(spocitejSkore({ ...zaklad, nabizenychMist: 8 })).toBe(10);
  });

  it("střední podnik boduje výš než mikropodnik i korporát", () => {
    const z = {
      vzdalenostM: 500,
      maVlastniJidelnu: false,
      czNace: ["62010"],
      urovenAdresy: 1 as const,
    };
    const mikro = spocitejSkore({ ...z, segment: "mikro" });
    const stredni = spocitejSkore({ ...z, segment: "stredni" });
    const korporat = spocitejSkore({ ...z, segment: "korporat" });
    expect(stredni).toBeGreaterThan(korporat);
    expect(korporat).toBeGreaterThan(mikro);
  });

  it("skóre klesá se vzdáleností", () => {
    const z = {
      segment: "stredni" as const,
      maVlastniJidelnu: false,
      czNace: ["69200"],
      urovenAdresy: 1 as const,
    };
    expect(spocitejSkore({ ...z, vzdalenostM: 200 })).toBeGreaterThan(
      spocitejSkore({ ...z, vzdalenostM: 2500 }),
    );
  });
});

describe("jeVyloucenyObor", () => {
  it("vyloučí restaurace a kavárny (oddíl 56)", () => {
    expect(jeVyloucenyObor(["56110"])).toBe(true); // restaurace
    expect(jeVyloucenyObor(["56110", "47250"])).toBe(true); // i jako vedlejší obor
  });

  it("vyloučí agentury práce (oddíl 78)", () => {
    expect(jeVyloucenyObor(["78100"])).toBe(true);
  });

  it("nevyloučí ubytování, výrobu ani kanceláře", () => {
    expect(jeVyloucenyObor(["55100"])).toBe(false); // hotel — zaměstnance má
    expect(jeVyloucenyObor(["25610"])).toBe(false); // povrchová úprava kovů
    expect(jeVyloucenyObor(["62010"])).toBe(false);
    expect(jeVyloucenyObor([])).toBe(false);
  });
});
