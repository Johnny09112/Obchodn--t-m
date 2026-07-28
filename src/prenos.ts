/**
 * Přenos dat z lokální databáze do sdílené.
 *
 * Potřeba jednou: při přechodu na sdílený Postgres pro dva uživatele.
 * Schéma je na obou stranách stejné (tytéž migrace), takže se jen kopírují
 * řádky — nic se nepřepočítává ani nedohledává.
 *
 * **Do neprázdné databáze nesáhne.** Kdyby se přenos pustil podruhé,
 * duplicitní klíče by ho sice zastavily, ale až v půlce — a napůl přenesená
 * databáze je horší než žádná. Radši odmítnout hned.
 */
import type { Db } from "./db.js";

/**
 * Pořadí je závazné: tabulka se přenese až po tom, na co se odkazuje.
 * Číselníky (kategorie, profily) tu schválně NEJSOU — cíl si je založil
 * migrací sám a jsou v obou databázích totožné.
 */
const TABULKY = [
  "jidelny",
  "companies",
  "oblasti",
  "agent_runs",
  "contacts",
  "evidence",
  "vyrazeni",
  "dosah",
  "oblast_firmy",
  "blacklist",
] as const;

/** Tabulky, jejichž neprázdnost znamená, že se do cíle už zapisovalo. */
const KONTROLOVANE = ["jidelny", "companies", "oblasti", "agent_runs"] as const;

export interface PrenosRadek {
  tabulka: string;
  radku: number;
}

export async function prenesData(zdroj: Db, cil: Db): Promise<PrenosRadek[]> {
  for (const t of KONTROLOVANE) {
    const r = await cil.query(`select 1 from ${t} limit 1`);
    if (r.length > 0) {
      throw new Error(
        `Cílová databáze není prázdná (tabulka ${t} obsahuje data). ` +
          "Přenos by ji poškodil — vyprázdni ji, nebo použij jinou.",
      );
    }
  }

  const vysledek: PrenosRadek[] = [];

  for (const tabulka of TABULKY) {
    const radky = await zdroj.query<Record<string, unknown>>(`select * from ${tabulka}`);
    if (radky.length === 0) {
      vysledek.push({ tabulka, radku: 0 });
      continue;
    }

    const sloupce = Object.keys(radky[0]!);
    const seznamSloupcu = sloupce.map((s) => `"${s}"`).join(", ");

    for (const radek of radky) {
      const zastupci = sloupce.map((_, i) => `$${i + 1}`).join(", ");
      const hodnoty = sloupce.map((s) => {
        const h = radek[s];
        // Pole a objekty projdou ovladačem správně jen jako JSON textu;
        // pole (cz_nace) ale ovladač zvládá nativně, takže se nechává.
        if (h !== null && typeof h === "object" && !Array.isArray(h) && !(h instanceof Date)) {
          return JSON.stringify(h);
        }
        return h;
      });
      await cil.query(
        `insert into ${tabulka} (${seznamSloupcu}) values (${zastupci})`,
        hodnoty,
      );
    }
    vysledek.push({ tabulka, radku: radky.length });
  }

  return vysledek;
}
