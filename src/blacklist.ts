/**
 * Ruční blacklist majitele — práce s databází.
 *
 * Automatická vyřazení (bytové domy, agentury práce, nevhodné obory) dělá
 * kód. Tohle je jejich obdoba pro pravidla, která zná jen majitel: „s touhle
 * firmou jsme už jednali", „tenhle obor neobsluhujeme".
 *
 * Každé pravidlo má povinný důvod — bez něj se za měsíc nedá poznat, proč
 * tam ta firma je, a pravidlo se buď smaže omylem, nebo zůstane navždy.
 *
 * **Samotné posuzování (`naBlacklistu`) a typy bydlí v `sito.ts`.** Sdílí je
 * webová aplikace, a ta si přes tenhle soubor nesmí přitáhnout databázi —
 * v prohlížeči ovladač Postgresu nedává smysl a při sestavení chybí. Hlídá
 * to `test/hranice-aplikace.test.ts`.
 */
import type { Db } from "./db.js";
import type { Pravidlo } from "./sito.js";

export {
  naBlacklistu,
  type Pravidlo,
  type PosuzovanaFirma,
  type TypPravidla,
} from "./sito.js";

export async function pridejPravidlo(db: Db, p: Pravidlo): Promise<void> {
  await db.query(
    "insert into blacklist (typ, hodnota, duvod, vytvoril) values ($1,$2,$3,$4)",
    [p.typ, p.hodnota, p.duvod, p.vytvoril ?? null],
  );
}

export async function nactiBlacklist(db: Db): Promise<Pravidlo[]> {
  return db.query<Pravidlo>(
    "select id, typ, hodnota, duvod, vytvoril from blacklist order by created_at",
  );
}

export async function smazPravidlo(db: Db, id: string): Promise<void> {
  await db.query("delete from blacklist where id = $1", [id]);
}
