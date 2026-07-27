import type { AresKlient, AresZaznam } from "./ares.js";
import type { Db } from "./db.js";
import type { Enricher } from "./enrich.js";
import { jeValidniIco } from "./ico.js";
import { klasifikujZonu, vzdalenostM, type Bod } from "./geo.js";
import type { Geokoder } from "./geocode.js";
import type { MpsvKlient } from "./mpsv.js";
import type { OsmKlient } from "./osm.js";
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
  zapisKontakt,
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
  /** Bez enricheru běží jen deterministická část. */
  enricher?: Enricher;
}

/**
 * Výchozí minimální počet zaměstnanců. Mikrofirmy do 10 lidí se vyplatí
 * oslovovat jen výjimečně — práce je stejná, odběr zlomkový.
 */
export const VYCHOZI_MIN_ZAMESTNANCU = 10;

export type ZdrojKandidata = "mpsv" | "osm" | "ares";

interface Kandidat {
  zdroj: ZdrojKandidata;
  zdrojUrl: string;
  ico?: string;
  nazev: string;
  /** Známá poloha pracoviště (OSM). Jinak se dopočítá z adresy sídla. */
  poloha?: Bod;
  nabizenychMist?: number;
}

export interface CmuchalSouhrn {
  behId: string;
  kandidatu: number;
  dleZdroje: Record<ZdrojKandidata, number>;
  kvalifikovano: number;
  cekajicich: number;
  bezZamestnancu: number;
  podLimitem: number;
  agentur: number;
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
  zona_metru: number;
  kapacita_volna: number;
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
            zona_metru, kapacita_volna, aktivni
     from jidelny where id = $1`,
    [jidelnaId],
  );
  const jidelna = jidelny[0];
  if (!jidelna) throw new Error(`Jídelna ${jidelnaId} neexistuje`);
  if (!jidelna.aktivni || jidelna.kapacita_volna <= 0) {
    throw new Error(
      `Jídelna ${jidelna.nazev} není aktivní nebo nemá volnou kapacitu — kapacita je strop obchodu (SPEC kap. 2)`,
    );
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
    dleZdroje: { mpsv: 0, osm: 0, ares: 0 },
    kvalifikovano: 0,
    cekajicich: 0,
    bezZamestnancu: 0,
    podLimitem: 0,
    agentur: 0,
    vyloucenyObor: 0,
    nesparovano: 0,
    zahozeno: 0,
    preskoceno: 0,
    chyby: [],
    nakladyUsd: 0,
    poznamkyProPlaybook: [],
  };

  try {
    const kandidati = await sesbirejKandidaty(deps, jidelna, souhrn, opts);
    souhrn.kandidatu = kandidati.length;

    for (const kandidat of kandidati.slice(0, opts.limit ?? kandidati.length)) {
      try {
        await zpracujKandidata(deps, jidelna, kandidat, souhrn, opts.minZamestnancu ?? VYCHOZI_MIN_ZAMESTNANCU);
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
  opts: { aresSweep?: boolean },
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

  // Zdroj C — sweep rejstříku podle obce. Sám o sobě je zašuměný (v Bezdružicích
  // 212 subjektů, z toho 26 skutečných zaměstnavatelů), ale po filtru na
  // doložené zaměstnance je to nejúplnější seznam firem sídlících v obci.
  if (opts.aresSweep !== false && jidelna.kod_obce != null) {
    try {
      // 1 000 je tvrdý strop samotného ARES. Obce nad tento počet subjektů
      // (typicky velká města) potřebují zúžení dotazu — viz docs/FAZE-0.md.
      for (const f of await deps.ares.najdiFirmyVObci(jidelna.kod_obce, { max: 1000 })) {
        kandidati.push({
          zdroj: "ares",
          zdrojUrl: `https://ares.gov.cz/ekonomicke-subjekty/${f.ico}`,
          ico: f.ico,
          nazev: f.nazev,
        });
        souhrn.dleZdroje.ares++;
      }
    } catch (e) {
      souhrn.chyby.push({ kdo: "zdroj ARES", chyba: e instanceof Error ? e.message : String(e) });
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

async function zpracujKandidata(
  deps: CmuchalDeps,
  jidelna: Jidelna,
  kandidat: Kandidat,
  souhrn: CmuchalSouhrn,
  minZamestnancu: number,
): Promise<void> {
  const { db } = deps;

  // Krok 1 — přiřazení právního subjektu. TP-1: bez ARES firma nevznikne.
  let ico = kandidat.ico;
  if (!ico) {
    const shoda = await deps.ares.najdiPodleJmena(kandidat.nazev);
    if (!shoda) {
      souhrn.nesparovano++;
      souhrn.poznamkyProPlaybook.push(`nespárováno s rejstříkem: ${kandidat.nazev}`);
      return;
    }
    ico = shoda.ico;
  }
  if (!jeValidniIco(ico)) {
    souhrn.zahozeno++;
    return;
  }

  const jizJe = await db.query("select 1 from companies where ico = $1", [ico]);
  if (jizJe.length > 0) {
    souhrn.preskoceno++;
    return;
  }

  const ares = await deps.ares.overFirmu(ico);
  if (!ares) {
    souhrn.zahozeno++;
    return;
  }

  // Krok 2 — filtry. Nejdřív obor: restaurace a agentury práce nemá smysl
  // oslovovat vůbec, ať už mají zaměstnanců kolik chtějí.
  if (jeVyloucenyObor(ares.czNace)) {
    souhrn.vyloucenyObor++;
    return;
  }

  const resUdaje = await deps.res.nactiUdaje(ico);
  if (resUdaje?.bezZamestnancu) {
    souhrn.bezZamestnancu++;
    return;
  }
  // Sweep rejstříku je hodně zašuměný — z něj bereme jen doložené zaměstnavatele.
  if (kandidat.zdroj === "ares" && resUdaje?.segment === null) {
    souhrn.bezZamestnancu++;
    return;
  }
  // Práh velikosti: u mikrofirem je práce s oslovením stejná jako u velkých,
  // ale výnos zlomkový. Neznámou velikost prahem neposuzujeme — přišla-li
  // firma ze silnějšího zdroje (pracoviště, mapa), necháme ji projít.
  if (splnujeMinimum(resUdaje?.kategorieKod ?? null, minZamestnancu) === false) {
    souhrn.podLimitem++;
    return;
  }

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
    return;
  }

  const vzdalenost = vzdalenostM(poloha, { lat: jidelna.lat, lng: jidelna.lng });
  const zona = klasifikujZonu(vzdalenost, jidelna.zona_metru);
  if (zona === "mimo" && vzdalenost > 2 * jidelna.zona_metru) {
    souhrn.zahozeno++;
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
