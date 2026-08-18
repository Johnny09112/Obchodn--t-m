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
): string {
  const podleKodu = new Map(nastaveni.map((n) => [n.kod, n]));
  const zData = hodnotyZDat(podklady);

  let telo = kostra;
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
