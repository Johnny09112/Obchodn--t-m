/**
 * Kontrola stylu zprávy podle SPEC kap. 6.
 *
 * Kapitola končí větou „automatická kontrola odmítne zprávu, která obsahuje
 * zakázanou frázi, překračuje délku, obsahuje pole bez evidence, nebo se
 * shoduje s jinou odeslanou zprávou na více než 70 % textu". Tohle je ta
 * kontrola pro **text samotný**; evidenci polí hlídá whitelist (TP-3)
 * a podobnost s odeslanými se bude počítat až ve fázi 3, kdy nějaké
 * odeslané budou.
 *
 * Vrací **seznam prohřešků, ne první chybu** — kdo píše šablonu, má vidět
 * všechno najednou, ne opravovat jednu věc za druhou.
 *
 * Bez závislostí na databázi: používá se při psaní šablon, v testech
 * i (od fáze 3) před odesláním.
 */

/** Doslova podle SPEC kap. 6. Pořadí zachováno, ať se dá porovnat. */
export const ZAKAZANE_FRAZE = [
  "V dnešní uspěchané době",
  "Dovolte mi představit",
  "Rád bych Vás oslovil s",
  "Věřím, že by Vás mohlo zaujmout",
  "nezávazně",
  "řešení na míru",
  "inovativní",
  "komplexní řešení",
  "win-win",
  "synergie",
  "posouváme hranice",
  "nechte mě vědět",
  "Doufám, že se máte dobře",
] as const;

/** Slova, po kterých předmět zní jako reklama, ne jako věcná zpráva. */
const SUPERLATIVY = ["revoluce", "revoluční", "nejlepší", "špičkov", "unikátní", "jedinečn"];

/**
 * Tvary vykání, které se v obchodním dopise píšou velkým písmenem.
 * Malé „vaší" v oslovení konkrétní osoby vypadá jako hromadná pošta
 * (vyžádal si majitel 18. 8. 2026).
 */
const TVARY_VYKANI =
  /(?<!\p{L})(vy|vás|vám|vámi|váš|vaše|vaší|vašeho|vašemu|vašich|vašim|vašimi|vaši)(?!\p{L})/gu;

const MAX_SLOV = 120;

export interface Prohresek {
  kod:
    | "zakazana-fraze"
    | "prilis-dlouha"
    | "odrazky"
    | "otazka"
    | "jmeno-adresata"
    | "html"
    | "predmet"
    | "vykani";
  /** Věta pro člověka, který zprávu píše — ne kód chyby. */
  detail: string;
}

/** Sjednotí mezery a velikost písmen, ať se fráze najde i „KOMPLEXNÍ  ŘEŠENÍ". */
function normalizuj(s: string): string {
  return s.replace(/\s+/g, " ").toLowerCase();
}

export function zkontrolujZpravu(
  telo: string,
  kontext: { predmet: string; jmenoAdresata?: string },
): Prohresek[] {
  const prohresky: Prohresek[] = [];
  const normalizovane = normalizuj(telo);

  for (const fraze of ZAKAZANE_FRAZE) {
    if (normalizovane.includes(normalizuj(fraze))) {
      prohresky.push({
        kod: "zakazana-fraze",
        detail: `Zakázaná fráze „${fraze}" (SPEC kap. 6).`,
      });
    }
  }

  const slov = telo.trim().split(/\s+/).filter(Boolean).length;
  if (slov > MAX_SLOV) {
    prohresky.push({
      kod: "prilis-dlouha",
      detail: `Zpráva má ${slov} slov, povoleno je ${MAX_SLOV}.`,
    });
  }

  // Odrážky poznáme podle řádku, který začíná pomlčkou, hvězdičkou, puntíkem
  // nebo číslem se závorkou — přesně tak vypadá výčet benefitů.
  if (telo.split("\n").some((r) => /^\s*([-*•·]|\d+[.)])\s+/.test(r))) {
    prohresky.push({
      kod: "odrazky",
      detail: "První oslovení nesmí mít odrážky s benefity — napiš to větou.",
    });
  }

  const otazniku = (telo.match(/\?/g) ?? []).length;
  if (otazniku !== 1) {
    prohresky.push({
      kod: "otazka",
      detail:
        otazniku === 0
          ? "Chybí otázka na konci — jedna konkrétní, s nízkým prahem."
          : `Otázek je ${otazniku}, má být právě jedna.`,
    });
  }

  if (kontext.jmenoAdresata) {
    const vyskyty = normalizovane.split(normalizuj(kontext.jmenoAdresata)).length - 1;
    if (vyskyty > 1) {
      prohresky.push({
        kod: "jmeno-adresata",
        detail: `Jméno adresáta je v textu ${vyskyty}×, smí být nejvýš jednou.`,
      });
    }
  }

  // Vykání velkým písmenem. Hledá se jen uvnitř věty — na začátku věty je
  // velké písmeno povinné tak jako tak a o vykání nevypovídá nic.
  const nalezene = new Set<string>();
  for (const m of telo.matchAll(TVARY_VYKANI)) {
    const pred = telo.slice(0, m.index).trimEnd();
    if (pred === "" || /[.!?:]$/.test(pred)) continue;
    nalezene.add(m[0]);
  }
  if (nalezene.size > 0) {
    const vypis = [...nalezene].map((x) => `„${x}"`).join(", ");
    prohresky.push({
      kod: "vykani",
      detail: `Vyká se velkým písmenem — oprav ${vypis}.`,
    });
  }

  if (/<[a-z/][^>]*>/i.test(telo)) {
    prohresky.push({
      kod: "html",
      detail: "Zpráva je prostý text — bez HTML, obrázků a loga v těle.",
    });
  }

  const predmet = normalizuj(kontext.predmet);
  if (/\?!|!\?|!{2,}|\?{2,}/.test(kontext.predmet)) {
    prohresky.push({
      kod: "predmet",
      detail: 'Předmět nemá být clickbait — bez „?!" a vykřičníků.',
    });
  } else if (SUPERLATIVY.some((s) => predmet.includes(s))) {
    prohresky.push({
      kod: "predmet",
      detail:
        'Předmět má být věcný, bez superlativů. Dobře: „obědy ze ZŠ Komenského pro vaše zaměstnance".',
    });
  }

  return prohresky;
}
