import { describe, expect, it } from "vitest";
import { prevazujiciSmennost, udajeZInzeratu } from "../src/inzeraty.js";
import { postavIndex } from "../src/mpsv.js";

describe("převažující směnnost", () => {
  it("vezme nejčastější režim a přizná, z kolika inzerátů je", () => {
    // Různé počty schválně: test, kde má každá skupina jedničku, mapování
    // neověří (poučení z [[pootocene-urovne-adres]]).
    const r = prevazujiciSmennost({
      "Smennost/jednoSm": 2,
      "Smennost/triSm": 5,
      "Smennost/dvouSm": 1,
    });
    expect(r?.text).toBe("třísměnný provoz");
    expect(r?.inzeratu).toBe(5);
    expect(r?.zCelkem).toBe(8);
  });

  // „Neurčeno" je nula tvářící se jako údaj — zapsat se nesmí.
  it("neurčeno se nepočítá a samo o sobě nedá nic", () => {
    expect(prevazujiciSmennost({ "Smennost/neurceno": 9 })).toBeNull();
    const r = prevazujiciSmennost({ "Smennost/neurceno": 9, "Smennost/nocni": 1 });
    expect(r?.text).toBe("noční provoz");
    expect(r?.zCelkem).toBe(1);
  });

  it("neznámý kód číselníku raději zahodí, než aby ho zapsal syrový", () => {
    expect(prevazujiciSmennost({ "Smennost/covid19": 4 })).toBeNull();
  });

  it("při shodě počtů je výsledek pokaždé stejný", () => {
    const a = prevazujiciSmennost({ "Smennost/dvouSm": 3, "Smennost/triSm": 3 });
    const b = prevazujiciSmennost({ "Smennost/triSm": 3, "Smennost/dvouSm": 3 });
    expect(a?.kod).toBe(b?.kod);
  });

  it("prázdný vstup nedá nic", () => {
    expect(prevazujiciSmennost({})).toBeNull();
  });
});

describe("údaje z inzerátů", () => {
  it("směnnost i stravování naráz, obojí s citací", () => {
    const u = udajeZInzeratu({
      smennost: { "Smennost/nepretrzity": 3 },
      stravovani: "možnost stravování (dotovaný oběd)",
    });
    expect(u.map((x) => x.atribut).sort()).toEqual(["smenny_provoz", "zpusob_stravovani"]);

    const s = u.find((x) => x.atribut === "smenny_provoz")!;
    expect(s.hodnota).toBe("nepřetržitý provoz");
    expect(s.citace).toContain("3 z 3");

    // Citace u stravování musí nést DOSLOVNÝ text zaměstnavatele (TP-2).
    const j = u.find((x) => x.atribut === "zpusob_stravovani")!;
    expect(j.hodnota).toBe("možnost stravování (dotovaný oběd)");
    expect(j.citace).toContain("možnost stravování (dotovaný oběd)");
  });

  it("když inzeráty nic neříkají, nevrátí nic — prázdno je správný výsledek", () => {
    expect(udajeZInzeratu({ smennost: {}, stravovani: null })).toEqual([]);
    expect(udajeZInzeratu({ smennost: { "Smennost/neurceno": 2 }, stravovani: "   " })).toEqual([]);
  });
});

describe("index z otevřených dat nese směnnost i stravování", () => {
  const syrova = {
    polozky: [
      {
        pocetMist: 2,
        zamestnavatel: { ico: "25232657", nazev: "Strojírna s.r.o." },
        smennost: { id: "Smennost/triSm" },
        vyhodyVolnehoMista: [
          { vyhoda: { id: "VyhodyVolnehoMista/dovol" }, popis: null },
          { vyhoda: { id: "VyhodyVolnehoMista/strav" }, popis: "závodní jídelna v areálu" },
        ],
        mistoVykonuPrace: { pracoviste: [{ nazev: "Strojírna s.r.o.", adresa: { obec: { id: "Obec/554791" } } }] },
      },
      {
        pocetMist: 1,
        zamestnavatel: { ico: "25232657", nazev: "Strojírna s.r.o." },
        smennost: { id: "Smennost/jednoSm" },
        vyhodyVolnehoMista: null,
        mistoVykonuPrace: { pracoviste: [{ nazev: "Strojírna s.r.o.", adresa: { obec: { id: "Obec/554791" } } }] },
      },
    ],
  };

  it("sečte režimy přes všechny inzeráty firmy", () => {
    const z = postavIndex(syrova)["554791"]!["25232657"]!;
    expect(z.smennost).toEqual({ "Smennost/triSm": 1, "Smennost/jednoSm": 1 });
  });

  it("vezme doslovný popis stravovacího benefitu", () => {
    const z = postavIndex(syrova)["554791"]!["25232657"]!;
    expect(z.stravovani).toBe("závodní jídelna v areálu");
  });

  it("inzerát bez těch polí index nerozbije", () => {
    const z = postavIndex({
      polozky: [
        {
          zamestnavatel: { ico: "11111111", nazev: "Bez údajů s.r.o." },
          mistoVykonuPrace: { pracoviste: [{ adresa: { obec: { id: "Obec/554791" } } }] },
        },
      ],
    })["554791"]!["11111111"]!;
    expect(z.smennost).toEqual({});
    expect(z.stravovani).toBeNull();
  });
});
