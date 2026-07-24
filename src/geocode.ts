import type { Bod } from "./geo.js";

export interface Geokoder {
  /** Geokóduje adresu přes Nominatim; žádný výsledek → null (nikdy odhad). */
  geokoduj(adresa: string): Promise<Bod | null>;
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
  };
}
