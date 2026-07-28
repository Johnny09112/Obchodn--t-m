import { describe, expect, it } from "vitest";
import { rozborZony } from "../src/zona.js";
import type { RegistrZaznam } from "../src/registr.js";

const firma = (ico: string, lat: number, lng: number, kat = "230"): RegistrZaznam & { lat: number; lng: number } => ({
  ico, nazev: `Firma ${ico}`, pravniForma: "112", kategorieKod: kat,
  nace: ["25610"], adresa: "Náves 1", obec: "Zbůch", psc: "33022",
  jednotka: 559661, zdrojUrl: "https://opendata.csu.gov.cz/x.csv", lat, lng,
});

// Jídelna ve Zbůchu; ~0,9 km na stupeň zeměpisné šířky ≈ 111 m na 0,001°.
const JIDELNA = { lat: 49.6, lng: 13.2 };
const oPar = (metru: number) => ({ lat: JIDELNA.lat + metru / 111_320, lng: JIDELNA.lng });

describe("rozbor zóny — kolik firem přibude při jakém poloměru", () => {
  const firmy = [
    firma("25232657", ...Object.values(oPar(500)) as [number, number]),
    firma("48362956", ...Object.values(oPar(2500)) as [number, number]),
    firma("17439523", ...Object.values(oPar(4500)) as [number, number]),
    firma("64358836", ...Object.values(oPar(9000)) as [number, number]),
  ];

  it("spočítá firmy kumulativně po poloměrech", () => {
    const r = rozborZony(JIDELNA, firmy, { polomery: [1000, 3000, 5000, 10000] });
    expect(r.map((x) => x.firem)).toEqual([1, 2, 3, 4]);
  });

  it("řekne, kolik firem oproti užší zóně přibude", () => {
    const r = rozborZony(JIDELNA, firmy, { polomery: [1000, 3000, 5000] });
    expect(r.map((x) => x.pribude)).toEqual([1, 1, 1]);
  });

  it("umí započítat jen firmy nad prahem velikosti", () => {
    const smes = [
      firma("25232657", ...Object.values(oPar(500)) as [number, number], "230"), // 25–49
      firma("48362956", ...Object.values(oPar(600)) as [number, number], "120"), // 1–5
    ];
    const r = rozborZony(JIDELNA, smes, { polomery: [3000], minZamestnancu: 25 });
    expect(r[0]!.firem).toBe(1);
  });

  it("u prázdného seznamu nespadne", () => {
    expect(rozborZony(JIDELNA, [], { polomery: [3000] })).toEqual([
      { polomerM: 3000, firem: 0, pribude: 0 },
    ]);
  });

  it("poloměry seřadí, i když přijdou zpřeházené", () => {
    const r = rozborZony(JIDELNA, firmy, { polomery: [5000, 1000, 3000] });
    expect(r.map((x) => x.polomerM)).toEqual([1000, 3000, 5000]);
  });
});
