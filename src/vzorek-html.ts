/**
 * Stránka pro ruční kontrolu vzorku (SPEC kap. 12, fáze 1).
 *
 * Kontrolor musí u každého záznamu vidět **hodnotu, doslovnou citaci
 * i odkaz na zdroj vedle sebe** — jinak nekontroluje data, ale svůj dojem
 * z nich. Odpovědi se drží v prohlížeči a na konci se z nich složí souhrn,
 * který jde zkopírovat a poslat zpátky.
 *
 * Soubor se nikam neodesílá: obsahuje kontakty na konkrétní lidi, takže
 * zůstává na disku majitele.
 */

export interface UdajKontroly {
  atribut: string;
  hodnota: string;
  citace: string | null;
  zdrojUrl: string;
  den: string;
}

export interface KontaktKontroly {
  kdo: string;
  spojeni: string;
  uroven: number | null;
  citace: string | null;
  zdrojUrl: string | null;
  den: string;
}

export interface ZaznamKontroly {
  ico: string;
  nazev: string;
  obec: string | null;
  velikost: string | null;
  skore: number | null;
  udaje: UdajKontroly[];
  kontakty: KontaktKontroly[];
}

const POPIS_ATRIBUTU: Record<string, string> = {
  velikost_kategorie: "Velikost",
  zamestnanci_odhad: "Počet zaměstnanců",
  ma_vlastni_jidelnu: "Vlastní jídelna",
  zpusob_stravovani: "Způsob stravování",
  ucel_adresy: "Účel zveřejněné adresy",
  smenny_provoz: "Směnný provoz",
  obor: "Obor",
  web: "Web firmy",
  adresa: "Poloha na mapě",
};

const POPIS_VELIKOSTI: Record<string, string> = {
  mikro: "mikropodnik",
  stredni: "střední",
  korporat: "korporát",
};

const POPIS_UROVNE: Record<number, string> = {
  1: "adresa pro nabídky",
  2: "obecná firemní adresa",
  3: "jmenná adresa osoby",
};

/** Data pocházejí z cizích webů — do HTML smí jen escapovaná. */
const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function zdroj(url: string | null, den: string): string {
  if (!url) return `<span class="tise">zdroj neuveden · ${esc(den)}</span>`;
  let popis = url;
  try {
    const u = new URL(url);
    popis = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    /* nechá se celá adresa */
  }
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(popis)}</a>
          <span class="tise"> · ${esc(den)}</span>`;
}

function zaznamHtml(z: ZaznamKontroly, poradi: number): string {
  const udaje = z.udaje
    .map(
      (u, i) => `
      <li class="polozka" data-klic="${esc(z.ico)}-u${i}">
        <div class="co">
          <strong>${esc(POPIS_ATRIBUTU[u.atribut] ?? u.atribut)}</strong>
          <span class="hodnota">${esc(u.hodnota)}</span>
        </div>
        ${u.citace ? `<blockquote>„${esc(u.citace)}"</blockquote>` : '<p class="tise">bez citace</p>'}
        <div class="paticka">
          <span class="zdroj">${zdroj(u.zdrojUrl, u.den)}</span>
          <span class="volby">
            <button type="button" class="ano" data-volba="sedi">sedí</button>
            <button type="button" class="ne" data-volba="nesedi">nesedí</button>
          </span>
        </div>
      </li>`,
    )
    .join("");

  const kontakty = z.kontakty
    .map(
      (k, i) => `
      <li class="polozka" data-klic="${esc(z.ico)}-k${i}">
        <div class="co">
          <strong>${esc(k.kdo)}</strong>
          <span class="hodnota">${esc(k.spojeni)}</span>
          ${k.uroven ? `<span class="stitek">${esc(POPIS_UROVNE[k.uroven] ?? `úroveň ${k.uroven}`)}</span>` : ""}
        </div>
        ${k.citace ? `<blockquote>„${esc(k.citace)}"</blockquote>` : '<p class="tise">bez citace</p>'}
        <div class="paticka">
          <span class="zdroj">${zdroj(k.zdrojUrl, k.den)}</span>
          <span class="volby">
            <button type="button" class="ano" data-volba="sedi">sedí</button>
            <button type="button" class="ne" data-volba="nesedi">nesedí</button>
          </span>
        </div>
      </li>`,
    )
    .join("");

  return `
    <article class="firma">
      <header>
        <span class="poradi">${poradi}.</span>
        <div>
          <h2>${esc(z.nazev)}</h2>
          <p class="radek">
            IČO ${esc(z.ico)} · ${esc(z.obec ?? "obec neznámá")} ·
            ${esc(z.velikost ? (POPIS_VELIKOSTI[z.velikost] ?? z.velikost) : "velikost neznámá")} ·
            skóre ${esc(z.skore ?? "—")} ·
            <a href="https://ares.gov.cz/ekonomicke-subjekty/${esc(z.ico)}" target="_blank" rel="noopener noreferrer">ARES</a>
          </p>
        </div>
      </header>
      ${udaje || kontakty ? `<ul class="polozky">${udaje}${kontakty}</ul>` : '<p class="tise">U téhle firmy není co kontrolovat — nemá doložený žádný údaj.</p>'}
    </article>`;
}

export function vygenerujKontrolu(vzorek: readonly ZaznamKontroly[], den: string): string {
  const zaznamu = vzorek.reduce((s, z) => s + z.udaje.length + z.kontakty.length, 0);

  const telo =
    vzorek.length === 0
      ? `<p class="prazdno">Vzorek je prázdný — není co kontrolovat.</p>`
      : vzorek.map((z, i) => zaznamHtml(z, i + 1)).join("");

  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kontrola vzorku — Cantinero</title>
<style>
  :root {
    --ground: #eeeee7; --karta: #fbfaf6; --karta2: #f3f2eb;
    --inkoust: #1d211b; --inkoust-slaby: #5c6157; --linka: #cfd0c6;
    --zelena: #3c6b48; --zelena-svetla: #e2ece3;
    --cihla: #a4432c; --cihla-svetla: #f7e5df;
    --pismo-nadpis: Georgia, "Times New Roman", serif;
    --pismo-text: system-ui, -apple-system, "Segoe UI", sans-serif;
    --pismo-data: ui-monospace, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ground: #14170f; --karta: #1c2019; --karta2: #232821;
      --inkoust: #e8e9e2; --inkoust-slaby: #a0a597; --linka: #363a33;
      --zelena: #7fb98c; --zelena-svetla: #22301f;
      --cihla: #e08a70; --cihla-svetla: #33211c;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ground); color: var(--inkoust);
         font-family: var(--pismo-text); line-height: 1.55; }
  .stranka { max-width: 50rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  h1 { font-family: var(--pismo-nadpis); font-size: 2rem; margin: 0 0 0.5rem; }
  .uvod { color: var(--inkoust-slaby); margin: 0 0 1.5rem; }
  .postup { background: var(--karta); border: 1px solid var(--linka);
            border-radius: 4px; padding: 1rem 1.25rem; margin-bottom: 2rem; }
  .postup p { margin: 0 0 0.5rem; font-size: 0.9375rem; }
  .postup p:last-child { margin-bottom: 0; }
  .firma { background: var(--karta); border: 1px solid var(--linka);
           border-radius: 4px; padding: 1.15rem 1.35rem; margin-bottom: 1.25rem; }
  .firma header { display: flex; gap: 0.9rem; align-items: baseline; margin-bottom: 0.9rem; }
  .poradi { font-family: var(--pismo-data); font-weight: 700; color: var(--inkoust-slaby); }
  .firma h2 { font-family: var(--pismo-nadpis); font-size: 1.1875rem; margin: 0 0 0.2rem; }
  .radek { font-family: var(--pismo-data); font-size: 0.8125rem;
           color: var(--inkoust-slaby); margin: 0; }
  .radek a, .zdroj a { color: var(--zelena); }
  .polozky { list-style: none; margin: 0; padding: 0; display: flex;
             flex-direction: column; gap: 0.75rem; }
  .polozka { background: var(--karta2); border-radius: 4px; padding: 0.8rem 0.95rem;
             border-left: 3px solid transparent; }
  .polozka.sedi { border-left-color: var(--zelena); background: var(--zelena-svetla); }
  .polozka.nesedi { border-left-color: var(--cihla); background: var(--cihla-svetla); }
  .co { display: flex; flex-wrap: wrap; gap: 0.4rem 0.6rem; align-items: baseline;
        font-size: 0.9375rem; margin-bottom: 0.35rem; }
  .hodnota { font-family: var(--pismo-data); }
  .stitek { font-family: var(--pismo-data); font-size: 0.6875rem; text-transform: uppercase;
            letter-spacing: 0.06em; background: var(--karta); padding: 0.1rem 0.4rem;
            border-radius: 2px; color: var(--inkoust-slaby); }
  blockquote { margin: 0 0 0.45rem; padding-left: 0.8rem; border-left: 2px solid var(--linka);
               font-style: italic; font-size: 0.875rem; color: var(--inkoust-slaby); }
  .paticka { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
             justify-content: space-between; font-size: 0.8125rem; }
  .zdroj { font-family: var(--pismo-data); word-break: break-all; }
  .tise { color: var(--inkoust-slaby); font-size: 0.8125rem; }
  .volby { display: flex; gap: 0.4rem; }
  button { font: inherit; font-size: 0.8125rem; padding: 0.25rem 0.7rem; cursor: pointer;
           border: 1px solid var(--linka); border-radius: 3px; background: var(--karta);
           color: var(--inkoust); }
  button:hover { border-color: var(--inkoust-slaby); }
  .polozka.sedi .ano { background: var(--zelena); color: var(--karta); border-color: var(--zelena); }
  .polozka.nesedi .ne { background: var(--cihla); color: var(--karta); border-color: var(--cihla); }
  button:focus-visible { outline: 2px solid var(--zelena); outline-offset: 2px; }
  /* Sticky proužek nese jen čísla — celý souhrn s textem by při čtení
     zakrýval čtvrtinu obrazovky. Text ke zkopírování je až na konci. */
  .souhrn { position: sticky; bottom: 0; background: var(--karta);
            border: 1px solid var(--linka); border-radius: 4px; padding: 0.55rem 1rem;
            margin-top: 2rem; box-shadow: 0 -2px 8px rgba(0,0,0,0.08); }
  .cisla { font-family: var(--pismo-data); font-size: 0.875rem; margin: 0; }
  .vysledek-box { background: var(--karta); border: 1px solid var(--linka);
                  border-radius: 4px; padding: 1rem 1.25rem; margin-top: 1.25rem; }
  .vysledek-box h2 { font-family: var(--pismo-nadpis); font-size: 1.125rem; margin: 0 0 0.5rem; }
  .vysledek-box p { margin: 0 0 0.6rem; font-size: 0.875rem; color: var(--inkoust-slaby); }
  textarea { width: 100%; min-height: 6rem; font-family: var(--pismo-data); font-size: 0.8125rem;
             padding: 0.6rem; border: 1px solid var(--linka); border-radius: 3px;
             background: var(--karta2); color: var(--inkoust); }
  .prazdno { padding: 2rem; text-align: center; color: var(--inkoust-slaby); }
</style>
</head>
<body>
<div class="stranka">
  <h1>Kontrola vzorku</h1>
  <p class="uvod">
    Vzorek ${vzorek.length} firem, dohromady ${zaznamu} záznamů ke kontrole.
    Připraveno ${esc(den)}.
  </p>

  <div class="postup">
    <p><strong>U každého záznamu porovnejte hodnotu s citací a zdrojem.</strong>
       „Nesedí" znamená: hodnota neodpovídá citaci, odkaz nevede tam, kde údaj
       stojí, nebo je kontakt zařazený do špatné úrovně.</p>
    <p><strong>Prázdno není chyba.</strong> Co není doložené, se nezapisuje —
       proto tu chybějící údaje vůbec nejsou.</p>
    <p>Odpovědi se ukládají v prohlížeči, takže se dá kdykoli přestat
       a vrátit se. Na konci zkopírujte souhrn a pošlete mi ho.</p>
  </div>

  ${telo}

  <div class="vysledek-box">
    <h2>Souhrn ke zkopírování</h2>
    <p>Až budete hotov (nebo skončíte pro dnešek), označte text níž
       a pošlete mi ho — spočítám z něj podíl chybných záznamů a zapíšu ho
       do paměti projektu.</p>
    <textarea id="vysledek" readonly aria-label="Souhrn ke zkopírování"></textarea>
  </div>

  <div class="souhrn">
    <p class="cisla" id="cisla">Zatím nic zkontrolováno z ${zaznamu} záznamů.</p>
  </div>
</div>

<script>
(function () {
  var KLIC = "cantinero-kontrola-${esc(den).replace(/[^0-9]/g, "")}";
  var stav = {};
  try { stav = JSON.parse(localStorage.getItem(KLIC) || "{}"); } catch (e) { stav = {}; }

  var polozky = Array.prototype.slice.call(document.querySelectorAll(".polozka"));

  function uloz() {
    try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* soukromé okno */ }
  }

  function prekresli() {
    var sedi = 0, nesedi = 0;
    polozky.forEach(function (p) {
      var volba = stav[p.dataset.klic];
      p.classList.toggle("sedi", volba === "sedi");
      p.classList.toggle("nesedi", volba === "nesedi");
      if (volba === "sedi") sedi++;
      if (volba === "nesedi") nesedi++;
    });
    var hotovo = sedi + nesedi;
    var podil = hotovo > 0 ? Math.round((nesedi / hotovo) * 1000) / 10 : 0;
    document.getElementById("cisla").textContent =
      "Zkontrolováno " + hotovo + " z " + polozky.length +
      " · sedí " + sedi + " · nesedí " + nesedi +
      " · podíl chybných " + podil + " %";

    var radky = ["Kontrola vzorku ${esc(den)}",
      "zkontrolováno: " + hotovo + " z " + polozky.length,
      "sedí: " + sedi, "nesedí: " + nesedi, "podíl chybných: " + podil + " %"];
    if (nesedi > 0) {
      radky.push("", "chybné záznamy:");
      polozky.forEach(function (p) {
        if (stav[p.dataset.klic] === "nesedi") {
          var firma = p.closest(".firma").querySelector("h2").textContent.trim();
          var co = p.querySelector(".co").textContent.replace(/\\s+/g, " ").trim();
          radky.push("- " + firma + " — " + co);
        }
      });
    }
    document.getElementById("vysledek").value = radky.join("\\n");
  }

  polozky.forEach(function (p) {
    p.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var klic = p.dataset.klic;
        stav[klic] = stav[klic] === b.dataset.volba ? undefined : b.dataset.volba;
        if (!stav[klic]) delete stav[klic];
        uloz();
        prekresli();
      });
    });
  });

  prekresli();
})();
</script>
</body>
</html>`;
}
