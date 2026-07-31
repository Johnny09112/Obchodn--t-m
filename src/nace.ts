/**
 * Práce s kódy CZ-NACE. **Čistý modul — nesmí sem přijít nic z databáze.**
 *
 * Sdílí ho i webová aplikace (přes `sito.ts`), a ta se do databáze dostává
 * jinudy. Jediný import z `db.ts` by sem přitáhl ovladače Postgresu, které
 * v prohlížeči nedávají smysl a při sestavení aplikace chybí.
 */

/**
 * Normalizace CZ-NACE na dvoumístný oddíl.
 *
 * Rejstřík vrací kódy v různých úrovních: sekce písmenem („G"), oddíl („55")
 * i celý kód („43120"). Sekce se zahazuje — nese příliš hrubou informaci.
 */
export function oddilZNace(nace: string): string | null {
  const cislice = nace.trim().replace(/\D/g, "");
  return cislice.length >= 2 ? cislice.slice(0, 2) : null;
}
