import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { postavIndex, vytvorMpsvKlienta } from "../src/mpsv.js";

const vzorek = {
  polozky: [
    {
      pocetMist: 8,
      zamestnavatel: { ico: "25242407", nazev: "AGROFARMY BEZDRUŽICE s.r.o." },
      mistoVykonuPrace: {
        pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }],
      },
    },
    {
      pocetMist: 1,
      zamestnavatel: { ico: "17255686", nazev: "Café Kryštof Harant s.r.o." },
      mistoVykonuPrace: {
        pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }],
      },
    },
    {
      pocetMist: 2,
      zamestnavatel: { ico: "25242407", nazev: "AGROFARMY BEZDRUŽICE s.r.o." },
      mistoVykonuPrace: {
        pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }],
      },
    },
    {
      pocetMist: 27,
      zamestnavatel: { ico: "25235753", nazev: "ŠKODA JS a.s." },
      mistoVykonuPrace: {
        pracoviste: [{ adresa: { obec: { id: "Obec/554791" } } }],
      },
    },
    // Bez IČO — musí se přeskočit
    {
      pocetMist: 3,
      zamestnavatel: { nazev: "Neznámý" },
      mistoVykonuPrace: { pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }] },
    },
  ],
};

describe("postavIndex", () => {
  it("sloučí inzeráty jednoho zaměstnavatele a sečte místa", () => {
    const idx = postavIndex(vzorek);
    const bezdruzice = idx["560740"]!;
    expect(Object.keys(bezdruzice)).toHaveLength(2);
    expect(bezdruzice["25242407"]).toEqual({
      nazev: "AGROFARMY BEZDRUŽICE s.r.o.",
      mist: 10, // 8 + 2
      inzeratu: 2,
    });
  });

  it("přeskočí záznamy bez IČO", () => {
    const idx = postavIndex(vzorek);
    const vsechna = Object.values(idx["560740"]!);
    expect(vsechna.some((z) => z.nazev === "Neznámý")).toBe(false);
  });

  it("rozdělí zaměstnavatele podle obcí", () => {
    const idx = postavIndex(vzorek);
    expect(Object.keys(idx["554791"]!)).toEqual(["25235753"]);
  });
});

describe("MpsvKlient", () => {
  it("stáhne, uloží index a při dalším volání už nestahuje", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cantinero-"));
    const cesta = join(dir, "index.json");
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(vzorek), { status: 200 }));

    const k = vytvorMpsvKlienta({ fetchFn, cestaIndexu: cesta });
    const prvni = await k.zamestnavateleVObci(560740);
    expect(prvni).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const druhy = await k.zamestnavateleVObci(560740);
    expect(druhy).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(1); // z cache, znovu se nestahuje

    const ulozeno = JSON.parse(await readFile(cesta, "utf8"));
    expect(ulozeno.obce["560740"]).toBeTruthy();
    expect(ulozeno.stazeno).toBeTruthy();
  });

  it("seřadí zaměstnavatele podle počtu nabízených míst", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cantinero-"));
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(vzorek), { status: 200 }));
    const k = vytvorMpsvKlienta({ fetchFn, cestaIndexu: join(dir, "i.json") });
    const z = await k.zamestnavateleVObci(560740);
    expect(z[0]!.ico).toBe("25242407");
    expect(z[0]!.mist).toBe(10);
    expect(z[0]!.zdrojUrl).toContain("mpsv.cz");
  });

  it("zastaralý index stáhne znovu", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cantinero-"));
    const cesta = join(dir, "index.json");
    await writeFile(
      cesta,
      JSON.stringify({ stazeno: "2020-01-01T00:00:00.000Z", obce: {} }),
      "utf8",
    );
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(vzorek), { status: 200 }));
    const k = vytvorMpsvKlienta({ fetchFn, cestaIndexu: cesta, maxStariHodin: 24 });
    await k.zamestnavateleVObci(560740);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
