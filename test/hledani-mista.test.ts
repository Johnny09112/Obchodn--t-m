import { describe, expect, it } from "vitest";
import { najdiMisto } from "../app/src/hledaniMista.js";

/** Odpověď Nominatimu tak, jak doopravdy chodí (zkráceno). */
const ODPOVED = [
  { display_name: "Zbůch, okres Plzeň-sever", lat: "49.6000", lon: "13.2000" },
  { display_name: "Zbůch, nádraží", lat: "49.6100", lon: "13.2100" },
];

function falesnyFetch(telo: unknown, ok = true) {
  return (async () => ({ ok, json: async () => telo }) as unknown as Response) as typeof fetch;
}

describe("hledání místa", () => {
  it("přeloží odpověď na body v mapě", async () => {
    const m = await najdiMisto("Zbůch", falesnyFetch(ODPOVED));
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({ nazev: "Zbůch, okres Plzeň-sever", lat: 49.6, lng: 13.2 });
  });

  it("prázdný dotaz se neptá vůbec", async () => {
    // Šetří to cizí službu i její limit jednoho dotazu za sekundu.
    let volano = false;
    const sledovany = (async () => {
      volano = true;
      return { ok: true, json: async () => [] } as unknown as Response;
    }) as typeof fetch;

    expect(await najdiMisto("   ", sledovany)).toEqual([]);
    expect(volano).toBe(false);
  });

  it("chyba služby vrátí prázdno, ne výjimku", async () => {
    // Mapová služba je cizí a občas neodpoví. Rozbít kvůli tomu celou
    // obrazovku by bylo horší než nenajít obec.
    expect(await najdiMisto("Zbůch", falesnyFetch(null, false))).toEqual([]);
  });

  it("výpadek sítě vrátí prázdno, ne výjimku", async () => {
    const spadne = (async () => {
      throw new Error("síť nedostupná");
    }) as typeof fetch;
    expect(await najdiMisto("Zbůch", spadne)).toEqual([]);
  });

  it("nesmyslné souřadnice se zahodí", async () => {
    // Nesmysl z cizí služby by poslal mapu do prázdna a vypadalo by to
    // jako chyba aplikace.
    const spatne = [{ display_name: "x", lat: "nesmysl", lon: "13.2" }];
    expect(await najdiMisto("x", falesnyFetch(spatne))).toEqual([]);
  });
});
