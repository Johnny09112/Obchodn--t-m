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
  pravniForma: "121",
  statistickeUdaje: { kategoriePoctuPracovniku: "330" },
};

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = handler(String(url), init);
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
      velikostKategorie: "korporat",
      kodObce: 554782,
      pravniForma: "121",
    });
    expect(z!.czNace).toContain("62010");
  });

  it("chybějící právní formu nedoplňuje", async () => {
    const { pravniForma, ...bezFormy } = subjektOdpoved;
    const ares = vytvorAresKlienta({ fetchFn: mockFetch(() => bezFormy), prodlevaMs: 0 });
    expect((await ares.overFirmu("25596641"))!.pravniForma).toBeNull();
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

  it("mapuje kategorie počtu pracovníků na segmenty dle SPEC", async () => {
    // Kódy podle oficiálního číselníku ARES „KategoriePoctuPracovniku".
    const pripady: Array<[string, string | null]> = [
      ["000", null], // neuvedeno — nevíme, neodhadujeme
      ["110", null], // bez zaměstnanců — není segment, je to vyřazení
      ["130", "mikro"], // 6–9
      ["220", "mikro"], // 20–24
      ["230", "stredni"], // 25–49
      ["320", "stredni"], // 200–249
      ["330", "korporat"], // 250–499
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

  it("umí dotaz zúžit na vybrané právní formy", async () => {
    // Bez zúžení spadne sweep na obcích nad 1 000 subjektů. Filtr na právní
    // formu je jediný, který ARES doopravdy uplatní — ověřeno reálnými dotazy.
    const fetchFn = mockFetch(() => ({ pocetCelkem: 0, ekonomickeSubjekty: [] }));
    const ares = vytvorAresKlienta({ fetchFn, prodlevaMs: 0 });
    await ares.najdiFirmyVObci(561215, { pravniFormy: ["112", "121"] });

    const telo = JSON.parse(String(fetchFn.mock.calls[0]![1]?.body));
    expect(telo.pravniForma).toEqual(["112", "121"]);
    expect(telo.sidlo).toEqual({ kodObce: 561215 });
  });

  it("bez zúžení pole pravniForma vůbec neposílá", async () => {
    const fetchFn = mockFetch(() => ({ pocetCelkem: 0, ekonomickeSubjekty: [] }));
    const ares = vytvorAresKlienta({ fetchFn, prodlevaMs: 0 });
    await ares.najdiFirmyVObci(560740);
    expect(JSON.parse(String(fetchFn.mock.calls[0]![1]?.body))).not.toHaveProperty("pravniForma");
  });

  it("u překročeného limitu řekne kolik jich je a co s tím", async () => {
    // ARES vrací HTTP 400. Bez srozumitelné hlášky se z běhu nedá poznat,
    // že jsme o data přišli kvůli velikosti města, ne kvůli výpadku.
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          kod: "CHYBA_VSTUPU",
          subKod: "VYSTUP_PRILIS_MNOHO_VYSLEDKU",
          popis: "Zadaný dotaz vrací příliš mnoho výsledků (13 600). Povoleno je maximálně 1 000 výsledků.",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );
    const ares = vytvorAresKlienta({ fetchFn, prodlevaMs: 0 });
    await expect(ares.najdiFirmyVObci(554791)).rejects.toThrow(/13 600/); // kolik jich je
    await expect(ares.najdiFirmyVObci(554791)).rejects.toThrow(/1 000/); // kde je strop
    await expect(ares.najdiFirmyVObci(554791)).rejects.toThrow(/MPSV/); // kudy dál
  });
});
