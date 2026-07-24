export interface Bod {
  lat: number;
  lng: number;
}

const R_ZEME_M = 6_371_000;

/** Haversine vzdálenost v metrech, zaokrouhlená na celé metry. */
export function vzdalenostM(a: Bod, b: Bod): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R_ZEME_M * Math.asin(Math.sqrt(h)));
}

/** Doba chůze při 80 m/min (≈4,8 km/h), zaokrouhleno nahoru. */
export function dobaChuzeMin(metru: number): number {
  return Math.ceil(metru / 80);
}

export type Zona = "pesi" | "dojezd" | "mimo";

/** Pěší dosah ≤ 800 m, krátký dojezd ≤ zóna jídelny, jinak mimo (SPEC kap. 2). */
export function klasifikujZonu(metru: number, zonaMetru: number): Zona {
  if (metru <= 800) return "pesi";
  if (metru <= zonaMetru) return "dojezd";
  return "mimo";
}
