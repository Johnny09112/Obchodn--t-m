import { beforeEach, describe, expect, it, vi } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozKampan } from "../src/kampan.js";
import { zalozFirmu, zapisKontakt } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";
import {
  dalsiReserseKVyrizeni,
  firmyProReserse,
  pocetSeSpojenim,
  selhalaReserse,
  uzavriReserse,
} from "../src/reserse.js";

// Čerstvá databáze na každý test — stejný vzor jako test/kampan-souhrn.test.ts.
let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const zaznam = (ico: string): AresZaznam => ({
  ico,
  nazev: `Firma ${ico}`,
  adresa: "x",
  obec: "Zbůch",
  czNace: ["25610"],
  velikostKategorie: "stredni",
  kodObce: 559661,
  pravniForma: "112",
});

/**
 * Založí kampaň a firmy do ní. Firma vzniká jen přes `zalozFirmu` (TP-1) —
 * přímý INSERT do `companies` je zakázaný. U `obohaceno: true` nastaví
 * razítko `companies.obohaceno_at`, u `vyrazena: true` firmu v kampani
 * vyřadí. `skore`, pokud je zadané, se zapíše do `companies.skore`.
 */
async function pripravKampan(
  db: Db,
  firmy: Array<{
    ico: string;
    obohaceno?: boolean;
    vyrazena?: boolean;
    skore?: number;
  }>,
): Promise<{ kampanId: string; ica: string[] }> {
  const kampanId = await zalozKampan(db, { nazev: `K-${Math.random()}`, spravce: "a@b.cz" });
  const ica: string[] = [];
  for (const f of firmy) {
    await zalozFirmu(db, zaznam(f.ico));
    await db.query("insert into kampan_firmy (kampan_id, ico) values ($1,$2)", [
      kampanId,
      f.ico,
    ]);
    if (f.obohaceno) {
      await db.query("update companies set obohaceno_at = now() where ico = $1", [f.ico]);
    }
    if (f.skore !== undefined) {
      await db.query("update companies set skore = $1 where ico = $2", [f.skore, f.ico]);
    }
    if (f.vyrazena) {
      await db.query(
        "update kampan_firmy set stav = 'vyrazena', duvod_vyrazeni = 'test' where kampan_id = $1 and ico = $2",
        [kampanId, f.ico],
      );
    }
    ica.push(f.ico);
  }
  return { kampanId, ica };
}

describe("výběr firem do dávky", () => {
  it("vezme jen firmy z kampaně, které rešerší neprošly", async () => {
    const { kampanId, ica } = await pripravKampan(db, [
      { ico: "25232657", obohaceno: false },
      { ico: "48362956", obohaceno: true },
    ]);
    const v = await firmyProReserse(db, kampanId, 10);
    expect(v.map((f) => f.ico)).toEqual(["25232657"]);
    expect(ica).toHaveLength(2);
  });

  // Vyřazení už dnes znamená „tuhle neoslovovat". Pouštět na ni rešerši
  // je zbytečná práce a majitel to výslovně rozhodl (2026-08-04).
  it("vyřazenou firmu do dávky nedá", async () => {
    const { kampanId } = await pripravKampan(db, [
      { ico: "25232657", obohaceno: false, vyrazena: true },
      { ico: "48362956", obohaceno: false },
    ]);
    const v = await firmyProReserse(db, kampanId, 10);
    expect(v.map((f) => f.ico)).toEqual(["48362956"]);
  });

  it("respektuje velikost dávky a řadí podle skóre sestupně", async () => {
    const { kampanId } = await pripravKampan(db, [
      { ico: "25232657", obohaceno: false, skore: 10 },
      { ico: "48362956", obohaceno: false, skore: 50 },
      { ico: "17439523", obohaceno: false, skore: 30 },
    ]);
    const v = await firmyProReserse(db, kampanId, 2);
    expect(v.map((f) => f.ico)).toEqual(["48362956", "17439523"]);
  });
});

describe("přechody stavů objednávky", () => {
  it("fronta bere nejstarší čekající", async () => {
    const { kampanId } = await pripravKampan(db, []);
    // Různé firem_zadano u obou záznamů schválně — jinak jsou k nerozeznání
    // a test by prošel i s obráceným řazením nebo bez řazení vůbec.
    await db.query(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal, pozadano_at)
       values ($1, 7, 'z', 'a@b.cz', now() - interval '1 hour')`,
      [kampanId],
    );
    await db.query(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 5, 'z', 'a@b.cz')`,
      [kampanId],
    );
    const p = await dalsiReserseKVyrizeni(db);
    expect(p?.firemZadano).toBe(7);
  });

  // Po pádu procesu zůstane objednávka v 'bezi' a nikdo ji nečeká. Kdyby si
  // ji fronta nevzala, visela by navždy — stejné rozhodnutí jako u průzkumu.
  it("bere i objednávku uvíznutou ve stavu bezi", async () => {
    const { kampanId } = await pripravKampan(db, []);
    await db.query(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal, stav)
       values ($1, 5, 'z', 'a@b.cz', 'bezi')`,
      [kampanId],
    );
    expect(await dalsiReserseKVyrizeni(db)).not.toBeNull();
  });

  it("hotovou objednávku už nebere", async () => {
    const { kampanId } = await pripravKampan(db, []);
    await db.query(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal, stav)
       values ($1, 5, 'z', 'a@b.cz', 'hotovo')`,
      [kampanId],
    );
    expect(await dalsiReserseKVyrizeni(db)).toBeNull();
  });

  it("uzavření zapíše počty a čas", async () => {
    const { kampanId } = await pripravKampan(db, []);
    const r = await db.query<{ id: string }>(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 5, 'z', 'a@b.cz') returning id`,
      [kampanId],
    );
    await uzavriReserse(db, r[0]!.id, { firemZpracovano: 5, firemSNalezem: 4 });
    const po = await db.query<{ stav: string; firem_s_nalezem: number; dokonceno_at: string }>(
      "select stav, firem_s_nalezem, dokonceno_at::text from reserse where id = $1",
      [r[0]!.id],
    );
    expect(po[0]!.stav).toBe("hotovo");
    expect(po[0]!.firem_s_nalezem).toBe(4);
    expect(po[0]!.dokonceno_at).not.toBeNull();
  });

  it("selhání zapíše důvod", async () => {
    const { kampanId } = await pripravKampan(db, []);
    const r = await db.query<{ id: string }>(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 5, 'z', 'a@b.cz') returning id`,
      [kampanId],
    );
    await selhalaReserse(db, r[0]!.id, "Claude Code se nepodařilo spustit");
    const po = await db.query<{ stav: string; chyba: string }>(
      "select stav, chyba from reserse where id = $1",
      [r[0]!.id],
    );
    expect(po[0]!.stav).toBe("selhalo");
    expect(po[0]!.chyba).toContain("nepodařilo spustit");
  });
});

describe("počet firem se spojením", () => {
  it("firma se dvěma kontakty se počítá jednou", async () => {
    await zalozFirmu(db, zaznam("25232657"));
    await zapisKontakt(db, "25232657", {
      email: "a@example.cz",
      urovenAdresy: 2,
      zdrojUrl: "https://example.cz/a",
      citace: "e-mail uvedený na stránkách",
    });
    await zapisKontakt(db, "25232657", {
      telefon: "123456789",
      urovenAdresy: 2,
      zdrojUrl: "https://example.cz/b",
      citace: "telefon uvedený na stránkách",
    });

    expect(await pocetSeSpojenim(db, ["25232657"])).toBe(1);
  });

  // V Postgresu je `= any('{}')` past — bez včasného návratu by dotaz
  // proběhl a vrátil 0 oklikou, tenhle test navíc hlídá, že se do databáze
  // vůbec nesahá.
  it("prázdný seznam IČO vrátí 0 a nesáhne do databáze", async () => {
    const spy = vi.spyOn(db, "query");

    expect(await pocetSeSpojenim(db, [])).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
