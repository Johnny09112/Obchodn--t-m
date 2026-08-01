/**
 * Oblast hledání — kruh nebo nakreslený tvar, uložený v databázi.
 *
 * Proč nestačí kruh: usekne sousední město v půlce a zvětšení poloměru
 * nabere na druhé straně, co nemá. Majitel potřebuje tvar natažený jedním
 * směrem (rozhodnutí 2026-07-28).
 *
 * Samotný tvar a test „leží bod uvnitř?" jsou v `oblast-tvar.ts` — bez
 * vazby na databázi, aby totéž mohla počítat i webová aplikace při kreslení.
 * Odtud se re-exportují, takže zbytek projektu je bere dál tady.
 */
import type { Db } from "./db.js";
import { vzdalenostM, type Bod } from "./geo.js";
import { bodVOblasti, type Oblast } from "./oblast-tvar.js";

export { bodVOblasti };
export type { Oblast };

// ───────────────────────────────────────────────────────── uložené oblasti

export interface UlozenaOblast {
  id: string;
  nazev: string;
  oblast: Oblast;
  /** Nepovinné — oblast smí existovat dřív než jídelna. */
  jidelnaId: string | null;
  poznamka: string | null;
}

interface RadekOblasti {
  id: string;
  nazev: string;
  typ: "kruh" | "polygon";
  stred_lat: number | null;
  stred_lng: number | null;
  polomer_m: number | null;
  body: Bod[] | null;
  jidelna_id: string | null;
  poznamka: string | null;
}

function naOblast(r: RadekOblasti): UlozenaOblast {
  return {
    id: r.id,
    nazev: r.nazev,
    jidelnaId: r.jidelna_id,
    poznamka: r.poznamka,
    oblast:
      r.typ === "kruh"
        ? {
            typ: "kruh",
            stred: { lat: Number(r.stred_lat), lng: Number(r.stred_lng) },
            polomerM: Number(r.polomer_m),
          }
        : { typ: "polygon", body: r.body ?? [] },
  };
}

/** Založí oblast. Jídelna je nepovinná — to je celý smysl obráceného postupu. */
export async function zalozOblast(
  db: Db,
  v: { nazev: string; oblast: Oblast; jidelnaId?: string; poznamka?: string },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into oblasti (nazev, typ, stred_lat, stred_lng, polomer_m, body,
                          jidelna_id, poznamka)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [
      v.nazev,
      v.oblast.typ,
      v.oblast.stred?.lat ?? null,
      v.oblast.stred?.lng ?? null,
      v.oblast.polomerM ?? null,
      v.oblast.body ? JSON.stringify(v.oblast.body) : null,
      v.jidelnaId ?? null,
      v.poznamka ?? null,
    ],
  );
  return r[0]!.id;
}

export async function nactiOblast(db: Db, id: string): Promise<UlozenaOblast | null> {
  const r = await db.query<RadekOblasti>(
    `select id, nazev, typ, stred_lat::float8 as stred_lat,
            stred_lng::float8 as stred_lng, polomer_m, body, jidelna_id, poznamka
     from oblasti where id = $1`,
    [id],
  );
  return r[0] ? naOblast(r[0]) : null;
}

export async function seznamOblasti(db: Db): Promise<UlozenaOblast[]> {
  const r = await db.query<RadekOblasti>(
    `select id, nazev, typ, stred_lat::float8 as stred_lat,
            stred_lng::float8 as stred_lng, polomer_m, body, jidelna_id, poznamka
     from oblasti order by created_at desc`,
  );
  return r.map(naOblast);
}

/** Přiřadí oblasti jídelnu — typicky až po jednání, kvůli kterému vznikla. */
export async function prirad(db: Db, oblastId: string, jidelnaId: string): Promise<void> {
  await db.query("update oblasti set jidelna_id = $1 where id = $2", [jidelnaId, oblastId]);
}

/**
 * Přepočte, které firmy do oblasti spadají. Vrací jejich počet.
 *
 * Počítá se v kódu, ne v databázi — viz úvodní komentář souboru.
 * Volá se znovu po každé úpravě tvaru, takže nejdřív smaže starý výsledek:
 * po zúžení oblasti musí firmy zmizet, ne zůstat.
 */
export async function prepocitejOblastFirmy(db: Db, oblastId: string): Promise<number> {
  const o = await nactiOblast(db, oblastId);
  if (!o) return 0;

  const firmy = await db.query<{ ico: string; lat: number; lng: number }>(
    `select ico, lat::float8 as lat, lng::float8 as lng
     from companies where lat is not null and lng is not null`,
  );

  await db.query("delete from oblast_firmy where oblast_id = $1", [oblastId]);

  const uvnitr: { ico: string; vzdalenost: number | null }[] = [];
  for (const f of firmy) {
    const bod = { lat: f.lat, lng: f.lng };
    if (!bodVOblasti(o.oblast, bod)) continue;
    // Vzdálenost dává smysl jen u kruhu; u nakresleného tvaru není od čeho.
    uvnitr.push({
      ico: f.ico,
      vzdalenost: o.oblast.stred ? vzdalenostM(o.oblast.stred, bod) : null,
    });
  }

  // Po dávkách, ne po jedné firmě. Na PGlite je to jedno — běží v procesu —
  // ale proti vzdálené databázi je každý zápis jedna cesta tam a zpět, takže
  // 12 762 firem Plzně znamenalo 12 762 cest a přepočet trval minuty.
  for (let i = 0; i < uvnitr.length; i += DAVKA) {
    const davka = uvnitr.slice(i, i + DAVKA);
    await db.query(
      `insert into oblast_firmy (oblast_id, ico, vzdalenost_m)
       values ${mistaVDavce(davka.length)}`,
      [oblastId, ...davka.flatMap((r) => [r.ico, r.vzdalenost])],
    );
  }
  return uvnitr.length;
}

/** Kolik řádků najednou. Tři parametry na řádek, strop Postgresu je 65535. */
const DAVKA = 500;

/**
 * Místa parametrů pro jednu dávku: `($1,$2,$3),($1,$4,$5)…`
 *
 * `$1` je oblast, stejná pro celou dávku; každý řádek si bere další dvojici.
 */
export function mistaVDavce(radku: number): string {
  const kusy: string[] = [];
  for (let i = 0; i < radku; i++) kusy.push(`($1,$${i * 2 + 2},$${i * 2 + 3})`);
  return kusy.join(",");
}

export interface FirmaVOblasti {
  ico: string;
  nazev: string;
  vzdalenostM: number | null;
  skore: number | null;
  velikostKategorie: string | null;
}

export async function firmyVOblasti(db: Db, oblastId: string): Promise<FirmaVOblasti[]> {
  return db.query<FirmaVOblasti>(
    `select c.ico, c.nazev, of.vzdalenost_m as "vzdalenostM", c.skore,
            c.velikost_kategorie as "velikostKategorie"
     from oblast_firmy of
     join companies c on c.ico = of.ico
     where of.oblast_id = $1
     order by c.skore desc nulls last`,
    [oblastId],
  );
}
