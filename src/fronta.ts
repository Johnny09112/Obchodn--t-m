/**
 * Fronta objednávek průzkumu a zámek na běh agenta.
 *
 * Aplikace agenta spustit neumí — podle pravidel si o průzkum jen požádá
 * (`pruzkumy`). Tenhle modul je druhá polovina: Čmuchal si práci vyzvedne
 * sám, naplánovaným během.
 *
 * **Jeden běh naráz.** `vyridPruzkum` si vyzvedává i úseky ve stavu 'bezi',
 * protože v tom stavu zůstane úsek po pádu procesu — a právě proto by si
 * dva souběžné běhy braly rozdělanou práci navzájem. Zámek to hlídá.
 */
import type { Db } from "./db.js";
import type { Pruzkum } from "./pruzkum.js";

/** Po jaké době bez známky života se zámek považuje za opuštěný. */
export const VYCHOZI_PRODLEVA_MIN = 15;

/**
 * Zkusí zamknout. Vrátí `false`, když zámek drží někdo jiný a ještě se ozývá.
 *
 * Týž držitel si zámek vezme znovu — běh, který spadl a hned se rozeběhl
 * znovu, by se jinak zablokoval sám o sebe.
 */
export async function zamkni(
  db: Db,
  jmeno: string,
  drzitel: string,
  prodlevaMin: number = VYCHOZI_PRODLEVA_MIN,
): Promise<boolean> {
  const r = await db.query<{ drzitel: string }>(
    `insert into zamky (jmeno, drzitel, ziskano_at, srdce_at)
     values ($1, $2, now(), now())
     on conflict (jmeno) do update
       set drzitel = excluded.drzitel, ziskano_at = now(), srdce_at = now()
       where zamky.drzitel = $2
          or zamky.srdce_at < now() - ($3 * interval '1 minute')
     returning drzitel`,
    [jmeno, drzitel, prodlevaMin],
  );
  return r.length > 0;
}

/**
 * Známka života. Volá se mezi úseky — bez ní by dlouhý běh po prodlevě
 * vypadal jako spadlý a druhý stroj by mu vzal práci pod rukama.
 */
export async function tep(db: Db, jmeno: string, drzitel: string): Promise<void> {
  await db.query("update zamky set srdce_at = now() where jmeno = $1 and drzitel = $2", [
    jmeno,
    drzitel,
  ]);
}

/** Odemkne, ale jen svůj zámek. Cizí odemknutí neudělá nic. */
export async function odemkni(db: Db, jmeno: string, drzitel: string): Promise<void> {
  await db.query("delete from zamky where jmeno = $1 and drzitel = $2", [jmeno, drzitel]);
}

const SLOUPCE = `id, kampan_id as "kampanId", oblast_id as "oblastId",
  pozadal, stav, pozadano_at as "pozadanoAt", run_id as "runId",
  firem_prevzato as "firemPrevzato", firem_novych as "firemNovych", chyba,
  urgentni`;

/**
 * Co si má agent z fronty vzít. Urgentní napřed, jinak nejstarší.
 *
 * Bere i objednávky ve stavu 'bezi': v tom stavu zůstane objednávka po pádu
 * procesu a nikdo ji nečeká — kdyby si ji fronta nevzala, visela by navždy
 * a kampaň by čekala na schválení donekonečna.
 *
 * Schválně NEBERE 'ceka_na_rozhodnuti'. Tam se čeká na člověka (tvar
 * nezabírá žádnou obec) a rozhodovat za něj agent nesmí.
 *
 * `jenUrgentni` je pro drobnou hlídku, která běží často. Kdyby brala i
 * běžné objednávky, rozjela by velký průzkum mimo dohodnuté denní okno.
 */
export async function dalsiKVyrizeni(
  db: Db,
  opts: { jenUrgentni?: boolean } = {},
): Promise<Pruzkum | null> {
  const r = await db.query<Pruzkum>(
    `select ${SLOUPCE} from pruzkumy
     where stav in ('ceka', 'bezi')
       and ($1::boolean is not true or urgentni)
     order by urgentni desc, pozadano_at
     limit 1`,
    [opts.jenUrgentni ?? false],
  );
  return r[0] ?? null;
}
