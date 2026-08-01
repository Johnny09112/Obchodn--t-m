/**
 * Síto „koho vůbec chceme oslovit" — pravidla, která platí trvale.
 *
 * **Čistý modul. Nesmí sem přijít nic, co sahá na databázi.**
 *
 * Proč to stojí za vlastní soubor: tohle jediné z jádra potřebuje i webová
 * aplikace (krok 2 a 4 průvodce kampaní). Dokud bylo síto v `kvalifikace.ts`,
 * táhla si aplikace přes `blacklist.ts` → `db.ts` ovladače PGlite a Postgresu.
 * Doma to prošlo, protože kořenové závislosti existují; **na Vercelu se
 * instalují jen ty z `app/`, takže sestavení padalo** — a padalo tiše, celou
 * etapu B.
 *
 * Pravidlo je jedno a sdílené: mění se tady, platí pro sběr i pro kampaně.
 */
import { jeBytovyDum, popisFormy } from "./formy.js";
import { oddilZNace } from "./nace.js";

// ─────────────────────────────────────────────────────── ruční blacklist

export type TypPravidla = "ico" | "nazev" | "nace" | "pravni_forma";

export interface Pravidlo {
  id?: string;
  typ: TypPravidla;
  hodnota: string;
  duvod: string;
  vytvoril?: string;
}

/** Firma tak, jak ji blacklist potřebuje vidět. */
export interface PosuzovanaFirma {
  ico: string;
  nazev: string;
  czNace: readonly string[];
  pravniForma?: string | null;
}

/**
 * Srovnávací tvar textu: bez diakritiky, malými písmeny.
 *
 * Kdo píše pravidlo, obvykle nepřepisuje háčky přesně podle rejstříku —
 * bez tohohle by pravidlo „kovovyroba" tiše nefungovalo a nikdo by nevěděl proč.
 *
 * Ze stejného důvodu podle toho hledá i aplikace: kdo píše „zapadni cechy",
 * myslí „Západní čechy".
 */
export function porovnatelne(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Vrátí pravidlo, které firmu vyřazuje, nebo null. */
export function naBlacklistu(
  pravidla: readonly Pravidlo[],
  firma: PosuzovanaFirma,
): Pravidlo | null {
  const nazev = porovnatelne(firma.nazev);
  const oddily = new Set(
    firma.czNace.map(oddilZNace).filter((o): o is string => o !== null),
  );

  for (const p of pravidla) {
    const hodnota = p.hodnota.trim();
    switch (p.typ) {
      case "ico":
        if (firma.ico === hodnota) return p;
        break;
      case "nazev":
        // Kus názvu stačí — pravidlo se píše ručně, ne kopíruje z rejstříku.
        if (nazev.includes(porovnatelne(hodnota))) return p;
        break;
      case "nace":
        if (oddily.has(hodnota)) return p;
        break;
      case "pravni_forma":
        if (firma.pravniForma === hodnota) return p;
        break;
    }
  }
  return null;
}

// ─────────────────────────────────────────── koho neoslovovat nikdy

/** Proč firmu neoslovovat, i když v území leží. */
export type DuvodNeoslovovat =
  | "partnerska_jidelna"
  | "bytovy_dum"
  | "blacklist"
  | "vlastni_jidelna";

export interface Neoslovovat {
  duvod: DuvodNeoslovovat;
  detail: string;
}

/**
 * Důvody „tuhle firmu neoslovovat", které platí **trvale** — nezávisle na
 * profilu projektu i na tom, odkud se firma vzala — a dají se posoudit rovnou
 * z kartotéky, bez jediného dotazu ven.
 *
 * K čemu to je: seznam firem v oblasti (`oblast_firmy`) se plní podle
 * geometrie, tedy bez ptaní. Cesta z něj do kampaně proto potřebuje vlastní
 * síto — jinak by kampaň nabídla firmu, kterou majitel mezitím dal na
 * blacklist, nebo školu, která se stala partnerem až potom.
 *
 * Proč to není `kvalifikujFirmu`: ta odpovídá na otázku „přijmout kandidáta
 * do kartotéky?" a její součástí je obor podle profilu a velikost. Tady jde
 * o jinou otázku — „vložit už přijatou firmu do seznamu k oslovení?" —
 * a obor ani velikost do ní schválně nepatří: firma posbíraná za jednoho
 * profilu by po přepnutí profilu z kampaně tiše zmizela. Co komu vyhovuje
 * velikostí a oborem, si člověk vybere při schvalování kampaně; tyhle čtyři
 * důvody vybírat nejde, ty platí vždycky.
 *
 * Vrací `null`, když firmě nic nebrání.
 */
export function duvodNeoslovovat(v: {
  ico: string;
  nazev: string;
  czNace: readonly string[];
  pravniForma: string | null;
  /** `null` znamená „nevíme", ne „nemá" — na dohad se firma nevyřazuje (TP-2). */
  maVlastniJidelnu: boolean | null;
  partnerskaIca: ReadonlySet<string>;
  blacklist: readonly Pravidlo[];
}): Neoslovovat | null {
  if (v.partnerskaIca.has(v.ico)) {
    return { duvod: "partnerska_jidelna", detail: "je to naše partnerská jídelna, ne zákazník" };
  }
  if (jeBytovyDum(v.pravniForma)) {
    return { duvod: "bytovy_dum", detail: popisFormy(v.pravniForma) ?? "bytový dům" };
  }
  const pravidlo = naBlacklistu(v.blacklist, {
    ico: v.ico,
    nazev: v.nazev,
    czNace: v.czNace,
    pravniForma: v.pravniForma,
  });
  if (pravidlo) {
    return { duvod: "blacklist", detail: pravidlo.duvod };
  }
  if (v.maVlastniJidelnu === true) {
    return { duvod: "vlastni_jidelna", detail: "má doloženou vlastní jídelnu" };
  }
  return null;
}
