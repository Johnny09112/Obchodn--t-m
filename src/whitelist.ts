/**
 * Atributy, které smějí do ZPRÁVY (SPEC kap. 5.2, TP-3).
 *
 * **Neomezuje sběr.** Co se smí o firmě zjišťovat, určuje profil produktu
 * nad rejstříkem `atributy` (ADR 0002, dvě vrstvy). Tenhle seznam musí
 * odpovídat atributům s `do_zpravy = true`; hlídá to test v
 * `test/atributy.test.ts`.
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
export const ATRIBUTY_SLOUPCE: Record<string, string> = {
  velikost_kategorie: "velikost_kategorie",
  zamestnanci_odhad: "zamestnanci_odhad",
  ma_vlastni_jidelnu: "ma_vlastni_jidelnu",
  zpusob_stravovani: "zpusob_stravovani",
  web: "web",
};
