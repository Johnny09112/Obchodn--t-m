/**
 * Podklad pro rozhodnutí o velikosti zóny.
 *
 * Zóna se nastavuje ke každé oblasti zvlášť a rozhoduje o ní majitel
 * (rozhodnutí 2026-07-28): u odloučené vesnice může být větší, tam kde se
 * jídelny překrývají menší. Aby to nebylo od oka, ukážeme před rozhodnutím,
 * **kolik firem při jakém poloměru přibude**.
 *
 * Počítá se lokálně z registru ČSÚ — žádné dotazy ven.
 */
import { vzdalenostM, type Bod } from "./geo.js";
import { splnujeMinimum } from "./res.js";

export interface RadekRozboru {
  polomerM: number;
  /** Firem do tohoto poloměru včetně. */
  firem: number;
  /** O kolik víc než při nejbližším užším poloměru. */
  pribude: number;
}

/** Firma s už známou polohou — z registru samotného souřadnice nejsou. */
export interface FirmaSPolohou {
  ico: string;
  kategorieKod: string;
  lat: number;
  lng: number;
}

export function rozborZony(
  jidelna: Bod,
  firmy: readonly FirmaSPolohou[],
  opts: { polomery: number[]; minZamestnancu?: number },
): RadekRozboru[] {
  const polomery = [...new Set(opts.polomery)].sort((a, b) => a - b);

  const vzdalenosti = firmy
    .filter((f) =>
      opts.minZamestnancu === undefined
        ? true
        : splnujeMinimum(f.kategorieKod || null, opts.minZamestnancu) === true,
    )
    .map((f) => vzdalenostM(jidelna, { lat: f.lat, lng: f.lng }));

  let predchozi = 0;
  return polomery.map((polomerM) => {
    const firem = vzdalenosti.filter((m) => m <= polomerM).length;
    const radek = { polomerM, firem, pribude: firem - predchozi };
    predchozi = firem;
    return radek;
  });
}
