/**
 * Fronta objednávek AI průzkumu.
 *
 * Vzor je `src/fronta.ts` pro průzkum, ale s jedním rozdílem: tenhle modul
 * práci nedělá. Umí jen vybrat firmy do dávky a přepínat stavy — samotné
 * spuštění agenta je jinde (`src/cmuchal-spousteni.ts`), aby šlo v testech
 * nahradit.
 */
import type { Db } from "./db.js";

export interface Reserse {
  id: string;
  kampanId: string;
  stav: "ceka" | "bezi" | "hotovo" | "selhalo";
  firemZadano: number;
  zadani: string;
  pozadal: string;
}

export interface FirmaKReserse {
  ico: string;
  nazev: string;
  skore: number | null;
}

const SLOUPCE = `id, kampan_id as "kampanId", stav,
  firem_zadano as "firemZadano", zadani, pozadal`;

/**
 * Co si má obsluha z fronty vzít — nejstarší čekající.
 *
 * Bere i objednávky ve stavu 'bezi': v tom stavu zůstane objednávka po pádu
 * procesu a nikdo ji nečeká. Kdyby si ji fronta nevzala, visela by navždy.
 * Totéž rozhodnutí jako u průzkumu (`src/fronta.ts`).
 */
export async function dalsiReserseKVyrizeni(db: Db): Promise<Reserse | null> {
  const r = await db.query<Reserse>(
    `select ${SLOUPCE} from reserse
     where stav in ('ceka','bezi')
     order by pozadano_at
     limit 1`,
  );
  return r[0] ?? null;
}

/**
 * Firmy, které mají jít na rešerši: v kampani, NEvyřazené, bez razítka
 * `obohaceno_at`. Nejlepší napřed.
 *
 * Vyřazená firma je vyřazená i pro rešerši — vyřazení znamená „tuhle
 * neoslovovat" a dohledávat na ni kontakt je zbytečná práce (rozhodnutí
 * majitele 2026-08-04).
 */
/**
 * Kolikrát se firma zkusí, než ji fronta pustí k vodě.
 *
 * Tři pokusy proto, že jeden bývá málo (agentovi může dojít čas dřív, než
 * se k ní dostane) a pátý už nic nepřinese — u firmy bez webu a bez
 * inzerátu není co najít ani napodesáté.
 */
export const MAX_POKUSU_RESERSE = 3;

/**
 * Pravidlo výběru sedí v databázi (funkce `firmy_pro_reserse`, migrace
 * 0054) — tenhle wrapper ho jen volá.
 *
 * Proč: aplikace nabízí „objednat rešerši pro N firem" a musí počítat
 * TÝMŽ pravidlem, jinak slíbí dávku, kterou jádro po vyzvednutí vybere
 * prázdnou. Přesně to se stalo 18. 8. 2026 u Hrobců — aplikace počítala
 * jen razítko a spojení, jádro filtrovalo i stav firmy, a objednávka na
 * 20 firem skončila „hotovo, 0 firem" bez jediného slova.
 *
 * Co funkce filtruje (podrobné zdůvodnění je v migracích 0054 a 0055):
 * jen vybrané firmy kampaně, bez razítka `obohaceno_at`, méně než
 * MAX_POKUSU_RESERSE pokusů, a bez stavu `zamitnuty`.
 *
 * Firmy **čekající na jídelnu do fronty patří** — rozhodl majitel
 * 18. 8. 2026 (ruší přísnější pravidlo z 13. 8.): data se předpřipravují
 * i v oblasti bez jídelny, zastavuje se až odeslání. Ta zábrana stojí
 * v `nahled_kampane`: bez jídelny není vzdálenost ani cena, takže se
 * firma z oslovení vyřadí sama.
 */
export async function firmyProReserse(
  db: Db,
  kampanId: string,
  limit: number,
): Promise<FirmaKReserse[]> {
  return db.query<FirmaKReserse>("select ico, nazev, skore from firmy_pro_reserse($1, $2)", [
    kampanId,
    limit,
  ]);
}

/**
 * Zaznamená, že firmy dávkou prošly — **bez ohledu na to, jestli z nich
 * něco vypadlo**.
 *
 * Tohle je ten rozdíl, na kterém celá oprava stojí: `obohaceno_at` říká
 * „něco jsme zjistili", tenhle čítač říká „zkoušeli jsme to". Dokud
 * existovalo jen to první, nešlo „nenašlo se" odlišit od „nezkusilo se".
 *
 * Volá se až po doběhnutí agenta, ne před ním — kdyby běh spadl na výpadku
 * spojení, nemá se to firmám počítat jako pokus.
 */
export async function zaznamenejPokusReserse(
  db: Db,
  ica: readonly string[],
): Promise<void> {
  if (ica.length === 0) return;
  await db.query(
    `update companies
     set reserse_pokusu = reserse_pokusu + 1, reserse_naposledy_at = now()
     where ico = any($1)`,
    [ica as string[]],
  );
}

/**
 * Kolik firem v kampani vyčerpalo pokusy, aniž by se u nich cokoli našlo.
 *
 * Není to chyba — je to zpráva o území. Ale musí být vidět, jinak se
 * prázdná fronta tváří stejně jako fronta, do které se ještě nesáhlo.
 */
export async function vycerpanePokusy(db: Db, kampanId: string): Promise<number> {
  const r = await db.query<{ pocet: number }>(
    `select count(*)::int as pocet
     from kampan_firmy kf join companies c on c.ico = kf.ico
     where kf.kampan_id = $1 and kf.stav = 'vybrana'
       and c.obohaceno_at is null
       and c.reserse_pokusu >= ${MAX_POKUSU_RESERSE}`,
    [kampanId],
  );
  return r[0]?.pocet ?? 0;
}

export async function zahajReserse(db: Db, id: string, runId: string): Promise<void> {
  await db.query(
    `update reserse set stav = 'bezi', zahajeno_at = now(), run_id = $2 where id = $1`,
    [id, runId],
  );
}

export async function uzavriReserse(
  db: Db,
  id: string,
  v: { firemZpracovano: number; firemSNalezem: number },
): Promise<void> {
  await db.query(
    `update reserse set stav = 'hotovo', dokonceno_at = now(),
       firem_zpracovano = $2, firem_s_nalezem = $3
     where id = $1`,
    [id, v.firemZpracovano, v.firemSNalezem],
  );
}

export async function selhalaReserse(db: Db, id: string, chyba: string): Promise<void> {
  await db.query(
    `update reserse set stav = 'selhalo', dokonceno_at = now(), chyba = $2 where id = $1`,
    [id, chyba],
  );
}

/** Kolik z daných firem má doložené spojení (e-mail nebo telefon). */
export async function pocetSeSpojenim(db: Db, ica: readonly string[]): Promise<number> {
  if (ica.length === 0) return 0;
  const r = await db.query<{ pocet: number }>(
    `select count(distinct k.ico)::int as pocet from contacts k
     where k.ico = any($1) and (k.email is not null or k.telefon is not null)`,
    [ica as string[]],
  );
  return r[0]?.pocet ?? 0;
}

/**
 * Kolik z daných firem agent doopravdy zpracoval — má razítko
 * `obohaceno_at`, které nastaví `zapisDavku` (src/nalezy.ts) u nálezu,
 * kontaktu i položky v `bezNalezu`.
 *
 * `firmyProReserse` vybírá jen firmy s `obohaceno_at is null`, takže před
 * během nemá žádná z nich razítko — kdo ho po běhu má, toho se agent
 * doopravdy dotkl. Bez tohohle rozlišení `reserse.firem_zpracovano` tvrdilo
 * počet firem, které se agentovi jen předaly, ne kolik jich stihl — když
 * doběhl na tři z dvaceti, objednávka hlásila dvacet (nález 7 závěrečné
 * revize).
 */
export async function pocetZpracovanych(db: Db, ica: readonly string[]): Promise<number> {
  if (ica.length === 0) return 0;
  const r = await db.query<{ pocet: number }>(
    `select count(*)::int as pocet from companies
     where ico = any($1) and obohaceno_at is not null`,
    [ica as string[]],
  );
  return r[0]?.pocet ?? 0;
}
