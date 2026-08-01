/**
 * Kampaň — pojmenovaný seznam firem s vlastním kontextem.
 *
 * **Není to rozesílka.** SPEC kap. 10.2 kampaňový režim zrušil; kampaň je
 * seznam práce, ze kterého ve fázi 3 odchází oslovení po jedné firmě.
 * V tomto modulu proto nikdy nesmí přibýt nic, co skládá nebo odesílá zprávy.
 */
import { nactiBlacklist } from "./blacklist.js";
import type { Db } from "./db.js";
import { duvodNeoslovovat, type DuvodNeoslovovat } from "./kvalifikace.js";
import { nactiOblast, prepocitejOblastFirmy, type UlozenaOblast } from "./oblast.js";
import { objednejPruzkum } from "./pruzkum.js";

export type StavKampane =
  | "rozpracovana"
  | "ceka_na_pruzkum"
  | "k_posouzeni"
  | "schvalena"
  | "bezi"
  | "uzavrena"
  | "zrusena";

export interface Kampan {
  id: string;
  nazev: string;
  popis: string | null;
  kontext: string | null;
  spravce: string;
  jidelnaId: string | null;
  stav: StavKampane;
  krok: number;
  duvodZruseni: string | null;
}

const SLOUPCE = `id, nazev, popis, kontext, spravce,
  jidelna_id as "jidelnaId",
  stav, krok, duvod_zruseni as "duvodZruseni"`;

export async function zalozKampan(
  db: Db,
  v: { nazev: string; spravce: string; popis?: string; kontext?: string },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into kampane (nazev, spravce, popis, kontext)
     values ($1,$2,$3,$4) returning id`,
    [v.nazev, v.spravce, v.popis ?? null, v.kontext ?? null],
  );
  return r[0]!.id;
}

export async function nactiKampan(db: Db, id: string): Promise<Kampan | null> {
  const r = await db.query<Kampan>(`select ${SLOUPCE} from kampane where id = $1`, [id]);
  return r[0] ?? null;
}

export async function seznamKampani(db: Db): Promise<Kampan[]> {
  return db.query<Kampan>(`select ${SLOUPCE} from kampane order by created_at desc`);
}

/**
 * Nastaví kampani území — celou množinu oblastí naráz.
 *
 * Nahrazuje, nepřidává: kdo z výběru oblast odebere, musí ji opravdu odebrat.
 * Přidávací chování by z každé opravy udělalo hromadění.
 *
 * Jídelna je nepovinná ze stejného důvodu jako u oblasti — může se doplnit
 * až po jednání.
 */
export async function nastavUzemi(
  db: Db,
  kampanId: string,
  v: { oblastiIds: readonly string[]; jidelnaId?: string | null },
): Promise<void> {
  const bezDuplicit = [...new Set(v.oblastiIds)];

  await db.query("delete from kampan_oblasti where kampan_id = $1", [kampanId]);
  for (const [poradi, oblastId] of bezDuplicit.entries()) {
    await db.query(
      `insert into kampan_oblasti (kampan_id, oblast_id, poradi) values ($1,$2,$3)`,
      [kampanId, oblastId, poradi],
    );
  }

  await db.query(
    `update kampane set jidelna_id = $1, krok = greatest(krok, 2) where id = $2`,
    [v.jidelnaId ?? null, kampanId],
  );
}

/** Oblasti kampaně v pořadí, ve kterém je člověk vybral. */
export async function oblastiKampane(db: Db, kampanId: string): Promise<UlozenaOblast[]> {
  const r = await db.query<{ oblastId: string }>(
    `select oblast_id as "oblastId" from kampan_oblasti
     where kampan_id = $1 order by poradi, created_at`,
    [kampanId],
  );
  const oblasti: UlozenaOblast[] = [];
  for (const { oblastId } of r) {
    const o = await nactiOblast(db, oblastId);
    if (o) oblasti.push(o);
  }
  return oblasti;
}

/** Objednávka průzkumu jedné oblasti kampaně. */
export interface PruzkumKampane {
  id: string;
  oblastId: string;
  oblastNazev: string;
  stav: string;
  chyba: string | null;
}

/**
 * Průzkumy území kampaně — i ty, které nikdo neobjednal kvůli téhle kampani.
 *
 * Bere se nejnovější objednávka na každou oblast, ať už ji zadal kdokoli.
 * Oblast prozkoumaná dřív a jinou kampaní je pořád prozkoumaná; tvářit se,
 * že se na ni čeká, by znamenalo objednat práci, která je hotová.
 */
export async function pruzkumyKampane(db: Db, kampanId: string): Promise<PruzkumKampane[]> {
  return db.query<PruzkumKampane>(
    `select distinct on (ko.oblast_id)
            p.id, ko.oblast_id as "oblastId", o.nazev as "oblastNazev", p.stav, p.chyba
     from kampan_oblasti ko
     join oblasti o on o.id = ko.oblast_id
     join pruzkumy p on p.oblast_id = ko.oblast_id
     where ko.kampan_id = $1
     order by ko.oblast_id, p.pozadano_at desc`,
    [kampanId],
  ).then((radky) => seradPodleUzemi(db, kampanId, radky));
}

/** Vrátí řádky v pořadí, ve kterém člověk oblasti vybral. */
async function seradPodleUzemi<T extends { oblastId: string }>(
  db: Db,
  kampanId: string,
  radky: T[],
): Promise<T[]> {
  const poradi = await db.query<{ oblastId: string }>(
    `select oblast_id as "oblastId" from kampan_oblasti
     where kampan_id = $1 order by poradi, created_at`,
    [kampanId],
  );
  const kam = new Map(poradi.map((p, i) => [p.oblastId, i]));
  return [...radky].sort((a, b) => (kam.get(a.oblastId) ?? 0) - (kam.get(b.oblastId) ?? 0));
}

/**
 * Objedná průzkum pro každou oblast kampaně, která ho ještě potřebuje.
 *
 * **Agenta to nespustí** — objednávka jen čeká ve frontě (TP-8 a rozhodnutí
 * o hlídce). Jedna objednávka na oblast, protože agent bere území po jednom
 * a průzkum je evidence o konkrétním tvaru.
 *
 * Přeskakuje oblast, která už hotový průzkum má nebo na jeden čeká. Neúspěšný
 * průzkum se objedná znovu — selhání není výsledek.
 */
export async function objednejPruzkumyProKampan(
  db: Db,
  kampanId: string,
  pozadal: string,
): Promise<{ objednano: string[]; preskoceno: string[] }> {
  const oblasti = await oblastiKampane(db, kampanId);
  const stavy = new Map((await pruzkumyKampane(db, kampanId)).map((p) => [p.oblastId, p.stav]));

  const objednano: string[] = [];
  const preskoceno: string[] = [];

  for (const o of oblasti) {
    const stav = stavy.get(o.id);
    if (stav && stav !== "selhalo") {
      preskoceno.push(o.nazev);
      continue;
    }
    await objednejPruzkum(db, { oblastId: o.id, kampanId, pozadal });
    objednano.push(o.nazev);
  }
  return { objednano, preskoceno };
}

export interface FirmaVKampani {
  ico: string;
  nazev: string;
  obec: string | null;
  stav: "vybrana" | "vyrazena";
  duvodVyrazeni: string | null;
  kontaktu: number;
  skore: number | null;
}

/** Firma, která v oblasti leží, ale do kampaně nepatří — i s důvodem. */
export interface VynechanaFirma {
  ico: string;
  nazev: string;
  duvod: DuvodNeoslovovat;
  detail: string;
}

/**
 * Doplní do kampaně firmy, které leží v její oblasti — a projdou kvalifikací.
 *
 * **Geometrie sama nestačí.** `oblast_firmy` odpovídá na otázku „co leží
 * uvnitř tvaru" a plní se bez ptaní (`prepocitejOblastFirmy`, a stejně tak
 * aplikace při kreslení oblasti). Kdyby se odsud kopírovalo rovnou, kampaň by
 * nabídla i firmu, kterou majitel mezitím dal na blacklist, nebo školu, která
 * se stala partnerskou jídelnou až potom. Síto je proto tady, na hranici mezi
 * „kde firma je" a „koho oslovíme" — viz `duvodNeoslovovat`.
 *
 * Vynechané firmy se vracejí i s důvodem. Tiché filtrování je horší než žádné:
 * kdo nevidí, proč firma v kampani chybí, začne pravidlům nedůvěřovat.
 *
 * **Ručně vyřazené firmy se nevzkřísí** — `on conflict do nothing`. Bez toho
 * by každé doplnění vrátilo zpátky všechno, co člověk vyhodil, a rozhodnutí
 * by tiše mizela.
 *
 * Příslušnost se před vložením přepočítá, aby se nevycházelo ze zastaralého
 * seznamu.
 */
export async function naplnZOblasti(
  db: Db,
  kampanId: string,
): Promise<{ pridano: number; jizBylo: number; vynechano: VynechanaFirma[] }> {
  const oblasti = await oblastiKampane(db, kampanId);
  if (oblasti.length === 0) return { pridano: 0, jizBylo: 0, vynechano: [] };

  for (const o of oblasti) await prepocitejOblastFirmy(db, o.id);

  // Pravidla se načtou jednou pro celé doplnění — stejně jako u sběru.
  const blacklist = await nactiBlacklist(db);
  const partnerskaIca = new Set(
    (await db.query<{ ico: string }>("select ico from jidelny where ico is not null")).map(
      (j) => j.ico,
    ),
  );

  // `distinct` je tu kvůli TP-5: oblasti se smějí překrývat, ale firma
  // v překryvu je pořád jedna firma a smí dostat jen jedno oslovení.
  // Bez toho by se i vynechání hlásilo dvakrát a člověk by nevěřil číslům.
  const kandidati = await db.query<{
    ico: string;
    nazev: string;
    czNace: string[];
    pravniForma: string | null;
    maVlastniJidelnu: boolean | null;
  }>(
    `select distinct c.ico, c.nazev, c.cz_nace as "czNace", c.pravni_forma as "pravniForma",
            c.ma_vlastni_jidelnu as "maVlastniJidelnu"
     from oblast_firmy of
     join companies c on c.ico = of.ico
     where of.oblast_id = any($1::uuid[])`,
    [oblasti.map((o) => o.id)],
  );

  const pred = await pocetRadku(db, kampanId);
  const vynechano: VynechanaFirma[] = [];

  for (const f of kandidati) {
    const duvod = duvodNeoslovovat({ ...f, partnerskaIca, blacklist });
    if (duvod) {
      vynechano.push({ ico: f.ico, nazev: f.nazev, ...duvod });
      continue;
    }
    await db.query(
      `insert into kampan_firmy (kampan_id, ico) values ($1,$2)
       on conflict (kampan_id, ico) do nothing`,
      [kampanId, f.ico],
    );
  }

  const po = await pocetRadku(db, kampanId);
  return { pridano: po - pred, jizBylo: pred, vynechano };
}

async function pocetRadku(db: Db, kampanId: string): Promise<number> {
  const r = await db.query<{ pocet: number }>(
    "select count(*)::int as pocet from kampan_firmy where kampan_id = $1",
    [kampanId],
  );
  return r[0]?.pocet ?? 0;
}

/** Vyřadí firmu z kampaně. Důvod je povinný — bez něj se pravidla nebrousí. */
export async function vyradFirmu(
  db: Db,
  kampanId: string,
  ico: string,
  duvod: string,
): Promise<void> {
  if (!duvod.trim()) throw new Error("Vyřazení firmy potřebuje důvod.");
  await db.query(
    `update kampan_firmy set stav = 'vyrazena', duvod_vyrazeni = $1
     where kampan_id = $2 and ico = $3`,
    [duvod.trim(), kampanId, ico],
  );
}

export async function firmyKampane(db: Db, kampanId: string): Promise<FirmaVKampani[]> {
  return db.query<FirmaVKampani>(
    `select kf.ico, c.nazev, c.obec, kf.stav,
            kf.duvod_vyrazeni as "duvodVyrazeni", c.skore,
            (select count(*)::int from contacts k where k.ico = kf.ico) as kontaktu
     from kampan_firmy kf
     join companies c on c.ico = kf.ico
     where kf.kampan_id = $1
     order by c.skore desc nulls last`,
    [kampanId],
  );
}

/**
 * Kam se z kterého stavu smí.
 *
 * `bezi` a `uzavrena` nemají žádnou příchozí cestu schválně — jsou
 * v číselníku kvůli fázi 3, ale kód fáze 0–2 do nich nepustí (TP-8).
 */
export const PRECHODY: Record<StavKampane, readonly StavKampane[]> = {
  rozpracovana: ["ceka_na_pruzkum", "k_posouzeni", "zrusena"],
  ceka_na_pruzkum: ["k_posouzeni", "zrusena"],
  k_posouzeni: ["schvalena", "ceka_na_pruzkum", "zrusena"],
  schvalena: ["zrusena"],
  bezi: [],
  uzavrena: [],
  zrusena: [],
};

/**
 * Změní stav kampaně. Nepovolený přechod skončí výjimkou.
 *
 * Podmínky schválení (průzkum doběhl, aspoň jedna firma s kontaktem) hlídá
 * navíc spoušť v databázi — tady jsou proto jen kvůli srozumitelné hlášce,
 * ne jako jediná pojistka.
 */
export async function zmenStav(
  db: Db,
  kampanId: string,
  novy: StavKampane,
  duvod?: string,
): Promise<void> {
  const k = await nactiKampan(db, kampanId);
  if (!k) throw new Error("Kampaň neexistuje.");

  if (!PRECHODY[k.stav].includes(novy)) {
    throw new Error(`Z „${k.stav}" nejde přejít do „${novy}".`);
  }
  if (novy === "zrusena" && !duvod?.trim()) {
    throw new Error("Zrušení kampaně potřebuje důvod.");
  }

  await db.query("update kampane set stav = $1, duvod_zruseni = $2 where id = $3", [
    novy,
    novy === "zrusena" ? duvod!.trim() : k.duvodZruseni,
    kampanId,
  ]);
}

export interface Souhrn {
  firem: number;
  vyrazenych: number;
  seSpojenim: number;
  /** Rozpad kontaktů podle úrovně adresy (TP-6). `null` = úroveň neurčena. */
  podleUrovne: Array<{ uroven: number | null; pocet: number }>;
  kapacitaVolna: number | null;
}

/**
 * Podklad pro posouzení kampaně před schválením.
 *
 * Kapacita se bere ze jídelny kampaně a může být neznámá — pak zůstane
 * `null` a nikde se z ní nesmí dělat nula.
 */
export async function souhrnKampane(db: Db, kampanId: string): Promise<Souhrn> {
  const zaklad = await db.query<{
    firem: number; vyrazenych: number; seSpojenim: number;
  }>(
    `select
       count(*) filter (where kf.stav = 'vybrana')::int as firem,
       count(*) filter (where kf.stav = 'vyrazena')::int as vyrazenych,
       count(*) filter (where kf.stav = 'vybrana' and exists (
         select 1 from contacts c where c.ico = kf.ico))::int as "seSpojenim"
     from kampan_firmy kf where kf.kampan_id = $1`,
    [kampanId],
  );

  const urovne = await db.query<{ uroven: number | null; pocet: number }>(
    `select c.uroven_adresy as uroven, count(*)::int as pocet
     from kampan_firmy kf
     join contacts c on c.ico = kf.ico
     where kf.kampan_id = $1 and kf.stav = 'vybrana'
     group by c.uroven_adresy order by c.uroven_adresy nulls last`,
    [kampanId],
  );

  const kapacita = await db.query<{ kapacita: number | null }>(
    `select j.kapacita_volna as kapacita
     from kampane k left join jidelny j on j.id = k.jidelna_id
     where k.id = $1`,
    [kampanId],
  );

  return {
    firem: zaklad[0]?.firem ?? 0,
    vyrazenych: zaklad[0]?.vyrazenych ?? 0,
    seSpojenim: zaklad[0]?.seSpojenim ?? 0,
    podleUrovne: urovne,
    kapacitaVolna: kapacita[0]?.kapacita ?? null,
  };
}

/**
 * Ve kterých jiných kampaních jsou firmy z této kampaně.
 *
 * Podle TP-5 smí na firmu odejít jedno oslovení; překryv proto **upozorňuje**
 * (rozhodnutí majitele 2026-07-29). Tvrdá pojistka sedí až u odesílání
 * ve fázi 3, podle `companies.osloveno_at`.
 */
export async function prekryvKampani(
  db: Db,
  kampanId: string,
): Promise<Array<{ nazev: string; pocet: number }>> {
  return db.query<{ nazev: string; pocet: number }>(
    `select k.nazev, count(*)::int as pocet
     from kampan_firmy moje
     join kampan_firmy jina
       on jina.ico = moje.ico and jina.kampan_id <> moje.kampan_id
     join kampane k on k.id = jina.kampan_id
     where moje.kampan_id = $1
       and moje.stav = 'vybrana' and jina.stav = 'vybrana'
       and k.stav <> 'zrusena'
     group by k.nazev order by count(*) desc, k.nazev`,
    [kampanId],
  );
}

/** Rozpad firem v kampani podle nejlepší doložené úrovně adresy (TP-6). */
export interface RozpadKontaktu {
  /** Úroveň 1 — konkrétní jmenovaná osoba. */
  jmenna: number;
  /** Úroveň 2 — adresa určená pro obchodní nabídky. */
  proNabidky: number;
  /** Úroveň 3 — obecná adresa typu info@. */
  obecna: number;
  /** Firma bez doloženého spojení. */
  zadny: number;
}

/**
 * Kolik firem v kampani má jaké spojení.
 *
 * Firma se počítá podle NEJLEPŠÍHO kontaktu, který má — jinak by jedna firma
 * přispěla do dvou sloupců a součet by nesouhlasil s počtem firem v kampani.
 * Nejlepší je nejnižší úroveň: 1 je jmenovaná osoba, 3 obecná adresa.
 *
 * Ručně vyřazené firmy se nepočítají vůbec; ty už v kampani nejsou.
 */
export async function rozpadKontaktuKampane(
  db: Db,
  kampanId: string,
): Promise<RozpadKontaktu> {
  const r = await db.query<{ uroven: number | null; pocet: number }>(
    `select nejlepsi as uroven, count(*)::int as pocet from (
       select kf.ico, min(k.uroven_adresy) as nejlepsi
       from kampan_firmy kf
       left join contacts k on k.ico = kf.ico
       where kf.kampan_id = $1 and kf.stav = 'vybrana'
       group by kf.ico
     ) t group by nejlepsi`,
    [kampanId],
  );

  const podle = new Map(r.map((x) => [x.uroven, x.pocet]));
  return {
    jmenna: podle.get(1) ?? 0,
    proNabidky: podle.get(2) ?? 0,
    obecna: podle.get(3) ?? 0,
    zadny: podle.get(null) ?? 0,
  };
}
