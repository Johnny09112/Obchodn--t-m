import { beforeAll, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import {
  nastavGeo,
  nastavSkore,
  nastavStav,
  ukonciBeh,
  zacniBeh,
  zalozFirmu,
  zapisAtribut,
  zapisKontakt,
} from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

const seznam: AresZaznam = {
  ico: "25596641",
  nazev: "Seznam.cz, a.s.",
  adresa: "Radlická 3294/10, 15000 Praha 5",
  obec: "Praha",
  czNace: ["62010", "73110"],
  velikostKategorie: "korporat",
  kodObce: 554782,
};

beforeAll(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("zalozFirmu (TP-1)", () => {
  it("založí firmu z ARES záznamu ve stavu novy", async () => {
    await zalozFirmu(db, seznam);
    const rows = await db.query<{ stav: string; velikost_kategorie: string }>(
      "select stav, velikost_kategorie from companies where ico = $1",
      [seznam.ico],
    );
    expect(rows[0]!.stav).toBe("novy");
    expect(rows[0]!.velikost_kategorie).toBe("korporat");
  });

  it("je idempotentní (druhé volání nespadne, neduplikuje)", async () => {
    await zalozFirmu(db, seznam);
    const rows = await db.query("select 1 from companies where ico = $1", [seznam.ico]);
    expect(rows).toHaveLength(1);
  });
});

describe("zapisAtribut (TP-2, TP-3)", () => {
  it("zapíše hodnotu i evidence atomicky", async () => {
    await zapisAtribut(db, seznam.ico, "zpusob_stravovani", "stravenky", {
      zdrojUrl: "https://www.seznam.cz/kariera",
      citace: "Přispíváme na stravování formou stravenek.",
    });
    const firma = await db.query<{ zpusob_stravovani: string }>(
      "select zpusob_stravovani from companies where ico = $1",
      [seznam.ico],
    );
    expect(firma[0]!.zpusob_stravovani).toBe("stravenky");
    const ev = await db.query(
      "select 1 from evidence where ico = $1 and atribut = 'zpusob_stravovani'",
      [seznam.ico],
    );
    expect(ev).toHaveLength(1);
  });

  it("odmítne atribut mimo whitelist", async () => {
    await expect(
      zapisAtribut(db, seznam.ico, "plat_reditele" as never, "x", {
        zdrojUrl: "https://example.com",
        citace: "y",
      }),
    ).rejects.toThrow(/není v rejstříku/i);
  });

  it("odmítne zápis bez zdroje", async () => {
    await expect(
      zapisAtribut(db, seznam.ico, "ma_vlastni_jidelnu", "false", {
        zdrojUrl: "",
        citace: "y",
      }),
    ).rejects.toThrow(/zdroj/i);
  });

  // Web firmy se má hromadit v kartotéce, ne mizet mezi běhy (0039_web_firmy).
  // Stejný mechanismus jako u zpusob_stravovani výš — sloupec companies.web
  // se plní přes ATRIBUTY_SLOUPCE, ne novou cestou. Citace je věta ze
  // stránky, ze které je vidět, že web patří právě téhle firmě (ne obecná
  // fráze, kterou by mohl mít kdokoli).
  it("propíše web firmy do companies.web", async () => {
    await zapisAtribut(db, seznam.ico, "web", "https://www.seznam.cz", {
      zdrojUrl: "https://www.seznam.cz/o-firme",
      citace: "Seznam.cz, a.s., IČO 25596641 — český internetový vyhledávač.",
    });
    const firma = await db.query<{ web: string }>(
      "select web from companies where ico = $1",
      [seznam.ico],
    );
    expect(firma[0]!.web).toBe("https://www.seznam.cz");
    const ev = await db.query(
      "select 1 from evidence where ico = $1 and atribut = 'web'",
      [seznam.ico],
    );
    expect(ev).toHaveLength(1);
  });
});

describe("zapisKontakt (TP-6)", () => {
  it("uloží kontakt s úrovní adresy a zdrojem", async () => {
    const id = await zapisKontakt(db, seznam.ico, {
      email: "obchod@seznam.cz",
      urovenAdresy: 1,
      zdrojUrl: "https://www.seznam.cz/kontakty",
      citace: "Pro obchodní nabídky pište na obchod@seznam.cz",
    });
    expect(id).toBeTruthy();
    const rows = await db.query<{ uroven_adresy: number }>(
      "select uroven_adresy from contacts where email = $1",
      ["obchod@seznam.cz"],
    );
    expect(rows[0]!.uroven_adresy).toBe(1);
  });

  it("odmítne kontakt bez zdroje", async () => {
    await expect(
      zapisKontakt(db, seznam.ico, {
        email: "x@y.cz",
        urovenAdresy: 2,
        zdrojUrl: "",
        citace: "",
      }),
    ).rejects.toThrow(/zdroj/i);
  });
});

describe("stavy a geo", () => {
  it("nastaví geo a skóre", async () => {
    const jid = await db.query<{ id: string }>(
      "insert into jidelny (nazev, adresa, lat, lng, kapacita_volna) values ('ZŠ Test','Praha',50.08,14.42,100) returning id",
    );
    await nastavGeo(db, seznam.ico, {
      lat: 50.05,
      lng: 14.4,
      jidelnaId: jid[0]!.id,
      vzdalenostM: 650,
      vZone: true,
    });
    await nastavSkore(db, seznam.ico, 87);
    const rows = await db.query<{ vzdalenost_m: number; skore: number }>(
      "select vzdalenost_m, skore from companies where ico = $1",
      [seznam.ico],
    );
    expect(rows[0]!.vzdalenost_m).toBe(650);
    expect(rows[0]!.skore).toBe(87);
  });

  it("povolí přechod novy → kvalifikovany", async () => {
    await nastavStav(db, seznam.ico, "kvalifikovany");
    const rows = await db.query<{ stav: string }>(
      "select stav from companies where ico = $1",
      [seznam.ico],
    );
    expect(rows[0]!.stav).toBe("kvalifikovany");
  });

  it("odmítne nepovolený přechod (kvalifikovany → zakaznik mimo fázi 1)", async () => {
    await expect(nastavStav(db, seznam.ico, "zakaznik" as never)).rejects.toThrow();
  });
});

describe("agent_runs (TP-13)", () => {
  it("zaznamená začátek a konec běhu", async () => {
    const behId = await zacniBeh(db, "cmuchal", { jidelnaId: "test" });
    await ukonciBeh(db, behId, { firem: 3 }, [{ ico: "123", chyba: "geocode selhal" }], 0.42);
    const rows = await db.query<{ konec: string | null; naklady_usd: string }>(
      "select konec, naklady_usd from agent_runs where id = $1",
      [behId],
    );
    expect(rows[0]!.konec).not.toBeNull();
    expect(Number(rows[0]!.naklady_usd)).toBeCloseTo(0.42);
  });
});
