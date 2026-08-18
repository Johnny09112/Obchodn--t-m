import { describe, expect, it } from "vitest";
import { dobaCestyMin, dobaChuzeMin, klasifikujZonu, vzdalenostM } from "../src/geo.js";

describe("vzdalenostM", () => {
  it("spočítá známou vzdálenost (Staroměstské nám. → Václavské nám., ~1.1 km)", () => {
    const staromak = { lat: 50.0875, lng: 14.4213 };
    const vaclavak = { lat: 50.0811, lng: 14.4276 };
    const d = vzdalenostM(staromak, vaclavak);
    expect(d).toBeGreaterThan(750);
    expect(d).toBeLessThan(950);
  });

  it("vrátí 0 pro stejný bod", () => {
    const p = { lat: 50, lng: 14 };
    expect(vzdalenostM(p, p)).toBe(0);
  });
});

describe("dobaChuzeMin", () => {
  it("800 m je 10 minut při 80 m/min", () => {
    expect(dobaChuzeMin(800)).toBe(10);
  });
  it("zaokrouhluje nahoru", () => {
    expect(dobaChuzeMin(810)).toBe(11);
  });
});

describe("klasifikujZonu", () => {
  it("do 800 m je pěší", () => {
    expect(klasifikujZonu(800, 3000)).toBe("pesi");
    expect(klasifikujZonu(0, 3000)).toBe("pesi");
  });
  it("do zóny jídelny je dojezd", () => {
    expect(klasifikujZonu(801, 3000)).toBe("dojezd");
    expect(klasifikujZonu(3000, 3000)).toBe("dojezd");
  });
  it("nad zónu je mimo", () => {
    expect(klasifikujZonu(3001, 3000)).toBe("mimo");
  });
});

/**
 * Doba cesty do zprávy.
 *
 * Uložená vzdálenost je **vzdušná čára** (haversine), skutečná trasa je
 * delší. Do prvního oslovení se proto nesmí psát čas spočítaný přímo
 * z ní — byl by to slib kratší cesty, než jaká je.
 */
describe("doba cesty pro zprávu", () => {
  it("trasa se počítá delší než vzdušná čára", () => {
    // Zástavbou se nechodí přímo; obvyklá oklika je kolem třetiny navíc.
    expect(dobaCestyMin(1000).minut).toBeGreaterThan(1000 / 80);
  });

  it("do dvou kilometrů trasy se chodí pěšky", () => {
    expect(dobaCestyMin(1000).zpusob).toBe("pesky");
  });

  it("dál se jede autem", () => {
    expect(dobaCestyMin(5000).zpusob).toBe("autem");
  });

  it("čas se zaokrouhluje nahoru po pěti minutách", () => {
    // Nikdy dolů: kratší slíbený čas je drobná nepravda hned v první větě.
    expect(dobaCestyMin(1000).minut % 5).toBe(0);
    expect(dobaCestyMin(1600).minut % 5).toBe(0);
    expect(dobaCestyMin(9000).minut % 5).toBe(0);
  });

  it("úplně blízká jídelna se nepočítá na minuty", () => {
    expect(dobaCestyMin(200).zpusob).toBe("blizko");
  });
});
