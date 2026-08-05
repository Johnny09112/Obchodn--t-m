import { describe, expect, it } from "vitest";
import {
  roztridKandidaty,
  spoctiKose,
  type FirmaProTrideni,
} from "../src/kampan-kandidati.js";

/** Firma s rozumnými výchozími hodnotami; test přepíše jen to, na čem záleží. */
function firma(zmeny: Partial<FirmaProTrideni> & { ico: string }): FirmaProTrideni {
  return {
    nazev: `Firma ${zmeny.ico}`,
    velikost_kategorie: "stredni",
    cz_nace: [],
    pravni_forma: "112",
    ma_vlastni_jidelnu: null,
    ...zmeny,
  };
}

const PRAZDNE_SITO = { partnerskaIca: new Set<string>(), blacklist: [] };

/** Zkratka: všechny uvedené firmy leží v území a v kampani zatím nikdo není. */
function roztrid(firmy: FirmaProTrideni[], jizVKampani: string[] = []) {
  return roztridKandidaty({
    firmy,
    vUzemi: new Set(firmy.map((f) => f.ico)),
    jizVKampani: new Set(jizVKampani),
    sito: PRAZDNE_SITO,
  });
}

describe("třídění kandidátů z území do kampaně", () => {
  it("firma v cílové velikosti patří do koše cilova", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: "stredni" })]);
    expect(k).toHaveLength(1);
    expect(k[0]!.kosik).toBe("cilova");
  });

  it("korporát je taky cílový", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: "korporat" })]);
    expect(k[0]!.kosik).toBe("cilova");
  });

  it("firma bez známé velikosti není cílová, ale ani zahozená", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: null })]);
    expect(k[0]!.kosik).toBe("bez_velikosti");
  });

  it("firma do 24 zaměstnanců je vždycky mikro", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: "mikro" })]);
    expect(k[0]!.kosik).toBe("mikro");
  });

  it("síto má přednost před velikostí a nese důvod", () => {
    const k = roztridKandidaty({
      firmy: [firma({ ico: "1", velikost_kategorie: "korporat" })],
      vUzemi: new Set(["1"]),
      jizVKampani: new Set(),
      sito: {
        partnerskaIca: new Set(["1"]),
        blacklist: [],
      },
    });
    expect(k[0]!.kosik).toBe("sito");
    expect(k[0]!.duvod?.duvod).toBe("partnerska_jidelna");
  });

  it("firma mimo území se neobjeví vůbec", () => {
    const k = roztridKandidaty({
      firmy: [firma({ ico: "1" }), firma({ ico: "2" })],
      vUzemi: new Set(["1"]),
      jizVKampani: new Set(),
      sito: PRAZDNE_SITO,
    });
    expect(k.map((x) => x.ico)).toEqual(["1"]);
  });

  it("firma už v kampani se mezi čekající nepočítá", () => {
    const k = roztrid([firma({ ico: "1" }), firma({ ico: "2" })], ["1"]);
    expect(spoctiKose(k)).toEqual({ cilova: 1, bezVelikosti: 0, mikro: 0 });
  });

  // Past z kapitoly 5 zadání: vyřazené firmy jsou v `kampan_firmy` taky,
  // takže `jizVKampani` je obsahuje. Kdyby se počítaly mezi čekající, panel
  // by sliboval víc, než tlačítko přidá — plnění je nevzkřísí.
  it("ručně vyřazená firma se mezi čekající nepočítá", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: null })], ["1"]);
    expect(spoctiKose(k)).toEqual({ cilova: 0, bezVelikosti: 0, mikro: 0 });
  });

  it("počty se sečtou po koších", () => {
    const k = roztrid([
      firma({ ico: "1", velikost_kategorie: "stredni" }),
      firma({ ico: "2", velikost_kategorie: null }),
      firma({ ico: "3", velikost_kategorie: null }),
      firma({ ico: "4", velikost_kategorie: "mikro" }),
    ]);
    expect(spoctiKose(k)).toEqual({ cilova: 1, bezVelikosti: 2, mikro: 1 });
  });

  it("firmy zadržené sítem se do počtů čekajících nepletou", () => {
    const k = roztridKandidaty({
      firmy: [firma({ ico: "1" }), firma({ ico: "2" })],
      vUzemi: new Set(["1", "2"]),
      jizVKampani: new Set(),
      sito: { partnerskaIca: new Set(["2"]), blacklist: [] },
    });
    expect(spoctiKose(k)).toEqual({ cilova: 1, bezVelikosti: 0, mikro: 0 });
  });

  // Majitel to řekl výslovně: malé firmy ano, společenství vlastníků ne.
  // Drží to síto (`jeBytovyDum`, právní formy 145 a 233), ne velikost —
  // proto společenství skončí v koši `sito`, i když je malé, a tlačítko
  // „přidat malé firmy" na ně nesáhne.
  it("společenství vlastníků je síto, ne malá firma", () => {
    const k = roztrid([
      firma({ ico: "1", velikost_kategorie: "mikro", pravni_forma: "145" }),
      firma({ ico: "2", velikost_kategorie: "mikro", pravni_forma: "112" }),
    ]);
    expect(k.find((x) => x.ico === "1")!.kosik).toBe("sito");
    expect(k.find((x) => x.ico === "2")!.kosik).toBe("mikro");
    expect(spoctiKose(k)).toEqual({ cilova: 0, bezVelikosti: 0, mikro: 1 });
  });

  it("bytové družstvo taky", () => {
    const k = roztrid([
      firma({ ico: "1", velikost_kategorie: "mikro", pravni_forma: "233" }),
    ]);
    expect(k[0]!.kosik).toBe("sito");
  });
});
