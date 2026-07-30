/**
 * Průzkum nakresleného území.
 *
 * Vlastní soubor, aby `cmuchal.ts` (už dnes velký) dál nerostl. Sdílí s ním
 * filtry, ověření v ARES i zápis kandidáta.
 *
 * **Oblast nepřiřazuje firmu k jídelně** — firmy se ukládají s prázdnou
 * jídelnou a o přiřazení rozhoduje vzdálenost, což je samostatná funkce.
 */
import type { CmuchalDeps } from "./cmuchal.js";
import { nactiOblast } from "./oblast.js";
import { selhalPruzkum, zahajPruzkum } from "./pruzkum.js";
import { obceVOblasti, KROK_MRIZKY_M } from "./uzemi.js";

export interface Rozhled {
  obci: number;
  useku: number;
  /** Kolik firem v těch jednotkách registr zná. */
  kandidatu: number;
  /** Kolik bodů mřížky se nepodařilo dohledat. */
  nedohledano: number;
  /** Objednávka čeká na rozhodnutí člověka (tvar nezabírá žádnou obec). */
  cekaNaRozhodnuti: boolean;
}

export async function rozhlednuti(
  deps: CmuchalDeps,
  pruzkumId: string,
  opts: { krokM?: number } = {},
): Promise<Rozhled> {
  const p = await nactiPruzkum(deps.db, pruzkumId);
  const o = await nactiOblast(deps.db, p.oblastId);
  if (!o) throw new Error("Oblast průzkumu neexistuje.");
  const registr = deps.registr;
  if (!registr) throw new Error("Průzkum oblasti se bez registru ČSÚ neobejde.");

  // Objednávku je potřeba rozběhnout hned: `selhalPruzkum` i `dokoncPruzkum`
  // přijmou jen tu, která běží, a bez toho by se neúspěch neměl kam zapsat.
  await zahajPruzkum(deps.db, pruzkumId);

  try {
    const nalez = await obceVOblasti(deps.geokoder, o.oblast, {
      krokM: opts.krokM ?? KROK_MRIZKY_M,
    });

    // Prázdný seznam míst je legitimní odpověď, ať byly nedohledané všechny
    // body mřížky, nebo jen některé — `geokoder.zpetne` vrací `null`, když
    // na daném bodě prostě žádná obec není (odloučená fabrika uprostřed
    // pole), a to je stejně platný výsledek jako nalezená obec. Rozdíl proti
    // mrtvé mapové službě dělá výjimka, ne počet nedohledaných bodů —
    // skutečný geokodér (src/geocode.ts) při selhání služby vyhazuje chybu,
    // ne `null`. Tu chytá `catch` níž.
    if (nalez.mista.length === 0) {
      await deps.db.query("update pruzkumy set stav = 'ceka_na_rozhodnuti' where id = $1", [
        pruzkumId,
      ]);
      return {
        obci: 0, useku: 0, kandidatu: 0,
        nedohledano: nalez.nedohledano, cekaNaRozhodnuti: true,
      };
    }

    const jednotky = await registr.jednotkyPodleMist(nalez.mista);
    let poradi = 0;
    for (const j of jednotky) {
      poradi++;
      await deps.db.query(
        `insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi)
         values ($1,$2,$3,$4) on conflict (pruzkum_id, jednotka) do nothing`,
        [pruzkumId, j.jednotka, j.obec, poradi],
      );
    }

    // Odhad nic nezaměřuje, ale zadarmo taky není úplně: `jednotkyPodleMist`
    // o pár řádků výš a `zamestnavateleVJednotkach` tady každá streamují
    // celý místní soubor registru zvlášť, takže se čte dvakrát. Bez sítě to
    // nic neváží a před několikahodinovým sběrem se to vědomě nechává
    // neoptimalizované.
    const kandidati = await registr.zamestnavateleVJednotkach(
      jednotky.map((j) => j.jednotka),
    );

    return {
      obci: nalez.mista.length,
      useku: jednotky.length,
      kandidatu: kandidati.length,
      nedohledano: nalez.nedohledano,
      cekaNaRozhodnuti: false,
    };
  } catch (chyba) {
    // Výjimka odsud znamená selhání služby (Nominatim nebo registr ČSÚ), ne
    // prázdnou krajinu — tu ohlašuje `mista.length === 0` výš, ne throw. Bez
    // tohohle odchycení by objednávka zůstala navždy trčet ve stavu 'bezi'
    // a kampaň, která na ni čeká, by se nedala nikdy schválit.
    const popis = chyba instanceof Error ? chyba.message : String(chyba);
    await selhalPruzkum(deps.db, pruzkumId, `Rozhlédnutí selhalo: ${popis}`);
    throw chyba;
  }
}

async function nactiPruzkum(db: CmuchalDeps["db"], id: string) {
  const r = await db.query<{ oblastId: string }>(
    `select oblast_id as "oblastId" from pruzkumy where id = $1`,
    [id],
  );
  const p = r[0];
  if (!p) throw new Error("Objednávka průzkumu neexistuje.");
  return p;
}
