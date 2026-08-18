import { describe, expect, it } from "vitest";
import { osloveni, oznaceniFirmy } from "../src/osloveni.js";

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

describe("označení firmy do vazby „od Vaší…“", () => {
  it("ženské jednoslovné označení se vyskloňuje", () => {
    expect(oznaceniFirmy("truhlárna")).toBe("od Vaší truhlárny");
    expect(oznaceniFirmy("lékárna")).toBe("od Vaší lékárny");
    expect(oznaceniFirmy("prodejna")).toBe("od Vaší prodejny");
    expect(oznaceniFirmy("zinkovna")).toBe("od Vaší zinkovny");
    expect(oznaceniFirmy("autodoprava")).toBe("od Vaší autodopravy");
    expect(oznaceniFirmy("škola")).toBe("od Vaší školy");
  });

  it("mužská jména na -a se NEskloňují jako ženská", () => {
    // „od Vaší specialisty" je nesmysl — rod se podle koncovky -a poznat nedá.
    expect(oznaceniFirmy("specialista")).toBe("od Vás");
    expect(oznaceniFirmy("kolega")).toBe("od Vás");
    expect(oznaceniFirmy("starosta")).toBe("od Vás");
  });

  it("označení role ustoupí, označení místa se vyskloňuje", () => {
    expect(oznaceniFirmy("distributor")).toBe("od Vás");
    expect(oznaceniFirmy("poskytovatel")).toBe("od Vás");
    expect(oznaceniFirmy("e-shop")).toBe("od Vašeho e-shopu");
    expect(oznaceniFirmy("ordinace")).toBe("od Vaší ordinace");
  });

  it("víceslovné a prázdné ustoupí", () => {
    expect(oznaceniFirmy("realitní kancelář")).toBe("od Vás");
    expect(oznaceniFirmy(null)).toBe("od Vás");
    expect(oznaceniFirmy("")).toBe("od Vás");
  });
});

describe("obecná slova se jako označení nepoužijí", () => {
  it("„firma“ a spol. neřeknou nic, takže ustoupí", () => {
    // Čmuchal je 18. 8. přinesl z ostrého běhu. Věta „pár minut od Vaší
    // firmy" je gramaticky správně a obsahově prázdná — horší než „od Vás",
    // protože zabírá místo a tváří se jako personalizace.
    for (const slovo of ["firma", "společnost", "spolek", "organizace", "provozovna"]) {
      expect(oznaceniFirmy(slovo)).toBe("od Vás");
    }
  });

  it("oborové slovo se pořád použije", () => {
    expect(oznaceniFirmy("betonárna")).toBe("od Vaší betonárny");
    expect(oznaceniFirmy("mateřinka")).toBe("od Vaší mateřinky");
  });
});

describe("další bezpečné tvary označení", () => {
  it("ženské na -ce má druhý pád stejný", () => {
    expect(oznaceniFirmy("ordinace")).toBe("od Vaší ordinace");
    expect(oznaceniFirmy("ambulance")).toBe("od Vaší ambulance");
  });

  it("střední na -ství a -ctví se nemění", () => {
    expect(oznaceniFirmy("sklenářství")).toBe("od Vašeho sklenářství");
    expect(oznaceniFirmy("zahradnictví")).toBe("od Vašeho zahradnictví");
  });

  it("mužské neživotné dostane -u", () => {
    expect(oznaceniFirmy("penzion")).toBe("od Vašeho penzionu");
    expect(oznaceniFirmy("autoservis")).toBe("od Vašeho autoservisu");
    expect(oznaceniFirmy("e-shop")).toBe("od Vašeho e-shopu");
  });

  it("jména osob a rolí ustoupí — firma není člověk", () => {
    // „pár minut pěšky od Vašeho distributora" tvrdí něco jiného, než
    // chceme: my mluvíme o té firmě, ne o někom, ke komu ona chodí.
    expect(oznaceniFirmy("distributor")).toBe("od Vás");
    expect(oznaceniFirmy("dodavatel")).toBe("od Vás");
    expect(oznaceniFirmy("poskytovatel")).toBe("od Vás");
    expect(oznaceniFirmy("truhlář")).toBe("od Vás");
  });
});
