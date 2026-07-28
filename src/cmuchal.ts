import type { AresKlient, AresZaznam } from "./ares.js";
import type { Db } from "./db.js";
import type { Enricher } from "./enrich.js";
import { naBlacklistu, nactiBlacklist, type Pravidlo } from "./blacklist.js";
import { FORMY_ZAMESTNAVATELU, jeBytovyDum, popisFormy } from "./formy.js";
import { jeValidniIco } from "./ico.js";
import { klasifikujZonu, vzdalenostM, type Bod } from "./geo.js";
import type { Geokoder } from "./geocode.js";
import type { MpsvKlient, MpsvKontakt } from "./mpsv.js";
import type { OsmKlient } from "./osm.js";
import type { RegistrKlient } from "./registr.js";
import type { ResKlient } from "./res.js";
import { jeVyloucenyObor, spocitejSkore } from "./score.js";
import { splnujeMinimum } from "./res.js";
import {
  nastavGeo,
  nastavSkore,
  nastavStav,
  ukonciBeh,
  zacniBeh,
  zalozFirmu,
  zapisAtribut,
  zapisDosah,
  zapisKontakt,
  zaznamVyrazeni,
  type DuvodVyrazeni,
} from "./repo.js";

export interface CmuchalDeps {
  db: Db;
  ares: AresKlient;
  res: ResKlient;
  geokoder: Geokoder;
  /** Zaměstnavatelé s pracovištěm v obci (otevřená data MPSV). */
  mpsv?: MpsvKlient;
  /** Fyzická pracoviště v zóně (OpenStreetMap). */
  osm?: OsmKlient;
  /**
   * Kompletní registr ČSÚ. Je-li k dispozici, nahrazuje sweep ARES —
   * nemá limit 1 000 výsledků a zná velikost firmy dopředu.
   */
  registr?: RegistrKlient;
  /** Bez enricheru běží jen deterministická část. */
  enricher?: Enricher;
}

/**
 * Výchozí minimální počet zaměstnanců. Mikrofirmy do 10 lidí se vyplatí
 * oslovovat jen výjimečně — práce je stejná, odběr zlomkový.
 */
export const VYCHOZI_MIN_ZAMESTNANCU = 10;

export type ZdrojKandidata = "mpsv" | "osm" | "ares" | "registr";

interface Kandidat {
  zdroj: ZdrojKandidata;
  zdrojUrl: string;
  ico?: string;
  nazev: string;
  /** Známá poloha pracoviště (OSM). Jinak se dopočítá z adresy sídla. */
  poloha?: Bod;
  nabizenychMist?: number;
  /**
   * Velikost už známá ze zdroje (registr ČSÚ ji nese s sebou). Ušetří dotaz
   * do statistického registru na každou firmu zvlášť.
   */
  kategorieKod?: string;
  /** Kontaktní osoba, kterou zaměstnavatel sám zveřejnil (otevřená data MPSV). */
  kontakt?: MpsvKontakt;
}

export interface CmuchalSouhrn {
  behId: string;
  kandidatu: number;
  dleZdroje: Record<ZdrojKandidata, number>;
  /** Kolik firem odpadlo v registru na prahu velikosti, než se na ně sáhlo. */
  odfiltrovanoVRegistru: number;
  kvalifikovano: number;
  cekajicich: number;
  bezZamestnancu: number;
  podLimitem: number;
  agentur: number;
  /** Kandidátů vyřazených proto, že jsou to naše vlastní partnerské jídelny. */
  partnerskychJidelen: number;
  /** Společenství vlastníků a bytová družstva — dům, ne zaměstnavatel. */
  bytovychDomu: number;
  /** Vyřazeno ručním pravidlem majitele. */
  naBlacklistu: number;
  vyloucenyObor: number;
  nesparovano: number;
  zahozeno: number;
  preskoceno: number;
  chyby: Array<{ kdo: string; chyba: string }>;
  nakladyUsd: number;
  poznamkyProPlaybook: string[];
}

interface Jidelna {
  id: string;
  nazev: string;
  obec: string | null;
  lat: number;
  lng: number;
  kod_obce: number | null;
  ico: string | null;
  zona_metru: number;
  kapacita_volna: number | null;
  aktivni: boolean;
}

/**
 * Čmuchal v2 — obrácené hledání.
 *
 * Místo „kdo je zapsaný v téhle obci" se ptá „kde se v téhle zóně pracuje".
 * Kandidáty sbírá ze tří zdrojů, každého ověří v ARES (TP-1), odfiltruje
 * ty bez zaměstnanců a teprve pak boduje. Nikdy nic neodesílá.
 */
export async function spustCmuchala(
  deps: CmuchalDeps,
  jidelnaId: string,
  opts: { limit?: number; aresSweep?: boolean; minZamestnancu?: number } = {},
): Promise<CmuchalSouhrn> {
  const { db } = deps;

  const jidelny = await db.query<Jidelna>(
    `select id, nazev, obec, lat::float8 as lat, lng::float8 as lng, kod_obce,
            ico, zona_metru, kapacita_volna, aktivni
     from jidelny where id = $1`,
    [jidelnaId],
  );
  let souhrnPoznamka: string | null = null;
  const jidelna = jidelny[0];
  if (!jidelna) throw new Error(`Jídelna ${jidelnaId} neexistuje`);
  if (!jidelna.aktivni) {
    throw new Error(`Jídelna ${jidelna.nazev} není aktivní`);
  }
  // Kapacita se tu záměrně NEkontroluje: sbírat data se smí i bez ní, protože
  // na výsledek hledání nemá vliv. Strop obchodu (SPEC kap. 2) se uplatní až
  // u fronty na oslovení — tam bez známé kapacity neodejde nic.
  if (jidelna.kapacita_volna === null) {
    souhrnPoznamka = `kapacita jídelny ${jidelna.nazev} není známá — pro sběr nevadí, před oslovením ji bude potřeba doplnit`;
  } else if (jidelna.kapacita_volna <= 0) {
    souhrnPoznamka = `jídelna ${jidelna.nazev} nemá volnou kapacitu — firmy se posbírají, ale oslovovat nelze`;
  }

  const behId = await zacniBeh(db, "cmuchal", {
    jidelnaId,
    limit: opts.limit ?? null,
    aresSweep: opts.aresSweep !== false,
    minZamestnancu: opts.minZamestnancu ?? VYCHOZI_MIN_ZAMESTNANCU,
  });

  const souhrn: CmuchalSouhrn = {
    behId,
    kandidatu: 0,
    dleZdroje: { mpsv: 0, osm: 0, ares: 0, registr: 0 },
    odfiltrovanoVRegistru: 0,
    kvalifikovano: 0,
    cekajicich: 0,
    bezZamestnancu: 0,
    podLimitem: 0,
    agentur: 0,
    partnerskychJidelen: 0,
    bytovychDomu: 0,
    naBlacklistu: 0,
    vyloucenyObor: 0,
    nesparovano: 0,
    zahozeno: 0,
    preskoceno: 0,
    chyby: [],
    nakladyUsd: 0,
    poznamkyProPlaybook: [],
  };
  if (souhrnPoznamka) souhrn.poznamkyProPlaybook.push(souhrnPoznamka);

  // Naši partneři nejsou zákazníci. Bereme IČO všech jídelen, ne jen té
  // aktuální — škola z Tlučné se objeví i při běhu na sousedním Zbůchu.
  const partnerskaIca = new Set(
    (await db.query<{ ico: string }>("select ico from jidelny where ico is not null"))
      .map((j) => j.ico),
  );

  // Ruční pravidla majitele — načtou se jednou, platí pro celý běh.
  const blacklist = await nactiBlacklist(db);

  try {
    const kandidati = await sesbirejKandidaty(deps, jidelna, souhrn, opts);
    souhrn.kandidatu = kandidati.length;

    for (const kandidat of kandidati.slice(0, opts.limit ?? kandidati.length)) {
      try {
        await zpracujKandidata(deps, jidelna, kandidat, souhrn, {
          minZamestnancu: opts.minZamestnancu ?? VYCHOZI_MIN_ZAMESTNANCU,
          partnerskaIca,
          blacklist,
        });
      } catch (e) {
        souhrn.chyby.push({
          kdo: kandidat.ico ?? kandidat.nazev,
          chyba: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    const { chyby, ...vystup } = souhrn;
    await ukonciBeh(db, behId, vystup, chyby, souhrn.nakladyUsd);
  }

  return souhrn;
}

/** Sesbírá kandidáty ze všech dostupných zdrojů a odstraní duplicity. */
async function sesbirejKandidaty(
  deps: CmuchalDeps,
  jidelna: Jidelna,
  souhrn: CmuchalSouhrn,
  opts: { aresSweep?: boolean; minZamestnancu?: number },
): Promise<Kandidat[]> {
  const kandidati: Kandidat[] = [];

  // Zdroj A — zaměstnavatelé s pracovištěm v obci. Nejsilnější signál:
  // říká, že tu firma reálně pracuje, ne kde má razítko.
  if (deps.mpsv && jidelna.kod_obce != null) {
    try {
      for (const z of await deps.mpsv.zamestnavateleVObci(jidelna.kod_obce)) {
        // Agentura práce sama v obci nikoho nekrmí — obědy řeší firma, kde
        // ti lidé fyzicky pracují. Pokud ji inzerát prozradí, přidáme rovnou ji.
        if (z.jeAgentura) {
          souhrn.agentur++;
          await zaznamVyrazeni(deps.db, {
            behId: souhrn.behId, jidelnaId: jidelna.id, zdroj: "mpsv",
            nazev: z.nazev, ico: z.ico, duvod: "agentura",
            detail: z.proKoho ? `nabírá pro ${z.proKoho}` : "označeno jako agentura práce",
          });
          souhrn.poznamkyProPlaybook.push(
            `agentura práce vyřazena: ${z.nazev}${z.proKoho ? ` (nabírala pro ${z.proKoho})` : ""}`,
          );
          if (z.proKoho) {
            kandidati.push({
              zdroj: "mpsv",
              zdrojUrl: z.zdrojUrl,
              nazev: z.proKoho,
              nabizenychMist: z.mist,
            });
            souhrn.dleZdroje.mpsv++;
          }
          continue;
        }
        kandidati.push({
          zdroj: "mpsv",
          zdrojUrl: z.zdrojUrl,
          ico: z.ico,
          nazev: z.nazev,
          nabizenychMist: z.mist,
          kontakt: z.kontakt,
        });
        souhrn.dleZdroje.mpsv++;
      }
    } catch (e) {
      souhrn.chyby.push({ kdo: "zdroj MPSV", chyba: e instanceof Error ? e.message : String(e) });
    }
  }

  // Zdroj B — fyzická pracoviště v zóně. Zachytí provozovny firem
  // sídlících jinde (typicky výrobní haly).
  if (deps.osm) {
    try {
      const pracoviste = await deps.osm.najdiPracoviste(
        { lat: jidelna.lat, lng: jidelna.lng },
        jidelna.zona_metru,
      );
      for (const p of pracoviste) {
        kandidati.push({
          zdroj: "osm",
          zdrojUrl: p.zdrojUrl,
          nazev: p.nazev,
          poloha: { lat: p.lat, lng: p.lng },
        });
        souhrn.dleZdroje.osm++;
      }
    } catch (e) {
      souhrn.chyby.push({ kdo: "zdroj OSM", chyba: e instanceof Error ? e.message : String(e) });
    }
  }

  // Zdroj C — kompletní seznam firem sídlících v území.
  //
  // Přednost má registr ČSÚ: nemá limit 1 000 výsledků, takže funguje stejně
  // na vesnici i v Praze, a nese s sebou velikost firmy. Práh velikosti se
  // proto uplatní JEŠTĚ V REGISTRU — malé firmy se vůbec nestahují.
  // Sweep ARES zůstává jako záloha, když registr není k dispozici.
  if (opts.aresSweep !== false && deps.registr) {
    try {
      // Statutární město je v registru rozdělené na obvody. Bez jejich
      // dohledání by jídelna v Plzni viděla desetinu města.
      const jednotky = jidelna.ico ? await deps.registr.jednotkyObce(jidelna.ico) : [];
      const kde = jednotky.length ? jednotky : jidelna.kod_obce != null ? [jidelna.kod_obce] : [];

      if (kde.length === 0) {
        souhrn.poznamkyProPlaybook.push(
          `jídelna ${jidelna.nazev} nemá IČO ani kód obce — registr se nedal použít`,
        );
      } else {
        if (kde.length > 1) {
          souhrn.poznamkyProPlaybook.push(
            `${jidelna.obec ?? "obec"} je v registru rozdělená na ${kde.length} územních jednotek`,
          );
        }
        const minZam = opts.minZamestnancu ?? VYCHOZI_MIN_ZAMESTNANCU;
        for (const f of await deps.registr.zamestnavateleVJednotkach(kde, {
          minZamestnancu: minZam,
        })) {
          kandidati.push({
            zdroj: "registr",
            zdrojUrl: f.zdrojUrl,
            ico: f.ico,
            nazev: f.nazev,
            kategorieKod: f.kategorieKod,
          });
          souhrn.dleZdroje.registr++;
        }
      }
    } catch (e) {
      const zprava = e instanceof Error ? e.message : String(e);
      souhrn.chyby.push({ kdo: "registr ČSÚ", chyba: zprava });
      souhrn.poznamkyProPlaybook.push(`registr ČSÚ se nepodařilo použít: ${zprava}`);
    }
  } else if (opts.aresSweep !== false && jidelna.kod_obce != null) {
    try {
      // 1 000 je tvrdý strop samotného ARES. Dotaz proto rovnou zužujeme na
      // právní formy zaměstnavatelů — bez toho sweep spadne na každé obci
      // nad tisíc subjektů (Stříbro 1 580 → 285). Živnostníci a bytové domy
      // tím z výsledku mizí u zdroje, ne až po stažení.
      for (const f of await deps.ares.najdiFirmyVObci(jidelna.kod_obce, {
        max: 1000,
        pravniFormy: FORMY_ZAMESTNAVATELU,
      })) {
        kandidati.push({
          zdroj: "ares",
          zdrojUrl: `https://ares.gov.cz/ekonomicke-subjekty/${f.ico}`,
          ico: f.ico,
          nazev: f.nazev,
        });
        souhrn.dleZdroje.ares++;
      }
    } catch (e) {
      const zprava = e instanceof Error ? e.message : String(e);
      souhrn.chyby.push({ kdo: "zdroj ARES", chyba: zprava });
      // Výpadek sweepu znamená díru v pokrytí — musí být vidět v souhrnu,
      // ne jen v technickém výpisu chyb, jinak se tichá ztráta tváří jako
      // úspěšný sběr.
      souhrn.poznamkyProPlaybook.push(`sweep rejstříku neproběhl: ${zprava}`);
    }
  }

  // Deduplikace: přednost má záznam s IČO a s vyšším počtem nabízených míst.
  const podleKlice = new Map<string, Kandidat>();
  for (const k of kandidati) {
    const klic = k.ico ?? `nazev:${k.nazev.toLowerCase()}`;
    const stavajici = podleKlice.get(klic);
    if (!stavajici || (k.nabizenychMist ?? 0) > (stavajici.nabizenychMist ?? 0)) {
      podleKlice.set(klic, { ...stavajici, ...k });
    }
  }
  // Nejdřív ti s doloženým náborem — u nich je největší šance na uzavření.
  return [...podleKlice.values()].sort(
    (a, b) => (b.nabizenychMist ?? 0) - (a.nabizenychMist ?? 0),
  );
}

/**
 * Uloží kontaktní osobu z inzerátu úřadu práce.
 *
 * Účel adresy se zapisuje pravdivě: ten člověk svůj kontakt zveřejnil kvůli
 * uchazečům o zaměstnání, ne kvůli nabídkám dodavatelů. Bez toho by při
 * schvalování oslovení nešlo poznat, odkud adresa je — a to je právě ten
 * rozdíl, na kterém stojí rozhodnutí, jestli se na ni smí psát (TP-6).
 */
async function zapisKontaktZInzeratu(
  db: Db,
  ico: string,
  kontakt: MpsvKontakt,
  zdrojUrl: string,
): Promise<void> {
  const kdo = [kontakt.jmeno, kontakt.prijmeni].filter(Boolean).join(" ") || "kontaktní osoba";
  await zapisKontakt(db, ico, {
    jmeno: kontakt.jmeno ?? undefined,
    prijmeni: kontakt.prijmeni ?? undefined,
    pozice: kontakt.pozice ?? undefined,
    email: kontakt.email ?? undefined,
    telefon: kontakt.telefon ?? undefined,
    // Jmenná adresa konkrétní osoby — nejnižší priorita ze tří úrovní.
    urovenAdresy: 3,
    zdrojUrl,
    citace:
      `otevřená data MPSV, inzerát na volné místo: kontaktní osoba ${kdo}` +
      `${kontakt.pozice ? ` (${kontakt.pozice})` : ""}`,
  });

  await zapisAtribut(db, ico, "ucel_adresy", "zveřejněno pro uchazeče o zaměstnání", {
    zdrojUrl,
    citace:
      "otevřená data MPSV: údaj je v inzerátu na volné místo v poli " +
      "„komu se hlásit“ — je určený uchazečům o práci, ne dodavatelům",
  });
}

async function zpracujKandidata(
  deps: CmuchalDeps,
  jidelna: Jidelna,
  kandidat: Kandidat,
  souhrn: CmuchalSouhrn,
  pravidla: {
    minZamestnancu: number;
    partnerskaIca: Set<string>;
    blacklist: readonly Pravidlo[];
  },
): Promise<void> {
  const { db } = deps;
  const { minZamestnancu, partnerskaIca } = pravidla;

  /** Vyřazení kandidáta — vždy i se záznamem do deníku, ať se dá kalibrovat. */
  const vyrad = async (duvod: DuvodVyrazeni, detail?: string, ico?: string) => {
    await zaznamVyrazeni(db, {
      behId: souhrn.behId,
      jidelnaId: jidelna.id,
      zdroj: kandidat.zdroj,
      nazev: kandidat.nazev,
      ico,
      duvod,
      detail,
    });
  };

  // Krok 1 — přiřazení právního subjektu. TP-1: bez ARES firma nevznikne.
  let ico = kandidat.ico;
  if (!ico) {
    const shoda = await deps.ares.najdiPodleJmena(kandidat.nazev);
    if (!shoda) {
      souhrn.nesparovano++;
      souhrn.poznamkyProPlaybook.push(`nespárováno s rejstříkem: ${kandidat.nazev}`);
      await vyrad("nesparovano", "název z mapy nemá jednoznačnou shodu v rejstříku");
      return;
    }
    ico = shoda.ico;
  }
  if (!jeValidniIco(ico)) {
    souhrn.zahozeno++;
    await vyrad("neplatne_ico", `IČO ${ico} neprošlo kontrolním součtem`, ico);
    return;
  }

  // Partnerská jídelna se ze sweepu rejstříku tváří jako běžný zaměstnavatel.
  // Nabízet obědy tomu, kdo je pro nás vaří, nedává smysl.
  if (partnerskaIca.has(ico)) {
    souhrn.partnerskychJidelen++;
    souhrn.poznamkyProPlaybook.push(`vlastní jídelna mezi kandidáty: ${kandidat.nazev}`);
    await vyrad("partnerska_jidelna", "je to naše partnerská jídelna, ne zákazník", ico);
    return;
  }

  // Firmu, kterou už známe, znovu neověřujeme ani nezaměřujeme. Zaznamenáme
  // ale, že ji má v dosahu i tahle jídelna — firma smí patřit víc jídelnám
  // zároveň a nepřeřazuje se mezi nimi (rozhodnutí majitele 2026-07-28).
  const jizJe = await db.query<{ lat: number | null; lng: number | null }>(
    "select lat::float8 as lat, lng::float8 as lng from companies where ico = $1",
    [ico],
  );
  if (jizJe.length > 0) {
    souhrn.preskoceno++;
    const znama = jizJe[0]!;
    if (znama.lat != null && znama.lng != null) {
      const m = vzdalenostM({ lat: znama.lat, lng: znama.lng }, { lat: jidelna.lat, lng: jidelna.lng });
      await zapisDosah(db, ico, jidelna.id, { vzdalenostM: m, vZone: m <= jidelna.zona_metru });
    }
    return;
  }

  const ares = await deps.ares.overFirmu(ico);
  if (!ares) {
    souhrn.zahozeno++;
    await vyrad("neni_v_ares", "rejstřík subjekt nezná", ico);
    return;
  }

  // Krok 2 — filtry.
  // Bytový dům (společenství vlastníků, bytové družstvo) zaměstnance formálně
  // má — správce, úklid —, ale nikdo tam neobědvá. Živnostníci se naopak
  // NEVYŘAZUJÍ: majitel je bude oslovovat jinou formou (rozhodnutí 2026-07-27).
  if (jeBytovyDum(ares.pravniForma)) {
    souhrn.bytovychDomu++;
    await vyrad("bytovy_dum", popisFormy(ares.pravniForma) ?? "bytový dům", ico);
    return;
  }

  // Ruční pravidla majitele. Až za ověřením v rejstříku, protože pravidlo
  // může mířit na obor nebo právní formu, které jsou známé teprve odtud.
  const pravidlo = naBlacklistu(pravidla.blacklist, {
    ico, nazev: ares.nazev, czNace: ares.czNace, pravniForma: ares.pravniForma,
  });
  if (pravidlo) {
    souhrn.naBlacklistu++;
    await vyrad("blacklist", pravidlo.duvod, ico);
    return;
  }

  // Obor: restaurace a agentury práce nemá smysl oslovovat vůbec, ať už mají
  // zaměstnanců kolik chtějí.
  if (jeVyloucenyObor(ares.czNace)) {
    souhrn.vyloucenyObor++;
    await vyrad("vylouceny_obor", `CZ-NACE ${ares.czNace.join(", ")}`, ico);
    return;
  }

  const resUdaje = await deps.res.nactiUdaje(ico);
  if (resUdaje?.bezZamestnancu) {
    souhrn.bezZamestnancu++;
    await vyrad("bez_zamestnancu", "statistický registr: bez zaměstnanců", ico);
    return;
  }
  // Sweep rejstříku je hodně zašuměný — z něj bereme jen doložené zaměstnavatele.
  // (U registru ČSÚ to řešit nemusíme: ten už prahem prošel u zdroje.)
  if (kandidat.zdroj === "ares" && resUdaje?.segment === null) {
    souhrn.bezZamestnancu++;
    await vyrad("neuvedena_velikost", "velikost neuvedena a jediným zdrojem je sweep rejstříku", ico);
    return;
  }
  // Mikropodniky se UKLÁDAJÍ — cílí se na ně jinou formou reklamy než e-mailem.
  // Práh proto neřídí, co se uloží, ale co se zařadí do fronty na oslovení.
  const podLimitem =
    splnujeMinimum(resUdaje?.kategorieKod ?? null, minZamestnancu) === false;
  if (podLimitem) souhrn.podLimitem++;

  // Krok 3 — poloha pracoviště.
  // Pořadí důležitosti: přesná poloha z mapy → adresa sídla, leží-li ve stejné
  // obci jako pracoviště → střed obce pracoviště. Poslední případ je klíčový:
  // MPSV ví, že se pracuje v naší obci, ale firma může sídlit přes půl republiky
  // (typicky výrobní provozovna). Počítat vzdálenost od sídla by ji vyřadilo.
  let poloha = kandidat.poloha;
  let polohaPopis = "poloha pracoviště podle OpenStreetMap";

  if (!poloha) {
    const sidloVeStejneObci =
      ares.kodObce != null && jidelna.kod_obce != null && ares.kodObce === jidelna.kod_obce;

    if (sidloVeStejneObci) {
      const adresa = [ares.adresa, ares.obec].filter(Boolean).join(", ");
      poloha = (await deps.geokoder.geokoduj(adresa)) ?? undefined;
      polohaPopis = `poloha z adresy sídla, které je ve stejné obci jako pracoviště: ${adresa}`;
    } else if (kandidat.zdroj === "mpsv" && jidelna.obec) {
      poloha = (await deps.geokoder.geokoduj(jidelna.obec)) ?? undefined;
      polohaPopis =
        `pracoviště v obci ${jidelna.obec} dle otevřených dat MPSV; ` +
        `firma sídlí jinde (${ares.obec ?? "?"}), přesná adresa provozovny neznámá — poloha je střed obce`;
    } else {
      const adresa = [ares.adresa, ares.obec].filter(Boolean).join(", ");
      poloha = (await deps.geokoder.geokoduj(adresa)) ?? undefined;
      polohaPopis = `poloha odvozena z adresy sídla: ${adresa}`;
    }

    // Záchrana: adresa se nedá zaměřit (u vesnic běžné — čísla popisná bez
    // ulic mapy neznají), ale z rejstříku víme, že firma sídlí v naší obci.
    // Zahodit ji by znamenalo přijít o skutečné zaměstnavatele.
    if (!poloha && sidloVeStejneObci && jidelna.obec) {
      poloha = (await deps.geokoder.geokoduj(jidelna.obec)) ?? undefined;
      polohaPopis =
        `sídlo v obci ${jidelna.obec} dle rejstříku; přesnou adresu „${ares.adresa ?? "?"}" ` +
        `se nepodařilo zaměřit — poloha je střed obce`;
    }
  }
  if (!poloha) {
    souhrn.zahozeno++;
    souhrn.poznamkyProPlaybook.push(`polohu se nepodařilo určit: ${ares.nazev}`);
    await vyrad("poloha_neznama", `adresa „${ares.adresa ?? "?"}" se nedá zaměřit`, ico);
    return;
  }

  const vzdalenost = vzdalenostM(poloha, { lat: jidelna.lat, lng: jidelna.lng });
  const zona = klasifikujZonu(vzdalenost, jidelna.zona_metru);
  if (zona === "mimo" && vzdalenost > 2 * jidelna.zona_metru) {
    souhrn.zahozeno++;
    await vyrad("mimo_zonu", `${vzdalenost} m od jídelny (zóna ${jidelna.zona_metru} m)`, ico);
    return;
  }

  // Krok 4 — zápis. Vše přes repository vrstvu, tedy s evidencí.
  await zalozFirmu(db, ares);
  await nastavGeo(db, ico, {
    lat: poloha.lat,
    lng: poloha.lng,
    jidelnaId: jidelna.id,
    vzdalenostM: vzdalenost,
    vZone: zona !== "mimo",
  });
  await zapisAtribut(db, ico, "adresa", `${poloha.lat},${poloha.lng}`, {
    zdrojUrl: kandidat.zdrojUrl,
    citace: polohaPopis,
  });
  await zapisDosah(db, ico, jidelna.id, { vzdalenostM: vzdalenost, vZone: zona !== "mimo" });

  if (resUdaje?.segment) {
    await zapisAtribut(db, ico, "velikost_kategorie", resUdaje.segment, {
      zdrojUrl: resUdaje.zdrojUrl,
      citace: `statistický registr: ${resUdaje.kategoriePopis} zaměstnanců`,
    });
  }

  if (kandidat.zdroj === "mpsv" && kandidat.nabizenychMist) {
    await zapisAtribut(db, ico, "obor", `nabírá ${kandidat.nabizenychMist} míst`, {
      zdrojUrl: kandidat.zdrojUrl,
      citace: `otevřená data MPSV: pracoviště v obci, ${kandidat.nabizenychMist} nabízených míst`,
    });
  }

  // Kontaktní osoba, kterou zaměstnavatel sám zveřejnil v inzerátu.
  // Nejlevnější zdroj jména, pozice, telefonu i e-mailu naráz — data už
  // stahujeme kvůli pracovištím.
  if (kandidat.kontakt) {
    await zapisKontaktZInzeratu(db, ico, kandidat.kontakt, kandidat.zdrojUrl);
  } else {
    // Až když jinak nevíme na koho se obrátit: statutární orgán z rejstříku.
    // Je to dotaz navíc, ale u firem bez inzerátu je to jediné doložitelné
    // jméno. Selže-li, běh pokračuje — jméno je bonus, ne podmínka.
    try {
      for (const clen of (await deps.ares.najdiStatutarniOrgany(ico)).slice(0, 2)) {
        await zapisKontakt(db, ico, {
          jmeno: clen.jmeno,
          prijmeni: clen.prijmeni,
          pozice: clen.funkce ?? undefined,
          urovenAdresy: 3,
          zdrojUrl: `https://ares.gov.cz/ekonomicke-subjekty/${ico}`,
          citace:
            `veřejný rejstřík: ${clen.funkce ?? "člen statutárního orgánu"} ` +
            `${clen.jmeno} ${clen.prijmeni}`,
        });
      }
    } catch (e) {
      souhrn.chyby.push({
        kdo: `statutární orgán ${ico}`,
        chyba: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Krok 5 — obohacení z webu (jen v zóně, ať se neplýtvá).
  let maVlastniJidelnu: boolean | null = null;
  let urovenAdresy: 1 | 2 | 3 | null = null;

  if (zona !== "mimo" && deps.enricher) {
    const v = await deps.enricher.obohat({ ico, nazev: ares.nazev, obec: ares.obec });
    souhrn.nakladyUsd += v.nakladyUsd;
    if (v.poznamkaProPlaybook) souhrn.poznamkyProPlaybook.push(v.poznamkaProPlaybook);

    for (const nalez of v.nalezy) {
      await zapisAtribut(db, ico, nalez.atribut, nalez.hodnota, {
        zdrojUrl: nalez.zdrojUrl,
        citace: nalez.citace,
      });
      if (nalez.atribut === "ma_vlastni_jidelnu") maVlastniJidelnu = nalez.hodnota === "true";
    }
    for (const kontakt of v.kontakty.slice(0, 2)) {
      await zapisKontakt(db, ico, kontakt);
      if (urovenAdresy === null || kontakt.urovenAdresy < urovenAdresy) {
        urovenAdresy = kontakt.urovenAdresy;
      }
    }
  }

  await nastavSkore(
    db,
    ico,
    spocitejSkore({
      vzdalenostM: vzdalenost,
      segment: resUdaje?.segment ?? null,
      maVlastniJidelnu,
      czNace: ares.czNace,
      urovenAdresy,
      nabizenychMist: kandidat.nabizenychMist,
    }),
  );

  if (zona === "mimo") {
    await nastavStav(db, ico, "cekajici_na_jidelnu");
    souhrn.cekajicich++;
  } else {
    await nastavStav(db, ico, "kvalifikovany");
    souhrn.kvalifikovano++;
  }
}
