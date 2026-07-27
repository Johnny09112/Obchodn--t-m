import { describe, expect, it } from "vitest";
import { jeBytovyDum, jeOsvc, popisFormy } from "../src/formy.js";

// Kódy pocházejí z oficiálního číselníku ARES „PravniForma"
// (POST /ciselniky-nazevniky/vyhledat), ne z odhadu.
describe("právní forma — bytové domy", () => {
  it("pozná společenství vlastníků a bytové družstvo", () => {
    expect(jeBytovyDum("145")).toBe(true); // Společenství vlastníků jednotek
    expect(jeBytovyDum("233")).toBe(true); // Bytové družstvo
  });

  it("běžnou firmu ani obec za bytový dům nepovažuje", () => {
    expect(jeBytovyDum("112")).toBe(false); // s.r.o.
    expect(jeBytovyDum("121")).toBe(false); // a.s.
    expect(jeBytovyDum("801")).toBe(false); // obec
    expect(jeBytovyDum("205")).toBe(false); // družstvo obecně — není bytové
    expect(jeBytovyDum(null)).toBe(false); // neznámá forma nic netvrdí
  });
});

describe("právní forma — živnostníci", () => {
  it("pozná všechny podoby podnikající fyzické osoby", () => {
    // 101–108 jsou v číselníku všechno fyzické osoby, jen podle různých zákonů.
    for (const kod of ["101", "102", "103", "104", "105", "106", "107", "108"]) {
      expect(jeOsvc(kod), `kód ${kod}`).toBe(true);
    }
    expect(jeOsvc("424")).toBe(true); // zahraniční fyzická osoba
  });

  it("bere i kód 100, u kterého si zdroje ARES protiřečí", () => {
    // Číselník vrací pro „100" dva různé názvy podle zdroje: obchodní
    // rejstřík „Podnikající fyzická osoba tuzemská", živnostenský
    // „Fyzická osoba nepodnikající". V datech pod ním sedí konkrétní lidé
    // vedení jménem. Ať platí kterákoli definice, firemní obědy neodebírají.
    expect(jeOsvc("100")).toBe(true);
  });

  it("právnickou osobu za živnostníka nepovažuje", () => {
    expect(jeOsvc("112")).toBe(false); // s.r.o.
    expect(jeOsvc("145")).toBe(false); // SVJ
    expect(jeOsvc("706")).toBe(false); // spolek
    expect(jeOsvc("331")).toBe(false); // příspěvková organizace
    expect(jeOsvc(null)).toBe(false);
  });
});

describe("popis formy pro člověka", () => {
  it("přeloží kód na název z číselníku", () => {
    expect(popisFormy("112")).toBe("Společnost s ručením omezeným");
    expect(popisFormy("145")).toBe("Společenství vlastníků jednotek");
  });

  it("u neznámého kódu si nic nevymýšlí", () => {
    expect(popisFormy("999999")).toBeNull();
    expect(popisFormy(null)).toBeNull();
  });
});
