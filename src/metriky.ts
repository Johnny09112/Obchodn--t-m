import type { Db } from "./db.js";

export interface PrehledStavu {
  firmyDleStavu: Record<string, number>;
  aktivnichJidelen: number;
  /** null = u žádné jídelny v provozu neznáme kapacitu. */
  kapacitaAktivnichJidelen: number | null;
  /** Kapacita jídelen v přípravě — potenciál, ne co můžeme prodat dnes. */
  kapacitaVPriprave: number;
  jidelenBezKapacity: number;
}

export async function prehledStavu(db: Db): Promise<PrehledStavu> {
  const stavy = await db.query<{ stav: string; pocet: string }>(
    "select stav, count(*)::text as pocet from companies group by stav",
  );
  // Kapacita jídelny v přípravě se nesmí přičíst k tomu, co jde prodat dnes
  // (migrace 0044) — proto dvě sumy, ne jedna.
  const jidelny = await db.query<{
    pocet: string; kapacita: string | null; priprava: string | null; bezkapacity: string;
  }>(
    `select count(*)::text as pocet,
            sum(kapacita_volna) filter (where stav = 'v_provozu')::text as kapacita,
            sum(kapacita_volna) filter (where stav = 'priprava')::text as priprava,
            count(*) filter (where kapacita_volna is null)::text as bezkapacity
     from jidelny where aktivni`,
  );
  return {
    firmyDleStavu: Object.fromEntries(stavy.map((s) => [s.stav, Number(s.pocet)])),
    aktivnichJidelen: Number(jidelny[0]?.pocet ?? 0),
    kapacitaAktivnichJidelen: jidelny[0]?.kapacita == null ? null : Number(jidelny[0].kapacita),
    kapacitaVPriprave: jidelny[0]?.priprava == null ? 0 : Number(jidelny[0].priprava),
    jidelenBezKapacity: Number(jidelny[0]?.bezkapacity ?? 0),
  };
}

/** Metriky fáze 1 dle SPEC kap. 12. */
export interface MetrikyFaze1 {
  kvalifikovanychFirem: number;
  /** Podíl kvalifikovaných firem s ověřeným stavem stravování (jídelna/způsob). */
  podilStravovaniOvereno: number;
  /** Podíl kontaktů úrovně 1 (poptávkové adresy) na všech kontaktech. */
  podilKontaktuUrovne1: number;
  kontaktuNaKvalifikovanouFirmu: number;
  /** Podíl vyplněných sledovaných polí, které mají záznam v evidence (TP-2). */
  podilPoliSeZdrojem: number;
}

export async function metrikyFaze1(db: Db): Promise<MetrikyFaze1> {
  const [kv] = await db.query<{ pocet: string }>(
    "select count(*)::text as pocet from companies where stav = 'kvalifikovany'",
  );
  const kvalifikovanych = Number(kv?.pocet ?? 0);

  const [strav] = await db.query<{ pocet: string }>(
    `select count(*)::text as pocet from companies
     where stav = 'kvalifikovany'
       and (zpusob_stravovani is not null or ma_vlastni_jidelnu is not null)`,
  );

  const [kontakty] = await db.query<{ celkem: string; uroven1: string }>(
    `select count(*)::text as celkem,
            count(*) filter (where uroven_adresy = 1)::text as uroven1
     from contacts`,
  );
  const celkemKontaktu = Number(kontakty?.celkem ?? 0);

  const [kontaktyKv] = await db.query<{ pocet: string }>(
    `select count(*)::text as pocet from contacts c
     join companies f on f.ico = c.ico where f.stav = 'kvalifikovany'`,
  );

  // Sledovaná pole plněná z atributů: kolik vyplněných hodnot má evidenci.
  const [pole] = await db.query<{ vyplneno: string; se_zdrojem: string }>(
    `with vyplnena as (
       select ico, unnest(array['velikost_kategorie','ma_vlastni_jidelnu','zpusob_stravovani']) as atribut,
              unnest(array[velikost_kategorie is not null, ma_vlastni_jidelnu is not null, zpusob_stravovani is not null]) as ma_hodnotu
       from companies
     )
     select count(*) filter (where ma_hodnotu)::text as vyplneno,
            count(*) filter (where ma_hodnotu and exists (
              select 1 from evidence e where e.ico = vyplnena.ico and e.atribut = vyplnena.atribut
            ))::text as se_zdrojem
     from vyplnena`,
  );
  const vyplneno = Number(pole?.vyplneno ?? 0);

  return {
    kvalifikovanychFirem: kvalifikovanych,
    podilStravovaniOvereno: kvalifikovanych ? Number(strav?.pocet ?? 0) / kvalifikovanych : 0,
    podilKontaktuUrovne1: celkemKontaktu
      ? Number(kontakty?.uroven1 ?? 0) / celkemKontaktu
      : 0,
    kontaktuNaKvalifikovanouFirmu: kvalifikovanych
      ? Number(kontaktyKv?.pocet ?? 0) / kvalifikovanych
      : 0,
    podilPoliSeZdrojem: vyplneno ? Number(pole?.se_zdrojem ?? 0) / vyplneno : 1,
  };
}
