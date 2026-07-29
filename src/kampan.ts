/**
 * Kampaň — pojmenovaný seznam firem s vlastním kontextem.
 *
 * **Není to rozesílka.** SPEC kap. 10.2 kampaňový režim zrušil; kampaň je
 * seznam práce, ze kterého ve fázi 3 odchází oslovení po jedné firmě.
 * V tomto modulu proto nikdy nesmí přibýt nic, co skládá nebo odesílá zprávy.
 */
import type { Db } from "./db.js";

export type StavKampane =
  | "rozpracovana"
  | "ceka_na_pruzkum"
  | "k_posouzeni"
  | "schvalena"
  | "bezi"
  | "uzavrena"
  | "zrusena";

export interface Kampan {
  id: string;
  nazev: string;
  popis: string | null;
  kontext: string | null;
  spravce: string;
  oblastId: string | null;
  jidelnaId: string | null;
  stav: StavKampane;
  krok: number;
  duvodZruseni: string | null;
}

const SLOUPCE = `id, nazev, popis, kontext, spravce,
  oblast_id as "oblastId", jidelna_id as "jidelnaId",
  stav, krok, duvod_zruseni as "duvodZruseni"`;

export async function zalozKampan(
  db: Db,
  v: { nazev: string; spravce: string; popis?: string; kontext?: string },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into kampane (nazev, spravce, popis, kontext)
     values ($1,$2,$3,$4) returning id`,
    [v.nazev, v.spravce, v.popis ?? null, v.kontext ?? null],
  );
  return r[0]!.id;
}

export async function nactiKampan(db: Db, id: string): Promise<Kampan | null> {
  const r = await db.query<Kampan>(`select ${SLOUPCE} from kampane where id = $1`, [id]);
  return r[0] ?? null;
}

export async function seznamKampani(db: Db): Promise<Kampan[]> {
  return db.query<Kampan>(`select ${SLOUPCE} from kampane order by created_at desc`);
}

/**
 * Přiřadí kampani území. Jídelna je nepovinná ze stejného důvodu jako
 * u oblasti — může se doplnit až po jednání.
 */
export async function nastavUzemi(
  db: Db,
  kampanId: string,
  v: { oblastId: string; jidelnaId?: string | null },
): Promise<void> {
  await db.query(
    `update kampane set oblast_id = $1, jidelna_id = $2, krok = greatest(krok, 2)
     where id = $3`,
    [v.oblastId, v.jidelnaId ?? null, kampanId],
  );
}
