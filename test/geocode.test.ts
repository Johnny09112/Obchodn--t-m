import { describe, expect, it, vi } from "vitest";
import { vytvorGeokoder } from "../src/geocode.js";

describe("geokoduj", () => {
  it("vrátí souřadnice prvního výsledku", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify([{ lat: "50.0755", lon: "14.4378" }]), {
        status: 200,
      }),
    );
    const geo = vytvorGeokoder({ fetchFn, prodlevaMs: 0, kontakt: "test@example.com" });
    expect(await geo.geokoduj("Radlická 10, Praha")).toEqual({
      lat: 50.0755,
      lng: 14.4378,
    });
  });

  it("vrátí null pro prázdný výsledek — nikdy neodhaduje", async () => {
    const fetchFn = vi.fn(async () => new Response("[]", { status: 200 }));
    const geo = vytvorGeokoder({ fetchFn, prodlevaMs: 0, kontakt: "test@example.com" });
    expect(await geo.geokoduj("Neexistující ulice 999")).toBeNull();
  });

  it("posílá User-Agent s kontaktem a omezuje na ČR", async () => {
    let zachyceno: { url?: string; ua?: string } = {};
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      zachyceno = {
        url: String(url),
        ua: (init?.headers as Record<string, string>)["User-Agent"],
      };
      return new Response("[]", { status: 200 });
    });
    const geo = vytvorGeokoder({ fetchFn, prodlevaMs: 0, kontakt: "test@example.com" });
    await geo.geokoduj("Praha");
    expect(zachyceno.url).toContain("countrycodes=cz");
    expect(zachyceno.ua).toContain("test@example.com");
  });

  it("drží rate-limit mezi požadavky", async () => {
    vi.useFakeTimers();
    try {
      const casy: number[] = [];
      const fetchFn = vi.fn(async () => {
        casy.push(Date.now());
        return new Response("[]", { status: 200 });
      });
      const geo = vytvorGeokoder({ fetchFn, prodlevaMs: 1000, kontakt: "t@e.com" });
      const p1 = geo.geokoduj("A");
      await vi.runAllTimersAsync();
      await p1;
      const p2 = geo.geokoduj("B");
      await vi.runAllTimersAsync();
      await p2;
      expect(casy[1]! - casy[0]!).toBeGreaterThanOrEqual(1000);
    } finally {
      vi.useRealTimers();
    }
  });
});
