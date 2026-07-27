/**
 * Statistický registr (RES) — sub-registr ARES.
 *
 * Jediné místo, kde je dostupná kategorie počtu zaměstnanců. Ve výsledku
 * vyhledávání ani v základním detailu subjektu není — musí se dotáhnout
 * zvlášť pro každé IČO.
 */
import { jeValidniIco } from "./ico.js";

const ZAKLAD = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

/**
 * Oficiální číselník ARES „KategoriePoctuPracovniku" (staženo a ověřeno
 * 2026-07-27). POZOR na past: `000` je *Neuvedeno*, nikoli „bez zaměstnanců" —
 * tou je až `110`.
 */
export const KATEGORIE_PRACOVNIKU: Record<string, { popis: string; od: number | null; do: number | null }> = {
  "000": { popis: "neuvedeno", od: null, do: null },
  "110": { popis: "bez zaměstnanců", od: 0, do: 0 },
  "120": { popis: "1–5", od: 1, do: 5 },
  "130": { popis: "6–9", od: 6, do: 9 },
  "210": { popis: "10–19", od: 10, do: 19 },
  "220": { popis: "20–24", od: 20, do: 24 },
  "230": { popis: "25–49", od: 25, do: 49 },
  "240": { popis: "50–99", od: 50, do: 99 },
  "310": { popis: "100–199", od: 100, do: 199 },
  "320": { popis: "200–249", od: 200, do: 249 },
  "330": { popis: "250–499", od: 250, do: 499 },
  "340": { popis: "500–999", od: 500, do: 999 },
  "410": { popis: "1000–1499", od: 1000, do: 1499 },
  "420": { popis: "1500–1999", od: 1500, do: 1999 },
  "430": { popis: "2000–2499", od: 2000, do: 2499 },
  "440": { popis: "2500–2999", od: 2500, do: 2999 },
  "450": { popis: "3000–3999", od: 3000, do: 3999 },
  "460": { popis: "4000–4999", od: 4000, do: 4999 },
  "470": { popis: "5000–9999", od: 5000, do: 9999 },
  "510": { popis: "10000+", od: 10000, do: null },
};

export type Segment = "mikro" | "stredni" | "korporat";

/** Segmentace dle SPEC kap. 10.2: mikro do 25, střední 25–250, korporát nad 250. */
export function segmentPodleKategorie(kod: string | null): Segment | null {
  if (!kod) return null;
  const k = KATEGORIE_PRACOVNIKU[kod];
  if (!k || k.od === null) return null; // neuvedeno → nevíme (TP-2: NULL, ne odhad)
  if (k.od === 0) return null; // bez zaměstnanců není segment, je to vyřazení
  if (k.od < 25) return "mikro";
  if (k.od < 250) return "stredni";
  return "korporat";
}

/**
 * Splňuje firma minimální velikost? Porovnává se **spodní hranice** pásma,
 * takže „10–19" projde prahem 10, ale „6–9" ne.
 * Neuvedená velikost vrací `null` — nevíme, a rozhodnutí necháme na volajícím.
 */
export function splnujeMinimum(kod: string | null, minZamestnancu: number): boolean | null {
  if (!kod) return null;
  const k = KATEGORIE_PRACOVNIKU[kod];
  if (!k || k.od === null) return null;
  return k.od >= minZamestnancu;
}

/** True jen tam, kde registr výslovně říká „bez zaměstnanců" (kód 110). */
export function jeBezZamestnancu(kod: string | null): boolean {
  return kod === "110";
}

export interface ResUdaje {
  ico: string;
  kategorieKod: string | null;
  kategoriePopis: string | null;
  segment: Segment | null;
  bezZamestnancu: boolean;
  /** Odkaz pro evidenci (TP-2). */
  zdrojUrl: string;
}

export interface ResKlient {
  nactiUdaje(ico: string): Promise<ResUdaje | null>;
}

export interface ResKlientOpts {
  fetchFn?: typeof fetch;
  prodlevaMs?: number;
}

export function vytvorResKlienta(opts: ResKlientOpts = {}): ResKlient {
  const fetchFn = opts.fetchFn ?? fetch;
  const prodlevaMs = opts.prodlevaMs ?? 300;
  let posledni = 0;

  return {
    async nactiUdaje(ico) {
      if (!jeValidniIco(ico)) return null;
      const cekat = posledni + prodlevaMs - Date.now();
      if (cekat > 0) await new Promise((r) => setTimeout(r, cekat));
      posledni = Date.now();

      const zdrojUrl = `${ZAKLAD}/ekonomicke-subjekty-res/${ico}`;
      const res = await fetchFn(zdrojUrl, { headers: { accept: "application/json" } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`ARES RES ${res.status} pro IČO ${ico}`);

      const data = (await res.json()) as {
        zaznamy?: Array<{ statistickeUdaje?: { kategoriePoctuPracovniku?: string } }>;
      };
      const kod = data.zaznamy?.[0]?.statistickeUdaje?.kategoriePoctuPracovniku ?? null;
      return {
        ico,
        kategorieKod: kod,
        kategoriePopis: kod ? (KATEGORIE_PRACOVNIKU[kod]?.popis ?? null) : null,
        segment: segmentPodleKategorie(kod),
        bezZamestnancu: jeBezZamestnancu(kod),
        zdrojUrl,
      };
    },
  };
}
