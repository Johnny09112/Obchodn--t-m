/**
 * Drobná čeština pro věty, které aplikace skládá z čísel.
 *
 * Čistý modul bez závislostí — sdílí ho aplikace i příkazová řádka.
 * Není to knihovna na skloňování: pokrývá jen tvary, které se v projektu
 * opravdu vyskytnou, a u zbytku volí bezpečnou variantu.
 */

/**
 * Český tvar podle počtu: 1 oblast · 2–4 oblasti · 5+ oblastí.
 *
 * Od dvaceti výš se chová jako pět a víc („21 oblastí"). Je to schválně
 * jednodušší než plné české skloňování — pro počty v přehledu to stačí
 * a složitější pravidlo by tu nikdo neuhlídal.
 */
export function cesky(n: number, jedna: string, dve: string, pet: string): string {
  if (n === 1) return jedna;
  if (n >= 2 && n <= 4) return dve;
  return pet;
}

/**
 * „z" nebo „ze" před číslovkou — podle toho, jak se čte, ne jak se píše.
 *
 * „1 ze 3 oblastí" se čte „ze tří", proto „ze". U „5" se čte „z pěti".
 * Číslice to nenapoví, takže je tu prostě seznam těch, které v kampani
 * reálně padnou v úvahu; u ostatních je „z" — je běžnější a nikdy nezní
 * jako chyba.
 */
export function zZe(n: number): string {
  const ze = new Set([2, 3, 4, 6, 7, 100]);
  return ze.has(n) ? "ze" : "z";
}
