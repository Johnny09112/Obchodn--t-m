/**
 * Zařazení firmy do kategorie podle zaměření.
 *
 * Členění je **data, ne kód** (rozhodnutí majitele 2026-07-28): aplikace má
 * být použitelná i pro jiná odvětví než jídelny, takže kategorie i převod
 * z oborů se dají upravit v databázi bez zásahu do programu.
 *
 * Převádí se přes dvoumístný oddíl CZ-NACE. Rejstřík míchá délky kódů —
 * chodí „25", „2561" i „25610", někdy jen písmeno sekce („G") — takže se
 * z každého kódu bere první dvojčíslí a písmena se ignorují.
 */
import type { Db } from "./db.js";

/** Kam spadne obor, který se nepodařilo zařadit. Nikdy ne prázdno. */
export const OSTATNI = "ostatni";

/** oddíl CZ-NACE („25") → kód kategorie („vyroba") */
export type PrevodNace = ReadonlyMap<string, string>;

export async function nactiPrevod(db: Db): Promise<PrevodNace> {
  const r = await db.query<{ nace_oddil: string; kategorie_kod: string }>(
    "select nace_oddil, kategorie_kod from kategorie_nace",
  );
  return new Map(r.map((x) => [x.nace_oddil, x.kategorie_kod]));
}

/** Dvoumístný oddíl z kódu libovolné délky. Písmeno sekce oddíl nemá. */
export function oddilZNace(nace: string): string | null {
  const cislice = nace.trim().replace(/\D/g, "");
  return cislice.length >= 2 ? cislice.slice(0, 2) : null;
}

/**
 * Kategorie pro firmu. Firma má často víc oborů; rozhoduje **první, který
 * se podaří zařadit** — v rejstříku bývá převažující činnost první.
 */
export function kategorieProNace(prevod: PrevodNace, czNace: readonly string[]): string {
  for (const nace of czNace) {
    const oddil = oddilZNace(nace);
    if (!oddil) continue;
    const kategorie = prevod.get(oddil);
    if (kategorie) return kategorie;
  }
  return OSTATNI;
}

export interface VysledekZarazeni {
  zarazeno: number;
  /** Obory, které skončily v „ostatních" — podklad pro dobroušení členění. */
  vOstatnich: Array<{ oddil: string; pocet: number }>;
}

/**
 * Doplní kategorii ke všem firmám. Opakovatelné.
 *
 * Vrací i rozpad toho, co spadlo do „ostatních" — bez něj by se nedalo
 * poznat, že členění někde nesedí, a firmy by tam tiše mizely.
 */
export async function priradKategorie(db: Db): Promise<VysledekZarazeni> {
  const prevod = await nactiPrevod(db);
  const firmy = await db.query<{ ico: string; cz_nace: string[] | null }>(
    "select ico, cz_nace from companies",
  );

  const ostatni = new Map<string, number>();
  let zarazeno = 0;

  for (const f of firmy) {
    const nace = f.cz_nace ?? [];
    const kategorie = kategorieProNace(prevod, nace);
    await db.query("update companies set kategorie = $1 where ico = $2", [kategorie, f.ico]);
    zarazeno++;

    if (kategorie === OSTATNI) {
      for (const n of nace) {
        const oddil = oddilZNace(n);
        if (oddil) {
          ostatni.set(oddil, (ostatni.get(oddil) ?? 0) + 1);
          break; // počítáme firmu jednou, podle prvního použitelného kódu
        }
      }
    }
  }

  return {
    zarazeno,
    vOstatnich: [...ostatni.entries()]
      .map(([oddil, pocet]) => ({ oddil, pocet }))
      .sort((a, b) => b.pocet - a.pocet),
  };
}
