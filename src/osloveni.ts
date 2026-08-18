/**
 * České oslovení z příjmení.
 *
 * **Skloňuje se jen tam, kde je pravidlo jednoznačné.** Oslovit někoho
 * špatně skloňovaným jménem je horší než ho neoslovit jménem vůbec —
 * „Dobrý den," je vždycky správně, „pane Drnče" nemusí být. A oslovení
 * je první věta prvního dopisu, takže chyba v něm zahodí celý zbytek.
 *
 * **Rod se pozná jedině z příjmení** (-ová/-á). Podle křestního jména se
 * neurčuje: spletený rod je horší chyba než obecný pozdrav, a jména jako
 * Nikola nebo René ho spolehlivě neurčí.
 *
 * Rozhodl majitel 18. 8. 2026, že chybějící jméno firmu z kampaně
 * nevyřazuje — mail se pošle s „Dobrý den," (paměť
 * „jedna-sablona-a-uplnost-blokuje").
 */

/**
 * Souhlásky, u kterých je vokativ na -e spolehlivý: Bayer → Bayere,
 * Redl → Redle, Florian → Floriane.
 *
 * Chybí tu schválně `k`, `g`, `h`, `ch` (vokativ na -u a s alternací)
 * a všechny měkké (`c`, `č`, `ž`, `š`, `ř`, `j`) — tam se tvar nedá
 * uhodnout bez slovníku.
 */
const NA_E = ["r", "l", "n", "m", "s", "z", "d", "t", "p", "b", "v", "f"];

/** Zakončení, u kterých vokativ vyžaduje vypadávání nebo alternaci hlásky. */
const NEJISTE = /(ek|ěk|ec|ce|k|g|h|ch|c|č|ž|š|ř|j)$/u;

export const OBECNE_OSLOVENI = "Dobrý den,";

/** Vrací celý řádek oslovení včetně čárky. */
export function osloveni(prijmeni: string | null): string {
  const p = (prijmeni ?? "").trim();

  // Kratší než dvě písmena nebo bez jediného písmene není příjmení.
  if (p.length < 2 || !/\p{L}/u.test(p)) return OBECNE_OSLOVENI;
  // Zkratky právní formy a podobné zbytky ze scrapování.
  if (p.includes(".")) return OBECNE_OSLOVENI;

  // Ženské příjmení: -ová i -á se v oslovení nemění.
  if (/(ová|á)$/u.test(p)) return `Vážená paní ${p},`;

  // Přídavné jméno mužského rodu — vokativ je stejný jako první pád.
  if (/(ý|í)$/u.test(p)) return `Vážený pane ${p},`;

  // Mužské příjmení na -a: Procházka → Procházko. Pravidlo bez výjimek.
  if (/a$/u.test(p)) return `Vážený pane ${p.slice(0, -1)}o,`;

  if (NEJISTE.test(p)) return OBECNE_OSLOVENI;

  const posledni = p.slice(-1).toLowerCase();
  if (NA_E.includes(posledni)) return `Vážený pane ${p}e,`;

  return OBECNE_OSLOVENI;
}
