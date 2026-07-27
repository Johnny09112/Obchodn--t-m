import { describe, expect, it, vi } from "vitest";
import {
  sestavDotaz,
  vytvorOsmKlienta,
  zajimavePracoviste,
  type OverpassOdpoved,
} from "../src/osm.js";

const odpoved: OverpassOdpoved = {
  elements: [
    { type: "node", id: 1, lat: 49.906, lon: 12.975, tags: { name: "KAPIC software", office: "it" } },
    { type: "way", id: 2, center: { lat: 49.91, lon: 12.98 }, tags: { name: "Léčebný Hotel Prusík", tourism: "hotel" } },
    { type: "way", id: 3, center: { lat: 49.9, lon: 12.97 }, tags: { name: "Zinkovna", man_made: "works" } },
    // Bez názvu — nelze spárovat s rejstříkem, přeskočit
    { type: "node", id: 4, lat: 49.9, lon: 12.97, tags: { office: "company" } },
    // Bydlení — nezajímá nás
    { type: "way", id: 5, center: { lat: 49.9, lon: 12.97 }, tags: { name: "Bytovka", building: "apartments" } },
  ],
};

describe("sestavDotaz", () => {
  it("obsahuje střed, poloměr a hledané druhy míst", () => {
    const q = sestavDotaz({ lat: 49.906, lng: 12.974 }, 3000);
    expect(q).toContain("around:3000,49.906,12.974");
    expect(q).toContain('"office"');
    expect(q).toContain('"man_made"="works"');
    expect(q).toContain("out center tags");
  });
});

describe("zajimavePracoviste", () => {
  it("vybere jen pojmenovaná místa, kde se pracuje", () => {
    const p = zajimavePracoviste(odpoved);
    expect(p.map((x) => x.nazev)).toEqual([
      "KAPIC software",
      "Léčebný Hotel Prusík",
      "Zinkovna",
    ]);
  });

  it("doplní souřadnice u ploch i bodů", () => {
    const p = zajimavePracoviste(odpoved);
    expect(p[0]).toMatchObject({ lat: 49.906, lng: 12.975, druh: "it" });
    expect(p[1]!.lat).toBeCloseTo(49.91, 3);
  });

  it("přidá odkaz na konkrétní prvek pro evidenci", () => {
    const p = zajimavePracoviste(odpoved);
    expect(p[0]!.zdrojUrl).toBe("https://www.openstreetmap.org/node/1");
    expect(p[1]!.zdrojUrl).toBe("https://www.openstreetmap.org/way/2");
  });
});

describe("OsmKlient", () => {
  it("při chybě prvního serveru zkusí zrcadlo", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("timeout", { status: 504 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(odpoved), { status: 200 }));
    const k = vytvorOsmKlienta({ fetchFn, prodlevaMs: 0 });
    const p = await k.najdiPracoviste({ lat: 49.906, lng: 12.974 }, 3000);
    expect(p).toHaveLength(3);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("když selžou všechny servery, vyhodí srozumitelnou chybu", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 504 }));
    const k = vytvorOsmKlienta({ fetchFn, prodlevaMs: 0 });
    await expect(
      k.najdiPracoviste({ lat: 49.9, lng: 12.9 }, 1000),
    ).rejects.toThrow(/Overpass/i);
  });
});
