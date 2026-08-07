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
