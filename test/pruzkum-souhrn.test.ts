import { describe, expect, it } from "vitest";
import { postupPruzkumu, souhrnPruzkumu, type OblastPostup } from "../src/pruzkum-postup.js";

/** Objednávka, která doběhla — dvě obce hotové. */
function hotova(nazev: string): OblastPostup {
  return {
    nazev,
    stav: "hotovo",
    postup: postupPruzkumu({
      stav: "hotovo",
      useky: [{ stav: "hotovo" }, { stav: "hotovo" }],
      bezPredMinutami: 30,
    }),
  };
}

function bezici(nazev: string): OblastPostup {
  return {
    nazev,
    stav: "bezi",
    postup: postupPruzkumu({
      stav: "bezi",
      useky: [{ stav: "hotovo" }, { stav: "bezi" }, { stav: "ceka" }, { stav: "ceka" }],
      bezPredMinutami: 20,
      bezicíObec: "Klatovy",
    }),
  };
}

function neobjednana(nazev: string): OblastPostup {
  return { nazev, stav: null, postup: null };
}

describe("souhrn průzkumu přes víc oblastí", () => {
  it("bez území se nepředstírá, že se na něco čeká", () => {
    const s = souhrnPruzkumu([]);
    expect(s.popis).toBe("Území zatím není vybrané.");
    expect(s.celkem).toBe(0);
  });

  it("nic neobjednaného — řekne to a vyjmenuje, co chybí", () => {
    const s = souhrnPruzkumu([neobjednana("Plzeňsko"), neobjednana("Klatovsko")]);
    expect(s.popis).toBe("Průzkum zatím není objednaný.");
    expect(s.bezObjednavky).toEqual(["Plzeňsko", "Klatovsko"]);
  });

  it("jedna oblast se chová jako dřív — nepřidává zbytečné počítání", () => {
    const s = souhrnPruzkumu([hotova("Plzeňsko")]);
    expect(s.hotovych).toBe(1);
    expect(s.celkem).toBe(1);
    expect(s.popis).toBe("Hotovo — prozkoumáno 2 obcí.");
  });

  it("všechny hotové", () => {
    const s = souhrnPruzkumu([hotova("Plzeňsko"), hotova("Klatovsko")]);
    expect(s.hotovych).toBe(2);
    expect(s.popis).toBe("Hotovo — prozkoumané jsou obě oblasti.");
  });

  it("rozpracované: kolik oblastí je za sebou a co se právě děje", () => {
    const s = souhrnPruzkumu([hotova("Plzeňsko"), bezici("Klatovsko"), neobjednana("Rokycansko")]);
    expect(s.hotovych).toBe(1);
    expect(s.celkem).toBe(3);
    expect(s.popis).toMatch(/^Hotová 1 ze 3 oblastí\. Klatovsko: Běží 20 minut/);
    expect(s.bezObjednavky).toEqual(["Rokycansko"]);
  });

  it("odhad se sečte jen tehdy, když je známý u všech nedokončených", () => {
    const sZnamym = souhrnPruzkumu([hotova("Plzeňsko"), bezici("Klatovsko")]);
    expect(sZnamym.odhadMinut).toBe(bezici("Klatovsko").postup!.odhadMinut);

    // Neobjednaná oblast se odhadnout nedá — a součet by pak lhal.
    const sNeznamym = souhrnPruzkumu([bezici("Klatovsko"), neobjednana("Rokycansko")]);
    expect(sNeznamym.odhadMinut).toBeNull();
  });

  it("selhání jedné oblasti nezmizí za úspěchem ostatních", () => {
    const selhala: OblastPostup = {
      nazev: "Rokycansko",
      stav: "selhalo",
      postup: postupPruzkumu({ stav: "selhalo", useky: [], bezPredMinutami: 5 }),
    };
    const s = souhrnPruzkumu([hotova("Plzeňsko"), selhala]);
    expect(s.popis).toContain("Rokycansko");
    expect(s.selhalych).toBe(1);
  });
});
