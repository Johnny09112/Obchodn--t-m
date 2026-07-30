import { describe, expect, it, vi } from "vitest";
import { vytvorGeokoder } from "../src/geocode.js";

function odpoved(telo: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(telo) } as Response);
}

describe("zpětné dohledání místa", () => {
  it("vytáhne obec a PSČ z odpovědi", async () => {
    const fetchFn = vi.fn(() =>
      odpoved({ address: { village: "Zbůch", postcode: "330 22" } }),
    );
    const g = vytvorGeokoder({ fetchFn: fetchFn as unknown as typeof fetch, prodlevaMs: 0, kontakt: "a@b.cz" });
    expect(await g.zpetne({ lat: 49.6, lng: 13.2 })).toEqual({ obec: "Zbůch", psc: "330 22" });
  });

  it("město i obec bez PSČ zvládne taky", async () => {
    const fetchFn = vi.fn(() => odpoved({ address: { town: "Rokycany" } }));
    const g = vytvorGeokoder({ fetchFn: fetchFn as unknown as typeof fetch, prodlevaMs: 0, kontakt: "a@b.cz" });
    expect(await g.zpetne({ lat: 49.7, lng: 13.6 })).toEqual({ obec: "Rokycany", psc: null });
  });

  it("bez obce vrátí null, nikdy si nic nedomýšlí", async () => {
    const fetchFn = vi.fn(() => odpoved({ address: { country: "Česko" } }));
    const g = vytvorGeokoder({ fetchFn: fetchFn as unknown as typeof fetch, prodlevaMs: 0, kontakt: "a@b.cz" });
    expect(await g.zpetne({ lat: 49.0, lng: 14.0 })).toBeNull();
  });

  it("chybu služby nespolkne", async () => {
    const fetchFn = vi.fn(() => Promise.resolve({ ok: false, status: 503 } as Response));
    const g = vytvorGeokoder({ fetchFn: fetchFn as unknown as typeof fetch, prodlevaMs: 0, kontakt: "a@b.cz" });
    await expect(g.zpetne({ lat: 49.6, lng: 13.2 })).rejects.toThrow();
  });
});
