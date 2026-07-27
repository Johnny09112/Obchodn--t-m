import { describe, expect, it, vi } from "vitest";
import {
  jeBezZamestnancu,
  segmentPodleKategorie,
  vytvorResKlienta,
} from "../src/res.js";

describe("segmentPodleKategorie", () => {
  it("mapuje na segmenty dle SPEC (mikro do 25, střední 25–250, korporát nad 250)", () => {
    expect(segmentPodleKategorie("120")).toBe("mikro"); // 1–5
    expect(segmentPodleKategorie("220")).toBe("mikro"); // 20–24
    expect(segmentPodleKategorie("230")).toBe("stredni"); // 25–49
    expect(segmentPodleKategorie("320")).toBe("stredni"); // 200–249
    expect(segmentPodleKategorie("330")).toBe("korporat"); // 250–499
    expect(segmentPodleKategorie("510")).toBe("korporat"); // 10000+
  });

  it("'000' je NEUVEDENO, ne bez zaměstnanců — vrací null, neodhaduje", () => {
    expect(segmentPodleKategorie("000")).toBeNull();
    expect(jeBezZamestnancu("000")).toBe(false);
  });

  it("'110' je skutečné bez zaměstnanců", () => {
    expect(jeBezZamestnancu("110")).toBe(true);
    expect(segmentPodleKategorie("110")).toBeNull();
  });

  it("neznámý kód nevyhodí výjimku", () => {
    expect(segmentPodleKategorie("999")).toBeNull();
    expect(segmentPodleKategorie(null)).toBeNull();
  });
});

describe("nactiUdaje", () => {
  const odpoved = (kod: string | null) =>
    new Response(
      JSON.stringify({
        zaznamy: [{ statistickeUdaje: kod ? { kategoriePoctuPracovniku: kod } : {} }],
      }),
      { status: 200 },
    );

  it("dotáhne kategorii a přeloží ji", async () => {
    const fetchFn = vi.fn(async () => odpoved("410"));
    const k = vytvorResKlienta({ fetchFn, prodlevaMs: 0 });
    const u = await k.nactiUdaje("25235753");
    expect(u).toMatchObject({
      kategorieKod: "410",
      kategoriePopis: "1000–1499",
      segment: "korporat",
      bezZamestnancu: false,
    });
    expect(u!.zdrojUrl).toContain("ekonomicke-subjekty-res/25235753");
  });

  it("chybějící údaj nechá jako neznámý", async () => {
    const fetchFn = vi.fn(async () => odpoved(null));
    const k = vytvorResKlienta({ fetchFn, prodlevaMs: 0 });
    const u = await k.nactiUdaje("25235753");
    expect(u!.kategorieKod).toBeNull();
    expect(u!.segment).toBeNull();
  });

  it("404 vrací null a nevalidní IČO nevolá síť", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 404 }));
    const k = vytvorResKlienta({ fetchFn, prodlevaMs: 0 });
    expect(await k.nactiUdaje("25235753")).toBeNull();
    expect(await k.nactiUdaje("123")).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
