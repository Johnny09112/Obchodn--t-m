import { describe, expect, it, vi } from "vitest";
import { vytvorAresKlienta } from "../src/ares.js";

const subjektOdpoved = {
  ico: "25596641",
  obchodniJmeno: "Seznam.cz, a.s.",
  sidlo: {
    textovaAdresa: "Radlická 3294/10, 15000 Praha 5",
    nazevObce: "Praha",
    nazevOkresu: "Hlavní město Praha",
    nazevKraje: "Hlavní město Praha",
    psc: 15000,
    kodObce: 554782,
  },
  czNace: ["62010", "73110"],
  statistickeUdaje: { kategoriePoctuPracovniku: "330" },
};

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = handler(url, init);
    if (body === null) {
      return new Response("not found", { status: 404 });
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("overFirmu", () => {
  it("vrátí namapovaný záznam pro existující IČO", async () => {
    const fetchFn = mockFetch(() => subjektOdpoved);
    const ares = vytvorAresKlienta({ fetchFn, prodlevaMs: 0 });
    const z = await ares.overFirmu("25596641");
    expect(z).toMatchObject({
      ico: "25596641",
      nazev: "Seznam.cz, a.s.",
      obec: "Praha",
      velikostKategorie: "velka",
      kodObce: 554782,
    });
    expect(z!.czNace).toContain("62010");
  });

  it("vrátí null pro 404", async () => {
    const fetchFn = mockFetch(() => null);
    const ares = vytvorAresKlienta({ fetchFn, prodlevaMs: 0 });
    expect(await ares.overFirmu("00006947")).toBeNull();
  });

  it("nevalidní IČO odmítne bez síťového volání", async () => {
    const fetchFn = mockFetch(() => subjektOdpoved);
    const ares = vytvorAresKlienta({ fetchFn, prodlevaMs: 0 });
    expect(await ares.overFirmu("123")).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("mapuje kategorie počtu pracovníků", async () => {
    const pripady: Array<[string, string | null]> = [
      ["130", "mikro"],   // 10–19
      ["220", "mala"],    // 25–49
      ["320", "stredni"], // 200–249
      ["330", "velka"],   // 250–499
    ];
    for (const [kod, ocekavano] of pripady) {
      const fetchFn = mockFetch(() => ({
        ...subjektOdpoved,
        statistickeUdaje: { kategoriePoctuPracovniku: kod },
      }));
      const ares = vytvorAresKlienta({ fetchFn, prodlevaMs: 0 });
      const z = await ares.overFirmu("25596641");
      expect(z!.velikostKategorie).toBe(ocekavano);
    }
  });
});

describe("najdiFirmyVObci", () => {
  it("stránkuje přes /vyhledat a vrátí všechny subjekty", async () => {
    const stranka1 = {
      pocetCelkem: 3,
      ekonomickeSubjekty: [subjektOdpoved, { ...subjektOdpoved, ico: "00006947" }],
    };
    const stranka2 = {
      pocetCelkem: 3,
      ekonomickeSubjekty: [{ ...subjektOdpoved, ico: "27604977" }],
    };
    const fetchFn = mockFetch((_url, init) => {
      const body = JSON.parse(String(init?.body));
      return body.start === 0 ? stranka1 : stranka2;
    });
    const ares = vytvorAresKlienta({ fetchFn, prodlevaMs: 0, strankaVelikost: 2 });
    const vysledek = await ares.najdiFirmyVObci(554782);
    expect(vysledek.map((s) => s.ico)).toEqual(["25596641", "00006947", "27604977"]);
  });

  it("respektuje maximální počet", async () => {
    const fetchFn = mockFetch(() => ({
      pocetCelkem: 100,
      ekonomickeSubjekty: Array.from({ length: 10 }, (_, i) => ({
        ...subjektOdpoved,
        ico: String(10000000 + i),
      })),
    }));
    const ares = vytvorAresKlienta({ fetchFn, prodlevaMs: 0, strankaVelikost: 10 });
    const vysledek = await ares.najdiFirmyVObci(554782, { max: 10 });
    expect(vysledek).toHaveLength(10);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
