import { describe, expect, it } from "vitest";
import { oznameniOBehu, type VysledekObjednavky } from "../src/oznameni.js";

const hotova = (oblast: string, novych = 120, prevzato = 30): VysledekObjednavky => ({
  oblast,
  stav: "hotovo",
  firemNovych: novych,
  firemPrevzato: prevzato,
  chyba: null,
});

const selhala = (oblast: string, chyba: string): VysledekObjednavky => ({
  oblast,
  stav: "selhalo",
  firemNovych: 0,
  firemPrevzato: 0,
  chyba,
});

describe("oznámení o doběhnutém průzkumu", () => {
  it("prázdná fronta neotravuje — hlídka se ptá každých deset minut", () => {
    // Kdyby bublina vyskočila i na „nebylo co dělat", majitel by ji do hodiny
    // vypnul a s ní i ta oznámení, kvůli kterým to vzniklo.
    expect(oznameniOBehu([])).toBeNull();
  });

  it("jedna hotová oblast: co se prozkoumalo a co z toho je", () => {
    expect(oznameniOBehu([hotova("Plzeňsko", 1871, 12)])).toEqual({
      druh: "hotovo",
      nadpis: "Průzkum hotový",
      text: "Plzeňsko — 1 871 nových firem, 12 už jsme znali.",
    });
  });

  it("bez jediné nové firmy se to řekne rovnou", () => {
    expect(oznameniOBehu([hotova("Rakovnicko", 0, 0)])?.text).toBe(
      "Rakovnicko — žádná nová firma.",
    );
  });

  it("víc oblastí naráz se shrne", () => {
    const o = oznameniOBehu([hotova("Plzeňsko", 1871), hotova("Klatovsko", 982)]);
    expect(o?.nadpis).toBe("Průzkum hotový");
    expect(o?.text).toBe("Prozkoumané 2 oblasti, 2 853 nových firem: Plzeňsko, Klatovsko.");
  });

  it("selhání se neschová za úspěch", () => {
    const o = oznameniOBehu([hotova("Plzeňsko", 100), selhala("Klatovsko", "ARES neodpovídal")]);
    expect(o?.druh).toBe("chyba");
    expect(o?.nadpis).toBe("Průzkum skončil s chybou");
    expect(o?.text).toContain("Klatovsko");
    expect(o?.text).toContain("ARES neodpovídal");
  });

  it("samotné selhání řekne důvod, ne jen že se nepovedlo", () => {
    const o = oznameniOBehu([selhala("Plzeňsko", "spojení vypršelo")]);
    expect(o).toEqual({
      druh: "chyba",
      nadpis: "Průzkum se nepovedl",
      text: "Plzeňsko — spojení vypršelo. Objednávku jde po opravě zadat znovu.",
    });
  });

  it("dlouhý text chyby se zkrátí — do bubliny se víc nevejde", () => {
    const o = oznameniOBehu([selhala("Plzeňsko", "x".repeat(300))]);
    expect(o!.text.length).toBeLessThanOrEqual(200);
    expect(o!.text).toContain("…");
  });

  it("oblast čekající na rozhodnutí není chyba, ale ani hotovo", () => {
    const o = oznameniOBehu([
      { oblast: "Rakovnicko", stav: "ceka_na_rozhodnuti", firemNovych: 0, firemPrevzato: 0, chyba: null },
    ]);
    expect(o?.druh).toBe("pozor");
    expect(o?.text).toContain("Rakovnicko");
  });
});
