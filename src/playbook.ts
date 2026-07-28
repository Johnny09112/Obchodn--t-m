/**
 * Co si Čmuchal odnáší z běhu do playbooku.
 *
 * Playbook má být znalost („u firem s víc provozovnami hledej podstránku
 * provozovny"), ne log. Po prvních běhech v něm bylo osm kopií téhož
 * čtyřicetiřádkového seznamu nespárovaných názvů a skutečné poznatky se
 * v tom ztratily.
 *
 * Výpis jednotlivých kandidátů sem proto nepatří — kdo přesně neprošel a
 * proč, je v tabulce `vyrazeni`, která je na to určená a dá se procházet.
 */

/**
 * Poznámky vázané na konkrétního kandidáta. Vznikají při každém běhu znovu
 * a ve stejném znění, takže by playbook jen nafukovaly.
 */
const VAZANE_NA_KANDIDATA = [
  /^nespárováno s rejstříkem:/i,
  /^polohu se nepodařilo určit:/i,
  /^vlastní jídelna mezi kandidáty:/i,
  /^agentura práce vyřazena:/i,
];

/**
 * Z poznámek běhu vybere ty, které mají cenu zapsat: obecné (ne vázané na
 * jednu firmu) a takové, které v playbooku ještě nejsou.
 */
export function novePoznatky(playbook: string, poznamky: readonly string[]): string[] {
  const vysledek: string[] = [];
  const videne = new Set<string>();

  for (const p of poznamky) {
    const text = p.trim();
    if (!text) continue;
    if (VAZANE_NA_KANDIDATA.some((v) => v.test(text))) continue;
    if (videne.has(text)) continue;
    if (playbook.includes(text)) continue;
    videne.add(text);
    vysledek.push(text);
  }
  return vysledek;
}
