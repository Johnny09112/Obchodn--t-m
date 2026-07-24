import { jeValidniIco } from "./ico.js";

/** Ověřený záznam firmy z ARES — jediný vstup pro založení company (TP-1). */
export interface AresZaznam {
  ico: string;
  nazev: string;
  adresa: string | null;
  obec: string | null;
  okres?: string | null;
  kraj?: string | null;
  psc?: string | null;
  czNace: string[];
  velikostKategorie: "mikro" | "mala" | "stredni" | "velka" | null;
  kodObce?: number | null;
}

export interface AresKlient {
  /** GET /ekonomicke-subjekty/{ico}; 404 nebo nevalidní IČO → null. */
  overFirmu(ico: string): Promise<AresZaznam | null>;
  /** POST /ekonomicke-subjekty/vyhledat dle kódu obce, se stránkováním. */
  najdiFirmyVObci(kodObce: number, opts?: { max?: number }): Promise<AresZaznam[]>;
}

const ZAKLAD = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

/**
 * Mapování číselníku ČSÚ kategoriePoctuPracovniku na kategorie dle segmentace
 * SPEC (mikro <25, malá 25–99, střední 100–249, velká 250+).
 */
export function mapujVelikost(kod: string | null | undefined): AresZaznam["velikostKategorie"] {
  if (!kod) return null;
  const k = Number(kod);
  if (Number.isNaN(k)) return null;
  if (k <= 210) return "mikro"; // bez zaměstnanců až 20–24
  if (k <= 230) return "mala"; // 25–49, 50–99
  if (k <= 320) return "stredni"; // 100–199, 200–249
  return "velka"; // 250+
}

interface AresSubjektDto {
  ico?: string;
  obchodniJmeno?: string;
  sidlo?: {
    textovaAdresa?: string;
    nazevObce?: string;
    nazevOkresu?: string;
    nazevKraje?: string;
    psc?: number | string;
    kodObce?: number;
  };
  czNace?: string[];
  statistickeUdaje?: { kategoriePoctuPracovniku?: string };
}

function mapujSubjekt(dto: AresSubjektDto): AresZaznam | null {
  if (!dto.ico || !dto.obchodniJmeno) return null;
  return {
    ico: dto.ico,
    nazev: dto.obchodniJmeno,
    adresa: dto.sidlo?.textovaAdresa ?? null,
    obec: dto.sidlo?.nazevObce ?? null,
    okres: dto.sidlo?.nazevOkresu ?? null,
    kraj: dto.sidlo?.nazevKraje ?? null,
    psc: dto.sidlo?.psc != null ? String(dto.sidlo.psc) : null,
    czNace: dto.czNace ?? [],
    velikostKategorie: mapujVelikost(dto.statistickeUdaje?.kategoriePoctuPracovniku),
    kodObce: dto.sidlo?.kodObce ?? null,
  };
}

export interface AresKlientOpts {
  fetchFn?: typeof fetch;
  /** Min. prodleva mezi požadavky (šetrné tempo, SPEC kap. 9). */
  prodlevaMs?: number;
  strankaVelikost?: number;
}

export function vytvorAresKlienta(opts: AresKlientOpts = {}): AresKlient {
  const fetchFn = opts.fetchFn ?? fetch;
  const prodlevaMs = opts.prodlevaMs ?? 300;
  const strankaVelikost = opts.strankaVelikost ?? 200;
  let posledni = 0;

  async function setrny<T>(fn: () => Promise<Response>): Promise<Response> {
    const cekat = posledni + prodlevaMs - Date.now();
    if (cekat > 0) await new Promise((r) => setTimeout(r, cekat));
    for (let pokus = 0; ; pokus++) {
      posledni = Date.now();
      const res = await fn();
      if ((res.status === 429 || res.status >= 500) && pokus < 3) {
        await new Promise((r) => setTimeout(r, prodlevaMs * 2 ** (pokus + 1)));
        continue;
      }
      return res;
    }
  }

  return {
    async overFirmu(ico) {
      if (!jeValidniIco(ico)) return null;
      const res = await setrny(() =>
        fetchFn(`${ZAKLAD}/ekonomicke-subjekty/${ico}`, {
          headers: { accept: "application/json" },
        }),
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`ARES ${res.status} pro IČO ${ico}`);
      return mapujSubjekt((await res.json()) as AresSubjektDto);
    },

    async najdiFirmyVObci(kodObce, o = {}) {
      const max = o.max ?? Infinity;
      const vysledek: AresZaznam[] = [];
      let start = 0;
      for (;;) {
        const res = await setrny(() =>
          fetchFn(`${ZAKLAD}/ekonomicke-subjekty/vyhledat`, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              sidlo: { kodObce },
              pocet: Math.min(strankaVelikost, max - vysledek.length),
              start,
            }),
          }),
        );
        if (!res.ok) throw new Error(`ARES vyhledat ${res.status} (kodObce ${kodObce})`);
        const data = (await res.json()) as {
          pocetCelkem: number;
          ekonomickeSubjekty?: AresSubjektDto[];
        };
        const subjekty = (data.ekonomickeSubjekty ?? [])
          .map(mapujSubjekt)
          .filter((s): s is AresZaznam => s !== null);
        vysledek.push(...subjekty);
        start += subjekty.length;
        if (
          subjekty.length === 0 ||
          vysledek.length >= Math.min(data.pocetCelkem, max)
        ) {
          break;
        }
      }
      return vysledek.slice(0, max === Infinity ? undefined : max);
    },
  };
}
