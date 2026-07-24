import type { AresKlient, AresZaznam } from "./ares.js";
import type { Db } from "./db.js";
import type { Enricher } from "./enrich.js";
import { jeValidniIco } from "./ico.js";
import { klasifikujZonu, vzdalenostM } from "./geo.js";
import type { Geokoder } from "./geocode.js";
import { spocitejSkore } from "./score.js";
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
  geokoder: Geokoder;
  /** Bez enricheru běží jen deterministická část (ARES + geo + skóre). */
  enricher?: Enricher;
}

export interface CmuchalSouhrn {
  behId: string;
  kandidatu: number;
  kvalifikovano: number;
  cekajicich: number;
  zahozeno: number;
  preskoceno: number;
  chyby: Array<{ ico: string; chyba: string }>;
  nakladyUsd: number;
  poznamkyProPlaybook: string[];
}

interface Jidelna {
  id: string;
  lat: number;
  lng: number;
  kod_obce: number | null;
  zona_metru: number;
  kapacita_volna: number;
  aktivni: boolean;
}

/**
 * Čmuchal (SPEC 10.1): pro aktivní jídelnu s volnou kapacitou vyjmenuje firmy
 * v obci, ověří je v ARES (TP-1), spočítá vzdálenost a zónu (TP-4), obohatí
 * s evidencí (TP-2/TP-3), skóruje a kvalifikuje. Nikdy nic neodesílá.
 */
export async function spustCmuchala(
  deps: CmuchalDeps,
  jidelnaId: string,
  opts: { limit?: number } = {},
): Promise<CmuchalSouhrn> {
  const { db } = deps;

  const jidelny = await db.query<Jidelna>(
    `select id, lat::float8 as lat, lng::float8 as lng, kod_obce, zona_metru, kapacita_volna, aktivni
     from jidelny where id = $1`,
    [jidelnaId],
  );
  const jidelna = jidelny[0];
  if (!jidelna) throw new Error(`Jídelna ${jidelnaId} neexistuje`);
  if (!jidelna.aktivni || jidelna.kapacita_volna <= 0) {
    throw new Error(
      `Jídelna ${jidelnaId} není aktivní nebo nemá volnou kapacitu — kapacita jídelen je strop obchodu (SPEC kap. 2)`,
    );
  }
  if (jidelna.kod_obce == null) {
    throw new Error(`Jídelna ${jidelnaId} nemá vyplněný kod_obce — bez něj nelze hledat firmy`);
  }

  const behId = await zacniBeh(db, "cmuchal", { jidelnaId, limit: opts.limit ?? null });

  const souhrn: CmuchalSouhrn = {
    behId,
    kandidatu: 0,
    kvalifikovano: 0,
    cekajicich: 0,
    zahozeno: 0,
    preskoceno: 0,
    chyby: [],
    nakladyUsd: 0,
    poznamkyProPlaybook: [],
  };

  try {
    const kandidati = await deps.ares.najdiFirmyVObci(jidelna.kod_obce, {
      max: opts.limit,
    });
    souhrn.kandidatu = kandidati.length;

    for (const kandidat of kandidati) {
      try {
        await zpracujKandidata(deps, jidelna, kandidat, souhrn);
      } catch (e) {
        souhrn.chyby.push({
          ico: kandidat.ico,
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

async function zpracujKandidata(
  deps: CmuchalDeps,
  jidelna: Jidelna,
  kandidat: AresZaznam,
  souhrn: CmuchalSouhrn,
): Promise<void> {
  const { db } = deps;

  // TP-1: bez validního IČO (a tedy shody v ARES) se firma nezakládá.
  if (!jeValidniIco(kandidat.ico)) {
    souhrn.zahozeno++;
    return;
  }

  // Idempotence: už zpracované firmy nezpracováváme znovu (TP-5 základ).
  const existuje = await db.query("select 1 from companies where ico = $1", [kandidat.ico]);
  if (existuje.length > 0) {
    souhrn.preskoceno++;
    return;
  }

  const adresa = [kandidat.adresa, kandidat.obec].filter(Boolean).join(", ");
  const poloha = await deps.geokoder.geokoduj(adresa);
  if (!poloha) {
    souhrn.zahozeno++;
    souhrn.poznamkyProPlaybook.push(`geocoding selhal: ${adresa}`);
    return;
  }

  const vzdalenost = vzdalenostM(poloha, { lat: jidelna.lat, lng: jidelna.lng });
  const zona = klasifikujZonu(vzdalenost, jidelna.zona_metru);

  // Daleko za zónou nemá smysl ukládat ani jako čekající.
  if (zona === "mimo" && vzdalenost > 2 * jidelna.zona_metru) {
    souhrn.zahozeno++;
    return;
  }

  await zalozFirmu(db, kandidat);
  await nastavGeo(db, kandidat.ico, {
    lat: poloha.lat,
    lng: poloha.lng,
    jidelnaId: jidelna.id,
    vzdalenostM: vzdalenost,
    vZone: zona !== "mimo",
  });

  const aresUrl = `https://ares.gov.cz/ekonomicke-subjekty/${kandidat.ico}`;
  if (kandidat.velikostKategorie) {
    await zapisAtribut(db, kandidat.ico, "velikost_kategorie", kandidat.velikostKategorie, {
      zdrojUrl: aresUrl,
      citace: `ARES kategoriePoctuPracovniku → ${kandidat.velikostKategorie}`,
    });
  }

  if (zona === "mimo") {
    await nastavStav(db, kandidat.ico, "cekajici_na_jidelnu");
    souhrn.cekajicich++;
    return;
  }

  // Obohacení z webu — jen v zóně, ať neplatíme za firmy, které stejně neoslovíme.
  let maVlastniJidelnu: boolean | null = null;
  let urovenAdresy: 1 | 2 | 3 | null = null;

  if (deps.enricher) {
    const v = await deps.enricher.obohat({
      ico: kandidat.ico,
      nazev: kandidat.nazev,
      obec: kandidat.obec,
    });
    souhrn.nakladyUsd += v.nakladyUsd;
    if (v.poznamkaProPlaybook) souhrn.poznamkyProPlaybook.push(v.poznamkaProPlaybook);

    for (const nalez of v.nalezy) {
      await zapisAtribut(db, kandidat.ico, nalez.atribut, nalez.hodnota, {
        zdrojUrl: nalez.zdrojUrl,
        citace: nalez.citace,
      });
      if (nalez.atribut === "ma_vlastni_jidelnu") {
        maVlastniJidelnu = nalez.hodnota === "true";
      }
    }
    for (const kontakt of v.kontakty.slice(0, 2)) {
      await zapisKontakt(db, kandidat.ico, kontakt);
      if (urovenAdresy === null || kontakt.urovenAdresy < urovenAdresy) {
        urovenAdresy = kontakt.urovenAdresy;
      }
    }
  }

  const skore = spocitejSkore({
    vzdalenostM: vzdalenost,
    velikostKategorie: kandidat.velikostKategorie,
    maVlastniJidelnu,
    czNace: kandidat.czNace,
    urovenAdresy,
  });
  await nastavSkore(db, kandidat.ico, skore);
  await nastavStav(db, kandidat.ico, "kvalifikovany");
  souhrn.kvalifikovano++;
}
