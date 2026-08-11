/**
 * Úroveň 2 — signál jako změna mezi dvěma běhy.
 *
 * Jeden obecný mechanismus místo čtečky na každý signál: kdo umí složit
 * otisk stavu, dostane zadarmo „přibylo", „změnilo se" i „zmizelo".
 * Přidat další signál tohoto druhu je pak nastavení, ne programování —
 * a právě proto náklad na údržbu roste s počtem ZDROJŮ, ne signálů.
 *
 * **Otisk je řetězec, ne struktura.** Co se má považovat za změnu,
 * rozhoduje ten, kdo otisk skládá. Kdyby to rozhodovala tahle vrstva,
 * musela by znát každý zdroj — a byla by to další kopie znalosti, která
 * se rozejde s daty.
 */
import type { Db } from "./db.js";

export interface Pozorovani {
  /** Identita sledované věci uvnitř zdroje — typicky IČO nebo kód obce. */
  klic: string;
  /** Otisk stavu. Stejný stav musí dát stejný otisk, jinak se změny vymyslí. */
  otisk: string;
}

export type DruhZmeny = "nove" | "zmeneno";

export interface Zmena {
  klic: string;
  druh: DruhZmeny;
  /** Předchozí otisk. `null` u nově viděné věci. */
  predchozi: string | null;
  otisk: string;
}

/**
 * Porovná, co zdroj vydal teď, s tím, co jsme viděli minule — a rovnou si
 * nový stav zapamatuje.
 *
 * **Co záměrně nehlásí: zmizení.** Že věc v téhle dávce není, neznamená,
 * že zanikla — může jen vypadnout z výřezu, který jsme se ptali. Rozdíl
 * mezi „zaniklo" a „neptali jsme se na to" tahle vrstva neuvidí, a tvářit
 * se, že ano, by vyrábělo falešné signály. Kdo zmizení potřebuje, musí
 * dodat úplnou dávku a vyhodnotit si to sám.
 *
 * **První běh nehlásí nic.** Kdyby hlásil, byl by při zavedení každý
 * záznam „nový" a obrazovka by se zavalila desítkami tisíc podnětů,
 * které nikdo nepřečte. Poprvé se jen zapamatuje stav.
 */
export async function porovnejAZapamatuj(
  db: Db,
  zdroj: string,
  pozorovani: readonly Pozorovani[],
): Promise<Zmena[]> {
  if (pozorovani.length === 0) return [];

  const klice = pozorovani.map((p) => p.klic);
  const stare = new Map(
    (
      await db.query<{ klic: string; otisk: string }>(
        "select klic, otisk from snimky where zdroj = $1 and klic = any($2)",
        [zdroj, klice],
      )
    ).map((r) => [r.klic, r.otisk]),
  );

  // Prázdná tabulka pro tenhle zdroj = první běh. Viz komentář výše.
  const pocty = await db.query<{ pocet: number }>(
    "select count(*)::int as pocet from snimky where zdroj = $1",
    [zdroj],
  );
  const prvniBeh = (pocty[0]?.pocet ?? 0) === 0;

  const zmeny: Zmena[] = [];
  for (const p of pozorovani) {
    const predchozi = stare.get(p.klic) ?? null;
    if (predchozi === p.otisk) continue;
    if (!prvniBeh) {
      zmeny.push({
        klic: p.klic,
        druh: predchozi === null ? "nove" : "zmeneno",
        predchozi,
        otisk: p.otisk,
      });
    }
  }

  // Zápis po jedné položce byl u přepočtu oblasti přes síť neúnosný
  // ([[zapis-po-jedne-je-lokalne-neviditelny]]) — proto jedním příkazem.
  await db.query(
    `insert into snimky (zdroj, klic, otisk, porizeno_at)
     select $1, k, o, now() from unnest($2::text[], $3::text[]) as t(k, o)
     on conflict (zdroj, klic) do update set otisk = excluded.otisk, porizeno_at = now()`,
    [zdroj, klice, pozorovani.map((p) => p.otisk)],
  );

  return zmeny;
}
