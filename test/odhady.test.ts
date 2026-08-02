import { describe, expect, it } from "vitest";
import { odhadKontaktu, SEKUND_NA_FIRMU } from "../src/odhady.js";

describe("odhad času na doplnění kontaktů", () => {
  it("vychází z naměřeného tempa, ne z dohadu", () => {
    // 2,9 s na firmu změřeno 2. 8. na dávce 200 firem (576 s).
    expect(SEKUND_NA_FIRMU).toBeCloseTo(2.9, 1);
  });

  it("krátké dávky v minutách", () => {
    expect(odhadKontaktu(200)).toBe("zhruba 10 minut");
    expect(odhadKontaktu(408)).toBe("zhruba 20 minut");
  });

  it("dlouhé v hodinách", () => {
    expect(odhadKontaktu(12462)).toBe("zhruba 10 hodin");
    expect(odhadKontaktu(2500)).toBe("zhruba 2 hodiny");
  });

  it("hodina se skloňuje", () => {
    expect(odhadKontaktu(1250)).toBe("zhruba hodinu");
  });

  it("nic k práci = žádný čas", () => {
    expect(odhadKontaktu(0)).toBe("žádný čas");
  });

  it("pár firem je pod minutu", () => {
    expect(odhadKontaktu(5)).toBe("necelou minutu");
  });
});
