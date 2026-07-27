/**
 * Vygeneruje HTML pohled na celou kartotéku — firmy, jejich údaje, kontakty
 * a hlavně **evidenci**: u každého údaje odkaz na zdroj a doslovnou citaci.
 * Slouží k ruční kontrole kvality dat (fáze 1 vyžaduje kontrolu vzorku).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Db } from "./db.js";

export interface KartotekaData {
  jidelny: Array<{
    nazev: string; obec: string | null; kapacita_volna: number;
    zona_metru: number; aktivni: boolean;
  }>;
  firmy: Array<{
    ico: string; nazev: string; obec: string | null; stav: string;
    skore: number | null; vzdalenost_m: number | null; v_zone: boolean | null;
    velikost_kategorie: string | null; ma_vlastni_jidelnu: boolean | null;
    zpusob_stravovani: string | null; cz_nace: string[];
    obohaceno_at: string | null;
  }>;
  kontakty: Array<{
    ico: string; jmeno: string | null; prijmeni: string | null;
    pozice: string | null; email: string | null; telefon: string | null;
    uroven_adresy: number | null; zdroj_url: string;
  }>;
  evidence: Array<{
    ico: string | null; atribut: string; hodnota: string;
    zdroj_url: string; citace: string | null; ziskano_at: string;
  }>;
  behy: Array<{
    agent: string; zacatek: string; konec: string | null;
    vystup: unknown; naklady_usd: string | null;
  }>;
}

export async function nactiKartoteku(db: Db): Promise<KartotekaData> {
  return {
    jidelny: await db.query(
      `select nazev, obec, kapacita_volna, zona_metru, aktivni from jidelny order by nazev`,
    ),
    firmy: await db.query(
      `select ico, nazev, obec, stav, skore, vzdalenost_m, v_zone, velikost_kategorie,
              ma_vlastni_jidelnu, zpusob_stravovani, cz_nace, obohaceno_at
       from companies order by skore desc nulls last`,
    ),
    kontakty: await db.query(
      `select ico, jmeno, prijmeni, pozice, email, telefon, uroven_adresy, zdroj_url
       from contacts order by ico, uroven_adresy`,
    ),
    evidence: await db.query(
      `select ico, atribut, hodnota, zdroj_url, citace, ziskano_at
       from evidence order by ico, atribut`,
    ),
    behy: await db.query(
      `select agent, zacatek, konec, vystup, naklady_usd
       from agent_runs order by zacatek desc`,
    ),
  };
}

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const STAVY: Record<string, string> = {
  novy: "nový", kvalifikovany: "kvalifikovaná", cekajici_na_jidelnu: "čeká na jídelnu",
  zamitnuty: "zamítnutá", osloveny: "oslovená", jednani: "jednání", zakaznik: "zákazník",
};

const UROVNE: Record<number, string> = {
  1: "poptávková", 2: "obecná", 3: "jmenná",
};

export function sestavKartoteku(d: KartotekaData, vygenerovano: string): string {
  const kapacita = d.jidelny.filter((j) => j.aktivni).reduce((s, j) => s + j.kapacita_volna, 0);
  const seZdrojem = d.evidence.length;

  const firmyHtml = d.firmy
    .map((f) => {
      const ev = d.evidence.filter((e) => e.ico === f.ico);
      const ko = d.kontakty.filter((k) => k.ico === f.ico);
      return `
<details class="firma">
  <summary>
    <span class="skore">${f.skore ?? "—"}</span>
    <span class="jmeno">${esc(f.nazev)}</span>
    <span class="stav s-${esc(f.stav)}">${esc(STAVY[f.stav] ?? f.stav)}</span>
    <span class="meta">${f.vzdalenost_m ?? "—"} m · ${esc(f.velikost_kategorie ?? "velikost neuvedena")} · ${ko.length} kontaktů</span>
  </summary>
  <div class="detail">
    <dl class="udaje">
      <dt>IČO</dt><dd>${esc(f.ico)}</dd>
      <dt>Sídlo</dt><dd>${esc(f.obec ?? "—")}</dd>
      <dt>Vlastní jídelna</dt><dd>${f.ma_vlastni_jidelnu === null ? "<i>nevíme</i>" : f.ma_vlastni_jidelnu ? "ano" : "ne"}</dd>
      <dt>Stravování</dt><dd>${f.zpusob_stravovani ? esc(f.zpusob_stravovani) : "<i>nevíme</i>"}</dd>
      <dt>Obory</dt><dd>${esc((f.cz_nace ?? []).join(", ") || "—")}</dd>
      <dt>Rešerše</dt><dd>${f.obohaceno_at ? "proběhla" : "<i>čeká</i>"}</dd>
    </dl>

    ${ko.length === 0 ? "" : `<h4>Kontakty</h4><ul class="kontakty">${ko
      .map((k) => `<li>
        <b>${esc([k.jmeno, k.prijmeni].filter(Boolean).join(" ") || k.email || "—")}</b>
        ${k.pozice ? ` · ${esc(k.pozice)}` : ""}
        <span class="uroven u${k.uroven_adresy}">${esc(UROVNE[k.uroven_adresy ?? 0] ?? "?")}</span>
        <div class="tiny">${esc(k.email ?? "")} ${esc(k.telefon ?? "")}</div>
        <a class="zdroj" href="${esc(k.zdroj_url)}" target="_blank" rel="noopener">zdroj</a>
      </li>`).join("")}</ul>`}

    <h4>Evidence — odkud každý údaj pochází</h4>
    ${ev.length === 0 ? '<p class="tiny"><i>Zatím žádná evidence.</i></p>' : `<ul class="evidence">${ev
      .map((e) => `<li>
        <span class="atribut">${esc(e.atribut)}</span>
        <span class="hodnota">${esc(e.hodnota)}</span>
        <blockquote>${esc(e.citace ?? "")}</blockquote>
        <a class="zdroj" href="${esc(e.zdroj_url)}" target="_blank" rel="noopener">${esc(e.zdroj_url.slice(0, 70))}</a>
      </li>`).join("")}</ul>`}
  </div>
</details>`;
    })
    .join("");

  const behyHtml = d.behy
    .map((b) => {
      const v = (b.vystup ?? {}) as Record<string, unknown>;
      const shrnuti = Object.entries(v)
        .filter(([k, x]) => typeof x === "number" && x !== 0 && k !== "nakladyUsd")
        .map(([k, x]) => `${k}: ${x}`)
        .join(" · ");
      return `<tr>
        <td class="mono">${esc(b.agent)}</td>
        <td class="mono tiny">${esc(new Date(b.zacatek).toLocaleString("cs-CZ"))}</td>
        <td class="tiny">${esc(shrnuti || "—")}</td>
        <td class="mono num">$${Number(b.naklady_usd ?? 0).toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cantinero — kartotéka</title>
<style>
  :root {
    --ink:#131c1f; --ink-soft:#46585a; --ink-faint:#7c8e8e;
    --ground:#ecefec; --surface:#f8faf8; --surface-2:#e3e8e4;
    --line:#c9d2cc; --line-soft:#dbe2dc; --accent:#1f6570; --accent-soft:#d6e6e7;
    --good:#3d7a36; --good-soft:#dbe9d6; --warn:#8f6110; --warn-soft:#f0e5c8;
    --sans: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
    --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#e2e9e6; --ink-soft:#9fb0ae; --ink-faint:#71827f;
      --ground:#0f1516; --surface:#171f20; --surface-2:#1e2829;
      --line:#2c3839; --line-soft:#232e2f; --accent:#64b6c0; --accent-soft:#16333a;
      --good:#82bd76; --good-soft:#1b2e1c; --warn:#d3a444; --warn-soft:#302614; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--ground); color:var(--ink); font-family:var(--sans);
    font-size:15px; line-height:1.6; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:1000px; margin:0 auto; padding:0 20px; }
  header { background:var(--surface); border-bottom:1px solid var(--line); padding:28px 0; margin-bottom:28px; }
  h1 { margin:0 0 4px; font-size:1.6rem; font-weight:800; letter-spacing:-0.025em; }
  h2 { font-size:1.1rem; font-weight:750; margin:32px 0 12px; letter-spacing:-0.015em; }
  h4 { font-size:.8rem; text-transform:uppercase; letter-spacing:.1em; color:var(--ink-faint);
    margin:16px 0 8px; font-family:var(--mono); font-weight:600; }
  .souhrn { display:flex; flex-wrap:wrap; gap:20px; margin-top:14px; }
  .souhrn div { font-family:var(--mono); font-size:.76rem; color:var(--ink-faint); }
  .souhrn b { display:block; font-family:var(--sans); font-size:1.4rem; color:var(--ink);
    font-weight:750; letter-spacing:-0.02em; }
  .mono { font-family:var(--mono); }
  .tiny { font-size:.8rem; color:var(--ink-soft); }
  .num { text-align:right; font-variant-numeric:tabular-nums; }

  details.firma { background:var(--surface); border:1px solid var(--line); margin-bottom:8px; }
  details.firma summary { padding:12px 16px; cursor:pointer; display:flex; flex-wrap:wrap;
    gap:10px; align-items:baseline; }
  details.firma summary::-webkit-details-marker { display:none; }
  details.firma[open] summary { border-bottom:1px solid var(--line-soft); }
  .skore { font-family:var(--mono); font-weight:700; color:var(--accent);
    min-width:2.2em; font-variant-numeric:tabular-nums; }
  .jmeno { font-weight:650; flex:1; min-width:200px; }
  .stav { font-family:var(--mono); font-size:.68rem; text-transform:uppercase;
    letter-spacing:.05em; padding:2px 8px; border-radius:2px;
    background:var(--surface-2); color:var(--ink-soft); }
  .stav.s-kvalifikovany { background:var(--good-soft); color:var(--good); }
  .stav.s-cekajici_na_jidelnu { background:var(--warn-soft); color:var(--warn); }
  summary .meta { font-family:var(--mono); font-size:.72rem; color:var(--ink-faint); }
  .detail { padding:12px 16px 18px; }
  dl.udaje { display:grid; grid-template-columns:auto 1fr; gap:3px 16px; margin:0; }
  dl.udaje dt { font-family:var(--mono); font-size:.72rem; color:var(--ink-faint); }
  dl.udaje dd { margin:0; font-size:.9rem; }
  ul.kontakty, ul.evidence { list-style:none; margin:0; padding:0;
    display:flex; flex-direction:column; gap:10px; }
  ul.kontakty li, ul.evidence li { border-left:2px solid var(--line);
    padding:6px 0 6px 12px; }
  .uroven { font-family:var(--mono); font-size:.66rem; text-transform:uppercase;
    padding:1px 6px; border-radius:2px; background:var(--surface-2); color:var(--ink-soft); }
  .uroven.u1 { background:var(--good-soft); color:var(--good); }
  .atribut { font-family:var(--mono); font-size:.72rem; color:var(--accent); }
  .hodnota { font-weight:600; margin-left:8px; }
  blockquote { margin:5px 0; padding-left:10px; border-left:2px solid var(--accent-soft);
    font-size:.85rem; color:var(--ink-soft); font-style:italic; }
  a.zdroj { font-family:var(--mono); font-size:.72rem; color:var(--accent);
    word-break:break-all; }
  table { border-collapse:collapse; width:100%; background:var(--surface);
    border:1px solid var(--line); }
  th { text-align:left; font-family:var(--mono); font-size:.66rem; text-transform:uppercase;
    letter-spacing:.1em; color:var(--ink-faint); padding:9px 12px;
    border-bottom:1px solid var(--line); background:var(--surface-2); }
  td { padding:9px 12px; border-bottom:1px solid var(--line-soft); }
  tr:last-child td { border-bottom:none; }
  .prazdno { background:var(--surface); border:1px dashed var(--line); padding:24px;
    text-align:center; font-family:var(--mono); font-size:.82rem; color:var(--ink-faint); }
  footer { margin:40px 0 60px; color:var(--ink-faint); font-size:.8rem; }
</style>
</head>
<body>
<header><div class="wrap">
  <h1>Kartotéka Cantinero</h1>
  <div class="tiny">Vygenerováno ${esc(vygenerovano)} · rozklikni firmu a uvidíš, odkud pochází každý údaj</div>
  <div class="souhrn">
    <div><b>${d.firmy.length}</b>firem</div>
    <div><b>${d.kontakty.length}</b>kontaktů</div>
    <div><b>${seZdrojem}</b>doložených údajů</div>
    <div><b>${d.jidelny.length}</b>jídelen</div>
    <div><b>${kapacita}</b>obědů/den volných</div>
    <div><b>${d.behy.length}</b>běhů agenta</div>
  </div>
</div></header>

<div class="wrap">
  <h2>Firmy</h2>
  ${d.firmy.length === 0 ? '<p class="prazdno">Kartotéka je zatím prázdná.</p>' : firmyHtml}

  <h2>Jídelny</h2>
  <table>
    <thead><tr><th>Název</th><th>Obec</th><th class="num">Volná kapacita</th><th class="num">Zóna</th><th>Stav</th></tr></thead>
    <tbody>${d.jidelny.map((j) => `<tr>
      <td>${esc(j.nazev)}</td><td>${esc(j.obec ?? "—")}</td>
      <td class="num mono">${j.kapacita_volna}</td>
      <td class="num mono">${(j.zona_metru / 1000).toFixed(1)} km</td>
      <td class="tiny">${j.aktivni ? "aktivní" : "neaktivní"}</td></tr>`).join("")}</tbody>
  </table>

  <h2>Deník běhů</h2>
  <table>
    <thead><tr><th>Agent</th><th>Kdy</th><th>Výsledek</th><th class="num">Náklady</th></tr></thead>
    <tbody>${behyHtml}</tbody>
  </table>

  <footer>
    Data pocházejí z lokální databáze ve složce <span class="mono">data/</span>.
    Tenhle soubor je jen pohled — pravda je v databázi.
  </footer>
</div>
</body>
</html>
`;
}

export async function vygenerujKartoteku(
  db: Db,
  cesta: string,
): Promise<{ cesta: string; firem: number; evidenci: number }> {
  const d = await nactiKartoteku(db);
  await mkdir(dirname(cesta), { recursive: true });
  await writeFile(cesta, sestavKartoteku(d, new Date().toLocaleString("cs-CZ")), "utf8");
  return { cesta, firem: d.firmy.length, evidenci: d.evidence.length };
}
