/**
 * Příjem nálezů od agenta.
 *
 * Rešerši na webu dělá agent (Claude Code na předplatném), ne kód. Tenhle
 * modul je **vrátný**: cokoli agent přinese, projde stejnou kontrolou jako
 * dřív výstup z API — whitelist atributů, povinný zdroj a doslovná citace
 * (TP-2, TP-3). Co neprojde, se zahodí a vypíše s důvodem.
 *
 * Vadná položka nikdy nezruší celou dávku — jinak by jedna překlepnutá
 * adresa zahodila hodinu práce.
 */
import { z } from "zod";
import type { Db } from "./db.js";
import { jeValidniIco } from "./ico.js";
import type { Segment } from "./res.js";
import {
  ukonciBeh,
  zacniBeh,
  zapisAtribut,
  zapisKontakt,
} from "./repo.js";

/** Atributy, které smí agent dohledávat na webu (podmnožina whitelistu kap. 5). */
export const OBOHACOVANE_ATRIBUTY = [
  "ma_vlastni_jidelnu",
  "zpusob_stravovani",
  "ucel_adresy",
] as const;

const nalezSchema = z.object({
  ico: z.string().refine(jeValidniIco, "neplatné IČO"),
  atribut: z.enum(OBOHACOVANE_ATRIBUTY),
  hodnota: z.string().min(1, "prázdná hodnota"),
  zdrojUrl: z.string().url("zdrojUrl musí být platná adresa stránky"),
  citace: z.string().min(1, "chybí doslovná citace ze zdroje"),
});

const kontaktSchema = z.object({
  ico: z.string().refine(jeValidniIco, "neplatné IČO"),
  email: z.string().email().optional(),
  jmeno: z.string().optional(),
  prijmeni: z.string().optional(),
  pozice: z.string().optional(),
  telefon: z.string().optional(),
  urovenAdresy: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  zdrojUrl: z.string().url("zdrojUrl musí být platná adresa stránky"),
  citace: z.string().min(1, "chybí doslovná citace ze zdroje"),
});

export const davkaSchema = z.object({
  nalezy: z.array(z.unknown()).default([]),
  kontakty: z.array(z.unknown()).default([]),
  /** IČO firem, u kterých agent hledal a nic doložitelného nenašel. */
  bezNalezu: z.array(z.string()).default([]),
  poznamkyProPlaybook: z.array(z.string()).default([]),
});

export type Davka = z.input<typeof davkaSchema>;

export interface VysledekZapisu {
  zapsanoNalezu: number;
  zapsanoKontaktu: number;
  oznacenoBezNalezu: number;
  odmitnuto: Array<{ polozka: unknown; duvod: string }>;
  behId: string;
}

async function firmaExistuje(db: Db, ico: string): Promise<boolean> {
  const r = await db.query("select 1 from companies where ico = $1", [ico]);
  return r.length > 0;
}

/** Zapíše dávku nálezů. Vše přes repository vrstvu, tedy s evidencí. */
export async function zapisDavku(db: Db, vstup: Davka): Promise<VysledekZapisu> {
  const davka = davkaSchema.parse(vstup);
  const behId = await zacniBeh(db, "cmuchal-obohaceni", {
    nalezu: davka.nalezy.length,
    kontaktu: davka.kontakty.length,
    bezNalezu: davka.bezNalezu.length,
  });

  const vysledek: VysledekZapisu = {
    zapsanoNalezu: 0,
    zapsanoKontaktu: 0,
    oznacenoBezNalezu: 0,
    odmitnuto: [],
    behId,
  };

  try {
    for (const syrovy of davka.nalezy) {
      const r = nalezSchema.safeParse(syrovy);
      if (!r.success) {
        vysledek.odmitnuto.push({
          polozka: syrovy,
          duvod: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
        continue;
      }
      const n = r.data;
      if (!(await firmaExistuje(db, n.ico))) {
        vysledek.odmitnuto.push({ polozka: syrovy, duvod: `firma ${n.ico} není v kartotéce` });
        continue;
      }
      await zapisAtribut(db, n.ico, n.atribut, n.hodnota, {
        zdrojUrl: n.zdrojUrl,
        citace: n.citace,
      });
      await oznacProverenou(db, n.ico);
      vysledek.zapsanoNalezu++;
    }

    for (const syrovy of davka.kontakty) {
      const r = kontaktSchema.safeParse(syrovy);
      if (!r.success) {
        vysledek.odmitnuto.push({
          polozka: syrovy,
          duvod: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
        continue;
      }
      const k = r.data;
      if (!(await firmaExistuje(db, k.ico))) {
        vysledek.odmitnuto.push({ polozka: syrovy, duvod: `firma ${k.ico} není v kartotéce` });
        continue;
      }
      const { ico, ...zbytek } = k;
      await zapisKontakt(db, ico, zbytek);
      await oznacProverenou(db, ico);
      vysledek.zapsanoKontaktu++;
    }

    for (const ico of davka.bezNalezu) {
      if (!jeValidniIco(ico) || !(await firmaExistuje(db, ico))) {
        vysledek.odmitnuto.push({ polozka: ico, duvod: `firma ${ico} není v kartotéce` });
        continue;
      }
      await oznacProverenou(db, ico);
      vysledek.oznacenoBezNalezu++;
    }
  } finally {
    const { odmitnuto, ...vystup } = vysledek;
    await ukonciBeh(
      db,
      behId,
      { ...vystup, poznamkyProPlaybook: davka.poznamkyProPlaybook },
      odmitnuto,
      0, // rešerši dělá agent na předplatném — žádné API náklady
    );
  }

  return vysledek;
}

async function oznacProverenou(db: Db, ico: string): Promise<void> {
  await db.query("update companies set obohaceno_at = now() where ico = $1", [ico]);
}

export interface FirmaKObohaceni {
  ico: string;
  nazev: string;
  obec: string | null;
  skore: number | null;
  vzdalenostM: number | null;
  /** Co u firmy ještě chybí — vodítko, co má agent hledat. */
  chybi: string[];
  /**
   * Osoby, které už u firmy známe — typicky jednatel z rejstříku.
   * Agent pak nehledá „nějaký kontakt", ale spojení na konkrétního člověka,
   * což je mnohem lepší výchozí pozice.
   */
  znameOsoby: string[];
}

/**
 * Firmy připravené k rešerši: kvalifikované, v zóně, dosud neprověřené.
 * Nejzajímavější (nejvyšší skóre) první.
 *
 * `segmenty` frontu zúží na dané velikosti. Rešerše stojí čas agenta, takže
 * u firmy s pěti lidmi se nevyplatí stejně jako u firmy s pěti sty. Firmy
 * s neznámou velikostí zúžením propadnou — nevíme o nich dost.
 *
 * `jenBezSpojeni` vybere firmy, u kterých **známe jméno, ale ne způsob, jak
 * se k člověku dostat**. Firma je hotová teprve se jménem A e-mailem nebo
 * telefonem (rozhodnutí majitele 2026-07-28); tahle fronta je proto
 * nejcennější — agent už ví, koho hledat, jen shání spojení.
 */
export async function firmyKObohaceni(
  db: Db,
  opts: {
    limit?: number;
    jidelnaId?: string;
    segmenty?: Segment[];
    jenBezSpojeni?: boolean;
    /**
     * Území místo zóny jídelny. Sběr nad oblastí zakládá firmy **bez jídelny
     * a bez zóny** (stav `cekajici_na_jidelnu`), takže je výchozí fronta
     * nikdy neuvidí — v Plzni by z 620 cílových firem nabídla 16.
     * Stejná díra jako u doplňování kontaktů.
     */
    oblastId?: string;
  },
): Promise<FirmaKObohaceni[]> {
  const podminky: string[] = [];
  const params: unknown[] = [];

  if (opts.oblastId) {
    params.push(opts.oblastId);
    podminky.push(
      "f.stav <> 'zamitnuty'",
      `exists (select 1 from oblast_firmy o where o.ico = f.ico
                 and o.oblast_id = $${params.length})`,
    );
  } else {
    podminky.push("f.stav = 'kvalifikovany'", "f.v_zone is true");
  }

  if (!opts.jenBezSpojeni) {
    // Standardní fronta jde po firmách, které rešerší ještě neprošly.
    podminky.push("f.obohaceno_at is null");
  } else {
    podminky.push(
      // Známe osobu…
      `exists (select 1 from contacts k where k.ico = f.ico and k.prijmeni is not null)`,
      // …ale nemáme na ni ani e-mail, ani telefon.
      `not exists (select 1 from contacts k where k.ico = f.ico
                     and (k.email is not null or k.telefon is not null))`,
    );
  }
  if (opts.jidelnaId) {
    params.push(opts.jidelnaId);
    podminky.push(`f.nejblizsi_jidelna_id = $${params.length}`);
  }
  if (opts.segmenty?.length) {
    params.push(opts.segmenty);
    podminky.push(`f.velikost_kategorie = any($${params.length})`);
  }

  const radky = await db.query<{
    ico: string;
    nazev: string;
    obec: string | null;
    skore: number | null;
    vzdalenost_m: number | null;
    ma_vlastni_jidelnu: boolean | null;
    zpusob_stravovani: string | null;
    kontaktu: number;
    spojeni: number;
    osoby: string[] | null;
  }>(
    `select f.ico, f.nazev, f.obec, f.skore, f.vzdalenost_m,
            f.ma_vlastni_jidelnu, f.zpusob_stravovani,
            (select count(*)::int from contacts c where c.ico = f.ico) as kontaktu,
            (select count(*)::int from contacts c where c.ico = f.ico
               and (c.email is not null or c.telefon is not null)) as spojeni,
            (select array_agg(
                      trim(coalesce(c.jmeno,'') || ' ' || coalesce(c.prijmeni,''))
                      || coalesce(' (' || c.pozice || ')', ''))
               from contacts c where c.ico = f.ico and c.prijmeni is not null) as osoby
     from companies f
     where ${podminky.join(" and ")}
     order by f.skore desc nulls last
     ${opts.limit ? `limit ${Number(opts.limit)}` : ""}`,
    params,
  );

  return radky.map((r) => {
    const chybi: string[] = [];
    if (r.ma_vlastni_jidelnu === null) chybi.push("ma_vlastni_jidelnu");
    if (r.zpusob_stravovani === null) chybi.push("zpusob_stravovani");
    if (r.kontaktu === 0) chybi.push("kontakt");
    // Firma je hotová se jménem A spojením — tohle je ta druhá půlka.
    if (r.spojeni === 0) chybi.push("spojeni");
    return {
      ico: r.ico,
      nazev: r.nazev,
      obec: r.obec,
      skore: r.skore,
      vzdalenostM: r.vzdalenost_m,
      chybi,
      znameOsoby: r.osoby ?? [],
    };
  });
}
