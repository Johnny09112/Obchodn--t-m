/**
 * Oznámení o doběhnutém průzkumu — text pro bublinu u hodin.
 *
 * **Nic se neodesílá.** Je to místní oznámení Windows na majitelově počítači,
 * ne e-mail ani zpráva ven; TP-8 zůstává v platnosti a žádný kód tady
 * odesílání neumí. Majitel si to vyžádal 1. 8. právě proto, že e-mail zatím
 * nesmí a bez zpětné vazby netuší, kdy je průzkum hotový.
 *
 * Čistý modul: větu skládá jádro, hlídka (PowerShell) ji jen zobrazí.
 * Formátovat text ve skriptu by znamenalo češtinu bez testů na místě,
 * kam nikdo nevidí.
 */
import { cesky } from "./cestina.js";

export interface VysledekObjednavky {
  oblast: string;
  stav: string;
  firemNovych: number;
  firemPrevzato: number;
  chyba: string | null;
}

export interface Oznameni {
  /** Řídí ikonu bubliny: hotovo · pozor · chyba. */
  druh: "hotovo" | "pozor" | "chyba";
  nadpis: string;
  text: string;
}

/** Do bubliny se víc nevejde; delší text Windows stejně usekne. */
const STROP = 200;

function zkrat(text: string): string {
  return text.length <= STROP ? text : `${text.slice(0, STROP - 1).trimEnd()}…`;
}

/** 1 871 — s mezerou po tisících, ať se to dá přečíst na jeden pohled. */
function cislo(n: number): string {
  return n.toLocaleString("cs-CZ").replace(/ /g, " ");
}

/**
 * Věta o tom, jak dopadl běh hlídky, nebo `null`, když není co hlásit.
 *
 * Prázdná fronta oznámení **nedostane**. Hlídka se ptá každých deset minut
 * a bublina „nebylo co dělat" by do hodiny skončila vypnutá i s těmi
 * oznámeními, kvůli kterým to celé vzniklo.
 */
export function oznameniOBehu(vysledky: readonly VysledekObjednavky[]): Oznameni | null {
  if (vysledky.length === 0) return null;

  const hotove = vysledky.filter((v) => v.stav === "hotovo");
  const selhale = vysledky.filter((v) => v.stav === "selhalo");
  const cekajici = vysledky.filter((v) => v.stav === "ceka_na_rozhodnuti");

  if (selhale.length > 0) {
    const prvni = selhale[0]!;
    if (selhale.length === 1 && hotove.length === 0) {
      return {
        druh: "chyba",
        nadpis: "Průzkum se nepovedl",
        text: zkrat(
          `${prvni.oblast} — ${prvni.chyba ?? "bez uvedeného důvodu"}. ` +
            "Objednávku jde po opravě zadat znovu.",
        ),
      };
    }
    const uspech = hotove.length > 0 ? `Hotové: ${hotove.map((h) => h.oblast).join(", ")}. ` : "";
    return {
      druh: "chyba",
      nadpis: "Průzkum skončil s chybou",
      text: zkrat(
        `${uspech}Nepovedlo se: ${selhale.map((s) => s.oblast).join(", ")} — ` +
          `${prvni.chyba ?? "bez uvedeného důvodu"}.`,
      ),
    };
  }

  if (hotove.length === 0 && cekajici.length > 0) {
    return {
      druh: "pozor",
      nadpis: "Průzkum čeká na rozhodnutí",
      text: zkrat(
        `${cekajici.map((c) => c.oblast).join(", ")} — nakreslený tvar nezabírá ` +
          "žádnou obec, takže není z čeho hledat. Musí rozhodnout člověk.",
      ),
    };
  }

  const novych = hotove.reduce((s, h) => s + h.firemNovych, 0);

  if (hotove.length === 1) {
    const h = hotove[0]!;
    const text =
      h.firemNovych === 0
        ? `${h.oblast} — žádná nová firma.`
        : `${h.oblast} — ${cislo(h.firemNovych)} ${cesky(h.firemNovych, "nová firma", "nové firmy", "nových firem")}` +
          (h.firemPrevzato > 0 ? `, ${cislo(h.firemPrevzato)} už jsme znali.` : ".");
    return { druh: "hotovo", nadpis: "Průzkum hotový", text: zkrat(text) };
  }

  return {
    druh: "hotovo",
    nadpis: "Průzkum hotový",
    text: zkrat(
      `${cesky(hotove.length, "Prozkoumaná", "Prozkoumané", "Prozkoumaných")} ${hotove.length} ` +
        `${cesky(hotove.length, "oblast", "oblasti", "oblastí")}, ${cislo(novych)} ` +
        `${cesky(novych, "nová firma", "nové firmy", "nových firem")}: ` +
        `${hotove.map((h) => h.oblast).join(", ")}.`,
    ),
  };
}
