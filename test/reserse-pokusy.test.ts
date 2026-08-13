import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozKampan } from "../src/kampan.js";
import { zalozFirmu } from "../src/repo.js";
import {
  MAX_POKUSU_RESERSE,
  firmyProReserse,
  vycerpanePokusy,
  zaznamenejPokusReserse,
} from "../src/reserse.js";

let db: Db;
let kampanId: string;

async function firmaVKampani(ico: string, skore: number): Promise<void> {
  await zalozFirmu(db, {
    ico, nazev: `Firma ${ico}`, pravniForma: "112", czNace: [],
  } as never);
  await db.query("update companies set stav = 'kvalifikovany', skore = $2 where ico = $1", [
    ico, skore,
  ]);
  await db.query(
    "insert into kampan_firmy (kampan_id, ico, stav) values ($1, $2, 'vybrana')",
    [kampanId, ico],
  );
}

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  kampanId = await zalozKampan(db, { nazev: "K", spravce: "a@b.cz" });
});

describe("pokusy o rešerši", () => {
  it("nová firma má nula pokusů a do fronty patří", async () => {
    await firmaVKampani("25232657", 50);
    const f = await firmyProReserse(db, kampanId, 10);
    expect(f.map((x) => x.ico)).toEqual(["25232657"]);
  });

  it("zaznamenaný pokus firmu z fronty hned nevyřadí", async () => {
    await firmaVKampani("25232657", 50);
    await zaznamenejPokusReserse(db, ["25232657"]);
    expect((await firmyProReserse(db, kampanId, 10))).toHaveLength(1);
  });

  // Jádro opravy: firma, u které agent nikdy nic nenajde, se musí
  // po vyčerpání pokusů přestat nabízet — jinak fronta nedojde.
  it("po vyčerpání pokusů z fronty vypadne", async () => {
    await firmaVKampani("25232657", 50);
    for (let i = 0; i < MAX_POKUSU_RESERSE; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(0);
  });

  it("hranice platí z obou stran", async () => {
    await firmaVKampani("25232657", 50);
    // O jeden pokus míň než limit — pořád ve frontě.
    for (let i = 0; i < MAX_POKUSU_RESERSE - 1; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(1);
    await zaznamenejPokusReserse(db, ["25232657"]);
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(0);
  });

  it("počítá se každé firmě zvlášť", async () => {
    await firmaVKampani("25232657", 50);
    await firmaVKampani("25242407", 40);
    for (let i = 0; i < MAX_POKUSU_RESERSE; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    const f = await firmyProReserse(db, kampanId, 10);
    expect(f.map((x) => x.ico)).toEqual(["25242407"]);
  });

  it("zapíše i čas posledního pokusu", async () => {
    await firmaVKampani("25232657", 50);
    await zaznamenejPokusReserse(db, ["25232657"]);
    const r = await db.query<{ reserse_pokusu: number; reserse_naposledy_at: Date | null }>(
      "select reserse_pokusu, reserse_naposledy_at from companies where ico = '25232657'",
    );
    expect(r[0]!.reserse_pokusu).toBe(1);
    expect(r[0]!.reserse_naposledy_at).not.toBeNull();
  });

  it("prázdný seznam nic nerozbije", async () => {
    await expect(zaznamenejPokusReserse(db, [])).resolves.toBeUndefined();
  });

  // Aby šlo poznat, že fronta doopravdy došla — a nespletlo se to
  // s „ještě jsme nezačali".
  it("vyčerpané firmy jde spočítat", async () => {
    await firmaVKampani("25232657", 50);
    await firmaVKampani("25242407", 40);
    expect(await vycerpanePokusy(db, kampanId)).toBe(0);
    for (let i = 0; i < MAX_POKUSU_RESERSE; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    expect(await vycerpanePokusy(db, kampanId)).toBe(1);
  });

  it("firma čekající na jídelnu do fronty nepatří", async () => {
    await firmaVKampani("25232657", 50);
    await firmaVKampani("25242407", 40);
    await db.query(
      "update companies set stav = 'cekajici_na_jidelnu' where ico = '25242407'",
    );
    const f = await firmyProReserse(db, kampanId, 10);
    // Obě strany zvlášť: kvalifikovaná zůstává, čekající vypadne. Test,
    // který tvrdí jen jedno, by neodlišil filtr od úplného vyprázdnění.
    expect(f.map((x) => x.ico)).toEqual(["25232657"]);
  });

  it("zamítnutá firma do fronty nepatří", async () => {
    await firmaVKampani("25232657", 50);
    await db.query("update companies set stav = 'zamitnuty' where ico = '25232657'");
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(0);
  });

  // Filtr je psaný jako výčet ZAKÁZANÝCH stavů. Kdyby byl obráceně, nový
  // pracovní stav by z fronty tiše vypadl a nikdo by si toho nevšiml.
  it("firma dál ve trychtýři z fronty tiše nezmizí", async () => {
    await firmaVKampani("25232657", 50);
    await db.query("update companies set stav = 'jednani' where ico = '25232657'");
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(1);
  });

  it("firma, u které se něco našlo, se mezi vyčerpané nepočítá", async () => {
    await firmaVKampani("25232657", 50);
    for (let i = 0; i < MAX_POKUSU_RESERSE; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    await db.query("update companies set obohaceno_at = now() where ico = '25232657'");
    expect(await vycerpanePokusy(db, kampanId)).toBe(0);
  });
});
