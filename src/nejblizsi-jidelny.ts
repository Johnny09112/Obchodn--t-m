/**
 * Které jídelny má firma na dosah a jak daleko.
 *
 * Bez závislostí na databázi — počítá se v prohlížeči nad seznamem jídelen,
 * který aplikace stejně načítá. Jídelen je pět, dotaz navíc by byl zbytečný.
 * Tenhle soubor importuje aplikace přímo, proto sem nesmí přibýt import
 * `db.ts` (Vercel instaluje jen závislosti `app/`).
 *
 * Vyžádal si to majitel 17. 8. 2026: v detailu firmy chtěl vidět pět
 * nejbližších jídelen do 50 km, a když žádná není, ať to obrazovka řekne
 * nahlas místo prázdna.
 */

import { vzdalenostM } from "./geo.js";
import type { StavJidelny } from "./kapacita.js";

export interface JidelnaKOkoli {
  id: string;
  nazev: string;
  obec: string | null;
  /** `null` = jídelnu nikdo neumístil na mapu; počítat s ní nejde. */
  lat: number | null;
  lng: number | null;
  zona_metru: number;
  stav: StavJidelny;
  aktivni: boolean;
}

export interface JidelnaVOkoli {
  id: string;
  nazev: string;
  obec: string | null;
  /** Vzdušná vzdálenost v metrech. */
  metru: number;
  stav: StavJidelny;
  /** Leží firma uvnitř zóny jídelny? Uvnitř zóny se dá rozvážet. */
  vZone: boolean;
}

/** Padesát kilometrů — dál už jídelna firmě nic nenabídne. */
const DOSAH_M = 50_000;
const KOLIK = 5;

export function nejblizsiJidelny(
  firma: { lat: number | null; lng: number | null },
  jidelny: readonly JidelnaKOkoli[],
  moznosti: { limit?: number; dosahM?: number } = {},
): JidelnaVOkoli[] {
  const { limit = KOLIK, dosahM = DOSAH_M } = moznosti;

  // Bez souřadnic firmy se vzdálenost spočítat nedá. Vrátit „žádná jídelna
  // v okolí" by ale lhalo — to je jiná odpověď než „nevíme kde firma je".
  // Rozlišit je musí obrazovka; tady prostě není co počítat.
  if (firma.lat === null || firma.lng === null) return [];

  const odkud = { lat: firma.lat, lng: firma.lng };

  return jidelny
    .filter((j) => j.aktivni && j.lat !== null && j.lng !== null)
    .map((j) => ({
      id: j.id,
      nazev: j.nazev,
      obec: j.obec,
      metru: vzdalenostM(odkud, { lat: j.lat!, lng: j.lng! }),
      stav: j.stav,
      vZone: vzdalenostM(odkud, { lat: j.lat!, lng: j.lng! }) <= j.zona_metru,
    }))
    .filter((j) => j.metru <= dosahM)
    .sort((a, b) => a.metru - b.metru)
    .slice(0, limit);
}

/** Vzdálenost pro člověka: metry pod kilometr, jinak kilometry na desetinu. */
export function popisVzdalenosti(metru: number): string {
  if (metru < 1000) return `${metru} m`;
  return `${(metru / 1000).toFixed(1).replace(".", ",")} km`;
}
