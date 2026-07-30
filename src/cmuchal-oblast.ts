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
import { nactiOblast, prepocitejOblastFirmy } from "./oblast.js";
import { bodVOblasti, type Oblast } from "./oblast-tvar.js";
import { dokoncPruzkum, selhalPruzkum, zahajPruzkum } from "./pruzkum.js";
import type { RegistrZaznam } from "./registr.js";
import {
  nastavGeo,
  ukonciBeh,
  zacniBeh,
  zalozFirmu,
  zaznamVyrazeni,
  type DuvodVyrazeni,
} from "./repo.js";
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

export interface VysledekPruzkumu {
  /** Objednávka je uzavřená (hotovo/selhalo) — nezůstal žádný úsek ve stavu 'ceka'. */
  uzavreno: boolean;
  usekuHotovo: number;
  usekuCelkem: number;
  /** Nové firmy nalezené a uložené ve všech dosud hotových úsecích této objednávky. */
  firemNovych: number;
  /** Firmy, které v tvaru leží a v kartotéce už byly — zjištěno přepočtem, ne hledáním. */
  firemPrevzato: number;
}

/**
 * Vyřídí (nebo pokračuje ve vyřizování) objednávky průzkumu — po úsecích,
 * aby šel běh přerušit a bez ztráty práce navázat.
 *
 * Úsek jednou hotový (nebo neúspěšný) se už znovu nezpracovává — celý smysl
 * dělení na úseky je, aby výpadek uprostřed neznamenal začínat od nuly.
 */
export async function vyridPruzkum(
  deps: CmuchalDeps,
  pruzkumId: string,
  opts: { nejvyseUseku?: number } = {},
): Promise<VysledekPruzkumu> {
  const { db } = deps;
  if (!deps.registr) throw new Error("Průzkum oblasti se bez registru ČSÚ neobejde.");
  const registr = deps.registr;

  // Krok 1 — bez úseků není co navazovat, teprve se rozhlédneme. Vrátí-li
  // se to s tím, že tvar nezabírá žádnou obec, není co sbírat — čeká se na
  // člověka, ne na další volání tohohle běhu.
  const existujici = await db.query<{ pocet: number }>(
    "select count(*)::int as pocet from pruzkum_useky where pruzkum_id = $1",
    [pruzkumId],
  );
  if ((existujici[0]?.pocet ?? 0) === 0) {
    const rozhled = await rozhlednuti(deps, pruzkumId);
    if (rozhled.cekaNaRozhodnuti) {
      return { uzavreno: false, usekuHotovo: 0, usekuCelkem: 0, firemNovych: 0, firemPrevzato: 0 };
    }
  }

  // Krok 2 — objednávka musí běžet. `rozhlednuti` ji sama zahajuje, ale při
  // navazujícím volání (úseky už existují) se přes něj nejde, takže tady je
  // to potřeba zopakovat — na už běžící objednávce nedělá `zahajPruzkum` nic.
  await zahajPruzkum(db, pruzkumId);

  const p = await nactiPruzkum(db, pruzkumId);
  const oblast = await nactiOblast(db, p.oblastId);
  if (!oblast) throw new Error("Oblast průzkumu neexistuje.");

  // Krok 3 — záznam běhu a přepočet už známých firem. Nic se přitom
  // nehledá ani nezaměřuje, jen se sáhne do kartotéky.
  const behId = await zacniBeh(db, "cmuchal-oblast", { pruzkumId, oblastId: p.oblastId });
  const firemPrevzato = await prepocitejOblastFirmy(db, p.oblastId);

  // Krok 4 — úseky ve stavu 'ceka' podle pořadí, nejvýš opts.nejvyseUseku.
  const limit = opts.nejvyseUseku;
  const cekajici = await db.query<{ id: string; jednotka: number; obec: string }>(
    limit == null
      ? `select id, jednotka, obec from pruzkum_useky
         where pruzkum_id = $1 and stav = 'ceka' order by poradi`
      : `select id, jednotka, obec from pruzkum_useky
         where pruzkum_id = $1 and stav = 'ceka' order by poradi limit $2`,
    limit == null ? [pruzkumId] : [pruzkumId, limit],
  );

  const chybyBehu: unknown[] = [];

  for (const usek of cekajici) {
    await db.query("update pruzkum_useky set stav = 'bezi' where id = $1", [usek.id]);
    try {
      const zaznamy = await registr.zamestnavateleVJednotkach([usek.jednotka]);
      let novych = 0;
      let mimoTvar = 0;
      for (const zaznam of zaznamy) {
        const vysledek = await zpracujFirmuVOblasti(deps, {
          zaznam,
          oblast: oblast.oblast,
          oblastId: p.oblastId,
          behId,
        });
        if (vysledek.stav === "ulozena") novych++;
        else if (vysledek.stav === "mimo_tvar") mimoTvar++;
      }
      await db.query(
        `update pruzkum_useky
         set stav = 'hotovo', firem_novych = $1, firem_mimo_tvar = $2, dokonceno_at = now()
         where id = $3`,
        [novych, mimoTvar, usek.id],
      );
    } catch (chyba) {
      // Chyba v jednom úseku nesmí zablokovat zbytek — dílčí výsledek je
      // lepší než žádný, další úsek se přesto zkusí.
      const popis = chyba instanceof Error ? chyba.message : String(chyba);
      await db.query(
        `update pruzkum_useky set stav = 'selhalo', chyba = $1, dokonceno_at = now()
         where id = $2`,
        [popis, usek.id],
      );
      chybyBehu.push({ usek: usek.obec, jednotka: usek.jednotka, chyba: popis });
    }
  }

  // Krok 5/6 — stav objednávky podle toho, co z úseků zbylo. Uzavře se, jen
  // když žádný nezůstal čekat — jinak by kampaň dostala zelenou nad
  // neúplným územím.
  const podleStavu = await db.query<{ stav: string; pocet: number }>(
    `select stav, count(*)::int as pocet from pruzkum_useky where pruzkum_id = $1 group by stav`,
    [pruzkumId],
  );
  const pocty = Object.fromEntries(podleStavu.map((r) => [r.stav, r.pocet]));
  const usekuCelkem = podleStavu.reduce((s, r) => s + r.pocet, 0);
  const usekuHotovo = pocty["hotovo"] ?? 0;
  const usekuSelhalo = pocty["selhalo"] ?? 0;
  const usekuCeka = pocty["ceka"] ?? 0;

  const soucetNovych = await db.query<{ soucet: number | null }>(
    `select sum(firem_novych)::int as soucet from pruzkum_useky
     where pruzkum_id = $1 and stav = 'hotovo'`,
    [pruzkumId],
  );
  const firemNovych = soucetNovych[0]?.soucet ?? 0;

  let uzavreno = false;
  if (usekuCeka === 0) {
    if (usekuHotovo === 0 && usekuSelhalo > 0) {
      await selhalPruzkum(db, pruzkumId, `Všechny úseky selhaly (${usekuSelhalo}).`);
    } else {
      await dokoncPruzkum(db, pruzkumId, { firemPrevzato, firemNovych });
    }
    uzavreno = true;
  }

  // Krok 7 — záznam běhu se uzavírá vždy, ať objednávka skončila nebo ne.
  await ukonciBeh(
    db,
    behId,
    { firemPrevzato, firemNovych, usekuHotovo, usekuCelkem },
    chybyBehu.length > 0 ? chybyBehu : undefined,
  );
  await db.query("update pruzkumy set run_id = $1 where id = $2", [behId, pruzkumId]);

  return { uzavreno, usekuHotovo, usekuCelkem, firemNovych, firemPrevzato };
}
