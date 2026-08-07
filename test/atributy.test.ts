import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiAtributy, jeZnamyAtribut } from "../src/atributy.js";
import { zalozFirmu, zapisAtribut } from "../src/repo.js";
import { POVOLENE_ATRIBUTY } from "../src/whitelist.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("rejstřík atributů", () => {
  it("obsahuje dnešních osm a všechny smějí do zprávy", async () => {
    const r = await db.query<{ kod: string; do_zpravy: boolean }>(
      "select kod, do_zpravy from atributy order by kod",
    );
    expect(r.map((x) => x.kod)).toEqual([
      "adresa",
      "kontakt",
      "ma_vlastni_jidelnu",
      "obor",
      "ucel_adresy",
      "velikost_kategorie",
      "zamestnanci_odhad",
      "zpusob_stravovani",
    ]);
    expect(r.every((x) => x.do_zpravy)).toBe(true);
  });

  it("každý atribut má popis, co se u něj hledá", async () => {
    const r = await db.query<{ kod: string; popis: string | null }>(
      "select kod, popis from atributy",
    );
    // Popis jde rovnou agentovi — prázdný by znamenal, že si musí domyslet,
    // co hledat, což je přesně dnešní stav a důvod téhle práce.
    expect(r.filter((x) => !x.popis?.trim()).map((x) => x.kod)).toEqual([]);
  });

  // Tvrdé pravidlo TP-3: databáze nesmí pustit atribut, který nikdo nezavedl.
  // Dřív to hlídala pevná podmínka `check`, nově cizí klíč do rejstříku.
  it("vymyšlený atribut databáze nepustí", async () => {
    // Firmu je nutné založit předem — jinak insert padne na evidence_ico_fkey
    // dřív, než se vůbec dostane k atributu, a test by prošel z jiného
    // důvodu, než tvrdí (nález revize: bez tohohle řádku projde i s platným
    // atributem, protože selže na cizím klíči na companies, ne na atributy).
    await db.query(
      `insert into companies (ico, nazev, stav) values ('25232657','X','kvalifikovany')
       on conflict do nothing`,
    );
    await expect(
      db.query(
        `insert into evidence (ico, atribut, hodnota, zdroj_url)
         values ('25232657', 'kdovico', 'x', 'https://e.cz')`,
      ),
    ).rejects.toThrow(/evidence_atribut_fk/);
  });

  it("atribut z rejstříku projde", async () => {
    await db.query(
      `insert into companies (ico, nazev, stav) values ('25232657','X','kvalifikovany')
       on conflict do nothing`,
    );
    await db.query(
      `insert into evidence (ico, atribut, hodnota, zdroj_url)
       values ('25232657', 'obor', 'pekárna', 'https://e.cz')`,
    );
    const r = await db.query<{ pocet: number }>(
      "select count(*)::int as pocet from evidence where atribut = 'obor'",
    );
    expect(r[0]!.pocet).toBe(1);
  });

  // Nejistota z plánu: „vymyšlený atribut neprojde" by prošel i na staré
  // podmínce `check`, kdyby migrace zapomněla podmínku zrušit — a nikdo by
  // si toho nevšiml, dokud by nový atribut nešel přidat. Ověřujeme napřímo
  // v katalogu, že na evidence.atribut zůstal jen cizí klíč.
  it("na evidence.atribut nezůstala žádná stará check podmínka", async () => {
    const r = await db.query<{ conname: string; contype: string }>(
      `select conname, contype
       from pg_constraint
       where conrelid = 'evidence'::regclass
         and contype = 'c'
         and conkey = array[
           (select attnum from pg_attribute
            where attrelid = 'evidence'::regclass and attname = 'atribut')
         ]`,
    );
    expect(r.map((x) => x.conname)).toEqual([]);
  });
});

describe("zápis atributu proti rejstříku (TP-3)", () => {
  // Firmu smí založit jen `zalozFirmu` (TP-1). Falešný záznam z ARESu si
  // opiš z `test/kampan-souhrn.test.ts`, kde už takový pomocník je.
  // Brief uváděl { ico, nazev, pravniForma } bez czNace — v praxi to spadne
  // na "null value in column cz_nace" (companies.cz_nace je not null,
  // ale explicitní undefined přebije defaultní '{}'). Doplněno o czNace: []
  // podle vzoru v test/kampan-souhrn.test.ts (nález, viz report úkolu 2).
  async function firma(ico: string): Promise<void> {
    await zalozFirmu(db, {
      ico,
      nazev: `Firma ${ico}`,
      pravniForma: "112",
      czNace: [],
    } as never);
  }

  it("atribut z rejstříku projde", async () => {
    await firma("25232657");
    await zapisAtribut(db, "25232657", "obor", "pekárna", {
      zdrojUrl: "https://e.cz/o-nas",
      citace: "Jsme rodinná pekárna.",
    });
    const r = await db.query<{ pocet: number }>(
      "select count(*)::int as pocet from evidence where ico = '25232657'",
    );
    expect(r[0]!.pocet).toBe(1);
  });

  it("atribut mimo rejstřík neprojde a řekne proč", async () => {
    await firma("25232657");
    await expect(
      zapisAtribut(db, "25232657", "kdovico", "x", {
        zdrojUrl: "https://e.cz",
        citace: "c",
      }),
    ).rejects.toThrow(/TP-3/);
  });

  // Nově zavedený atribut MUSÍ projít — jinak by rejstřík byl jen ozdoba
  // a nastavitelnost by neexistovala.
  it("nově zavedený atribut projde bez zásahu do kódu", async () => {
    await firma("25232657");
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny a na kolik', false)`,
    );
    await zapisAtribut(db, "25232657", "smenny_provoz", "třísměnný", {
      zdrojUrl: "https://e.cz/kariera",
      citace: "Pracujeme ve třísměnném provozu.",
    });
    expect(await jeZnamyAtribut(db, "smenny_provoz")).toBe(true);
  });

  it("bez zdroje neprojde ani známý atribut (TP-2 platí dál)", async () => {
    await firma("25232657");
    await expect(
      zapisAtribut(db, "25232657", "obor", "pekárna", {
        zdrojUrl: "",
        citace: "",
      }),
    ).rejects.toThrow();
  });

  it("whitelist pro zprávu odpovídá příznaku do_zpravy", async () => {
    const vRejstriku = (await nactiAtributy(db))
      .filter((a) => a.doZpravy)
      .map((a) => a.kod)
      .sort();
    expect(vRejstriku).toEqual([...POVOLENE_ATRIBUTY].sort());
  });

  it("atribut s do_zpravy = false do zprávy nepatří", async () => {
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny', false)`,
    );
    const doZpravy = (await nactiAtributy(db)).filter((a) => a.doZpravy).map((a) => a.kod);
    expect(doZpravy).not.toContain("smenny_provoz");
  });
});
