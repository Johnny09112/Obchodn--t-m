/**
 * Fronta objednávek na průzkum území.
 *
 * Aplikace agenta spustit neumí — běží v Claude Code na předplatném
 * uživatele, ne na serveru (ADR 0001). Objedná si ho tedy tudy a agent si
 * práci vyzvedne, až ho někdo pustí.
 *
 * `pruzkumy` je objednávka, `agent_runs` provedení. Jedna objednávka může
 * mít i víc pokusů, proto se `run_id` zapisuje až při zahájení.
 */
import type { Db } from "./db.js";

export type StavPruzkumu = "ceka" | "bezi" | "hotovo" | "selhalo" | "ceka_na_rozhodnuti";

export interface Pruzkum {
  id: string;
  oblastId: string;
  kampanId: string | null;
  stav: StavPruzkumu;
  pozadal: string;
}

const SLOUPCE = `id, oblast_id as "oblastId", kampan_id as "kampanId", stav, pozadal`;

export async function objednejPruzkum(
  db: Db,
  v: { oblastId: string; kampanId?: string; pozadal: string },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into pruzkumy (oblast_id, kampan_id, pozadal) values ($1,$2,$3) returning id`,
    [v.oblastId, v.kampanId ?? null, v.pozadal],
  );
  return r[0]!.id;
}

/** Nejstarší čekající objednávka, nebo null. Zahájené se už nevydávají. */
export async function dalsiPruzkum(db: Db): Promise<Pruzkum | null> {
  const r = await db.query<Pruzkum>(
    `select ${SLOUPCE} from pruzkumy where stav = 'ceka'
     order by pozadano_at limit 1`,
  );
  return r[0] ?? null;
}

/**
 * Rozběhne objednávku, která ještě čeká — ať už normálně (`ceka`), nebo po
 * vědomém rozhodnutí člověka pokračovat i bez zabraných obcí
 * (`ceka_na_rozhodnuti`, viz `--i-bez-obci` v CLI). Na objednávce, která už
 * běží (nebo je uzavřená), nedělá nic — díky tomu opakované volání
 * (`vyridPruzkum` ho volá při každém navazujícím běhu) nepřepíše `run_id`
 * zpátky na prázdno.
 */
export async function zahajPruzkum(db: Db, id: string, runId?: string): Promise<void> {
  await db.query(
    `update pruzkumy set stav = 'bezi', zahajeno_at = now(), run_id = $1
     where id = $2 and stav in ('ceka', 'ceka_na_rozhodnuti')`,
    [runId ?? null, id],
  );
}

/** Dokončit se dá jen průzkum, který opravdu běží — jinak by se tiše přepsal. */
export async function dokoncPruzkum(
  db: Db,
  id: string,
  v: { firemPrevzato: number; firemNovych: number },
): Promise<void> {
  const r = await db.query<{ id: string }>(
    `update pruzkumy set stav = 'hotovo', dokonceno_at = now(),
            firem_prevzato = $1, firem_novych = $2
     where id = $3 and stav = 'bezi'
     returning id`,
    [v.firemPrevzato, v.firemNovych, id],
  );
  if (r.length === 0) {
    throw new Error("Průzkum nejde dokončit — není ve stavu 'bezi' (nebyl zahájen, nebo už je hotový/selhaný).");
  }
}

/**
 * Selhání se zapisuje s popisem — bez něj se nedá poznat, co opravit.
 * Prohlásit za neúspěšný jde jen průzkum, který opravdu běží, ze stejného
 * důvodu jako u `dokoncPruzkum`.
 */
export async function selhalPruzkum(db: Db, id: string, chyba: string): Promise<void> {
  if (!chyba.trim()) throw new Error("Neúspěšný průzkum potřebuje popis chyby.");
  const r = await db.query<{ id: string }>(
    `update pruzkumy set stav = 'selhalo', dokonceno_at = now(), chyba = $1
     where id = $2 and stav = 'bezi'
     returning id`,
    [chyba.trim(), id],
  );
  if (r.length === 0) {
    throw new Error("Průzkum nejde označit za neúspěšný — není ve stavu 'bezi' (nebyl zahájen, nebo je už uzavřený).");
  }
}

export async function nedokonceneProKampan(db: Db, kampanId: string): Promise<number> {
  const r = await db.query<{ pocet: number }>(
    `select count(*)::int as pocet from pruzkumy
     where kampan_id = $1 and stav in ('ceka','bezi')`,
    [kampanId],
  );
  return r[0]?.pocet ?? 0;
}
