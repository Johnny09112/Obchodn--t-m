/**
 * Kompletní registr ekonomických subjektů ČSÚ (otevřená data).
 *
 * Proč to je zásadní zdroj: vyhledávací API ARES vydá nejvýš 1 000 výsledků
 * na dotaz, takže sweep podle obce padá všude nad velikost Stříbra. Tenhle
 * soubor obsahuje **všechny subjekty v ČR najednou** (3,5 mil. řádků),
 * takže limit přestává existovat — filtruje se lokálně.
 *
 * Druhá výhoda je ještě větší: je v něm sloupec `KATPO`, tedy velikost firmy.
 * Dnes ji zjišťujeme jedním HTTP dotazem na každého kandidáta zvlášť, takže
 * se nedá filtrovat dřív, než se firma stáhne. Odsud ji máme zadarmo a je
 * možné **odfiltrovat malé firmy ještě před ověřováním a geokódováním** —
 * z 747 tisíc pražských subjektů zbyde 9 337 skutečných cílů.
 *
 * Co tenhle zdroj NEMĚNÍ: firma pořád vzniká jen po ověření IČO v ARES
 * (TP-1). Registr slouží k **sestavení seznamu kandidátů**, ne k zakládání
 * firem — ověřovací cesta zůstává `zalozFirmu()` nad `overFirmu()`.
 *
 * Omezení: registr zná jen SÍDLA, ne provozovny — stejně jako ARES. Kde se
 * skutečně pracuje, říkají otevřená data MPSV a OpenStreetMap.
 */
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { FORMY_ZAMESTNAVATELU } from "./formy.js";
import type { Misto } from "./geocode.js";
import { splnujeMinimum } from "./res.js";

const ZDROJ = "https://opendata.csu.gov.cz/soubory/od/od_org03/res_data.csv";

export interface RegistrZaznam {
  ico: string;
  nazev: string;
  /** Kód dle číselníku ARES „PravniForma". */
  pravniForma: string;
  /** Kód dle číselníku „KategoriePoctuPracovniku" — velikost zadarmo. */
  kategorieKod: string;
  nace: string[];
  /** Ulice s číslem popisným, pokud je v registru vedená. */
  adresa: string | null;
  obec: string | null;
  psc: string | null;
  /** RÚIAN kód základní územní jednotky (u velkých měst = městský obvod). */
  jednotka: number;
  /** Pro evidenci (TP-2). */
  zdrojUrl: string;
}

export interface RegistrKlient {
  /**
   * Zaměstnavatelé se sídlem v daných územních jednotkách.
   *
   * Zadává se KÓD jednotky, ne název obce — „Hrádek" je v ČR šestkrát
   * a podle názvu by se natáhly firmy z cizích obcí.
   */
  zamestnavateleVJednotkach(
    jednotky: number[],
    opts?: {
      minZamestnancu?: number;
      /** Které právní formy brát. Bez zadání platí formy zaměstnavatelů. */
      pravniFormy?: readonly string[];
    },
  ): Promise<RegistrZaznam[]>;

  /**
   * Územní jednotky obce, ve které sídlí subjekt s daným IČO — typicky
   * partnerská jídelna. U běžné obce vrátí jednu, u statutárního města
   * všechny jeho obvody (Plzeň 10, Praha 57), aby zóna neusekla město
   * na hranici obvodu.
   */
  jednotkyObce(ico: string): Promise<number[]>;

  /**
   * Územní jednotky odpovídající zadaným místům.
   *
   * Hledá podle názvu obce **a PSČ** — samotný název nestačí, „Hrádek" je
   * v ČR šestkrát a podle jména by se natáhly firmy z cizích obcí. Místo
   * bez PSČ vrátí všechny jednotky toho jména; raději víc práce než minout
   * tu správnou, protože tvar stejně na konci firmy ořeže.
   *
   * Jedním průchodem souboru pro všechna místa naráz.
   */
  jednotkyPodleMist(
    mista: readonly Misto[],
  ): Promise<Array<{ jednotka: number; obec: string }>>;
}

export interface RegistrKlientOpts {
  cestaSouboru?: string;
  /** Registr se aktualizuje 2× měsíčně, takže častěji stahovat nemá smysl. */
  maxStariDnu?: number;
  fetchFn?: typeof fetch;
}

/**
 * Rozdělí řádek CSV. Registr používá uvozovky u názvu firmy a ten může
 * obsahovat čárku („KOVOVÝROBA HONZÍK, s.r.o."), takže dělit prostým
 * `split(",")` nejde — rozsypalo by to všechny následující sloupce.
 */
export function rozdelRadek(radek: string): string[] {
  const pole: string[] = [];
  let aktualni = "";
  let vUvozovkach = false;
  for (const znak of radek) {
    if (znak === '"') vUvozovkach = !vUvozovkach;
    else if (znak === "," && !vUvozovkach) {
      pole.push(aktualni);
      aktualni = "";
    } else aktualni += znak;
  }
  pole.push(aktualni);
  return pole;
}

/** Odkaz na registr pro evidenci (TP-2). */
export const ZDROJ_REGISTRU = ZDROJ;

/**
 * Velikostní kategorie všech subjektů v registru, proudově.
 *
 * Není to metoda `RegistrKlient` schválně: ten se v testech nahrazuje
 * dvojníkem a povinná metoda navíc by rozbila každý z nich kvůli něčemu,
 * co se používá na jednom místě.
 *
 * Soubor se tu **nestahuje** — počítá se s tím, že už na disku je (stáhne
 * ho běžný sběr). Když není, je to chyba a řekne se to nahlas.
 */
export function zdrojVelikosti(opts: { cestaSouboru?: string } = {}) {
  const cesta = opts.cestaSouboru ?? "data/cache/res_data.csv";
  return {
    zdrojUrl: ZDROJ,
    async *kategorie(): AsyncGenerator<{ ico: string; kategorieKod: string }> {
      const rl = createInterface({
        input: createReadStream(cesta, "utf8"),
        crlfDelay: Infinity,
      });
      let sloupce: Map<string, number> | null = null;
      for await (const radek of rl) {
        if (!radek) continue;
        const pole = rozdelRadek(radek);
        if (!sloupce) {
          sloupce = new Map(pole.map((n, i) => [n.trim(), i]));
          continue;
        }
        const r = new Radek(pole, sloupce);
        // Zaniklý subjekt se přeskakuje ze stejného důvodu jako při sběru.
        if (r.hodnota("DDATZAN")) continue;
        yield { ico: r.hodnota("ICO"), kategorieKod: r.hodnota("KATPO") };
      }
    },
  };
}

const FORMY = new Set(FORMY_ZAMESTNAVATELU);

/** Porovnání bez ohledu na velikost písmen a okolní/vnitřní mezery. */
const normalizujNazev = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

/** „330 22" a „33022" musí vyjít jako totéž PSČ. */
const normalizujPsc = (s: string): string => s.replace(/\s+/g, "");

/** Pohled na jeden řádek podle jmen sloupců — pořadí se může časem změnit. */
class Radek {
  constructor(
    private readonly pole: string[],
    private readonly sloupce: Map<string, number>,
  ) {}
  hodnota(nazev: string): string {
    const i = this.sloupce.get(nazev);
    return i === undefined ? "" : (this.pole[i] ?? "").trim();
  }
}

function naZaznam(r: Radek): RegistrZaznam {
  const ulice = r.hodnota("ULICE_TEXT");
  const cislo = r.hodnota("CDOM");
  const nace = [r.hodnota("NACE2025"), r.hodnota("NACE")].filter(Boolean);
  return {
    ico: r.hodnota("ICO"),
    nazev: r.hodnota("FIRMA"),
    pravniForma: r.hodnota("FORMA"),
    kategorieKod: r.hodnota("KATPO"),
    nace: [...new Set(nace)],
    adresa: ulice ? [ulice, cislo].filter(Boolean).join(" ") : (cislo || null),
    obec: r.hodnota("OBEC_TEXT") || null,
    psc: r.hodnota("PSC") || null,
    jednotka: Number(r.hodnota("ICZUJ")),
    zdrojUrl: ZDROJ,
  };
}

export function vytvorRegistrKlienta(opts: RegistrKlientOpts = {}): RegistrKlient {
  const cesta = opts.cestaSouboru ?? "data/cache/res_data.csv";
  const maxStari = (opts.maxStariDnu ?? 14) * 86_400_000;
  const fetchFn = opts.fetchFn ?? fetch;

  async function zajistiSoubor(): Promise<void> {
    try {
      const s = await stat(cesta);
      if (Date.now() - s.mtimeMs <= maxStari) return;
    } catch {
      /* soubor zatím není — stáhneme ho */
    }
    const res = await fetchFn(ZDROJ);
    if (!res.ok) throw new Error(`Registr ČSÚ ${res.status} — soubor se nepodařilo stáhnout`);
    await mkdir(dirname(cesta), { recursive: true });
    await writeFile(cesta, Buffer.from(await res.arrayBuffer()));
  }

  /**
   * Projde soubor a na každý řádek zavolá `zpracuj`.
   *
   * Čte se proudově a index se nestaví. Půl gigabajtu by v paměti bylo
   * zbytečné a odvozený index by potřeboval verzování — na tom už jednou
   * tiše selhal filtr agentur (viz memory/poznatky.md). Soubor sám je cache.
   */
  async function projdi(zpracuj: (r: Radek) => void): Promise<void> {
    await zajistiSoubor();
    const rl = createInterface({
      input: createReadStream(cesta, "utf8"),
      crlfDelay: Infinity,
    });
    let sloupce: Map<string, number> | null = null;
    for await (const radek of rl) {
      if (!radek) continue;
      if (!sloupce) {
        sloupce = new Map(rozdelRadek(radek).map((n, i) => [n.trim(), i]));
        continue;
      }
      zpracuj(new Radek(rozdelRadek(radek), sloupce));
    }
  }

  return {
    async zamestnavateleVJednotkach(jednotky, o = {}) {
      const chtene = new Set(jednotky.map(String));
      const nalezene: RegistrZaznam[] = [];
      // Profil projektu smí seznam forem přepsat — Cantinero Business bere
      // i živnostníky, protože restauraci často provozuje fyzická osoba.
      const formy = o.pravniFormy?.length ? new Set(o.pravniFormy) : FORMY;

      await projdi((r) => {
        if (!chtene.has(r.hodnota("ICZUJ"))) return;
        if (r.hodnota("DDATZAN")) return; // zaniklý subjekt
        if (!formy.has(r.hodnota("FORMA"))) return; // mimo profil
        // Velikost známe rovnou z registru, takže malé firmy odpadnou dřív,
        // než se na ně sáhne dotazem — v tom je celá úspora.
        if (o.minZamestnancu !== undefined) {
          if (splnujeMinimum(r.hodnota("KATPO") || null, o.minZamestnancu) !== true) return;
        }
        nalezene.push(naZaznam(r));
      });

      return nalezene;
    },

    async jednotkyObce(ico) {
      // Jedno čtení: cestou se staví mapa obec+okres → jednotky a zároveň se
      // hledá řádek jídelny. Rozhoduje dvojice obec + okres, protože samotný
      // název obce není v ČR jedinečný — „Hrádek" je šestkrát.
      const podleObce = new Map<string, Set<number>>();
      let klicJidelny: string | null = null;

      await projdi((r) => {
        const klic = `${r.hodnota("OBEC_TEXT")}|${r.hodnota("OKRESLAU")}`;
        const j = Number(r.hodnota("ICZUJ"));
        if (Number.isFinite(j)) {
          const mnozina = podleObce.get(klic);
          if (mnozina) mnozina.add(j);
          else podleObce.set(klic, new Set([j]));
        }
        if (r.hodnota("ICO") === ico) klicJidelny = klic;
      });

      return klicJidelny ? [...(podleObce.get(klicJidelny) ?? [])] : [];
    },

    async jednotkyPodleMist(mista) {
      if (mista.length === 0) return [];

      const hledana = mista.map((m) => ({
        obec: normalizujNazev(m.obec),
        psc: m.psc === null ? null : normalizujPsc(m.psc),
      }));

      // Klíč je ICZUJ — jedna jednotka smí do výsledku jen jednou, i když
      // do ní patří víc míst nebo víc řádků (firem) registru.
      const nalezene = new Map<number, string>();

      await projdi((r) => {
        const obecRadku = r.hodnota("OBEC_TEXT");
        if (!obecRadku) return;
        const j = Number(r.hodnota("ICZUJ"));
        if (!Number.isFinite(j) || nalezene.has(j)) return;

        const obecNorm = normalizujNazev(obecRadku);
        const pscNorm = normalizujPsc(r.hodnota("PSC"));
        const shoda = hledana.some(
          (m) => m.obec === obecNorm && (m.psc === null || m.psc === pscNorm),
        );
        if (shoda) nalezene.set(j, obecRadku);
      });

      return [...nalezene].map(([jednotka, obec]) => ({ jednotka, obec }));
    },
  };
}
