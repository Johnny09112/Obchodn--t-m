/**
 * Postup průzkumu přeložený do věty pro člověka.
 *
 * **Čistý modul — sdílí ho webová aplikace, nesmí sem nic z databáze.**
 * Hlídá to `test/hranice-aplikace.test.ts`.
 *
 * Proč vůbec: stav `bezi` sám o sobě neříká nic. Majitel se díval na
 * průzkum, který 78 minut nehlásil jediné číslo, a neměl jak zjistit, že
 * se zasekl na Plzni — ani že mu druhá objednávka stojí ve frontě za ním.
 */
import { zZe } from "./cestina.js";

export interface UsekProPostup {
  stav: string;
}

export interface Postup {
  hotovo: number;
  celkem: number;
  selhalo: number;
  /** Věta, která odpovídá na „co se právě děje a na co se čeká". */
  popis: string;
  /** Hrubý odhad zbývajících minut. `null`, když se odhadnout nedá. */
  odhadMinut: number | null;
}

/** Jedna oblast kampaně i s tím, jak na tom je její objednávka. */
export interface OblastPostup {
  nazev: string;
  /** Stav objednávky, nebo `null` když žádná není. */
  stav: string | null;
  /** Postup té objednávky, nebo `null` když žádná není. */
  postup: Postup | null;
}

export interface SouhrnPruzkumu {
  hotovych: number;
  selhalych: number;
  celkem: number;
  /** Oblasti, pro které se ještě neobjednalo. */
  bezObjednavky: string[];
  popis: string;
  /** Odhad zbývajících minut, nebo `null` když se nedá udělat. */
  odhadMinut: number | null;
}

/**
 * Postup kampaně, která stojí na víc oblastech.
 *
 * Každá oblast má vlastní objednávku a agent je bere po jedné. Sečíst
 * obce napříč objednávkami by lhalo — dvě oblasti se můžou překrývat, takže
 * „hotovo 40 z 90 obcí" by nedávalo smysl. Počítají se proto **oblasti**
 * a rozepisuje se jen ta, která se právě řeší.
 */
export function souhrnPruzkumu(oblasti: readonly OblastPostup[]): SouhrnPruzkumu {
  const celkem = oblasti.length;
  const hotove = oblasti.filter((o) => o.stav === "hotovo");
  const selhale = oblasti.filter((o) => o.stav === "selhalo");
  const bezObjednavky = oblasti.filter((o) => o.stav === null).map((o) => o.nazev);

  const zaklad = {
    hotovych: hotove.length,
    selhalych: selhale.length,
    celkem,
    bezObjednavky,
  };

  if (celkem === 0) {
    return { ...zaklad, odhadMinut: null, popis: "Území zatím není vybrané." };
  }

  if (bezObjednavky.length === celkem) {
    return { ...zaklad, odhadMinut: null, popis: "Průzkum zatím není objednaný." };
  }

  // Jediná oblast: mluv o obcích, ne o oblastech. Počítání „hotová 1 z 1"
  // by k větě nic nepřidalo a jen ji zamlžilo.
  if (celkem === 1) {
    const jedina = oblasti[0]!;
    return {
      ...zaklad,
      odhadMinut: jedina.postup?.odhadMinut ?? null,
      popis: jedina.postup?.popis ?? "Průzkum zatím není objednaný.",
    };
  }

  if (hotove.length === celkem) {
    return {
      ...zaklad,
      odhadMinut: 0,
      popis:
        celkem === 2
          ? "Hotovo — prozkoumané jsou obě oblasti."
          : `Hotovo — prozkoumaných je všech ${celkem} oblastí.`,
    };
  }

  // Rozepisuje se ta, na které se dá čekat: běžící, jinak první nehotová.
  const nahlas =
    oblasti.find((o) => o.stav === "bezi") ??
    selhale[0] ??
    oblasti.find((o) => o.stav !== null && o.stav !== "hotovo");

  const kolik =
    `${hotove.length === 1 ? "Hotová" : "Hotové"} ${hotove.length} ` +
    `${zZe(celkem)} ${celkem} oblastí.`;
  const detail = nahlas?.postup ? ` ${nahlas.nazev}: ${nahlas.postup.popis}` : "";

  return { ...zaklad, odhadMinut: odhadCelkem(oblasti), popis: kolik + detail };
}

/**
 * Součet zbývajících minut. `null`, jakmile se u některé nedokončené
 * oblasti odhadnout nedá — částečný součet by tvrdil míň, než je pravda.
 */
function odhadCelkem(oblasti: readonly OblastPostup[]): number | null {
  let soucet = 0;
  for (const o of oblasti) {
    if (o.stav === "hotovo") continue;
    const m = o.postup?.odhadMinut;
    if (m == null) return null;
    soucet += m;
  }
  return soucet;
}

function minutySlovy(m: number): string {
  if (m < 1) return "necelou minutu";
  if (m < 60) return `${m} minut`;
  const hodin = Math.floor(m / 60);
  const zbytek = m % 60;
  const h = hodin === 1 ? "hodinu" : hodin < 5 ? `${hodin} hodiny` : `${hodin} hodin`;
  return zbytek === 0 ? h : `${h} a ${zbytek} minut`;
}

export function postupPruzkumu(v: {
  stav: string;
  useky: UsekProPostup[];
  /** Jak dlouho už objednávka běží (nebo čeká), v minutách. */
  bezPredMinutami: number;
  /** Obec, která se právě zpracovává. */
  bezicíObec?: string | null;
  /** Název oblasti jiného průzkumu, který drží frontu. */
  blokujeJiny?: string | null;
  /** Za kolik minut se hlídka podívá do fronty. */
  dalsiBehZa?: number | null;
}): Postup {
  const hotovo = v.useky.filter((u) => u.stav === "hotovo").length;
  const selhalo = v.useky.filter((u) => u.stav === "selhalo").length;
  const celkem = v.useky.length;

  const dovetekSelhani =
    selhalo === 0
      ? ""
      : selhalo === 1
        ? " Jedna obec se nepovedla, zkusí se znovu."
        : ` ${selhalo} obce se nepovedly, zkusí se znovu.`;

  if (v.stav === "hotovo") {
    return { hotovo, celkem, selhalo, odhadMinut: 0, popis: `Hotovo — prozkoumáno ${hotovo} obcí.` };
  }

  if (v.stav === "selhalo") {
    return {
      hotovo,
      celkem,
      selhalo,
      odhadMinut: null,
      popis: "Průzkum se nepovedl. Důvod je u objednávky zapsaný; po opravě jde objednat znovu.",
    };
  }

  if (v.stav === "ceka_na_rozhodnuti") {
    return {
      hotovo,
      celkem,
      selhalo,
      odhadMinut: null,
      popis: "Tvar nezabírá žádnou obec — musí rozhodnout člověk, sám se to nerozjede.",
    };
  }

  // Objednávka ještě nezačala: buď čeká na hlídku, nebo na jiný průzkum.
  if (celkem === 0) {
    if (v.blokujeJiny) {
      return {
        hotovo,
        celkem,
        selhalo,
        odhadMinut: null,
        // Běží jen jeden průzkum naráz — dva by si braly rozdělané obce.
        popis: `Čeká, až doběhne průzkum „${v.blokujeJiny}". Naráz běží jen jeden.`,
      };
    }
    const kdy =
      v.dalsiBehZa == null ? "při nejbližším běhu hlídky" : `zhruba za ${minutySlovy(v.dalsiBehZa)}`;
    return {
      hotovo,
      celkem,
      selhalo,
      odhadMinut: null,
      popis: `Čeká na spuštění — hlídka si ho vyzvedne ${kdy}.`,
    };
  }

  const kde = v.bezicíObec ? ` Právě: ${v.bezicíObec}.` : "";

  // Odhad jen z hotových obcí. Bez jediné hotové by to byl dohad — velké
  // město trvá i hodinu, vesnice vteřiny.
  if (hotovo === 0) {
    return {
      hotovo,
      celkem,
      selhalo,
      odhadMinut: null,
      popis:
        `Běží ${minutySlovy(v.bezPredMinutami)}, hotovo 0 z ${celkem} obcí.${kde}` +
        " Odhad zatím nejde udělat — velká města zaberou i hodinu." +
        dovetekSelhani,
    };
  }

  const naObec = v.bezPredMinutami / hotovo;
  const zbyva = celkem - hotovo;
  const odhadMinut = Math.round(naObec * zbyva);

  return {
    hotovo,
    celkem,
    selhalo,
    odhadMinut,
    popis:
      `Běží ${minutySlovy(v.bezPredMinutami)}, hotovo ${hotovo} z ${celkem} obcí.${kde}` +
      ` Zbývá zhruba ${minutySlovy(odhadMinut)}.` +
      dovetekSelhani,
  };
}
