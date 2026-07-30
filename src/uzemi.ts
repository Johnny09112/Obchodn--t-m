/**
 * Z nakresleného tvaru na seznam obcí.
 *
 * Registr ČSÚ hledá firmy podle územní jednotky, ne podle souřadnic — tvar
 * má naopak jen souřadnice. Tenhle modul ten překlad zajišťuje: rozseje
 * do tvaru mřížku bodů a u každého se zeptá, jaká obec na něm leží.
 */
import { bodVOblasti, type Oblast } from "./oblast-tvar.js";
import type { Bod } from "./geo.js";

/** Stupeň zeměpisné šířky má zhruba tolik metrů, všude stejně. */
const METRU_NA_STUPEN = 111_320;

/**
 * Kolik bodů musí mřížka aspoň chytit, než se přestane zjemňovat.
 *
 * Míň by neovzorkovalo úzký protáhlý tvar (třeba údolí nebo koridor podél
 * silnice) — spadl by na hrstku bodů namačkaných na jednom místě místo
 * pokrytí celé délky. Víc by zase zbytečně násobilo dotazy na mapovou
 * službu — každý bod je jeden dotaz a ta snese jeden za sekundu.
 */
const MIN_BODU = 12;

interface Obal {
  jih: number;
  sever: number;
  zapad: number;
  vychod: number;
}

function obalTvaru(oblast: Oblast): Obal {
  if (oblast.typ === "kruh") {
    if (!oblast.stred || oblast.polomerM === undefined) {
      throw new Error("Kruh bez středu nebo poloměru nemá obal.");
    }
    const dLat = oblast.polomerM / METRU_NA_STUPEN;
    const dLng =
      oblast.polomerM / (METRU_NA_STUPEN * Math.cos((oblast.stred.lat * Math.PI) / 180));
    return {
      jih: oblast.stred.lat - dLat,
      sever: oblast.stred.lat + dLat,
      zapad: oblast.stred.lng - dLng,
      vychod: oblast.stred.lng + dLng,
    };
  }
  const body = oblast.body ?? [];
  if (body.length < 3) throw new Error("Tvar s méně než třemi body neohraničí plochu.");
  return {
    jih: Math.min(...body.map((b) => b.lat)),
    sever: Math.max(...body.map((b) => b.lat)),
    zapad: Math.min(...body.map((b) => b.lng)),
    vychod: Math.max(...body.map((b) => b.lng)),
  };
}

/**
 * Body pravidelné mřížky, které leží uvnitř tvaru.
 *
 * Dokud mřížka nechytí aspoň `MIN_BODU` bodů, krok se opakovaně půlí. Nestačí
 * zastavit se u prvního nalezeného bodu — obal tvaru (obdélník) neprozradí,
 * že je tvar úzký a protáhlý (diagonální pruh má obal skoro čtvercový), takže
 * hrubý krok by z celého území vytáhl jen jeden dva náhodné body a zbytek by
 * se nikdy neprohledal. Naopak velký tvar, který má dost bodů hned napoprvé,
 * se dál nezjemňuje — nechceme násobit dotazy na mapovou službu zbytečně.
 *
 * Po vyčerpání pokusů se vrátí nejlepší dosud nalezený výsledek, i kdyby byl
 * pod `MIN_BODU` — prázdné pole je vyhrazené jen pro tvar, kde opravdu neleží
 * žádný bod mřížky ani při nejjemnějším kroku.
 */
export function mrizkaVOblasti(oblast: Oblast, krokM: number): Bod[] {
  if (!(krokM > 0)) throw new Error("Krok mřížky musí být kladný.");

  const obal = obalTvaru(oblast);
  let nejlepsi: Bod[] = [];
  // Pět zjemnění stačí: z 3 km se dostaneme pod 100 m.
  for (let pokus = 0, krok = krokM; pokus < 6; pokus++, krok /= 2) {
    const body = posbirej(oblast, obal, krok);
    if (body.length > nejlepsi.length) nejlepsi = body;
    if (body.length >= MIN_BODU) return body;
  }
  return nejlepsi;
}

function posbirej(oblast: Oblast, obal: Obal, krokM: number): Bod[] {
  const krokLat = krokM / METRU_NA_STUPEN;
  const body: Bod[] = [];

  // Začíná se od poloviny kroku, aby body nepadaly přesně na hranici tvaru.
  for (let lat = obal.jih + krokLat / 2; lat <= obal.sever; lat += krokLat) {
    // Poledníky se k pólům sbíhají, takže krok na délku závisí na šířce.
    const krokLng = krokM / (METRU_NA_STUPEN * Math.cos((lat * Math.PI) / 180));
    for (let lng = obal.zapad + krokLng / 2; lng <= obal.vychod; lng += krokLng) {
      const bod = { lat, lng };
      if (bodVOblasti(oblast, bod)) body.push(bod);
    }
  }
  return body;
}
