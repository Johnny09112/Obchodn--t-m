/**
 * Oblast hledání — kruh nebo nakreslený tvar.
 *
 * Proč nestačí kruh: usekne sousední město v půlce a zvětšení poloměru
 * nabere na druhé straně, co nemá. Majitel potřebuje tvar natažený jedním
 * směrem (rozhodnutí 2026-07-28).
 *
 * **Proč se to počítá tady a ne v databázi:** sdílený Postgres by uměl
 * PostGIS, ale testy běží nad PGlite, která ho nemá — dotaz opřený o PostGIS
 * by rozbil `npm test` bez sítě. Tvar se proto ukládá jako obyčejná data
 * a bod se testuje v kódu. Při našich objemech (celá ČR = 35 tisíc firem
 * nad 25 zaměstnanců) je to otázka milisekund a chová se to na obou
 * databázích stejně.
 */
import { vzdalenostM, type Bod } from "./geo.js";

export interface Oblast {
  typ: "kruh" | "polygon";
  /** Jen u kruhu. */
  stred?: Bod;
  /** Jen u kruhu. */
  polomerM?: number;
  /** Jen u polygonu — vrcholy v pořadí, jak se kreslily. */
  body?: Bod[];
}

/**
 * Leží bod uvnitř oblasti?
 *
 * Hranice patří dovnitř. Bez toho by firma přesně na okraji zóny padala
 * jednou dovnitř a jednou ven podle zaokrouhlení.
 */
export function bodVOblasti(oblast: Oblast, bod: Bod): boolean {
  if (oblast.typ === "kruh") {
    if (!oblast.stred || oblast.polomerM === undefined) return false;
    return vzdalenostM(oblast.stred, bod) <= oblast.polomerM;
  }
  const body = oblast.body ?? [];
  // Dvě úsečky plochu neohraničí.
  if (body.length < 3) return false;
  return vPolygonu(body, bod);
}

/**
 * Ray casting: z bodu se vede polopřímka na východ a počítají se průsečíky
 * s hranami. Lichý počet = uvnitř.
 *
 * Zvládne i konkávní tvary (písmeno L), kde naivní postupy selhávají —
 * a právě konkávní tvary majitel potřebuje. Nezáleží ani na tom, kterým
 * směrem se polygon kreslil.
 */
function vPolygonu(body: readonly Bod[], bod: Bod): boolean {
  let uvnitr = false;
  for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
    const a = body[i]!;
    const b = body[j]!;

    // Leží bod přímo na hraně? Pak patří dovnitř, ať vyjde cokoli dál.
    if (naUsecce(a, b, bod)) return true;

    const protina =
      a.lat > bod.lat !== b.lat > bod.lat &&
      bod.lng < ((b.lng - a.lng) * (bod.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (protina) uvnitr = !uvnitr;
  }
  return uvnitr;
}

/** Leží bod na úsečce a–b (s tolerancí na zaokrouhlení souřadnic)? */
function naUsecce(a: Bod, b: Bod, bod: Bod): boolean {
  const TOLERANCE = 1e-9;
  const vektorovySoucin =
    (bod.lat - a.lat) * (b.lng - a.lng) - (bod.lng - a.lng) * (b.lat - a.lat);
  if (Math.abs(vektorovySoucin) > TOLERANCE) return false;

  return (
    Math.min(a.lat, b.lat) - TOLERANCE <= bod.lat &&
    bod.lat <= Math.max(a.lat, b.lat) + TOLERANCE &&
    Math.min(a.lng, b.lng) - TOLERANCE <= bod.lng &&
    bod.lng <= Math.max(a.lng, b.lng) + TOLERANCE
  );
}
