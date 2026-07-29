import { bodVOblasti, type Oblast } from "../../src/oblast-tvar";
import type { Firma, RadekOblasti } from "./data";

/**
 * Barvy pro rozlišení oblastí v mapě.
 *
 * Vybrané tak, aby se daly rozeznat na podkladu OpenStreetMap (zeleň, voda,
 * silnice) a mezi sebou i při barvosleposti — proto se nesází na dvojici
 * červená/zelená a každá oblast má navíc jmenovku v seznamu.
 */
const BARVY = [
  "#2e4a7d", // razítková modř
  "#9a6f0e", // hořčice
  "#1f6f6b", // tyrkys
  "#7a3b8f", // švestka
  "#8e3b2c", // cihla
  "#4a6b1f", // olivová
  "#2b6ca3", // světlá modř
  "#a33b6b", // purpur
];

export function barvaOblasti(poradi: number): string {
  return BARVY[poradi % BARVY.length]!;
}

export function naOblast(r: RadekOblasti): Oblast {
  return r.typ === "kruh"
    ? {
        typ: "kruh",
        stred: { lat: Number(r.stred_lat), lng: Number(r.stred_lng) },
        polomerM: Number(r.polomer_m),
      }
    : { typ: "polygon", body: r.body ?? [] };
}

export interface Vrstva {
  id: string;
  nazev: string;
  oblast: Oblast;
  barva: string;
  /** IČO firem, které do oblasti spadají. */
  firmy: Set<string>;
}

/**
 * Spočítá, které firmy spadají do kterých zobrazených oblastí.
 *
 * Počítá se jen pro zobrazené oblasti — se stovkami uložených oblastí by
 * procházet všechny znamenalo statisíce zbytečných testů při každém
 * překreslení.
 */
export function spoctiVrstvy(
  oblasti: RadekOblasti[],
  zobrazene: ReadonlySet<string>,
  firmy: Firma[],
): Vrstva[] {
  return oblasti
    .map((r, i) => ({ r, barva: barvaOblasti(i) }))
    .filter(({ r }) => zobrazene.has(r.id))
    .map(({ r, barva }) => {
      const oblast = naOblast(r);
      const uvnitr = new Set<string>();
      for (const f of firmy) {
        if (f.lat === null || f.lng === null) continue;
        if (bodVOblasti(oblast, { lat: f.lat, lng: f.lng })) uvnitr.add(f.ico);
      }
      return { id: r.id, nazev: r.nazev, oblast, barva, firmy: uvnitr };
    });
}

export interface Prekryv {
  /** IČO firem, které leží ve víc než jedné zobrazené oblasti. */
  firmy: Set<string>;
  /** Dvojice oblastí, které se o firmy dělí — od největšího průniku. */
  dvojice: Array<{ a: string; b: string; pocet: number }>;
}

/**
 * Najde firmy, které spadají do víc oblastí zároveň.
 *
 * Není to jen zajímavost. Tvrdé pravidlo TP-5 dovoluje na jednu firmu jedno
 * iniciační oslovení — firma ve dvou kampaních naráz je tedy chyba, kterou
 * je potřeba vidět dřív, než se kampaň spustí, ne až podle stížnosti.
 */
export function najdiPrekryv(vrstvy: Vrstva[]): Prekryv {
  const kolikrat = new Map<string, number>();
  for (const v of vrstvy) {
    for (const ico of v.firmy) kolikrat.set(ico, (kolikrat.get(ico) ?? 0) + 1);
  }
  const firmy = new Set([...kolikrat].filter(([, n]) => n > 1).map(([ico]) => ico));

  const dvojice: Prekryv["dvojice"] = [];
  for (let i = 0; i < vrstvy.length; i++) {
    for (let j = i + 1; j < vrstvy.length; j++) {
      const a = vrstvy[i]!;
      const b = vrstvy[j]!;
      let pocet = 0;
      for (const ico of a.firmy) if (b.firmy.has(ico)) pocet++;
      if (pocet > 0) dvojice.push({ a: a.nazev, b: b.nazev, pocet });
    }
  }
  dvojice.sort((x, y) => y.pocet - x.pocet);

  return { firmy, dvojice };
}
