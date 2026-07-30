import type { Bod } from "./geo.js";

export interface Misto {
  obec: string;
  psc: string | null;
}

export interface Geokoder {
  /** Geokóduje adresu přes Nominatim; žádný výsledek → null (nikdy odhad). */
  geokoduj(adresa: string): Promise<Bod | null>;
  /**
   * Zpětné dohledání: ze souřadnic na obec. Nenalezeno → null, nikdy odhad.
   *
   * Nominatim vrací název obce v různých polích podle velikosti sídla,
   * proto se zkouší postupně.
   */
  zpetne(bod: Bod): Promise<Misto | null>;
}

export interface GeokoderOpts {
  fetchFn?: typeof fetch;
  /** Nominatim vyžaduje max 1 požadavek/s. */
  prodlevaMs?: number;
  /** Kontaktní e-mail do User-Agent (podmínky užití Nominatim). */
  kontakt: string;
}

export function vytvorGeokoder(opts: GeokoderOpts): Geokoder {
  const fetchFn = opts.fetchFn ?? fetch;
  const prodlevaMs = opts.prodlevaMs ?? 1100;
  let fronta: Promise<unknown> = Promise.resolve();
  let posledni = 0;

  return {
    geokoduj(adresa) {
      const uloha = fronta.then(async () => {
        const cekat = posledni + prodlevaMs - Date.now();
        if (cekat > 0) await new Promise((r) => setTimeout(r, cekat));
        posledni = Date.now();

        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("countrycodes", "cz");
        url.searchParams.set("limit", "1");
        url.searchParams.set("q", adresa);

        const res = await fetchFn(url.toString(), {
          headers: { "User-Agent": `cantinero-cmuchal/0.1 (${opts.kontakt})` },
        });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const data = (await res.json()) as Array<{ lat: string; lon: string }>;
        const prvni = data[0];
        if (!prvni) return null;
        return { lat: Number(prvni.lat), lng: Number(prvni.lon) };
      });
      fronta = uloha.catch(() => {});
      return uloha;
    },

    zpetne(bod) {
      const uloha = fronta.then(async () => {
        const cekat = posledni + prodlevaMs - Date.now();
        if (cekat > 0) await new Promise((r) => setTimeout(r, cekat));
        posledni = Date.now();

        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("lat", String(bod.lat));
        url.searchParams.set("lon", String(bod.lng));
        url.searchParams.set("zoom", "10");
        url.searchParams.set("addressdetails", "1");

        const res = await fetchFn(url.toString(), {
          headers: { "User-Agent": `cantinero-cmuchal/0.1 (${opts.kontakt})` },
        });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const data = (await res.json()) as {
          address?: {
            village?: string;
            town?: string;
            city?: string;
            municipality?: string;
            postcode?: string;
          };
        };
        const adresa = data.address;
        const obec = adresa?.village ?? adresa?.town ?? adresa?.city ?? adresa?.municipality;
        if (!obec) return null;
        return { obec, psc: adresa?.postcode ?? null };
      });
      fronta = uloha.catch(() => {});
      return uloha;
    },
  };
}
