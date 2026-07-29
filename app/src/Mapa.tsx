import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Oblast } from "../../src/oblast-tvar";
import type { Bod } from "../../src/geo";
import type { Firma, Jidelna } from "./data";
import type { Vrstva } from "./vrstvy";

export type Rezim = "prohlizeni" | "kruh" | "polygon";

interface Props {
  firmy: Firma[];
  jidelny: Jidelna[];
  /** Uložené oblasti zapnuté v mapě, každá svou barvou. */
  vrstvy: Vrstva[];
  /** Tvar, který se právě kreslí nebo upravuje. */
  navrh: Oblast | null;
  /** IČO firem uvnitř návrhu — obarví se jinak než zbytek. */
  uvnitr: ReadonlySet<string>;
  /** IČO firem ve víc oblastech zároveň — podle TP-5 je to chyba k opravě. */
  vPrekryvu: ReadonlySet<string>;
  rezim: Rezim;
  onKlikDoMapy: (bod: Bod) => void;
  onPosunVrcholu: (index: number, bod: Bod) => void;
  onKlikNaVrstvu: (id: string) => void;
  /** Střed a přiblížení při prvním vykreslení. */
  vychozi: { stred: Bod; zoom: number };
}

/**
 * Mapa se drží mimo React — Leaflet si vrstvy spravuje sám a překreslovat
 * je přes React by znamenalo bourat a stavět značky při každém pohybu myší.
 * React tu jen říká, co se má změnit; kresbu dělá Leaflet.
 */
export function Mapa({
  firmy,
  jidelny,
  vrstvy,
  navrh,
  uvnitr,
  vPrekryvu,
  rezim,
  onKlikDoMapy,
  onPosunVrcholu,
  onKlikNaVrstvu,
  vychozi,
}: Props) {
  const obal = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const vrstvaOblasti = useRef<L.LayerGroup | null>(null);
  const vrstvaFirem = useRef<L.LayerGroup | null>(null);
  const vrstvaJidelen = useRef<L.LayerGroup | null>(null);
  const vrstvaTvaru = useRef<L.LayerGroup | null>(null);

  // Obsluhy drží aktuální hodnoty, aniž by se kvůli nim mapa zakládala znovu.
  const klik = useRef(onKlikDoMapy);
  klik.current = onKlikDoMapy;
  const posun = useRef(onPosunVrcholu);
  posun.current = onPosunVrcholu;
  const klikVrstva = useRef(onKlikNaVrstvu);
  klikVrstva.current = onKlikNaVrstvu;

  // ── založení mapy (jednou)
  useEffect(() => {
    if (!obal.current || mapa.current) return;

    // Kolečko myši nechává mapu na pokoji, dokud se do ní neklikne. Jinak
    // by se stránka nedala projet — nad mapou by se místo posouvání
    // přibližovalo a čtenář by uvízl uprostřed.
    // Přiblížení patří vpravo — vlevo nahoře stojí panel s ovládáním tvaru.
    const m = L.map(obal.current, { zoomControl: false, scrollWheelZoom: false }).setView(
      [vychozi.stred.lat, vychozi.stred.lng],
      vychozi.zoom,
    );
    // Vlevo nahoře stojí panel s ovládáním tvaru, vpravo nahoře seznam vrstev.
    L.control.zoom({ position: "bottomright" }).addTo(m);
    m.on("click", () => m.scrollWheelZoom.enable());
    m.on("mouseout", () => m.scrollWheelZoom.disable());
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(m);

    // Pořadí zakládání určuje, co leží navrchu: uložené oblasti vespod,
    // nad nimi firmy a jídelny, úplně nahoře kreslený tvar s úchyty.
    vrstvaOblasti.current = L.layerGroup().addTo(m);
    vrstvaFirem.current = L.layerGroup().addTo(m);
    vrstvaJidelen.current = L.layerGroup().addTo(m);
    vrstvaTvaru.current = L.layerGroup().addTo(m);
    m.on("click", (e) => klik.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapa.current = m;

    return () => {
      m.remove();
      mapa.current = null;
    };
    // Výchozí pohled se použije jen při založení — pak mapu řídí uživatel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── uložené oblasti zapnuté v mapě
  useEffect(() => {
    const v = vrstvaOblasti.current;
    if (!v) return;
    v.clearLayers();
    for (const vr of vrstvy) {
      const styl = {
        color: vr.barva,
        weight: 2,
        fillColor: vr.barva,
        // Nízká výplň schválně: kde se dvě oblasti překryjí, ztmavne to
        // a překryv je vidět i bez čtení čísel.
        fillOpacity: 0.1,
      };
      const tvar =
        vr.oblast.typ === "kruh" && vr.oblast.stred && vr.oblast.polomerM !== undefined
          ? L.circle([vr.oblast.stred.lat, vr.oblast.stred.lng], {
              ...styl,
              radius: vr.oblast.polomerM,
            })
          : L.polygon(
              (vr.oblast.body ?? []).map((b) => [b.lat, b.lng] as [number, number]),
              styl,
            );
      tvar
        .bindTooltip(`${vr.nazev} — ${vr.firmy.size} firem`)
        .on("click", (e) => {
          // Bez tohohle by klik do oblasti zároveň přidal bod kreslenému tvaru.
          L.DomEvent.stopPropagation(e);
          klikVrstva.current(vr.id);
        })
        .addTo(v);
    }
  }, [vrstvy]);

  // ── firmy
  useEffect(() => {
    const v = vrstvaFirem.current;
    if (!v) return;
    v.clearLayers();
    for (const f of firmy) {
      if (f.lat === null || f.lng === null) continue;
      const je = uvnitr.has(f.ico);

      // Firma ve víc oblastech zároveň dostane výstražný kroužek — podle
      // TP-5 na ni smí odejít jen jedno oslovení, takže je to k opravě.
      if (vPrekryvu.has(f.ico)) {
        L.circleMarker([f.lat, f.lng], {
          radius: 9,
          color: "#8e3b2c",
          weight: 2,
          dashArray: "3 2",
          fill: false,
        })
          .bindTooltip(`${f.nazev} — leží ve víc oblastech`)
          .addTo(v);
      }

      // Firmy mimo tvar musí být vidět — na zelenomodrém podkladu mapy
      // světlá šeď mizí. Zůstávají ale zřetelně druhé v pořadí.
      L.circleMarker([f.lat, f.lng], {
        radius: je ? 5.5 : 4,
        color: je ? "#2e4a7d" : "#454f48",
        weight: je ? 1.5 : 1,
        fillColor: je ? "#2e4a7d" : "#7d8a80",
        fillOpacity: je ? 0.9 : 0.8,
      })
        .bindTooltip(
          `${f.nazev}${f.obec ? ` · ${f.obec}` : ""}${
            f.zamestnanci_odhad ? ` · ${f.zamestnanci_odhad} zam.` : ""
          }`,
        )
        .addTo(v);
    }
  }, [firmy, uvnitr, vPrekryvu]);

  // ── jídelny
  useEffect(() => {
    const v = vrstvaJidelen.current;
    if (!v) return;
    v.clearLayers();
    for (const j of jidelny) {
      if (j.lat === null || j.lng === null) continue;
      L.marker([j.lat, j.lng], {
        icon: L.divIcon({ className: "znacka-jidelny", html: "", iconSize: [14, 14] }),
        keyboard: false,
      })
        .bindTooltip(`Jídelna ${j.nazev}`)
        .addTo(v);
    }
  }, [jidelny]);

  // ── kreslený tvar a jeho úchyty
  useEffect(() => {
    const v = vrstvaTvaru.current;
    if (!v) return;
    v.clearLayers();
    if (!navrh) return;

    if (navrh.typ === "kruh" && navrh.stred && navrh.polomerM !== undefined) {
      L.circle([navrh.stred.lat, navrh.stred.lng], {
        radius: navrh.polomerM,
        color: "#2e4a7d",
        weight: 2,
        fillColor: "#2e4a7d",
        fillOpacity: 0.07,
      }).addTo(v);
      L.marker([navrh.stred.lat, navrh.stred.lng], {
        icon: L.divIcon({ className: "uchyt uchyt-stred", html: "", iconSize: [12, 12] }),
        draggable: true,
      })
        .on("drag", (e) => {
          const p = (e.target as L.Marker).getLatLng();
          posun.current(0, { lat: p.lat, lng: p.lng });
        })
        .addTo(v);
      return;
    }

    const body = navrh.body ?? [];
    if (body.length >= 2) {
      const cara = body.map((b) => [b.lat, b.lng] as [number, number]);
      // Dokud nejsou tři body, plocha neexistuje — kresli jen čáru.
      if (body.length >= 3) {
        L.polygon(cara, {
          color: "#2e4a7d",
          weight: 2,
          fillColor: "#2e4a7d",
          fillOpacity: 0.07,
        }).addTo(v);
      } else {
        L.polyline(cara, { color: "#2e4a7d", weight: 2, dashArray: "4 4" }).addTo(v);
      }
    }
    body.forEach((b, i) => {
      L.marker([b.lat, b.lng], {
        icon: L.divIcon({ className: "uchyt", html: "", iconSize: [11, 11] }),
        draggable: true,
      })
        .on("drag", (e) => {
          const p = (e.target as L.Marker).getLatLng();
          posun.current(i, { lat: p.lat, lng: p.lng });
        })
        .addTo(v);
    });
  }, [navrh]);

  // ── kurzor podle toho, co klik udělá
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    m.getContainer().style.cursor = rezim === "prohlizeni" ? "" : "crosshair";
  }, [rezim]);

  return <div className="mapa" ref={obal} />;
}
