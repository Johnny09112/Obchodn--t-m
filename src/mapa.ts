import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Db } from "./db.js";
import { soucetKapacit, type StavJidelny } from "./kapacita.js";

/**
 * Vygeneruje statickou HTML mapu z aktuálního obsahu kartotéky.
 *
 * Záměrně statický soubor, ne server: otevře se dvojklikem, funguje offline
 * kromě mapových dlaždic a dá se poslat kolegovi. Při sdílené databázi si
 * ho každý vygeneruje sám ze stejných dat.
 */

export interface MapaJidelna {
  id: string;
  nazev: string;
  adresa: string;
  lat: number;
  lng: number;
  zona_metru: number;
  kapacita_volna: number | null;
  aktivni: boolean;
  stav: StavJidelny;
}

export interface MapaFirma {
  ico: string;
  nazev: string;
  obec: string | null;
  lat: number;
  lng: number;
  stav: string;
  skore: number | null;
  vzdalenost_m: number | null;
  kontaktu: number;
}

export async function nactiDataProMapu(db: Db) {
  const jidelny = await db.query<MapaJidelna>(
    `select id, nazev, adresa, lat::float8 as lat, lng::float8 as lng,
            zona_metru, kapacita_volna, aktivni, stav
     from jidelny order by nazev`,
  );
  const firmy = await db.query<MapaFirma>(
    `select f.ico, f.nazev, f.obec, f.lat::float8 as lat, f.lng::float8 as lng,
            f.stav, f.skore, f.vzdalenost_m,
            (select count(*)::int from contacts c where c.ico = f.ico) as kontaktu
     from companies f
     where f.lat is not null and f.lng is not null
     order by f.skore desc nulls last`,
  );
  return { jidelny, firmy };
}

const STAVY: Record<string, { popis: string; barva: string }> = {
  novy: { popis: "nový", barva: "#7c8e8e" },
  kvalifikovany: { popis: "kvalifikovaná", barva: "#3d7a36" },
  cekajici_na_jidelnu: { popis: "čeká na jídelnu", barva: "#8f6110" },
  zamitnuty: { popis: "zamítnutá", barva: "#94352d" },
  osloveny: { popis: "oslovená", barva: "#1f6570" },
  jednani: { popis: "jednání", barva: "#6b3fa0" },
  zakaznik: { popis: "zákazník", barva: "#0f766e" },
};

export function sestavHtml(
  jidelny: MapaJidelna[],
  firmy: MapaFirma[],
  vygenerovano: string,
): string {
  const data = JSON.stringify({ jidelny, firmy, stavy: STAVY })
    // Aby se řetězec nerozbil, kdyby v názvu firmy bylo </script>.
    .replace(/</g, "\\u003c");

  const pocty = Object.entries(
    firmy.reduce<Record<string, number>>((acc, f) => {
      acc[f.stav] = (acc[f.stav] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([s, n]) => `${STAVY[s]?.popis ?? s}: ${n}`)
    .join(" · ");

  // Jídelna v přípravě zatím nemá co prodat — do volné kapacity se nepočítá,
  // ukazuje se vedle jako potenciál.
  const soucet = soucetKapacit(jidelny);

  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cantinero — mapa území</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  :root {
    --ink: #131c1f; --ink-soft: #46585a; --ink-faint: #7c8e8e;
    --ground: #ecefec; --surface: #f8faf8; --surface-2: #e3e8e4;
    --line: #c9d2cc; --accent: #1f6570;
    --sans: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
    --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ink: #e2e9e6; --ink-soft: #9fb0ae; --ink-faint: #71827f;
      --ground: #0f1516; --surface: #171f20; --surface-2: #1e2829;
      --line: #2c3839; --accent: #64b6c0;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--ground); color: var(--ink);
    font-family: var(--sans); display: flex; flex-direction: column; height: 100vh;
  }
  header {
    padding: 14px 20px; background: var(--surface);
    border-bottom: 1px solid var(--line);
    display: flex; flex-wrap: wrap; gap: 14px 24px; align-items: baseline;
  }
  h1 { margin: 0; font-size: 1.05rem; font-weight: 750; letter-spacing: -0.015em; }
  .meta { font-family: var(--mono); font-size: 0.74rem; color: var(--ink-faint); }
  .meta b { color: var(--ink-soft); font-weight: 600; }
  #mapa { flex: 1; min-height: 0; }
  .legenda {
    padding: 10px 20px; background: var(--surface); border-top: 1px solid var(--line);
    display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 0.8rem; color: var(--ink-soft);
  }
  .legenda i {
    display: inline-block; width: 11px; height: 11px; border-radius: 50%;
    margin-right: 6px; vertical-align: -1px; border: 1px solid rgba(0,0,0,.25);
  }
  .prazdno {
    position: absolute; z-index: 500; inset: 0; display: grid; place-content: center;
    pointer-events: none; text-align: center;
  }
  .prazdno span {
    background: var(--surface); border: 1px dashed var(--line);
    padding: 14px 20px; font-family: var(--mono); font-size: 0.8rem; color: var(--ink-faint);
    pointer-events: auto;
  }
  .leaflet-popup-content { font-family: var(--sans); font-size: 0.85rem; line-height: 1.5; }
  .leaflet-popup-content b { font-size: 0.9rem; }
  .leaflet-popup-content dl { margin: 6px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
  .leaflet-popup-content dt { color: #666; }
  .leaflet-popup-content dd { margin: 0; font-family: var(--mono); font-size: 0.8rem; }
</style>
</head>
<body>
<header>
  <h1>Cantinero — mapa území</h1>
  <span class="meta">jídelen: <b>${jidelny.length}</b> · volná kapacita: <b>${soucet.vProvozu}</b> obědů/den${soucet.priprava > 0 ? ` · v přípravě dalších <b>${soucet.priprava}</b>` : ""}</span>
  <span class="meta">firem na mapě: <b>${firmy.length}</b>${pocty ? " · " + pocty : ""}</span>
  <span class="meta">vygenerováno <b>${vygenerovano}</b></span>
</header>
<div id="mapa"></div>
<div class="legenda" id="legenda"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const DATA = ${data};

const mapa = L.map("mapa", { scrollWheelZoom: true }).setView([49.82, 15.47], 7);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; přispěvatelé <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(mapa);

const vrstvaZon = L.layerGroup().addTo(mapa);
const vrstvaFirem = L.layerGroup().addTo(mapa);
const body = [];

DATA.jidelny.forEach(function (j) {
  // Pěší dosah 800 m
  L.circle([j.lat, j.lng], {
    radius: 800, color: "#1f6570", weight: 1.5, fillColor: "#1f6570", fillOpacity: 0.12
  }).addTo(vrstvaZon);
  // Celá zóna jídelny
  L.circle([j.lat, j.lng], {
    radius: j.zona_metru, color: "#1f6570", weight: 1.5, dashArray: "6 5",
    fillColor: "#1f6570", fillOpacity: 0.05
  }).addTo(vrstvaZon);

  L.marker([j.lat, j.lng]).addTo(vrstvaZon).bindPopup(
    "<b>" + j.nazev + "</b><br />" + j.adresa +
    "<dl><dt>volná kapacita</dt><dd>" + (j.kapacita_volna === null ? "neuvedeno" : j.kapacita_volna + " obědů/den") + "</dd>" +
    "<dt>zóna</dt><dd>" + (j.zona_metru / 1000).toFixed(1) + " km</dd>" +
    "<dt>stav</dt><dd>" + (!j.aktivni ? "mimo provoz" : j.stav === "priprava" ? "příprava" : "v provozu") + "</dd></dl>"
  );
  body.push([j.lat, j.lng]);
});

DATA.firmy.forEach(function (f) {
  var s = DATA.stavy[f.stav] || { popis: f.stav, barva: "#7c8e8e" };
  L.circleMarker([f.lat, f.lng], {
    radius: 6, color: "#fff", weight: 1.5, fillColor: s.barva, fillOpacity: 0.95
  }).addTo(vrstvaFirem).bindPopup(
    "<b>" + f.nazev + "</b><br />" + (f.obec || "") +
    "<dl><dt>IČO</dt><dd>" + f.ico + "</dd>" +
    "<dt>stav</dt><dd>" + s.popis + "</dd>" +
    "<dt>skóre</dt><dd>" + (f.skore === null ? "—" : f.skore) + "</dd>" +
    "<dt>vzdálenost</dt><dd>" + (f.vzdalenost_m === null ? "—" : f.vzdalenost_m + " m") + "</dd>" +
    "<dt>kontaktů</dt><dd>" + f.kontaktu + "</dd></dl>"
  );
  body.push([f.lat, f.lng]);
});

if (body.length > 0) {
  mapa.fitBounds(L.latLngBounds(body).pad(0.25));
} else {
  var d = document.createElement("div");
  d.className = "prazdno";
  d.innerHTML = "<span>Zatím žádná data — mapa se naplní prvním během Čmuchala</span>";
  document.getElementById("mapa").appendChild(d);
}

L.control.layers(null, { "Zóny jídelen": vrstvaZon, "Firmy": vrstvaFirem },
  { collapsed: false }).addTo(mapa);

var leg = document.getElementById("legenda");
leg.innerHTML =
  '<span><i style="background:#1f6570"></i>jídelna a její zóna</span>' +
  Object.keys(DATA.stavy).map(function (k) {
    return '<span><i style="background:' + DATA.stavy[k].barva + '"></i>' + DATA.stavy[k].popis + "</span>";
  }).join("");
</script>
</body>
</html>
`;
}

export async function vygenerujMapu(db: Db, cesta: string): Promise<{ cesta: string; jidelen: number; firem: number }> {
  const { jidelny, firmy } = await nactiDataProMapu(db);
  const vygenerovano = new Date().toLocaleString("cs-CZ");
  await mkdir(dirname(cesta), { recursive: true });
  await writeFile(cesta, sestavHtml(jidelny, firmy, vygenerovano), "utf8");
  return { cesta, jidelen: jidelny.length, firem: firmy.length };
}
