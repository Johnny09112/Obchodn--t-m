import { describe, expect, it } from "vitest";
import {
  popisTvaru,
  popisPruzkumu,
  type PopisTvaru,
  type PopisPruzkumu,
} from "../src/oblast-popis.js";

const TED = new Date("2026-08-01T10:00:00Z");

function pruzkum(v: Partial<PopisPruzkumu>): PopisPruzkumu {
  return { pruzkumu: 0, posledniStav: null, posledniAt: null, ...v };
}

describe("popis tvaru", () => {
  it("kruh se říká v kilometrech, s desetinnou čárkou", () => {
    const k: PopisTvaru = { typ: "kruh", polomerM: 6000, bodu: null };
    expect(popisTvaru(k)).toBe("kruh 6,0 km");
  });

  it("kruh pod kilometr se nezaokrouhlí na nulu", () => {
    expect(popisTvaru({ typ: "kruh", polomerM: 800, bodu: null })).toBe("kruh 0,8 km");
  });

  it("nakreslený tvar se počítá na body — a čeština umí tři tvary", () => {
    expect(popisTvaru({ typ: "polygon", polomerM: null, bodu: 1 })).toBe("tvar o 1 bodu");
    expect(popisTvaru({ typ: "polygon", polomerM: null, bodu: 3 })).toBe("tvar o 3 bodech");
    expect(popisTvaru({ typ: "polygon", polomerM: null, bodu: 8 })).toBe("tvar o 8 bodech");
  });

  it("rozbitý tvar nepředstírá číslo", () => {
    expect(popisTvaru({ typ: "polygon", polomerM: null, bodu: null })).toBe("nakreslený tvar");
    expect(popisTvaru({ typ: "kruh", polomerM: null, bodu: null })).toBe("kruh");
  });
});

describe("popis průzkumu", () => {
  it("neprozkoumaná oblast to řekne rovnou", () => {
    expect(popisPruzkumu(pruzkum({}), TED)).toBe("Zatím neprozkoumaná");
  });

  it("hotový průzkum s datem", () => {
    const p = pruzkum({
      pruzkumu: 1,
      posledniStav: "hotovo",
      posledniAt: "2026-07-28T08:00:00Z",
    });
    expect(popisPruzkumu(p, TED)).toBe("Prozkoumaná 28. 7. 2026");
  });

  it("dnešek a včerejšek se říkají slovem", () => {
    expect(
      popisPruzkumu(
        pruzkum({ pruzkumu: 1, posledniStav: "hotovo", posledniAt: "2026-08-01T06:00:00Z" }),
        TED,
      ),
    ).toBe("Prozkoumaná dnes");
    expect(
      popisPruzkumu(
        pruzkum({ pruzkumu: 1, posledniStav: "hotovo", posledniAt: "2026-07-31T20:00:00Z" }),
        TED,
      ),
    ).toBe("Prozkoumaná včera");
  });

  it("čekající a běžící průzkum se pozná, ať je objednaný kdykoli", () => {
    expect(
      popisPruzkumu(pruzkum({ pruzkumu: 1, posledniStav: "ceka", posledniAt: "2026-08-01T09:00:00Z" }), TED),
    ).toBe("Průzkum čeká ve frontě");
    expect(
      popisPruzkumu(pruzkum({ pruzkumu: 1, posledniStav: "bezi", posledniAt: "2026-08-01T09:00:00Z" }), TED),
    ).toBe("Průzkum právě běží");
  });

  it("selhání se neschovává", () => {
    expect(
      popisPruzkumu(
        pruzkum({ pruzkumu: 1, posledniStav: "selhalo", posledniAt: "2026-07-30T08:00:00Z" }),
        TED,
      ),
    ).toBe("Průzkum selhal 30. 7. 2026");
  });

  it("opakovaný průzkum popisuje ten poslední, ale přizná, kolik jich bylo", () => {
    const p = pruzkum({
      pruzkumu: 3,
      posledniStav: "hotovo",
      posledniAt: "2026-07-28T08:00:00Z",
    });
    expect(popisPruzkumu(p, TED)).toBe("Prozkoumaná 28. 7. 2026, celkem 3×");
  });

  it("neznámý stav se nevydává za nic jiného", () => {
    expect(popisPruzkumu(pruzkum({ pruzkumu: 1, posledniStav: "nove_neco" }), TED)).toBe(
      "Průzkum ve stavu „nove_neco“",
    );
  });
});
