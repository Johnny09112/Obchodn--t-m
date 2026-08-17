/**
 * Výběr vzorku firem k ruční kontrole kvality (SPEC kap. 12, fáze 1).
 *
 * Metriku „podíl chybných záznamů" nespočítá žádný dotaz — musí ji změřit
 * člověk, který si údaj otevře a porovná se zdrojem. Tenhle soubor řeší
 * jedinou, ale podstatnou část: **koho mu předložit**.
 *
 * Bez závislostí na databázi, ať jde otestovat i použít z aplikace.
 */

export interface FirmaVzorku {
  ico: string;
  nazev: string;
  velikost_kategorie: string | null;
  /** Kolik má firma kontaktů, přes které jde oslovit. */
  spojeni: number;
}

/**
 * Vybere různorodý vzorek — **ne prvních N**.
 *
 * Kdyby se bralo prvních třicet, dostal by kontrolor samé mikropodniky se
 * spojením (těch je v kartotéce nejvíc) a změřil by kvalitu jediného
 * případu. Vzorek se proto skládá po skupinách: velikost × má/nemá spojení.
 * Z každé skupiny se bere poměrně, ale **každá zastoupená skupina dostane
 * aspoň jedno místo** — i ta o třech firmách, protože právě v okrajových
 * skupinách bývají chyby.
 *
 * Výběr je opakovatelný (bez náhody): dvakrát spuštěný nad stejnými daty dá
 * stejný vzorek. Kontrola se tak dá zopakovat a porovnat.
 */
export function vyberVzorek(firmy: readonly FirmaVzorku[], pocet: number): FirmaVzorku[] {
  if (firmy.length === 0 || pocet <= 0) return [];
  if (firmy.length <= pocet) return [...firmy];

  const skupiny = new Map<string, FirmaVzorku[]>();
  for (const f of firmy) {
    const klic = `${f.velikost_kategorie ?? "nezname"}|${f.spojeni > 0 ? "spojeni" : "bez"}`;
    const s = skupiny.get(klic);
    if (s) s.push(f);
    else skupiny.set(klic, [f]);
  }

  // Uvnitř skupiny se řadí podle IČO — jen aby byl výběr opakovatelný.
  // Pořadí skupin taky, jinak by vzorek závisel na pořadí řádků z databáze.
  const serazene = [...skupiny.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([klic, s]) => [klic, [...s].sort((x, y) => x.ico.localeCompare(y.ico))] as const);

  const vybrano: FirmaVzorku[] = [];
  const kurzory = new Map<string, number>();

  // Kolo za kolem po jedné z každé skupiny. Malá skupina dojde a přeskočí se,
  // velká dodá zbytek — tím vznikne poměrné zastoupení bez počítání kvót.
  let pridanoVKole = true;
  while (vybrano.length < pocet && pridanoVKole) {
    pridanoVKole = false;
    for (const [klic, skupina] of serazene) {
      if (vybrano.length >= pocet) break;
      const kde = kurzory.get(klic) ?? 0;
      if (kde >= skupina.length) continue;
      vybrano.push(skupina[kde]!);
      kurzory.set(klic, kde + 1);
      pridanoVKole = true;
    }
  }

  return vybrano;
}
