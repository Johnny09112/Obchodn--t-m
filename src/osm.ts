/**
 * OpenStreetMap přes Overpass API — zdroj **fyzických pracovišť** v zóně.
 *
 * Doplňuje díru, kterou ARES neumí zaplnit: najde provozy, kanceláře, hotely,
 * obchody a ordinace stojící v okolí jídelny bez ohledu na to, kde má jejich
 * firma zapsané sídlo. Zdarma a bez klíče.
 *
 * Gotchy ověřené v praxi: hlavní server často vrací 504, proto se zkouší
 * zrcadlo; příliš široký dotaz spadne na timeout; povinný je slušný
 * User-Agent s kontaktem.
 */
import type { Bod } from "./geo.js";

const SERVERY = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

/** Značky, které označují místo, kde lidé pracují. */
const HLEDANE_ZNACKY = [
  '"office"',
  '"craft"',
  '"industrial"',
  '"man_made"="works"',
  '"landuse"="industrial"',
  '"building"="industrial"',
  '"shop"',
  '"tourism"~"^(hotel|guest_house)$"',
  '"amenity"~"^(school|kindergarten|nursing_home|clinic|hospital|doctors|pharmacy|restaurant|cafe|bank|post_office|townhall)$"',
];

export function sestavDotaz(stred: Bod, radiusM: number): string {
  const okolo = `around:${radiusM},${stred.lat},${stred.lng}`;
  const casti = HLEDANE_ZNACKY.map((z) => `  nwr(${okolo})[${z}];`).join("\n");
  return `[out:json][timeout:50];\n(\n${casti}\n);\nout center tags 400;`;
}

export interface OsmPracoviste {
  nazev: string;
  druh: string;
  lat: number;
  lng: number;
  /** Odkaz na konkrétní prvek — použitelný jako zdroj do evidence (TP-2). */
  zdrojUrl: string;
}

export interface OverpassOdpoved {
  elements?: Array<{
    type?: string;
    id?: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }>;
}

/** Značky, které samy o sobě pracoviště neznamenají (bydlení apod.). */
const NEZAJIMAVE_BUILDING = new Set(["apartments", "house", "residential", "detached", "yes"]);

export function zajimavePracoviste(data: OverpassOdpoved): OsmPracoviste[] {
  const vysledek: OsmPracoviste[] = [];
  for (const e of data.elements ?? []) {
    const t = e.tags ?? {};
    const nazev = t.name;
    // Bez názvu se prvek nedá spárovat s rejstříkem — přeskočit.
    if (!nazev) continue;

    const druh =
      t.office ?? t.craft ?? t.industrial ?? t.man_made ?? t.shop ?? t.tourism ??
      t.amenity ?? t.landuse ??
      (t.building && !NEZAJIMAVE_BUILDING.has(t.building) ? t.building : undefined);
    if (!druh) continue;

    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (lat === undefined || lng === undefined) continue;

    vysledek.push({
      nazev,
      druh,
      lat,
      lng,
      zdrojUrl: `https://www.openstreetmap.org/${e.type ?? "node"}/${e.id ?? 0}`,
    });
  }
  return vysledek;
}

export interface OsmKlient {
  najdiPracoviste(stred: Bod, radiusM: number): Promise<OsmPracoviste[]>;
}

export interface OsmKlientOpts {
  fetchFn?: typeof fetch;
  prodlevaMs?: number;
  kontakt?: string;
}

export function vytvorOsmKlienta(opts: OsmKlientOpts = {}): OsmKlient {
  const fetchFn = opts.fetchFn ?? fetch;
  const prodlevaMs = opts.prodlevaMs ?? 1000;
  const kontakt = opts.kontakt ?? process.env.NOMINATIM_CONTACT ?? "";

  return {
    async najdiPracoviste(stred, radiusM) {
      const dotaz = sestavDotaz(stred, radiusM);
      const chyby: string[] = [];

      for (const server of SERVERY) {
        try {
          const res = await fetchFn(server, {
            method: "POST",
            headers: {
              "content-type": "text/plain",
              "User-Agent": `cantinero-cmuchal/0.1 (${kontakt})`,
            },
            body: dotaz,
          });
          if (!res.ok) {
            chyby.push(`${server}: HTTP ${res.status}`);
            if (prodlevaMs) await new Promise((r) => setTimeout(r, prodlevaMs));
            continue;
          }
          return zajimavePracoviste((await res.json()) as OverpassOdpoved);
        } catch (e) {
          chyby.push(`${server}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      throw new Error(`Overpass nedostupný — ${chyby.join("; ")}`);
    },
  };
}
