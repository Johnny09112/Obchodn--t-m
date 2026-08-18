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

/**
 * Oklika: skutečná trasa je delší než vzdušná čára.
 *
 * Uložená `vzdalenost_m` je haversine, tedy jak letí vrána. V zástavbě se
 * takhle nechodí — ulice zahýbají, koleje a řeky se obcházejí. Přirážka
 * třetiny je střízlivý odhad běžný v dopravním plánování; **schválně se
 * přidává, ne ubírá**, protože slíbit kratší cestu, než jaká je, je
 * drobná nepravda hned v první větě oslovení.
 */
const OKLIKA = 1.3;

/** Chůze 80 m/min (≈4,8 km/h) — pomalejší tempo, ať to není přehnané. */
const CHUZE_M_ZA_MIN = 80;

/** Jízda městem 25 km/h včetně křižovatek a parkování. */
const JIZDA_M_ZA_MIN = 25_000 / 60;

/** Nad dva kilometry trasy už nikdo pěšky na oběd nechodí. */
const PESKY_DO_M = 2000;

/** Pod tuhle hranici se čas neuvádí — „pár minut" je pravdivější než číslo. */
const BLIZKO_DO_M = 400;

export interface DobaCesty {
  zpusob: "blizko" | "pesky" | "autem";
  /** Zaokrouhleno nahoru na pětiminutovky. U „blizko" nemá význam. */
  minut: number;
}

/**
 * Jak dlouho trvá cesta z firmy do jídelny, v podobě, která smí do zprávy.
 *
 * Vyžádal si majitel 18. 8. 2026: místo vzdálenosti časový údaj po pěti
 * minutách, do dvou kilometrů pěšky, dál autem.
 */
export function dobaCestyMin(vzdusnaM: number): DobaCesty {
  const trasa = vzdusnaM * OKLIKA;
  if (trasa <= BLIZKO_DO_M) return { zpusob: "blizko", minut: 0 };

  const pesky = trasa <= PESKY_DO_M;
  const minut = trasa / (pesky ? CHUZE_M_ZA_MIN : JIZDA_M_ZA_MIN);
  return { zpusob: pesky ? "pesky" : "autem", minut: Math.ceil(minut / 5) * 5 };
}
