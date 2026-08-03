/**
 * Průzkum nakresleného území.
 *
 * Vlastní soubor, aby `cmuchal.ts` (už dnes velký) dál nerostl. Kvalifikaci
 * („koho vůbec chceme") sdílí s ním přes `src/kvalifikace.ts` — bez toho by
 * pravidlo přidané pro cestu kolem jídelny na oblast tiše nedosáhlo.
 *
 * **Oblast nepřiřazuje firmu k jídelně** — firmy se ukládají s prázdnou
 * jídelnou a o přiřazení rozhoduje vzdálenost, což je samostatná funkce.
 */
import type { AresZaznam } from "./ares.js";
import { nactiBlacklist, type Pravidlo } from "./blacklist.js";
import { VYCHOZI_MIN_ZAMESTNANCU, type CmuchalDeps } from "./cmuchal.js";
import type { Bod } from "./geo.js";
import { kvalifikujFirmu } from "./kvalifikace.js";
import { nactiOblast, prepocitejOblastFirmy } from "./oblast.js";
import { bodVOblasti, type Oblast } from "./oblast-tvar.js";
import { nactiProfil, type Profil } from "./profil.js";
import { dokoncPruzkum, selhalPruzkum, zahajPruzkum } from "./pruzkum.js";
import type { RegistrZaznam } from "./registr.js";
import {
  nastavGeo,
  nastavSkore,
  nastavStav,
  ukonciBeh,
  zacniBeh,
  zalozFirmu,
  zapisAtribut,
  zaznamVyrazeni,
  type DuvodVyrazeni,
} from "./repo.js";
import {
  jeBezZamestnancu, KATEGORIE_PRACOVNIKU, segmentPodleKategorie, type ResUdaje,
} from "./res.js";
import { spocitejSkore } from "./score.js";
import { obceVOblasti, KROK_MRIZKY_M } from "./uzemi.js";

export interface Rozhled {
  obci: number;
  useku: number;
  /** Kolik firem v těch jednotkách registr zná. */
  kandidatu: number;
  /**
   * Kolik z `kandidatu` kartotéka ještě nezná (nebo je zná bez souřadnic) —
   * jen ty se budou při zpracování úseků skutečně zaměřovat
   * (`zpracujFirmuVOblasti` firmu se známými souřadnicemi přeskakuje).
   * Odhad času v CLI se počítá z tohohle čísla, ne z `kandidatu`.
   */
  kandidatuKZamereni: number;
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

  // TP-13 — i rozhlédnutí je běh agenta: sahá na mapovou službu (Nominatim)
  // i na registr ČSÚ, ne jen na databázi. Vlastní běh, oddělený od toho,
  // který později zpracuje úseky (`vyridPruzkum` si zakládá svůj) — obě fáze
  // stojí za samostatný záznam v `agent_runs`.
  const behId = await zacniBeh(deps.db, "cmuchal-oblast-rozhlednuti", {
    pruzkumId, oblastId: p.oblastId,
  });

  // Objednávku je potřeba rozběhnout hned: `selhalPruzkum` i `dokoncPruzkum`
  // přijmou jen tu, která běží, a bez toho by se neúspěch neměl kam zapsat.
  // `behId` se zapisuje rovnou do `pruzkumy.run_id` — další volání
  // `zahajPruzkum` (bez runId, z `vyridPruzkum`) na už běžící objednávce nic
  // nedělá, takže ho nepřepíše zpátky na prázdno.
  await zahajPruzkum(deps.db, pruzkumId, behId);

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
      const vysledek: Rozhled = {
        obci: 0, useku: 0, kandidatu: 0, kandidatuKZamereni: 0,
        nedohledano: nalez.nedohledano, cekaNaRozhodnuti: true,
      };
      await ukonciBeh(deps.db, behId, vysledek);
      return vysledek;
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

    // Kolik z kandidátů kartotéka už zná se souřadnicemi — ty se při
    // zpracování úseků nezaměřují znovu (`zpracujFirmuVOblasti`, krok 1).
    // Nad územím, které se překrývá s dřív prozkoumaným, jich může být
    // většina — proto odhad času v CLI stojí na rozdílu, ne na `kandidatu`.
    const ica = [...new Set(kandidati.map((k) => k.ico))];
    let znamychSeSouradnicemi = 0;
    if (ica.length > 0) {
      const znami = await deps.db.query<{ pocet: number }>(
        `select count(*)::int as pocet from companies
         where ico = any($1) and lat is not null and lng is not null`,
        [ica],
      );
      znamychSeSouradnicemi = znami[0]?.pocet ?? 0;
    }

    const vysledek: Rozhled = {
      obci: nalez.mista.length,
      useku: jednotky.length,
      kandidatu: kandidati.length,
      kandidatuKZamereni: Math.max(0, kandidati.length - znamychSeSouradnicemi),
      nedohledano: nalez.nedohledano,
      cekaNaRozhodnuti: false,
    };
    await ukonciBeh(deps.db, behId, vysledek);
    return vysledek;
  } catch (chyba) {
    // Výjimka odsud znamená selhání služby (Nominatim nebo registr ČSÚ), ne
    // prázdnou krajinu — tu ohlašuje `mista.length === 0` výš, ne throw. Bez
    // tohohle odchycení by objednávka zůstala navždy trčet ve stavu 'bezi'
    // a kampaň, která na ni čeká, by se nedala nikdy schválit.
    const popis = chyba instanceof Error ? chyba.message : String(chyba);
    await selhalPruzkum(deps.db, pruzkumId, `Rozhlédnutí selhalo: ${popis}`);
    await ukonciBeh(deps.db, behId, null, [popis]);
    throw chyba;
  }
}

export interface VysledekFirmy {
  stav: "ulozena" | "mimo_tvar" | "vyrazena" | "bez_souradnic";
  ico: string | null;
  /**
   * Firma v kartotéce dosud nebyla a teď vznikla.
   *
   * Uložení a založení není totéž: firma, kterou už známe odjinud (sběr kolem
   * jídelny, dřívější průzkum), se do oblasti taky „uloží", ale nová není.
   * Bez tohohle rozlišení se při navazujícím běhu hlásily jako nové i firmy,
   * které tentýž průzkum našel minule.
   */
  nova: boolean;
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
    /**
     * Koho vůbec chceme oslovit — stejná pravidla jako u cesty kolem
     * jídelny, sdílená přes `src/kvalifikace.ts`. Bez nich by do oblasti (a
     * odtud do kampaně) mohl spadnout bytový dům, firma bez zaměstnanců,
     * nechtěný obor, blacklistovaná firma nebo naše vlastní jídelna.
     */
    partnerskaIca: ReadonlySet<string>;
    blacklist: readonly Pravidlo[];
    profil: Profil;
  },
): Promise<VysledekFirmy> {
  const { db } = deps;
  const { zaznam, oblast, oblastId, behId, partnerskaIca, blacklist, profil } = vstup;
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
      return { stav: "vyrazena", ico, nova: false };
    }

    // Krok 2b — kvalifikace: chceme tuhle firmu vůbec oslovit? Hned po ověření
    // v ARES a před zaměřováním adresy, ať se neplýtvá vteřinou na geokódování
    // firmy, kterou stejně nechceme. Velikost bere přímo ze záznamu registru
    // (sloupec KATPO) — je stejná jako z ARES statistického registru, ale bez
    // dalšího síťového dotazu (viz `src/zona.ts`, kde se dělá totéž).
    const resUdaje: ResUdaje = {
      ico,
      kategorieKod: zaznam.kategorieKod,
      kategoriePopis: null,
      segment: segmentPodleKategorie(zaznam.kategorieKod),
      bezZamestnancu: jeBezZamestnancu(zaznam.kategorieKod),
      zdrojUrl: zaznam.zdrojUrl,
    };
    const kvalifikace = kvalifikujFirmu({
      ico,
      partnerskaIca,
      ares,
      blacklist,
      profil,
      resUdaje,
      zdroj: "registr",
      minZamestnancu: profil.minZamestnancu ?? VYCHOZI_MIN_ZAMESTNANCU,
    });
    if (!kvalifikace.ok) {
      await vyrad(kvalifikace.duvod, kvalifikace.detail ?? kvalifikace.duvod);
      return { stav: "vyrazena", ico, nova: false };
    }

    // Krok 3 — zaměření adresy sídla ze záznamu registru.
    const adresa = [zaznam.adresa, zaznam.obec].filter(Boolean).join(", ");
    bod = await deps.geokoder.geokoduj(adresa);
    if (!bod) {
      // Číselník DuvodVyrazeni „bez_souradnic" nezná — nejbližší vhodný je
      // `poloha_neznama`, stejný, jaký pro tenhle případ používá `zpracujKandidata`.
      await vyrad("poloha_neznama", `adresa „${adresa}" se nedá zaměřit`);
      return { stav: "bez_souradnic", ico, nova: false };
    }
  }

  // Krok 4 — rozhoduje tvar oblasti, ne vzdálenost od jídelny.
  if (!bodVOblasti(oblast, bod)) {
    await vyrad("mimo_zonu", "leží mimo nakreslený tvar oblasti");
    return { stav: "mimo_tvar", ico, nova: false };
  }

  // Krok 5 — zápis. Vše přes repository vrstvu (TP-1). Oblast nepřiřazuje
  // firmu k jídelně — o to se stará vzdálenost, samostatná funkce.
  if (ares) await zalozFirmu(db, ares);
  // `nastavGeo` se volá JEN pro nově zaměřenou firmu (ares truthy — krok 2/3
  // výš). Pro firmu, která souřadnice už měla (`zname`), se nevolá vůbec:
  // `nastavGeo` v repo.ts je bezpodmínečný `update` bez podmínky, takže by
  // těmhle firmám přepsal `jidelnaId`/`vzdalenostM`/`vZone` na null — tiše by
  // je odstřihl od jejich jídelny a vyhodil z fronty na oslovení (ta filtruje
  // na v_zone is true). Souřadnice se nezměnily a přiřazení k jídelně
  // průzkumu oblasti nepřísluší (rozhoduje o něm vzdálenost, samostatná
  // funkce) — NEOPRAVUJ tohle voláním nastavGeo zpátky pro obě větve.
  if (ares) {
    await nastavGeo(db, ico, {
      lat: bod.lat,
      lng: bod.lng,
      jidelnaId: null,
      vzdalenostM: null,
      vZone: null,
    });
  }
  await db.query(
    `insert into oblast_firmy (oblast_id, ico) values ($1,$2)
     on conflict (oblast_id, ico) do nothing`,
    [oblastId, ico],
  );

  // Nově založená firma z oblasti je kvalifikovaná, ale bez jídelny — přesně
  // stav `cekajici_na_jidelnu`. Skóre se počítá i tak: vzdálenost se nevymýšlí
  // (TP-2), vypadne z výpočtu a zbytek se přepočte na touž stupnici (viz
  // `spocitejSkore`). Bez skóre by se seznam firem v kampani nedal setřídit
  // podle priority — a to je jeho hlavní smysl.
  //
  // Jen u nově založené firmy: firma, kterou už kartotéka znala odjinud, má
  // svůj stav i skóre z lepších podkladů (často včetně vzdálenosti k jídelně)
  // a tady se nepřepisuje.
  if (ares) {
    await nastavStav(db, ico, "cekajici_na_jidelnu");

    /*
     * Velikost se zapisuje **hned při sběru**, ne až zpětným doplněním.
     *
     * Dřív se `KATPO` ze souboru přečetlo, použilo na kvalifikaci a skóre —
     * a zahodilo. Do kartotéky šla velikost z ARESu, kde u běžného dotazu
     * není, takže každá nově sebraná firma zůstala bez velikosti. U kampaně
     * Čachrov to znamenalo 91 firem, z nichž filtr na cílovou velikost
     * nepustil ani jednu.
     *
     * `segmentPodleKategorie` vrací null u „neuvedeno" i „bez zaměstnanců" —
     * ani jedno velikost není a nic se nedomýšlí (TP-2).
     */
    const segment = segmentPodleKategorie(zaznam.kategorieKod);
    if (segment) {
      await zapisAtribut(db, ico, "velikost_kategorie", segment, {
        zdrojUrl: zaznam.zdrojUrl,
        citace:
          "statistický registr ČSÚ, kategorie počtu pracovníků: " +
          `${KATEGORIE_PRACOVNIKU[zaznam.kategorieKod ?? ""]?.popis ?? zaznam.kategorieKod} zaměstnanců`,
      });
    }

    await nastavSkore(
      db,
      ico,
      spocitejSkore({
        vzdalenostM: null, // k žádné jídelně zatím nepatří
        segment: segmentPodleKategorie(zaznam.kategorieKod),
        maVlastniJidelnu: null, // sběr to nezjišťuje, doplní rešerše
        czNace: ares.czNace,
        urovenAdresy: null, // kontakt ještě není
      }),
    );
  }

  return { stav: "ulozena", ico, nova: ares !== null };
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
  /** Objednávka je uzavřená (hotovo/selhalo) — nezůstal žádný úsek ve stavu 'ceka' ani 'bezi'. */
  uzavreno: boolean;
  /** Kumulativně za celou objednávku (i za dřívější volání), ne jen za toto volání. */
  usekuHotovo: number;
  /** Počet všech úseků objednávky, bez ohledu na stav. */
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
  // Přepočet je tu kvůli svému účinku, ne kvůli návratovému číslu: doplní do
  // oblasti firmy, které v tvaru leží a kartotéka je zná odjinud. Kolik jich
  // bylo „převzatých", se spočítá až na konci — viz krok 6.
  await prepocitejOblastFirmy(db, p.oblastId);

  // Krok 3b — pravidla kvalifikace: koho vůbec chceme (src/kvalifikace.ts).
  // Stejně jako `spustCmuchala` v cmuchal.ts — načtou se jednou, platí pro
  // celý běh. Bez toho by nové pravidlo blacklistu, platné pro cestu kolem
  // jídelny, na oblast tiše nedosáhlo.
  const partnerskaIca = new Set(
    (await db.query<{ ico: string }>("select ico from jidelny where ico is not null")).map(
      (j) => j.ico,
    ),
  );
  const blacklist = await nactiBlacklist(db);
  const profil = await nactiProfil(db);

  // Krok 4 — úseky ve stavu 'ceka' i 'bezi', podle pořadí, nejvýš
  // opts.nejvyseUseku.
  //
  // 'bezi' se vyzvedává znovu záměrně: to je přesně stav, ve kterém úsek
  // zůstane, když proces spadne uprostřed zpracování — a kvůli přerušení
  // uprostřed se dělení na úseky vůbec dělá. Kdyby se bralo jen 'ceka',
  // rozdělaný úsek by navždy uvázl v 'bezi' a objednávka by se (protože
  // nikde nezbývá 'ceka') mylně uzavřela na 'hotovo' nad neúplným územím.
  // Zpracování znovu je levné — firmy se známými souřadnicemi se v
  // `zpracujFirmuVOblasti` nezaměřují podruhé.
  //
  // Tohle stojí na předpokladu jednoho běhu nad danou objednávkou naráz —
  // souběžné vyřizování téže objednávky z víc procesů by si úseky rvalo
  // mezi sebou. To je vědomě mimo rozsah (ADR by řešil zamykání úseku).
  const limit = opts.nejvyseUseku;
  const cekajici = await db.query<{ id: string; jednotka: number; obec: string }>(
    limit == null
      ? `select id, jednotka, obec from pruzkum_useky
         where pruzkum_id = $1 and stav in ('ceka', 'bezi') order by poradi`
      : `select id, jednotka, obec from pruzkum_useky
         where pruzkum_id = $1 and stav in ('ceka', 'bezi') order by poradi limit $2`,
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
          partnerskaIca,
          blacklist,
          profil,
        });
        // Počítá se založení, ne uložení. Firma, kterou kartotéka už znala,
        // se do oblasti taky uloží, ale nová není — jinak by se při
        // navazujícím běhu hlásila jako nová podruhé.
        if (vysledek.stav === "ulozena") {
          if (vysledek.nova) novych++;
        } else if (vysledek.stav === "mimo_tvar") mimoTvar++;
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
  // když žádný nezůstal ve stavu 'ceka' ANI 'bezi' — jinak by kampaň
  // dostala zelenou nad neúplně prozkoumaným územím (viz komentář ke
  // kroku 4: 'bezi' může být rozdělaný úsek po pádu procesu, ne úsek, který
  // se zpracovává právě teď v jiném vlákně).
  const podleStavu = await db.query<{ stav: string; pocet: number }>(
    `select stav, count(*)::int as pocet from pruzkum_useky where pruzkum_id = $1 group by stav`,
    [pruzkumId],
  );
  const pocty = Object.fromEntries(podleStavu.map((r) => [r.stav, r.pocet]));
  const usekuCelkem = podleStavu.reduce((s, r) => s + r.pocet, 0);
  const usekuHotovo = pocty["hotovo"] ?? 0;
  const usekuSelhalo = pocty["selhalo"] ?? 0;
  const usekuNedokonceno = (pocty["ceka"] ?? 0) + (pocty["bezi"] ?? 0);

  const soucetNovych = await db.query<{ soucet: number | null }>(
    `select sum(firem_novych)::int as soucet from pruzkum_useky
     where pruzkum_id = $1 and stav = 'hotovo'`,
    [pruzkumId],
  );
  const firemNovych = soucetNovych[0]?.soucet ?? 0;

  // „Převzaté" = firmy, které v tvaru leží a NEZALOŽIL je tenhle průzkum.
  // Odvozuje se odečtením, ne měřením na začátku běhu: kdyby se vzal prostý
  // počet firem v oblasti, obsahoval by při navazujícím běhu i to, co tentýž
  // průzkum našel minule — a ty by se počítaly dvakrát (jednou jako nové,
  // podruhé jako převzaté).
  const vOblasti = await db.query<{ pocet: number }>(
    "select count(*)::int as pocet from oblast_firmy where oblast_id = $1",
    [p.oblastId],
  );
  const firemPrevzato = Math.max(0, (vOblasti[0]?.pocet ?? 0) - firemNovych);

  let uzavreno = false;
  if (usekuNedokonceno === 0) {
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
