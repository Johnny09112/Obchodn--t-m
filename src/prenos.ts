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
 *
 * `atributy` a `profil_atributy` jsou jiný případ, i když taky vypadají
 * jako číselník: cíl si sice výchozí osazení taky zakládá migrací, ale
 * rejstřík se navíc smí RUČNĚ ROZŠIŘOVAT (celý smysl profilu produktu —
 * ADR 0002). Zdroj a cíl se tak časem rozejdou a rozdíl je potřeba přenést.
 * Proto jsou v seznamu, ale s tolerancí duplicit (`CISELNIKY_S_DUPLICITOU`
 * níž) — jinak by insert osmi výchozích atributů, které cíl už má, spadl na
 * `atributy_pkey`. `atributy` musí být před `evidence` (cizí klíč
 * `evidence_atribut_fk`), `profil_atributy` hned za ní — odkazuje na ni i na
 * `profily`, které v cíli existují vždy.
 */
const TABULKY = [
  "jidelny",
  "atributy",
  "profil_atributy",
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

/**
 * Tabulky, kde cíl může mít stejný řádek už z vlastní migrace (výchozí
 * osazení číselníku) — insert proto ignoruje duplicity podle primárního
 * klíče místo aby na nich spadl. `radku` ve výsledku pak značí, kolik řádků
 * v cíli OPRAVDU PŘIBYLO, ne kolik jich bylo ve zdroji.
 */
const CISELNIKY_S_DUPLICITOU = new Set<string>(["atributy", "profil_atributy"]);

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
    const tolerujDuplicity = CISELNIKY_S_DUPLICITOU.has(tabulka);

    let vlozeno = 0;
    for (const radek of radky) {
      const zastupci = sloupce.map((_, i) => `$${i + 1}`).join(", ");
      const hodnoty = sloupce.map((s) => {
        // Objekty i pole se předávají jako hodnota. Dřív se objekty
        // stringifikovaly v domnění, že jinak ovladačem neprojdou — opak je
        // pravda: ostrý Postgres by JSON text serializoval podruhé a do jsonb
        // uložil řetězec místo objektu (ověřeno 17. 8. 2026, viz repo.ts).
        return radek[s];
      });
      const vysledekInsertu = await cil.query(
        `insert into ${tabulka} (${seznamSloupcu}) values (${zastupci})` +
          (tolerujDuplicity ? " on conflict do nothing returning 1" : ""),
        hodnoty,
      );
      if (!tolerujDuplicity || vysledekInsertu.length > 0) vlozeno++;
    }
    vysledek.push({ tabulka, radku: tolerujDuplicity ? vlozeno : radky.length });
  }

  return vysledek;
}
