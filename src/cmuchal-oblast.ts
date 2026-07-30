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
  if (!deps.registr) throw new Error("Průzkum oblasti se bez registru ČSÚ neobejde.");

  // Objednávku je potřeba rozběhnout hned: `selhalPruzkum` i `dokoncPruzkum`
  // přijmou jen tu, která běží, a bez toho by se neúspěch neměl kam zapsat.
  await zahajPruzkum(deps.db, pruzkumId);

  const nalez = await obceVOblasti(deps.geokoder, o.oblast, {
    krokM: opts.krokM ?? KROK_MRIZKY_M,
  });

  // Žádný bod se nedohledal — to není prázdná krajina, to je nedostupná
  // služba. Prohlásit průzkum za hotový by zamlčelo chybu.
  if (nalez.bodu > 0 && nalez.nedohledano === nalez.bodu) {
    await selhalPruzkum(
      deps.db,
      pruzkumId,
      "Zpětné dohledání obcí neodpovědělo ani u jednoho bodu — služba je nejspíš nedostupná.",
    );
    throw new Error("Zpětné dohledání obcí selhalo u všech bodů.");
  }

  if (nalez.mista.length === 0) {
    await deps.db.query("update pruzkumy set stav = 'ceka_na_rozhodnuti' where id = $1", [
      pruzkumId,
    ]);
    return {
      obci: 0, useku: 0, kandidatu: 0,
      nedohledano: nalez.nedohledano, cekaNaRozhodnuti: true,
    };
  }

  const jednotky = await deps.registr.jednotkyPodleMist(nalez.mista);
  let poradi = 0;
  for (const j of jednotky) {
    poradi++;
    await deps.db.query(
      `insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi)
       values ($1,$2,$3,$4) on conflict (pruzkum_id, jednotka) do nothing`,
      [pruzkumId, j.jednotka, j.obec, poradi],
    );
  }

  // Odhad je zadarmo: `zamestnavateleVJednotkach` čte místní soubor
  // a nic nezaměřuje. Kolik z kandidátů se bude zaměřovat, se pozná až
  // podle toho, které z nich už kartotéka zná — to spočítá CLI.
  const kandidati = await deps.registr.zamestnavateleVJednotkach(
    jednotky.map((j) => j.jednotka),
  );

  return {
    obci: nalez.mista.length,
    useku: jednotky.length,
    kandidatu: kandidati.length,
    nedohledano: nalez.nedohledano,
    cekaNaRozhodnuti: false,
  };
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
