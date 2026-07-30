/**
 * Průzkum nakresleného území.
 *
 * Vlastní soubor, aby `cmuchal.ts` (už dnes velký) dál nerostl. Sdílí s ním
 * filtry, ověření v ARES i zápis kandidáta.
 *
 * **Oblast nepřiřazuje firmu k jídelně** — firmy se ukládají s prázdnou
 * jídelnou a o přiřazení rozhoduje vzdálenost, což je samostatná funkce.
 */
import type { AresZaznam } from "./ares.js";
import type { CmuchalDeps } from "./cmuchal.js";
import type { Bod } from "./geo.js";
import { nactiOblast } from "./oblast.js";
import { bodVOblasti, type Oblast } from "./oblast-tvar.js";
import { selhalPruzkum, zahajPruzkum } from "./pruzkum.js";
import type { RegistrZaznam } from "./registr.js";
import { nastavGeo, zalozFirmu, zaznamVyrazeni, type DuvodVyrazeni } from "./repo.js";
import { obceVOblasti, KROK_MRIZKY_M } from "./uzemi.js";

export interface Rozhled {
  obci: number;
  useku: number;
  /** Kolik firem v těch jednotkách registr zná. */
  kandidatu: number;
  /** Kolik bodů mřížky se nepodařilo dohledat. */
  nedohledano: number;
  /** Objednávka čeká na rozhodnutí člověka (tvar nezabírá žádnou obec). */
  cekaNaRozhodnuti: boolean;
}

export async function rozhlednuti(
  deps: CmuchalDeps,
  pruzkumId: string,
  opts: { krokM?: number } = {},
): Promise<Rozhled> {
  const p = await nactiPruzkum(deps.db, pruzkumId);
  const o = await nactiOblast(deps.db, p.oblastId);
  if (!o) throw new Error("Oblast průzkumu neexistuje.");
  const registr = deps.registr;
  if (!registr) throw new Error("Průzkum oblasti se bez registru ČSÚ neobejde.");

  // Objednávku je potřeba rozběhnout hned: `selhalPruzkum` i `dokoncPruzkum`
  // přijmou jen tu, která běží, a bez toho by se neúspěch neměl kam zapsat.
  await zahajPruzkum(deps.db, pruzkumId);

  try {
    const nalez = await obceVOblasti(deps.geokoder, o.oblast, {
      krokM: opts.krokM ?? KROK_MRIZKY_M,
    });

    // Prázdný seznam míst je legitimní odpověď, ať byly nedohledané všechny
    // body mřížky, nebo jen některé — `geokoder.zpetne` vrací `null`, když
    // na daném bodě prostě žádná obec není (odloučená fabrika uprostřed
    // pole), a to je stejně platný výsledek jako nalezená obec. Rozdíl proti
    // mrtvé mapové službě dělá výjimka, ne počet nedohledaných bodů —
    // skutečný geokodér (src/geocode.ts) při selhání služby vyhazuje chybu,
    // ne `null`. Tu chytá `catch` níž.
    if (nalez.mista.length === 0) {
      await deps.db.query("update pruzkumy set stav = 'ceka_na_rozhodnuti' where id = $1", [
        pruzkumId,
      ]);
      return {
        obci: 0, useku: 0, kandidatu: 0,
        nedohledano: nalez.nedohledano, cekaNaRozhodnuti: true,
      };
    }

    const jednotky = await registr.jednotkyPodleMist(nalez.mista);
    let poradi = 0;
    for (const j of jednotky) {
      poradi++;
      await deps.db.query(
        `insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi)
         values ($1,$2,$3,$4) on conflict (pruzkum_id, jednotka) do nothing`,
        [pruzkumId, j.jednotka, j.obec, poradi],
      );
    }

    // Odhad nic nezaměřuje, ale zadarmo taky není úplně: `jednotkyPodleMist`
    // o pár řádků výš a `zamestnavateleVJednotkach` tady každá streamují
    // celý místní soubor registru zvlášť, takže se čte dvakrát. Bez sítě to
    // nic neváží a před několikahodinovým sběrem se to vědomě nechává
    // neoptimalizované.
    const kandidati = await registr.zamestnavateleVJednotkach(
      jednotky.map((j) => j.jednotka),
    );

    return {
      obci: nalez.mista.length,
      useku: jednotky.length,
      kandidatu: kandidati.length,
      nedohledano: nalez.nedohledano,
      cekaNaRozhodnuti: false,
    };
  } catch (chyba) {
    // Výjimka odsud znamená selhání služby (Nominatim nebo registr ČSÚ), ne
    // prázdnou krajinu — tu ohlašuje `mista.length === 0` výš, ne throw. Bez
    // tohohle odchycení by objednávka zůstala navždy trčet ve stavu 'bezi'
    // a kampaň, která na ni čeká, by se nedala nikdy schválit.
    const popis = chyba instanceof Error ? chyba.message : String(chyba);
    await selhalPruzkum(deps.db, pruzkumId, `Rozhlédnutí selhalo: ${popis}`);
    throw chyba;
  }
}

export interface VysledekFirmy {
  stav: "ulozena" | "mimo_tvar" | "vyrazena" | "bez_souradnic";
  ico: string | null;
}

/**
 * Zpracuje jeden záznam z registru pro průzkum oblasti.
 *
 * Vlastní, kratší cesta než `zpracujKandidata` v `cmuchal.ts` — ta je
 * navázaná na jídelnu osmnácti místy včetně celé logiky zón, která u oblasti
 * nedává smysl. Tady rozhoduje tvar, ne vzdálenost od jídelny.
 */
export async function zpracujFirmuVOblasti(
  deps: CmuchalDeps,
  vstup: {
    zaznam: RegistrZaznam;
    oblast: Oblast;
    oblastId: string;
    behId: string;
  },
): Promise<VysledekFirmy> {
  const { db } = deps;
  const { zaznam, oblast, oblastId, behId } = vstup;
  const ico = zaznam.ico;

  /** Vyřazení kandidáta — vždy i se záznamem do deníku (žádná jídelna tu není). */
  const vyrad = (duvod: DuvodVyrazeni, detail: string) =>
    zaznamVyrazeni(db, {
      behId,
      jidelnaId: null,
      zdroj: "registr",
      nazev: zaznam.nazev,
      ico,
      duvod,
      detail,
    });

  let ares: AresZaznam | null = null;
  let bod: Bod | null = null;

  // Krok 1 — firmu se známými souřadnicemi znovu neověřujeme ani nezaměřujeme.
  // Každé zaměření je sekundový dotaz na mapovou službu navíc.
  const znama = await db.query<{ lat: number | null; lng: number | null }>(
    "select lat::float8 as lat, lng::float8 as lng from companies where ico = $1",
    [ico],
  );
  const zname = znama[0];
  if (zname && zname.lat != null && zname.lng != null) {
    bod = { lat: zname.lat, lng: zname.lng };
  } else {
    // Krok 2 — TP-1: bez ověření v ARES firma vzniknout nesmí.
    ares = await deps.ares.overFirmu(ico);
    if (!ares) {
      await vyrad("nesparovano", "registr uvádí IČO, které ARES nezná");
      return { stav: "vyrazena", ico };
    }

    // Krok 3 — zaměření adresy sídla ze záznamu registru.
    const adresa = [zaznam.adresa, zaznam.obec].filter(Boolean).join(", ");
    bod = await deps.geokoder.geokoduj(adresa);
    if (!bod) {
      // Číselník DuvodVyrazeni „bez_souradnic" nezná — nejbližší vhodný je
      // `poloha_neznama`, stejný, jaký pro tenhle případ používá `zpracujKandidata`.
      await vyrad("poloha_neznama", `adresa „${adresa}" se nedá zaměřit`);
      return { stav: "bez_souradnic", ico };
    }
  }

  // Krok 4 — rozhoduje tvar oblasti, ne vzdálenost od jídelny.
  if (!bodVOblasti(oblast, bod)) {
    await vyrad("mimo_zonu", "leží mimo nakreslený tvar oblasti");
    return { stav: "mimo_tvar", ico };
  }

  // Krok 5 — zápis. Vše přes repository vrstvu (TP-1). Oblast nepřiřazuje
  // firmu k jídelně — o to se stará vzdálenost, samostatná funkce.
  if (ares) await zalozFirmu(db, ares);
  await nastavGeo(db, ico, {
    lat: bod.lat,
    lng: bod.lng,
    jidelnaId: null,
    vzdalenostM: null,
    vZone: null,
  });
  await db.query(
    `insert into oblast_firmy (oblast_id, ico) values ($1,$2)
     on conflict (oblast_id, ico) do nothing`,
    [oblastId, ico],
  );

  return { stav: "ulozena", ico };
}

async function nactiPruzkum(db: CmuchalDeps["db"], id: string) {
  const r = await db.query<{ oblastId: string }>(
    `select oblast_id as "oblastId" from pruzkumy where id = $1`,
    [id],
  );
  const p = r[0];
  if (!p) throw new Error("Objednávka průzkumu neexistuje.");
  return p;
}
