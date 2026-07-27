import { jeValidniIco } from "./ico.js";
import { segmentPodleKategorie, type Segment } from "./res.js";

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
  velikostKategorie: Segment | null;
  kodObce?: number | null;
  /** Kód dle číselníku ARES „PravniForma" (viz src/formy.ts). NULL = neuvedeno. */
  pravniForma?: string | null;
}

export interface AresKlient {
  /** GET /ekonomicke-subjekty/{ico}; 404 nebo nevalidní IČO → null. */
  overFirmu(ico: string): Promise<AresZaznam | null>;
  /**
   * POST /ekonomicke-subjekty/vyhledat dle kódu obce, se stránkováním.
   *
   * `pravniFormy` dotaz zúží (viz `FORMY_ZAMESTNAVATELU` v src/formy.ts).
   * Bez zúžení spadne sweep na každé obci nad 1 000 subjektů. Filtr na právní
   * formu je jediný, který ARES doopravdy uplatní — `datumVzniku`
   * i `pocetZamestnancu` se tiše ignorují a `czNace` porovnává přesný kód
   * (dotaz „56" nenajde firmu s „56110"), takže dělit se podle nich nedá.
   */
  najdiFirmyVObci(
    kodObce: number,
    opts?: { max?: number; pravniFormy?: readonly string[] },
  ): Promise<AresZaznam[]>;
  /**
   * Párování názvu pracoviště (např. z mapy) na subjekt v rejstříku.
   * Vrací shodu jen tehdy, je-li jednoznačná — u víc kandidátů raději nic,
   * abychom si nevymýšleli (TP-2).
   */
  najdiPodleJmena(nazev: string): Promise<AresZaznam | null>;
}

const ZAKLAD = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

/**
 * Překlad kódu počtu pracovníků na segment dle SPEC.
 * Sdílí jediný zdroj pravdy s modulem `res` — číselník je oficiální a
 * jeho kódy nejsou intuitivní (`000` = neuvedeno, `110` = bez zaměstnanců).
 *
 * Pozn.: vyhledávací endpoint ARES tenhle údaj nevrací, takže je tu prakticky
 * vždy null; skutečný zdroj velikosti je statistický registr (`src/res.ts`).
 */
export function mapujVelikost(kod: string | null | undefined): AresZaznam["velikostKategorie"] {
  return segmentPodleKategorie(kod ?? null);
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
  pravniForma?: string;
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
    pravniForma: dto.pravniForma ?? null,
  };
}

/**
 * Srozumitelná hláška místo holého „ARES vyhledat 400".
 *
 * Překročení limitu je jiný druh problému než výpadek: nepřišli jsme o data
 * kvůli chybě, ale proto, že je obec příliš velká. Z běhu to musí být poznat,
 * jinak se tichá díra v pokrytí tváří jako úspěšný sběr.
 */
async function popisChybyHledani(res: Response, kodObce: number): Promise<string> {
  let telo: { subKod?: string; popis?: string } = {};
  try {
    telo = (await res.json()) as typeof telo;
  } catch {
    /* odpověď nebyla JSON — vystačíme si se stavovým kódem */
  }
  if (telo.subKod === "VYSTUP_PRILIS_MNOHO_VYSLEDKU") {
    const pocet = /\((\d[\d\s ]*)\)/.exec(telo.popis ?? "")?.[1] ?? "?";
    return (
      `Obec ${kodObce} má ${pocet} subjektů a rejstřík vydá nejvýš 1 000 na dotaz. ` +
      `Zúžení podle právní formy už bylo použito a nestačí — obec je na sweep ` +
      `rejstříku příliš velká. Pracoviště v ní hledej přes otevřená data MPSV ` +
      `a OpenStreetMap; sídlo v takovém městě stejně neříká, kde se pracuje.`
    );
  }
  return `ARES vyhledat ${res.status} (kodObce ${kodObce})${telo.popis ? `: ${telo.popis}` : ""}`;
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

    async najdiPodleJmena(nazev) {
      const ocisteny = nazev.trim();
      if (ocisteny.length < 3) return null;
      const res = await setrny(() =>
        fetchFn(`${ZAKLAD}/ekonomicke-subjekty/vyhledat`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ obchodniJmeno: ocisteny, pocet: 5, start: 0 }),
        }),
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        pocetCelkem?: number;
        ekonomickeSubjekty?: AresSubjektDto[];
      };
      const subjekty = (data.ekonomickeSubjekty ?? [])
        .map(mapujSubjekt)
        .filter((s): s is AresZaznam => s !== null);
      if (subjekty.length === 0) return null;
      if (subjekty.length === 1) return subjekty[0]!;

      // Víc kandidátů — bereme jen přesnou shodu názvu, jinak radši nic.
      const norm = (s: string) => s.toLowerCase().replace(/[\s.,]/g, "");
      const presna = subjekty.filter((s) => norm(s.nazev) === norm(ocisteny));
      return presna.length === 1 ? presna[0]! : null;
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
              // Prázdné pole by ARES bral jako „žádná forma nevyhovuje".
              ...(o.pravniFormy?.length ? { pravniForma: [...o.pravniFormy] } : {}),
              pocet: Math.min(strankaVelikost, max - vysledek.length),
              start,
            }),
          }),
        );
        if (!res.ok) throw new Error(await popisChybyHledani(res, kodObce));
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
