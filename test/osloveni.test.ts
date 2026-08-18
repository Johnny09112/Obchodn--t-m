import { describe, expect, it } from "vitest";
import { osloveni } from "../src/osloveni.js";

/**
 * České oslovení z příjmení.
 *
 * Testy jsou postavené na příjmeních, která **jsou v ostré kartotéce**
 * (43 různých u kvalifikovaných firem s e-mailem, stav k 18. 8. 2026) —
 * ne na vymyšlených případech.
 */

describe("české oslovení", () => {
  it("ženské příjmení na -ová se neskloňuje", () => {
    expect(osloveni("Nováková")).toBe("Vážená paní Nováková,");
    expect(osloveni("Dvořáková")).toBe("Vážená paní Dvořáková,");
    expect(osloveni("Frýaufová")).toBe("Vážená paní Frýaufová,");
  });

  it("mužské příjmení na -a má vokativ na -o", () => {
    expect(osloveni("Procházka")).toBe("Vážený pane Procházko,");
    expect(osloveni("Blecha")).toBe("Vážený pane Blecho,");
    expect(osloveni("Planeta")).toBe("Vážený pane Planeto,");
  });

  it("přídavné jméno na -ý zůstává beze změny", () => {
    expect(osloveni("Buranský")).toBe("Vážený pane Buranský,");
  });

  it("příjmení na -r a -l má vokativ na -e", () => {
    expect(osloveni("Bayer")).toBe("Vážený pane Bayere,");
    expect(osloveni("Kestler")).toBe("Vážený pane Kestlere,");
    expect(osloveni("Redl")).toBe("Vážený pane Redle,");
    expect(osloveni("Týzl")).toBe("Vážený pane Týzle,");
  });

  it("nejisté tvary raději neskloňuje a osloví obecně", () => {
    // -ek a -ec mají vypadávající -e- (Duchek → Duchku, Drnec → Drnče)
    // a výjimek je tolik, že se to nedá spolehlivě uhodnout.
    expect(osloveni("Duchek")).toBe("Dobrý den,");
    expect(osloveni("Drnec")).toBe("Dobrý den,");
    expect(osloveni("Janíček")).toBe("Dobrý den,");
    expect(osloveni("Vochoc")).toBe("Dobrý den,");
    expect(osloveni("Klug")).toBe("Dobrý den,");
  });

  it("bez příjmení osloví obecně", () => {
    expect(osloveni(null)).toBe("Dobrý den,");
    expect(osloveni("")).toBe("Dobrý den,");
    expect(osloveni("   ")).toBe("Dobrý den,");
  });

  it("jednopísmenné a podivné vstupy nespadnou", () => {
    expect(osloveni("X")).toBe("Dobrý den,");
    expect(osloveni("123")).toBe("Dobrý den,");
    expect(osloveni("s.r.o.")).toBe("Dobrý den,");
  });

  it("oslovení vždycky končí čárkou a začíná velkým písmenem", () => {
    for (const p of ["Nováková", "Procházka", "Bayer", "Duchek", null]) {
      const o = osloveni(p);
      expect(o.endsWith(",")).toBe(true);
      expect(o[0]).toBe(o[0]?.toUpperCase());
    }
  });
});
