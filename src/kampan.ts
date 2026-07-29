/**
 * Kampaň — pojmenovaný seznam firem s vlastním kontextem.
 *
 * **Není to rozesílka.** SPEC kap. 10.2 kampaňový režim zrušil; kampaň je
 * seznam práce, ze kterého ve fázi 3 odchází oslovení po jedné firmě.
 * V tomto modulu proto nikdy nesmí přibýt nic, co skládá nebo odesílá zprávy.
 */
import type { Db } from "./db.js";
import { prepocitejOblastFirmy } from "./oblast.js";

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

export interface FirmaVKampani {
  ico: string;
  nazev: string;
  obec: string | null;
  stav: "vybrana" | "vyrazena";
  duvodVyrazeni: string | null;
  kontaktu: number;
  skore: number | null;
}

/**
 * Doplní do kampaně firmy, které leží v její oblasti.
 *
 * **Ručně vyřazené firmy se nevzkřísí** — `on conflict do nothing`. Bez toho
 * by každé doplnění vrátilo zpátky všechno, co člověk vyhodil, a rozhodnutí
 * by tiše mizela.
 *
 * Příslušnost se před vložením přepočítá, aby se nevycházelo ze zastaralého
 * seznamu.
 */
export async function naplnZOblasti(
  db: Db,
  kampanId: string,
): Promise<{ pridano: number; jizBylo: number }> {
  const k = await nactiKampan(db, kampanId);
  if (!k?.oblastId) return { pridano: 0, jizBylo: 0 };

  await prepocitejOblastFirmy(db, k.oblastId);

  const pred = await pocetRadku(db, kampanId);
  await db.query(
    `insert into kampan_firmy (kampan_id, ico)
     select $1, of.ico from oblast_firmy of where of.oblast_id = $2
     on conflict (kampan_id, ico) do nothing`,
    [kampanId, k.oblastId],
  );
  const po = await pocetRadku(db, kampanId);
  return { pridano: po - pred, jizBylo: pred };
}

async function pocetRadku(db: Db, kampanId: string): Promise<number> {
  const r = await db.query<{ pocet: number }>(
    "select count(*)::int as pocet from kampan_firmy where kampan_id = $1",
    [kampanId],
  );
  return r[0]?.pocet ?? 0;
}

/** Vyřadí firmu z kampaně. Důvod je povinný — bez něj se pravidla nebrousí. */
export async function vyradFirmu(
  db: Db,
  kampanId: string,
  ico: string,
  duvod: string,
): Promise<void> {
  if (!duvod.trim()) throw new Error("Vyřazení firmy potřebuje důvod.");
  await db.query(
    `update kampan_firmy set stav = 'vyrazena', duvod_vyrazeni = $1
     where kampan_id = $2 and ico = $3`,
    [duvod.trim(), kampanId, ico],
  );
}

export async function firmyKampane(db: Db, kampanId: string): Promise<FirmaVKampani[]> {
  return db.query<FirmaVKampani>(
    `select kf.ico, c.nazev, c.obec, kf.stav,
            kf.duvod_vyrazeni as "duvodVyrazeni", c.skore,
            (select count(*)::int from contacts k where k.ico = kf.ico) as kontaktu
     from kampan_firmy kf
     join companies c on c.ico = kf.ico
     where kf.kampan_id = $1
     order by c.skore desc nulls last`,
    [kampanId],
  );
}

/**
 * Kam se z kterého stavu smí.
 *
 * `bezi` a `uzavrena` nemají žádnou příchozí cestu schválně — jsou
 * v číselníku kvůli fázi 3, ale kód fáze 0–2 do nich nepustí (TP-8).
 */
export const PRECHODY: Record<StavKampane, readonly StavKampane[]> = {
  rozpracovana: ["ceka_na_pruzkum", "k_posouzeni", "zrusena"],
  ceka_na_pruzkum: ["k_posouzeni", "zrusena"],
  k_posouzeni: ["schvalena", "ceka_na_pruzkum", "zrusena"],
  schvalena: ["zrusena"],
  bezi: [],
  uzavrena: [],
  zrusena: [],
};

/**
 * Změní stav kampaně. Nepovolený přechod skončí výjimkou.
 *
 * Podmínky schválení (průzkum doběhl, aspoň jedna firma s kontaktem) hlídá
 * navíc spoušť v databázi — tady jsou proto jen kvůli srozumitelné hlášce,
 * ne jako jediná pojistka.
 */
export async function zmenStav(
  db: Db,
  kampanId: string,
  novy: StavKampane,
  duvod?: string,
): Promise<void> {
  const k = await nactiKampan(db, kampanId);
  if (!k) throw new Error("Kampaň neexistuje.");

  if (!PRECHODY[k.stav].includes(novy)) {
    throw new Error(`Z „${k.stav}" nejde přejít do „${novy}".`);
  }
  if (novy === "zrusena" && !duvod?.trim()) {
    throw new Error("Zrušení kampaně potřebuje důvod.");
  }

  await db.query("update kampane set stav = $1, duvod_zruseni = $2 where id = $3", [
    novy,
    novy === "zrusena" ? duvod!.trim() : k.duvodZruseni,
    kampanId,
  ]);
}
