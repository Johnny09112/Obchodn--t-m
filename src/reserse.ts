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
export async function firmyProReserse(
  db: Db,
  kampanId: string,
  limit: number,
): Promise<FirmaKReserse[]> {
  return db.query<FirmaKReserse>(
    `select c.ico, c.nazev, c.skore
     from kampan_firmy kf
     join companies c on c.ico = kf.ico
     where kf.kampan_id = $1
       and kf.stav = 'vybrana'
       and c.obohaceno_at is null
     order by c.skore desc nulls last, c.ico
     limit $2`,
    [kampanId, limit],
  );
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
