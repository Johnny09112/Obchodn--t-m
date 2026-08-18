/**
 * Skládání textu zprávy — **čistá funkce bez databáze**.
 *
 * Proč zvlášť od `zprava.ts`: obrazovka kampaně potřebuje ukázat tentýž
 * text, jaký složí jádro, a přitom nesmí sáhnout na nic, co se připojuje
 * k databázi (Vercel instaluje jen závislosti `app/`). Kdyby si aplikace
 * skládání opsala, vznikly by dva různé maily pod jedním jménem — a text
 * je tady ten produkt.
 *
 * Tenhle modul proto smí importovat **jen další čisté moduly**
 * (`osloveni`, `geo`, `cestina`). Žádné `db.js`, žádné dotazy.
 * Past, ze které to vzešlo: paměť „pravidlo-v-jadru-nehlida-obrazovku".
 */

import { cesky } from "./cestina.js";
import { dobaCestyMin } from "./geo.js";
import { osloveni, oznaceniFirmy } from "./osloveni.js";

export type RezimPole = "z_dat" | "pevne" | "vynechat";

export interface NastaveniPole {
  kod: string;
  rezim: RezimPole;
  hodnota: string | null;
}

/** Údaje o firmě, ze kterých se skládá text. Kdo je načte, je jeho věc. */
export interface PodkladyFirmy {
  prijmeni: string | null;
  /** Krátké označení firmy — jedno slovo opsané z jejího webu. */
  oznaceni: string | null;
  vzdalenostM: number | null;
  /** Už hotový text ceny („115 Kč" nebo „od 110 Kč"), nebo `null`. */
  cena: string | null;
  /**
   * Hodnoty parametrů té nabídky, která firmu obsluhuje — podle nich se
   * vyhodnocují podmíněné věty. Klíčem je kód parametru.
   */
  parametry: Record<string, string>;
}

/**
 * Podmínka u věty: ukaž ji, jen když parametr nabídky odpovídá.
 *
 * Váže se na **pořadí odstavce a věty**, ne na pozici znaku. Pozice se při
 * psaní posune a podmínka by pak platila pro jinou větu — čehož by si
 * nikdo nevšiml, dokud by mail neodešel.
 */
export interface PodminkaPasaze {
  odstavec: number;
  veta: number;
  parametrKod: string;
  /** `null` znamená „parametr je vyplněný", bez ohledu na hodnotu. */
  ocekavanaHodnota: string | null;
}

/** Věta končí tečkou; dělí se stejně jako při vynechávání pole. */
function naVety(odstavec: string): string[] {
  return odstavec.split(/(?<=\.)\s+/);
}

/** Platí podmínka pro tuhle firmu? */
function podminkaPlati(p: PodminkaPasaze, parametry: Record<string, string>): boolean {
  const hodnota = parametry[p.parametrKod];
  if (hodnota === undefined || hodnota === "") return false;
  if (p.ocekavanaHodnota === null) return true;

  // Výběr z možností je uložený jako JSON pole — ptáme se na obsažení.
  if (hodnota.trimStart().startsWith("[")) {
    try {
      const volby: unknown = JSON.parse(hodnota);
      return Array.isArray(volby) && volby.map(String).includes(p.ocekavanaHodnota);
    } catch {
      return false;
    }
  }
  return hodnota === p.ocekavanaHodnota;
}

/**
 * Vypustí věty, jejichž podmínka pro tuhle firmu neplatí.
 *
 * Naléhavý důvod, proč to existuje: šablona tvrdí „na místě **nebo**
 * v jídlonosičích" a jídelna, která umí jen jedno, by tím rozeslala
 * nepravdu o službě.
 */
function vypustNeplatneVety(
  telo: string,
  podminky: PodminkaPasaze[],
  parametry: Record<string, string>,
): string {
  if (podminky.length === 0) return telo;

  // Odstavce se počítají jen ty skutečné, prázdné řádky mezi nimi ne.
  // Kdo v editoru klikne na druhý odstavec, myslí druhý odstavec — ne
  // čtvrtý řádek.
  let poradi = -1;

  return telo
    .split("\n")
    .map((odstavec) => {
      if (odstavec.trim() === "") return odstavec;
      poradi += 1;
      const zdejsi = podminky.filter((p) => p.odstavec === poradi);
      if (zdejsi.length === 0) return odstavec;

      return naVety(odstavec)
        .filter((_, j) => {
          const p = zdejsi.find((x) => x.veta === j);
          return !p || podminkaPlati(p, parametry);
        })
        .join(" ")
        .trim();
    })
    .join("\n");
}

/**
 * Vzdálenost do zprávy — **časem, ne kilometry**.
 *
 * Vyžádal si majitel 18. 8. 2026 a má pravdu hned dvakrát. Za prvé:
 * adresáta zajímá, jak dlouho mu to trvá, ne kolik to měří. Za druhé,
 * a to je horší: uložená vzdálenost je **vzdušná čára**, takže napsané
 * kilometry by ani neodpovídaly tomu, co člověk ujde.
 *
 * Slovo „přibližně" tam patří: je to odhad a nemá se tvářit jinak.
 */
export function vzdalenostSlovy(metru: number): string {
  const { zpusob, minut } = dobaCestyMin(metru);
  if (zpusob === "blizko") return "pár minut pěšky";
  return `přibližně ${minut} ${cesky(minut, "minutu", "minuty", "minut")} ${
    zpusob === "pesky" ? "pěšky" : "autem"
  }`;
}

/** Čím se vyplní které pole, když je v režimu „vzít z dat". */
export function hodnotyZDat(p: PodkladyFirmy): Record<string, string | null> {
  return {
    osloveni: osloveni(p.prijmeni),
    od_vasi_firmy: oznaceniFirmy(p.oznaceni),
    vzdalenost: p.vzdalenostM != null ? vzdalenostSlovy(p.vzdalenostM) : null,
    cena: p.cena,
  };
}

/**
 * Vymaže větu, ve které stojí zástupný údaj.
 *
 * Věta je úsek mezi tečkami. Maže se celá schválně: vynechat jen číslo by
 * nechalo „Kompletní menu vychází na  s možností…", což je horší než nic.
 */
function vymazVetuS(telo: string, znacka: string): string {
  return telo
    .split("\n")
    .map((odstavec) => {
      if (!odstavec.includes(znacka)) return odstavec;
      const vety = odstavec.split(/(?<=\.)\s+/);
      return vety
        .filter((v) => !v.includes(znacka))
        .join(" ")
        .trim();
    })
    .join("\n");
}

/**
 * Složí text z kostry šablony.
 *
 * Chybějící údaj se **nevyplňuje ničím** — zástupný údaj v textu zůstane,
 * ať je na první pohled vidět, že se zpráva odeslat nedá. Tichým doplněním
 * prázdna by vznikla věta, která vypadá hotově a přitom nedává smysl.
 */
export function slozText(
  kostra: string,
  nastaveni: NastaveniPole[],
  podklady: PodkladyFirmy,
  podminky: PodminkaPasaze[] = [],
): string {
  const podleKodu = new Map(nastaveni.map((n) => [n.kod, n]));
  const zData = hodnotyZDat(podklady);

  // Nejdřív podmínky, teprve pak pole: vypuštěná věta se nemá čím vyplňovat
  // a vyplněná věta by se hůř poznávala podle pořadí.
  let telo = vypustNeplatneVety(kostra, podminky, podklady.parametry);
  for (const [, kod] of kostra.matchAll(/\[([a-z_]+)\]/g)) {
    if (kod === undefined) continue;
    const znacka = `[${kod}]`;
    const n = podleKodu.get(kod);

    if (n?.rezim === "vynechat") {
      telo = vymazVetuS(telo, znacka);
      continue;
    }
    const hodnota = n?.rezim === "pevne" ? n.hodnota : zData[kod];
    if (hodnota == null) continue;
    telo = telo.split(znacka).join(hodnota);
  }

  return telo.replace(/[ \t]+\n/g, "\n").trim();
}
