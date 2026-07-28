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
  /** Číslo popisné pracoviště — rozliší provozy uvnitř obce. */
  cisloDomovni: number | null;
  /**
   * Agentura práce: nabírá lidi pro někoho jiného, sama v obci nesídlí
   * ani tam nevaří obědy. Poznáme podle příznaku v datech nebo podle názvu
   * pracoviště, který prozradí skutečného zaměstnavatele.
   */
  jeAgentura: boolean;
  /** Firma, pro kterou agentura nabírá — vytažená z názvu pracoviště. */
  proKoho: string | null;
  /** Kontaktní osoba, kterou zaměstnavatel v inzerátu zveřejnil sám. */
  kontakt?: MpsvKontakt;
  /** Pro evidenci (TP-2). */
  zdrojUrl: string;
}

/**
 * Kontaktní osoba z inzerátu.
 *
 * Zaměstnavatel ji do otevřených dat vložil sám, takže je to legitimní
 * veřejný zdroj — a jediný, který dá jméno, pozici, telefon i e-mail naráz.
 *
 * Pozor na účel: ten člověk je tam kvůli uchazečům o zaměstnání, ne kvůli
 * nabídkám dodavatelů. Do evidence se to musí zapsat pravdivě, ať je při
 * schvalování oslovení vidět, odkud adresa je.
 */
export interface MpsvKontakt {
  /** Jméno včetně titulu před jménem, pokud ho inzerát uvádí. */
  jmeno: string | null;
  prijmeni: string | null;
  pozice: string | null;
  email: string | null;
  telefon: string | null;
}

interface ZaznamObce {
  nazev: string;
  mist: number;
  inzeratu: number;
  cisloDomovni: number | null;
  jeAgentura: boolean;
  proKoho: string | null;
  kontakt?: MpsvKontakt;
}

/** obec → IČO → údaje */
export type MpsvIndex = Record<string, Record<string, ZaznamObce>>;

interface SyrovaData {
  polozky?: Array<{
    pocetMist?: number;
    souhlasAgenturyAgentura?: boolean;
    souhlasAgenturyUzivatel?: boolean;
    zamestnavatel?: { ico?: string; nazev?: string };
    prvniKontaktSeZamestnavatelem?: {
      komuSeHlasit?: {
        jmeno?: string | null;
        prijmeni?: string | null;
        titulPredJmenem?: string | null;
        titulZaJmenem?: string | null;
        poziceVeSpolecnosti?: string | null;
        email?: string | null;
        telefon?: string | null;
      } | null;
    } | null;
    mistoVykonuPrace?: {
      pracoviste?: Array<{
        nazev?: string;
        adresa?: { obec?: { id?: string }; cisloDomovni?: number };
      }>;
    };
  }>;
}

/**
 * Z názvu pracoviště vytáhne firmu, pro kterou se nabírá.
 * Agentury to uvádějí dvěma způsoby:
 *   „MSRCZ MARINA GLOBAL. s.r.o. (SIGNUM s.r.o.)"
 *   „MARCIUS PLUS s.r.o., pracoviště Bezdružice, Signum s.r.o."
 * Vrací null, pokud název jen opakuje jméno zaměstnavatele.
 */
export function vytahniProKoho(
  nazevPracoviste: string | undefined,
  nazevZamestnavatele: string,
): string | null {
  if (!nazevPracoviste) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[\s.,]/g, "");
  const zam = norm(nazevZamestnavatele);

  const kandidati: string[] = [];
  const vZavorce = /\(([^)]+)\)/.exec(nazevPracoviste);
  if (vZavorce?.[1]) kandidati.push(vZavorce[1]);
  // Poslední úsek za čárkou — „…, pracoviště X, Firma s.r.o."
  const useky = nazevPracoviste.split(",").map((u) => u.trim());
  if (useky.length > 1) kandidati.push(useky[useky.length - 1]!);

  for (const k of kandidati) {
    const kn = norm(k);
    // Musí to vypadat jako firma a nesmí to být jen opis zaměstnavatele.
    if (!/s\.?r\.?o\.?|a\.?s\.?|spol/i.test(k)) continue;
    if (kn === zam || zam.includes(kn) || kn.includes(zam)) continue;
    return k.trim();
  }
  return null;
}

/** Zredukuje celý balík na kompaktní index obec → zaměstnavatelé. */
type KomuSeHlasit = NonNullable<
  NonNullable<NonNullable<SyrovaData["polozky"]>[number]["prvniKontaktSeZamestnavatelem"]>["komuSeHlasit"]
>;

/**
 * Kontakt z inzerátu. Pole bývají vyplněná jen zčásti, takže bereme,
 * co je — stačí jediný použitelný údaj. Úplně prázdný kontakt vracíme jako
 * `undefined`, ať se do kartotéky nedostane prázdný záznam tvářící se
 * jako nález.
 */
export function vytahniKontakt(k: KomuSeHlasit | null | undefined): MpsvKontakt | undefined {
  if (!k) return undefined;
  const ocisti = (h: string | null | undefined) => h?.trim() || null;

  const jmeno = [ocisti(k.titulPredJmenem), ocisti(k.jmeno)].filter(Boolean).join(" ") || null;
  const prijmeni =
    [ocisti(k.prijmeni), ocisti(k.titulZaJmenem)].filter(Boolean).join(" ") || null;
  const kontakt: MpsvKontakt = {
    jmeno,
    prijmeni,
    pozice: ocisti(k.poziceVeSpolecnosti),
    email: ocisti(k.email),
    telefon: ocisti(k.telefon),
  };
  const maNeco = Object.values(kontakt).some((h) => h !== null);
  return maNeco ? kontakt : undefined;
}

export function postavIndex(data: SyrovaData): MpsvIndex {
  const index: MpsvIndex = {};
  for (const v of data.polozky ?? []) {
    const ico = v.zamestnavatel?.ico;
    const nazev = v.zamestnavatel?.nazev;
    if (!ico || !nazev) continue;

    // Jeden inzerát může mít víc pracovišť; každou obec počítáme zvlášť.
    for (const p of v.mistoVykonuPrace?.pracoviste ?? []) {
      const kod = String(p.adresa?.obec?.id ?? "").replace("Obec/", "");
      if (!kod) continue;

      const proKoho = vytahniProKoho(p.nazev, nazev);
      index[kod] ??= {};
      const zaznam: ZaznamObce = index[kod]![ico] ?? {
        nazev, mist: 0, inzeratu: 0, cisloDomovni: null,
        jeAgentura: false, proKoho: null,
      };
      zaznam.mist += v.pocetMist ?? 1;
      zaznam.inzeratu += 1;
      zaznam.cisloDomovni ??= p.adresa?.cisloDomovni ?? null;
      // Stačí jediný inzerát s příznakem agentury nebo s cizí firmou v názvu.
      if (v.souhlasAgenturyAgentura === true) zaznam.jeAgentura = true;
      if (proKoho) {
        zaznam.jeAgentura = true;
        zaznam.proKoho ??= proKoho;
      }
      // První použitelný kontakt vyhrává. Firma mívá víc inzerátů a bývá
      // v nich týž člověk; přepisovat ho dalším nemá co zlepšit.
      zaznam.kontakt ??= vytahniKontakt(v.prvniKontaktSeZamestnavatelem?.komuSeHlasit);
      index[kod]![ico] = zaznam;
    }
  }
  return index;
}

export interface MpsvKlient {
  /** Zaměstnavatelé s pracovištěm v obci, seřazení podle počtu nabízených míst. */
  zamestnavateleVObci(kodObce: number): Promise<MpsvZamestnavatel[]>;
  /**
   * Kontaktní osoba zaměstnavatele podle IČO, bez ohledu na obec.
   *
   * Slouží k doplnění kontaktů u firem, které v kartotéce už jsou — ty se
   * při běhu přeskakují, takže by se k nim nový zdroj jinak nedostal.
   */
  kontaktZamestnavatele(ico: string): Promise<MpsvKontakt | null>;
}

export interface MpsvKlientOpts {
  fetchFn?: typeof fetch;
  cestaIndexu?: string;
  /** Po kolika hodinách se index považuje za zastaralý. */
  maxStariHodin?: number;
}

/**
 * Verze formátu indexu. Zvyš při každé změně toho, co se z dat vytahuje —
 * jinak by se po nasazení použil starý index bez nových polí a nová logika
 * by tiše nefungovala (stalo se u rozpoznávání agentur).
 */
const VERZE_INDEXU = 3;

interface UlozenyIndex {
  verze?: number;
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
      if (u.verze !== VERZE_INDEXU) return null;
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
      verze: VERZE_INDEXU,
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
        .map(([ico, z]) => ({ ico, ...z, kodObce, zdrojUrl: ZDROJ }))
        .sort((a, b) => b.mist - a.mist);
    },

    async kontaktZamestnavatele(ico) {
      const index = await zajistiIndex();
      // Index je stavěný obec → IČO, protože tak se v běhu hledá. Tady jdeme
      // proti srsti přes všechny obce; je to pár tisíc položek v paměti,
      // takže se druhý index kvůli tomu nevyplatí držet.
      for (const obec of Object.values(index.obce)) {
        const kontakt = obec[ico]?.kontakt;
        if (kontakt) return kontakt;
      }
      return null;
    },
  };
}
