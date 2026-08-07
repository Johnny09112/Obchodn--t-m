/**
 * Rejstřík atributů — co se o firmě smí vědět.
 *
 * Zdroj pravdy je tabulka `atributy`, ne kód. `src/whitelist.ts` zůstává
 * jako seznam pro **zprávu** (SPEC kap. 5.2, příznak `do_zpravy`), ale
 * o tom, co se smí **sbírat**, už nerozhoduje — to určuje profil produktu.
 */
import type { Db } from "./db.js";

export interface Atribut {
  kod: string;
  nazev: string;
  /** Co se u atributu hledá. Jde rovnou agentovi do zadání. */
  popis: string;
  doZpravy: boolean;
  /** Hledá tenhle atribut agent na webu? (viz `atributy.hleda_agent`) */
  hledaAgent: boolean;
}

export async function nactiAtributy(db: Db): Promise<Atribut[]> {
  return db.query<Atribut>(
    `select kod, nazev, popis, do_zpravy as "doZpravy", hleda_agent as "hledaAgent"
     from atributy order by kod`,
  );
}

export async function jeZnamyAtribut(db: Db, kod: string): Promise<boolean> {
  const r = await db.query<{ pocet: number }>(
    "select count(*)::int as pocet from atributy where kod = $1",
    [kod],
  );
  return (r[0]?.pocet ?? 0) > 0;
}

/**
 * Atributy, které daný profil o firmě zjišťuje.
 *
 * Návratový typ je `Atribut`, který od úkolu 2 obsahuje `hledaAgent` — musí
 * se tedy načítat i tady, ne jen `kod, nazev, popis, do_zpravy`. Bez toho by
 * bylo `hledaAgent` vždy `undefined`, filtr v úkolu 4 by vyházel všechno
 * a ostrá dávka by doběhla s nulou (rozhodnutí k briefu, viz report).
 */
export async function nactiAtributyProfilu(db: Db, profilKod: string): Promise<Atribut[]> {
  return db.query<Atribut>(
    `select a.kod, a.nazev, a.popis, a.do_zpravy as "doZpravy", a.hleda_agent as "hledaAgent"
     from profil_atributy pa
     join atributy a on a.kod = pa.atribut_kod
     where pa.profil_kod = $1
     order by a.kod`,
    [profilKod],
  );
}

/**
 * Globálně aktivní profil (`profily where aktivni`).
 *
 * Slouží jako výchozí branch tam, kde volající nezadá profil výslovně —
 * NIKDY se nepadá na celý rejstřík atributů. Kdyby se to spletlo, atribut
 * zavedený mimo profily by se začal hledat u všech firem přes
 * `k-obohaceni` bez parametrů (přesně příkaz z playbooku Čmuchala).
 */
export async function aktivniProfilKod(db: Db): Promise<string> {
  const r = await db.query<{ kod: string }>("select kod from profily where aktivni");
  const kod = r[0]?.kod;
  if (!kod) throw new Error("Žádný profil není aktivní — nastav ho: profil zvol <kod>.");
  return kod;
}

/**
 * Profil kampaně, nebo globálně aktivní, když kampaň žádný nemá.
 *
 * Rešerše bere profil odsud — běží uvnitř kampaně. Sběr naopak zůstává na
 * globálním profilu, protože běží nad územím, kde kampaň ještě není.
 */
export async function profilProKampan(db: Db, kampanId: string): Promise<string> {
  const r = await db.query<{ kod: string }>(
    `select coalesce(k.profil_kod, (select kod from profily where aktivni)) as kod
     from kampane k where k.id = $1`,
    [kampanId],
  );
  const kod = r[0]?.kod;
  if (!kod) throw new Error(`Kampaň ${kampanId} nemá profil a žádný není aktivní.`);
  return kod;
}
