import type { AresZaznam } from "./ares.js";
import type { Db } from "./db.js";
import {
  ATRIBUTY_SLOUPCE,
  jePovolenyAtribut,
  type PovolenyAtribut,
} from "./whitelist.js";

export interface EvidenceVstup {
  zdrojUrl: string;
  citace: string;
  confidence?: number;
}

function overZdroj(e: EvidenceVstup): void {
  if (!e.zdrojUrl) {
    throw new Error("TP-2: bez zdroje se nezapisuje — chybí zdrojUrl");
  }
}

/**
 * TP-1: jediná cesta, jak vytvořit záznam v companies — z ověřeného ARES
 * záznamu. Idempotentní (opakovaný běh firmu neduplikuje ani nepřepíše).
 */
export async function zalozFirmu(db: Db, ares: AresZaznam): Promise<void> {
  await db.query(
    `insert into companies (ico, nazev, adresa, obec, okres, kraj, psc, cz_nace,
                            velikost_kategorie, pravni_forma)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (ico) do nothing`,
    [
      ares.ico,
      ares.nazev,
      ares.adresa,
      ares.obec,
      ares.okres ?? null,
      ares.kraj ?? null,
      ares.psc ?? null,
      ares.czNace,
      ares.velikostKategorie,
      ares.pravniForma ?? null,
    ],
  );
}

/** SQL cast pro sloupce companies plněné z atributů. */
const CAST_SLOUPCE: Record<string, string> = {
  ma_vlastni_jidelnu: "::boolean",
  zamestnanci_odhad: "::int",
};

/**
 * TP-2 + TP-3: zápis atributu vždy atomicky s evidencí (zdroj + doslovná
 * citace). Atribut mimo whitelist je odmítnut.
 */
export async function zapisAtribut(
  db: Db,
  ico: string,
  atribut: PovolenyAtribut,
  hodnota: string,
  evidence: EvidenceVstup,
): Promise<void> {
  if (!jePovolenyAtribut(atribut)) {
    throw new Error(`TP-3: atribut '${atribut}' není na whitelistu`);
  }
  overZdroj(evidence);

  await db.tx(async (t) => {
    await t.query(
      `insert into evidence (ico, atribut, hodnota, zdroj_url, citace, confidence)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        ico,
        atribut,
        hodnota,
        evidence.zdrojUrl,
        evidence.citace.slice(0, 200),
        evidence.confidence ?? null,
      ],
    );
    const sloupec = ATRIBUTY_SLOUPCE[atribut];
    if (sloupec) {
      const cast = CAST_SLOUPCE[sloupec] ?? "";
      await t.query(
        `update companies set ${sloupec} = $1${cast} where ico = $2`,
        [hodnota, ico],
      );
    }
  });
}

export interface KontaktVstup {
  email?: string;
  urovenAdresy: 1 | 2 | 3;
  jmeno?: string;
  prijmeni?: string;
  pozice?: string;
  telefon?: string;
  zdrojUrl: string;
  citace: string;
}

/** TP-6: kontakt vždy s úrovní adresy a zdrojem; evidence se váže na kontakt. */
export async function zapisKontakt(
  db: Db,
  ico: string,
  k: KontaktVstup,
): Promise<string> {
  overZdroj(k);
  return db.tx(async (t) => {
    const rows = await t.query<{ id: string }>(
      `insert into contacts (ico, jmeno, prijmeni, pozice, email, uroven_adresy, telefon, zdroj_url)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        ico,
        k.jmeno ?? null,
        k.prijmeni ?? null,
        k.pozice ?? null,
        k.email ?? null,
        k.urovenAdresy,
        k.telefon ?? null,
        k.zdrojUrl,
      ],
    );
    const id = rows[0]!.id;
    await t.query(
      `insert into evidence (ico, contact_id, atribut, hodnota, zdroj_url, citace)
       values ($1,$2,'kontakt',$3,$4,$5)`,
      [ico, id, k.email ?? `${k.jmeno ?? ""} ${k.prijmeni ?? ""}`.trim(), k.zdrojUrl, k.citace.slice(0, 200)],
    );
    return id;
  });
}

export interface GeoVstup {
  lat: number;
  lng: number;
  /** Prázdné u firem z průzkumné oblasti — o přiřazení rozhoduje vzdálenost,
   *  ne oblast, a řeší se samostatně. */
  jidelnaId: string | null;
  vzdalenostM: number | null;
  vZone: boolean | null;
}

/**
 * Zaznamená, že jídelna má firmu v dosahu.
 *
 * Firma smí být v dosahu víc jídelen zároveň — nepřeřazuje se mezi nimi
 * (rozhodnutí majitele 2026-07-28). Opakovaný zápis přepíše vzdálenost,
 * takže přepočet jde pustit kdykoli znovu.
 */
export async function zapisDosah(
  db: Db,
  ico: string,
  jidelnaId: string,
  d: { vzdalenostM: number; vZone: boolean },
): Promise<void> {
  await db.query(
    `insert into dosah (ico, jidelna_id, vzdalenost_m, v_zone)
     values ($1,$2,$3,$4)
     on conflict (ico, jidelna_id) do update
       set vzdalenost_m = excluded.vzdalenost_m,
           v_zone = excluded.v_zone,
           zjisteno_at = now()`,
    [ico, jidelnaId, d.vzdalenostM, d.vZone],
  );
}

export async function nastavGeo(db: Db, ico: string, g: GeoVstup): Promise<void> {
  await db.query(
    `update companies
     set lat = $1, lng = $2, nejblizsi_jidelna_id = $3, vzdalenost_m = $4, v_zone = $5
     where ico = $6`,
    [g.lat, g.lng, g.jidelnaId, g.vzdalenostM, g.vZone, ico],
  );
}

export async function nastavSkore(db: Db, ico: string, skore: number): Promise<void> {
  await db.query("update companies set skore = $1 where ico = $2", [skore, ico]);
}

/** Povolené přechody stavů ve fázi 1 (Čmuchal nesmí za hranici kvalifikace). */
const POVOLENE_PRECHODY: Record<string, string[]> = {
  novy: ["kvalifikovany", "cekajici_na_jidelnu", "zamitnuty"],
  cekajici_na_jidelnu: ["kvalifikovany", "zamitnuty"],
};

export type StavFaze1 = "kvalifikovany" | "cekajici_na_jidelnu" | "zamitnuty";

export async function nastavStav(db: Db, ico: string, novyStav: StavFaze1): Promise<void> {
  await db.tx(async (t) => {
    const rows = await t.query<{ stav: string }>(
      "select stav from companies where ico = $1 for update",
      [ico],
    );
    if (rows.length === 0) throw new Error(`Firma ${ico} neexistuje`);
    const soucasny = rows[0]!.stav;
    if (!POVOLENE_PRECHODY[soucasny]?.includes(novyStav)) {
      throw new Error(`Nepovolený přechod stavu ${soucasny} → ${novyStav}`);
    }
    await t.query("update companies set stav = $1 where ico = $2", [novyStav, ico]);
  });
}

export type DuvodVyrazeni =
  | "neplatne_ico"
  | "neni_v_ares"
  | "nesparovano"
  | "agentura"
  | "vylouceny_obor"
  | "bez_zamestnancu"
  | "neuvedena_velikost"
  | "poloha_neznama"
  | "mimo_zonu"
  | "partnerska_jidelna"
  | "bytovy_dum"
  | "blacklist";

export interface VyrazeniVstup {
  behId: string;
  /** Prázdné u vyřazení z průzkumné oblasti — tam žádná jídelna není. */
  jidelnaId: string | null;
  zdroj: "mpsv" | "osm" | "ares" | "registr";
  nazev: string;
  ico?: string;
  duvod: DuvodVyrazeni;
  detail?: string;
}

/**
 * Zapíše, proč kandidát nepostoupil dál. Slouží ke kalibraci pravidel —
 * bez toho nejde poznat, jestli filtr nevyhazuje i to, co má projít.
 */
export async function zaznamVyrazeni(db: Db, v: VyrazeniVstup): Promise<void> {
  await db.query(
    `insert into vyrazeni (beh_id, jidelna_id, ico, nazev, zdroj, duvod, detail)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [v.behId, v.jidelnaId, v.ico ?? null, v.nazev, v.zdroj, v.duvod, v.detail ?? null],
  );
}

/** TP-13: auditovatelnost — každý běh agenta do agent_runs. */
export async function zacniBeh(db: Db, agent: string, vstup: unknown): Promise<string> {
  const rows = await db.query<{ id: string }>(
    "insert into agent_runs (agent, vstup) values ($1, $2) returning id",
    [agent, JSON.stringify(vstup)],
  );
  return rows[0]!.id;
}

export async function ukonciBeh(
  db: Db,
  id: string,
  vystup: unknown,
  chyby?: unknown[],
  nakladyUsd?: number,
): Promise<void> {
  await db.query(
    `update agent_runs
     set konec = now(), vystup = $1, chyby = $2, naklady_usd = $3
     where id = $4`,
    [
      JSON.stringify(vystup),
      chyby && chyby.length > 0 ? JSON.stringify(chyby) : null,
      nakladyUsd ?? null,
      id,
    ],
  );
}
