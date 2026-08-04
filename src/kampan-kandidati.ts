/**
 * Kdo z území do kampaně patří a proč — jedno pravidlo pro plnění i pro počty.
 *
 * **Čistý modul. Nesmí sem přijít nic, co sahá na databázi.** Používá ho webová
 * aplikace (`app/src/data.ts`), a ta si přes `src/` nesmí přitáhnout `db.ts` —
 * Vercel kořenové závislosti neinstaluje a sestavení by spadlo. Hlídá
 * `test/hranice-aplikace.test.ts`.
 *
 * Proč vlastní soubor: dřív to byl cyklus uvnitř `naplnKampanZOblasti`, který
 * zároveň třídil i vkládal. Obrazovka pak nemohla říct, kolik firem čeká, aniž
 * by pravidlo opsala podruhé — a dvě opsaná pravidla se dřív nebo později
 * rozejdou.
 */
import { duvodNeoslovovat, type Neoslovovat, type Pravidlo } from "./sito.js";

/** Proč firma (ne)patří do kampaně. */
export type Kosik =
  /** Doložených 25 a víc zaměstnanců — bere se vždycky. */
  | "cilova"
  /** Registr velikost neuvádí — bere se jen na vyžádání. */
  | "bez_velikosti"
  /** Do 24 zaměstnanců — do kampaně se neberou automaticky, majitel je může přibrat vlastní volbou. */
  | "mikro"
  /** Zadrželo síto (blacklist, bytový dům, partner, vlastní jídelna). */
  | "sito";

/** Firma tak, jak ji třídění potřebuje vidět. Podmnožina `Firma` z aplikace. */
export interface FirmaProTrideni {
  ico: string;
  nazev: string;
  velikost_kategorie: string | null;
  cz_nace: readonly string[];
  pravni_forma: string | null;
  ma_vlastni_jidelnu: boolean | null;
}

export interface Kandidat {
  ico: string;
  nazev: string;
  kosik: Kosik;
  /** Vyplněné jen u koše `sito` — jinak `null`. */
  duvod: Neoslovovat | null;
}

export interface VstupTrideni {
  firmy: readonly FirmaProTrideni[];
  /** IČO firem ležících ve vybraných oblastech, sjednocená. */
  vUzemi: ReadonlySet<string>;
  /**
   * IČO, která v kampani už jsou — **včetně ručně vyřazených**. Ta se
   * doplněním nevzkřísí (`on conflict do nothing`), takže mezi čekající
   * nepatří. Pro plnění se předává prázdná množina.
   */
  jizVKampani: ReadonlySet<string>;
  sito: {
    partnerskaIca: ReadonlySet<string>;
    blacklist: readonly Pravidlo[];
  };
}

/**
 * Roztřídí firmy z území podle toho, proč (ne)patří do kampaně.
 *
 * Pořadí rozhodování je podstatné: **síto má přednost před velikostí.** Firma
 * na blacklistu se nemá objevit mezi čekajícími ani omylem, i kdyby byla
 * sebevětší.
 */
export function roztridKandidaty(vstup: VstupTrideni): Kandidat[] {
  const kandidati: Kandidat[] = [];

  for (const f of vstup.firmy) {
    if (!vstup.vUzemi.has(f.ico)) continue;
    if (vstup.jizVKampani.has(f.ico)) continue;

    const duvod = duvodNeoslovovat({
      ico: f.ico,
      nazev: f.nazev,
      czNace: f.cz_nace,
      pravniForma: f.pravni_forma,
      maVlastniJidelnu: f.ma_vlastni_jidelnu,
      partnerskaIca: vstup.sito.partnerskaIca,
      blacklist: vstup.sito.blacklist,
    });
    if (duvod) {
      kandidati.push({ ico: f.ico, nazev: f.nazev, kosik: "sito", duvod });
      continue;
    }

    const kosik: Kosik =
      f.velikost_kategorie === "mikro"
        ? "mikro"
        : f.velikost_kategorie === "stredni" || f.velikost_kategorie === "korporat"
          ? "cilova"
          : "bez_velikosti";

    kandidati.push({ ico: f.ico, nazev: f.nazev, kosik, duvod: null });
  }

  return kandidati;
}

/** Počty firem po koších. Koš `sito` se nepočítá — ty nečekají, ty nepatří. */
export interface PocetKosu {
  cilova: number;
  bezVelikosti: number;
  mikro: number;
}

export function spoctiKose(kandidati: readonly Kandidat[]): PocetKosu {
  const p: PocetKosu = { cilova: 0, bezVelikosti: 0, mikro: 0 };
  for (const k of kandidati) {
    if (k.kosik === "cilova") p.cilova++;
    else if (k.kosik === "bez_velikosti") p.bezVelikosti++;
    else if (k.kosik === "mikro") p.mikro++;
  }
  return p;
}
