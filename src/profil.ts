/**
 * Profil projektu — koho vlastně hledáme.
 *
 * Registr subjektů je jeden a společný pro všechny projekty; drží se celý
 * offline a nic se z něj nezahazuje. Profil řídí jen to, na koho se vynaloží
 * **drahá práce**: ověření v rejstříku, zaměření adresy (1 dotaz za vteřinu)
 * a rešerše kontaktů.
 *
 * Proč to není v kódu: Cantinero restaurace vyřazuje (vaří si samy),
 * Cantinero Business na ně naopak míří. Stejný stroj, opačné zadání —
 * a přepnout se to musí bez zásahu do programu (rozhodnutí 2026-07-28).
 */
import type { Db } from "./db.js";
import { oddilZNace } from "./kategorie.js";

export interface Profil {
  kod: string;
  nazev: string;
  popis: string | null;
  /** NULL = velikost neposuzovat. U restaurací dává smysl i malý podnik. */
  minZamestnancu: number | null;
  /** Právní formy, které se z registru vůbec berou. */
  formy: ReadonlySet<string>;
  /** Prázdné = „všechny obory". Neprázdné = „jen tyhle". */
  jenObory: ReadonlySet<string>;
  /** Obory, které neprojdou nikdy. Uplatní se i na seznam „jen tyhle". */
  vylouceneObory: ReadonlySet<string>;
}

export interface PolozkaSeznamu {
  kod: string;
  nazev: string;
  popis: string | null;
  aktivni: boolean;
}

/** Načte profil podle kódu, nebo ten právě aktivní. */
export async function nactiProfil(db: Db, kod?: string): Promise<Profil> {
  const r = await db.query<{
    kod: string; nazev: string; popis: string | null; min_zamestnancu: number | null;
  }>(
    kod
      ? "select kod, nazev, popis, min_zamestnancu from profily where kod = $1"
      : "select kod, nazev, popis, min_zamestnancu from profily where aktivni",
    kod ? [kod] : [],
  );
  const p = r[0];
  if (!p) throw new Error(`Profil ${kod ?? "(aktivní)"} databáze nezná`);

  const formy = await db.query<{ pravni_forma: string }>(
    "select pravni_forma from profil_formy where profil_kod = $1",
    [p.kod],
  );
  const obory = await db.query<{ smer: string; nace_oddil: string }>(
    "select smer, nace_oddil from profil_obory where profil_kod = $1",
    [p.kod],
  );

  return {
    kod: p.kod,
    nazev: p.nazev,
    popis: p.popis,
    minZamestnancu: p.min_zamestnancu,
    formy: new Set(formy.map((f) => f.pravni_forma)),
    jenObory: new Set(obory.filter((o) => o.smer === "ano").map((o) => o.nace_oddil)),
    vylouceneObory: new Set(obory.filter((o) => o.smer === "ne").map((o) => o.nace_oddil)),
  };
}

export async function seznamProfilu(db: Db): Promise<PolozkaSeznamu[]> {
  return db.query<PolozkaSeznamu>(
    "select kod, nazev, popis, aktivni from profily order by created_at",
  );
}

/** Přepne aktivní profil. Aktivní je vždy právě jeden. */
export async function zvolProfil(db: Db, kod: string): Promise<void> {
  const je = await db.query("select 1 from profily where kod = $1", [kod]);
  if (je.length === 0) throw new Error(`Profil ${kod} databáze nezná`);
  await db.query("update profily set aktivni = false where aktivni");
  await db.query("update profily set aktivni = true where kod = $1", [kod]);
}

/**
 * Projde firma s těmito obory profilem?
 *
 * Vyloučení váží víc než povolení: **stačí jediný vyloučený obor a firma
 * neprojde.** Firma jich mívá víc a restaurace, která má vedle toho zapsaný
 * i obchod, je pořád restaurace.
 *
 * Naopak u seznamu „jen tyhle" stačí jediná shoda — jinak by neprošel
 * nikdo, kdo má vedle hlavní činnosti i něco navíc.
 */
export function oborProchazi(profil: Profil, czNace: readonly string[]): boolean {
  const oddily = czNace
    .map(oddilZNace)
    .filter((o): o is string => o !== null);

  if (oddily.some((o) => profil.vylouceneObory.has(o))) return false;
  if (profil.jenObory.size === 0) return true;
  return oddily.some((o) => profil.jenObory.has(o));
}
