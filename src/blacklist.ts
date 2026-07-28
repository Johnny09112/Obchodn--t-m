/**
 * Ruční blacklist majitele.
 *
 * Automatická vyřazení (bytové domy, agentury práce, nevhodné obory) dělá
 * kód. Tohle je jejich obdoba pro pravidla, která zná jen majitel: „s touhle
 * firmou jsme už jednali", „tenhle obor neobsluhujeme".
 *
 * Každé pravidlo má povinný důvod — bez něj se za měsíc nedá poznat, proč
 * tam ta firma je, a pravidlo se buď smaže omylem, nebo zůstane navždy.
 */
import type { Db } from "./db.js";
import { oddilZNace } from "./kategorie.js";

export type TypPravidla = "ico" | "nazev" | "nace" | "pravni_forma";

export interface Pravidlo {
  id?: string;
  typ: TypPravidla;
  hodnota: string;
  duvod: string;
  vytvoril?: string;
}

/** Firma tak, jak ji blacklist potřebuje vidět. */
export interface PosuzovanaFirma {
  ico: string;
  nazev: string;
  czNace: readonly string[];
  pravniForma?: string | null;
}

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

/**
 * Srovnávací tvar textu: bez diakritiky, malými písmeny.
 *
 * Kdo píše pravidlo, obvykle nepřepisuje háčky přesně podle rejstříku —
 * bez tohohle by pravidlo „kovovyroba" tiše nefungovalo a nikdo by nevěděl proč.
 */
function porovnatelne(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Vrátí pravidlo, které firmu vyřazuje, nebo null. */
export function naBlacklistu(
  pravidla: readonly Pravidlo[],
  firma: PosuzovanaFirma,
): Pravidlo | null {
  const nazev = porovnatelne(firma.nazev);
  const oddily = new Set(
    firma.czNace.map(oddilZNace).filter((o): o is string => o !== null),
  );

  for (const p of pravidla) {
    const hodnota = p.hodnota.trim();
    switch (p.typ) {
      case "ico":
        if (firma.ico === hodnota) return p;
        break;
      case "nazev":
        // Kus názvu stačí — pravidlo se píše ručně, ne kopíruje z rejstříku.
        if (nazev.includes(porovnatelne(hodnota))) return p;
        break;
      case "nace":
        if (oddily.has(hodnota)) return p;
        break;
      case "pravni_forma":
        if (firma.pravniForma === hodnota) return p;
        break;
    }
  }
  return null;
}
