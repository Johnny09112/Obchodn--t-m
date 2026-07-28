/**
 * Dosah — které jídelny mají firmu na dojezd.
 *
 * Firma smí patřit víc jídelnám zároveň. Nepřeřazuje se mezi nimi a žádná
 * si ji „nezabírá“: jde o obchodní potenciál oblasti, ne o vlastnictví
 * (rozhodnutí majitele 2026-07-28). Statistika každé jídelny proto firmu
 * obsahuje, i když ji shodně obsahuje i statistika sousední jídelny.
 *
 * Počítá se ze souřadnic, které už v databázi jsou — žádné dotazy ven,
 * takže přepočet je levný a jde pustit po každé změně zón.
 */
import type { Db } from "./db.js";
import { vzdalenostM } from "./geo.js";
import { zapisDosah } from "./repo.js";

export interface FirmaVDosahu {
  ico: string;
  nazev: string;
  vzdalenostM: number;
  skore: number | null;
  velikostKategorie: string | null;
  /** Kolik dalších jídelen má tuhle firmu taky v dosahu. */
  sdileniSJinymi: number;
}

/**
 * Přepočte dosah pro všechny firmy se známou polohou a všechny aktivní
 * jídelny. Zaznamenává i firmy mimo zónu — ať jde poznat, jak daleko jsou,
 * a nemusí se to počítat znovu při rozšíření zóny.
 */
export async function prepocitejDosah(
  db: Db,
  opts: { jidelnaId?: string } = {},
): Promise<{ firem: number; dvojic: number; vZone: number }> {
  const params: unknown[] = [];
  let podminka = "aktivni is true";
  if (opts.jidelnaId) {
    params.push(opts.jidelnaId);
    podminka += ` and id = $${params.length}`;
  }

  const jidelny = await db.query<{
    id: string; lat: number; lng: number; zona_metru: number;
  }>(
    `select id, lat::float8 as lat, lng::float8 as lng, zona_metru
     from jidelny where ${podminka}`,
    params,
  );
  const firmy = await db.query<{ ico: string; lat: number; lng: number }>(
    `select ico, lat::float8 as lat, lng::float8 as lng
     from companies where lat is not null and lng is not null`,
  );

  let dvojic = 0;
  let vZone = 0;
  for (const f of firmy) {
    for (const j of jidelny) {
      const m = vzdalenostM({ lat: f.lat, lng: f.lng }, { lat: j.lat, lng: j.lng });
      const jeVZone = m <= j.zona_metru;
      await zapisDosah(db, f.ico, j.id, { vzdalenostM: m, vZone: jeVZone });
      dvojic++;
      if (jeVZone) vZone++;
    }
  }
  return { firem: firmy.length, dvojic, vZone };
}

/**
 * Firmy, které má daná jídelna v dosahu — podklad pro statistiku i tisk.
 * Firma se tu objeví i tehdy, když ji má v dosahu ještě jiná jídelna;
 * `sdileniSJinymi` říká s kolika.
 */
export async function firmyVDosahu(
  db: Db,
  jidelnaId: string,
  opts: { minZamestnancu?: boolean } = {},
): Promise<FirmaVDosahu[]> {
  void opts;
  return db.query<FirmaVDosahu>(
    `select c.ico, c.nazev, d.vzdalenost_m as "vzdalenostM", c.skore,
            c.velikost_kategorie as "velikostKategorie",
            (select count(*)::int - 1 from dosah x
              where x.ico = c.ico and x.v_zone) as "sdileniSJinymi"
     from dosah d
     join companies c on c.ico = d.ico
     where d.jidelna_id = $1 and d.v_zone is true
     order by c.skore desc nulls last`,
    [jidelnaId],
  );
}
