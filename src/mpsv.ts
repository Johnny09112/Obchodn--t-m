/**
 * Otevřená data MPSV — volná pracovní místa.
 *
 * Proč to je nejcennější zdroj: u každého inzerátu je IČO zaměstnavatele
 * a obec, kde se **skutečně pracuje**. To je jediný bezplatný signál
 * „tahle firma tu má provozovnu", protože ARES zná pouze sídla.
 *
 * Omezení zdroje: parametry v URL (filtry, limit) server ignoruje — vždy
 * vrací celý balík (~178 MB, ~39 tis. inzerátů). Proto se stáhne jednou,
 * zredukuje na malý index obec → zaměstnavatelé a ten se cachuje na disk.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const ZDROJ = "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json";

export interface MpsvZamestnavatel {
  ico: string;
  nazev: string;
  /** Součet nabízených míst — hrubý ukazatel velikosti provozu. */
  mist: number;
  inzeratu: number;
  kodObce: number;
  /** Pro evidenci (TP-2). */
  zdrojUrl: string;
}

/** obec → IČO → údaje */
export type MpsvIndex = Record<string, Record<string, { nazev: string; mist: number; inzeratu: number }>>;

interface SyrovaData {
  polozky?: Array<{
    pocetMist?: number;
    zamestnavatel?: { ico?: string; nazev?: string };
    mistoVykonuPrace?: {
      pracoviste?: Array<{ adresa?: { obec?: { id?: string } } }>;
    };
  }>;
}

/** Zredukuje celý balík na kompaktní index obec → zaměstnavatelé. */
export function postavIndex(data: SyrovaData): MpsvIndex {
  const index: MpsvIndex = {};
  for (const v of data.polozky ?? []) {
    const ico = v.zamestnavatel?.ico;
    const nazev = v.zamestnavatel?.nazev;
    if (!ico || !nazev) continue;

    // Jeden inzerát může mít víc pracovišť; každou obec počítáme zvlášť.
    const obce = new Set<string>();
    for (const p of v.mistoVykonuPrace?.pracoviste ?? []) {
      const kod = String(p.adresa?.obec?.id ?? "").replace("Obec/", "");
      if (kod) obce.add(kod);
    }

    for (const kod of obce) {
      index[kod] ??= {};
      const zaznam = index[kod]![ico] ?? { nazev, mist: 0, inzeratu: 0 };
      zaznam.mist += v.pocetMist ?? 1;
      zaznam.inzeratu += 1;
      index[kod]![ico] = zaznam;
    }
  }
  return index;
}

export interface MpsvKlient {
  /** Zaměstnavatelé s pracovištěm v obci, seřazení podle počtu nabízených míst. */
  zamestnavateleVObci(kodObce: number): Promise<MpsvZamestnavatel[]>;
}

export interface MpsvKlientOpts {
  fetchFn?: typeof fetch;
  cestaIndexu?: string;
  /** Po kolika hodinách se index považuje za zastaralý. */
  maxStariHodin?: number;
}

interface UlozenyIndex {
  stazeno: string;
  obce: MpsvIndex;
}

export function vytvorMpsvKlienta(opts: MpsvKlientOpts = {}): MpsvKlient {
  const fetchFn = opts.fetchFn ?? fetch;
  const cesta = opts.cestaIndexu ?? "data/cache/mpsv-index.json";
  const maxStari = (opts.maxStariHodin ?? 24) * 3600_000;
  let vPameti: UlozenyIndex | null = null;

  async function nactiZDisku(): Promise<UlozenyIndex | null> {
    try {
      const u = JSON.parse(await readFile(cesta, "utf8")) as UlozenyIndex;
      if (Date.now() - new Date(u.stazeno).getTime() > maxStari) return null;
      return u;
    } catch {
      return null;
    }
  }

  async function zajistiIndex(): Promise<UlozenyIndex> {
    if (vPameti) return vPameti;
    const zDisku = await nactiZDisku();
    if (zDisku) {
      vPameti = zDisku;
      return zDisku;
    }

    const res = await fetchFn(ZDROJ, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`MPSV ${res.status} — nepodařilo se stáhnout volná místa`);
    const data = (await res.json()) as SyrovaData;

    const ulozeny: UlozenyIndex = {
      stazeno: new Date().toISOString(),
      obce: postavIndex(data),
    };
    await mkdir(dirname(cesta), { recursive: true });
    await writeFile(cesta, JSON.stringify(ulozeny), "utf8");
    vPameti = ulozeny;
    return ulozeny;
  }

  return {
    async zamestnavateleVObci(kodObce) {
      const index = await zajistiIndex();
      const obec = index.obce[String(kodObce)] ?? {};
      return Object.entries(obec)
        .map(([ico, z]) => ({
          ico,
          nazev: z.nazev,
          mist: z.mist,
          inzeratu: z.inzeratu,
          kodObce,
          zdrojUrl: ZDROJ,
        }))
        .sort((a, b) => b.mist - a.mist);
    },
  };
}
