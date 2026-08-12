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
import { aktivniProfilKod, nactiAtributyProfilu } from "./atributy.js";
import type { Db } from "./db.js";
import { jeValidniIco } from "./ico.js";
import type { Segment } from "./res.js";
import {
  ukonciBeh,
  zacniBeh,
  zapisAtribut,
  zapisKontakt,
} from "./repo.js";

/**
 * Co smí agent dohledávat na webu, už neurčuje pevný výčet v kódu, ale
 * rejstřík atributů (`atributy.hleda_agent`) — nahrazuje dřívější
 * `OBOHACOVANE_ATRIBUTY`. Ten byl druhá, přísnější kopie whitelistu vedle
 * `zapisAtribut` (TP-3): dokud existoval, nový atribut se odmítl tady, dřív
 * než se vůbec dostal k opravdové kontrole, a ostrá dávka doběhla s nulou.
 *
 * Zod tedy jen ověří tvar (neprázdný řetězec); jestli je atribut opravdu
 * v rejstříku a smí ho hledat agent, se řeší za běhu v `zapisDavku`.
 */
const nalezSchema = z.object({
  ico: z.string().refine(jeValidniIco, "neplatné IČO"),
  atribut: z.string().min(1, "prázdný atribut"),
  hodnota: z.string().min(1, "prázdná hodnota"),
  zdrojUrl: z.string().url("zdrojUrl musí být platná adresa stránky"),
  citace: z.string().min(1, "chybí doslovná citace ze zdroje"),
});

/**
 * Smí agent tenhle atribut dohledávat na webu? Kontrola za běhu proti
 * rejstříku (`atributy.hleda_agent`) — nahrazuje dřívější zod `z.enum`
 * nad `OBOHACOVANE_ATRIBUTY` (viz komentář výš).
 */
async function jeObohacovanyAtribut(db: Db, atribut: string): Promise<boolean> {
  const r = await db.query<{ hleda_agent: boolean }>(
    "select hleda_agent from atributy where kod = $1",
    [atribut],
  );
  return r[0]?.hleda_agent === true;
}

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
      // Whitelist se dřív hlídal enumem v zod schématu (`OBOHACOVANE_ATRIBUTY`);
      // teď je to tahle kontrola za běhu proti rejstříku — atribut musí být
      // známý A musí ho agent doopravdy hledat (`hleda_agent`). Odmítnutí
      // nezruší dávku, jen se přeskočí tahle položka.
      if (!(await jeObohacovanyAtribut(db, n.atribut))) {
        vysledek.odmitnuto.push({
          polozka: syrovy,
          duvod: `atribut '${n.atribut}' agent nehledá — není v rejstříku, nebo má hleda_agent = false`,
        });
        continue;
      }
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

export interface ChybejiciAtribut {
  kod: string;
  /** Co se u něj hledá. Jde agentovi do zadání. */
  popis: string;
}

export interface FirmaKObohaceni {
  ico: string;
  nazev: string;
  obec: string | null;
  skore: number | null;
  vzdalenostM: number | null;
  /** Co u firmy ještě chybí — vodítko, co má agent hledat. */
  chybi: ChybejiciAtribut[];
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
    /**
     * Objednávka AI rešerše (`reserse obsluz`) vybírá jen firmy z konkrétní
     * kampaně — jinak by agent mohl narazit na firmu, kterou majitel z
     * kampaně vyřadil, což výslovně zakázal (rozhodnutí 2026-08-04).
     * Podmínka tady musí přesně kopírovat `firmyProReserse` (src/reserse.ts)
     * — je to totéž pravidlo na dvou místech a bez testu, který obě
     * porovná, se dřív nebo později rozejdou (nález 2 závěrečné revize).
     * Kombinuje se s `jidelnaId`/`segmenty` níž, ale ne s `jenBezSpojeni` —
     * ta fronta je jiná, nezávislá potřeba.
     */
    kampanId?: string;
    /**
     * Profil produktu, podle kterého se počítá `chybi` — o atributech
     * rozhoduje profil (`nactiAtributyProfilu`), `spojeni` se hledá vždycky
     * bez ohledu na profil (viz komentář u výpočtu `chybi` níž).
     *
     * Nezadaný profil padá na globálně aktivní (`aktivniProfilKod`), NIKDY
     * na celý rejstřík atributů — jinak by atribut zavedený mimo profily
     * začal chodit do `chybi` u všech firem přes `k-obohaceni` bez
     * parametrů, což je přesně příkaz z playbooku Čmuchala.
     */
    profilKod?: string;
  },
): Promise<FirmaKObohaceni[]> {
  const podminky: string[] = [];
  const params: unknown[] = [];

  if (opts.kampanId) {
    params.push(opts.kampanId);
    podminky.push(
      `exists (select 1 from kampan_firmy kf where kf.kampan_id = $${params.length}
                 and kf.ico = f.ico and kf.stav = 'vybrana')`,
      "f.obohaceno_at is null",
    );
  } else if (opts.oblastId) {
    params.push(opts.oblastId);
    podminky.push(
      "f.stav <> 'zamitnuty'",
      `exists (select 1 from oblast_firmy o where o.ico = f.ico
                 and o.oblast_id = $${params.length})`,
    );
  } else {
    podminky.push("f.stav = 'kvalifikovany'", "f.v_zone is true");
  }

  // `--kampan` už podmínku „neprošla rešerší" nese sám (musí přesně
  // odpovídat firmyProReserse) — druhé přidání by bylo jen neškodně
  // duplicitní, ale `jenBezSpojeni` s kampaní kombinovat nedává smysl.
  if (!opts.kampanId) {
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
    spojeni: number;
    osoby: string[] | null;
  }>(
    `select f.ico, f.nazev, f.obec, f.skore, f.vzdalenost_m,
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

  // Co u firmy chybí, určuje PROFIL — ale jen z atributů, které agent
  // doopravdy hledá (`hleda_agent`). Velikost a adresa plynou z rejstříků
  // a hledat je na webu je zbytečná práce; kdyby se do `chybi` dostaly,
  // agent by dávku protopil sháněním něčeho, co dávno víme.
  //
  // `obor` mezi ně do 7. 8. 2026 patřil taky — dokud se neukázalo, že kód
  // činnosti z rejstříku stačí na filtrování, ale ne na oslovení. Migrace
  // 0038 ho zapnula (viz její komentář). Rozhoduje o tom **příznak v datech**,
  // ne tenhle výčet — ten je jen vysvětlení, proč se u některých atributů
  // vyplatí hledání vypnout.
  //
  // Zdrojem pravdy o tom, jestli údaj máme, je EVIDENCE, ne sloupec —
  // nově zavedené atributy sloupec v `companies` nemají.
  //
  // `spojeni` je výjimka: není to atribut a profil ho neřídí. Bez spojení
  // nemá celý systém výstup, takže se hledá vždycky.
  const atributy = (
    opts.profilKod
      ? await nactiAtributyProfilu(db, opts.profilKod)
      : await nactiAtributyProfilu(db, await aktivniProfilKod(db))
  ).filter((a) => a.hledaAgent);

  const maEvidenci = new Set(
    (
      await db.query<{ ico: string; atribut: string }>(
        `select distinct ico, atribut from evidence where ico = any($1)`,
        [radky.map((r) => r.ico)],
      )
    ).map((e) => `${e.ico}|${e.atribut}`),
  );

  return radky.map((r) => {
    const chybi: ChybejiciAtribut[] = atributy
      .filter((a) => !maEvidenci.has(`${r.ico}|${a.kod}`))
      .map((a) => ({ kod: a.kod, popis: a.popis }));
    // `spojeni` NENÍ atribut — proto popis rovnou říká, kam ho hlásit.
    // Bez té věty ho agent při ostré dávce 12. 8. poslal mezi nálezy, kde
    // ho kontrola správně odmítla („atribut 'spojeni' agent nehledá").
    // Odmítnutí bylo správné; chyba byla v zadání, které vypadalo, jako by
    // `spojeni` bylo totéž co obor nebo web.
    if (r.spojeni === 0) {
      chybi.push({
        kod: "spojeni",
        popis:
          "e-mail nebo telefon na osobu — POZOR: tohle není atribut. " +
          "Hlas ho v poli „kontakty“, ne mezi nálezy.",
      });
    }
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
