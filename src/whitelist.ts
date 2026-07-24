/**
 * Whitelist atributů dle SPEC kap. 5 (TP-3). Renderer i sběr smí pracovat
 * pouze s těmito atributy; cokoliv jiného se nesmí ani sbírat.
 */
export const POVOLENE_ATRIBUTY = [
  "velikost_kategorie",
  "zamestnanci_odhad",
  "ma_vlastni_jidelnu",
  "zpusob_stravovani",
  "ucel_adresy",
  "kontakt",
  "obor",
  "adresa",
] as const;

export type PovolenyAtribut = (typeof POVOLENE_ATRIBUTY)[number];

/** Atributy, které se propisují do sloupců v companies. */
export const ATRIBUTY_SLOUPCE: Partial<Record<PovolenyAtribut, string>> = {
  velikost_kategorie: "velikost_kategorie",
  zamestnanci_odhad: "zamestnanci_odhad",
  ma_vlastni_jidelnu: "ma_vlastni_jidelnu",
  zpusob_stravovani: "zpusob_stravovani",
};

export function jePovolenyAtribut(a: string): a is PovolenyAtribut {
  return (POVOLENE_ATRIBUTY as readonly string[]).includes(a);
}
