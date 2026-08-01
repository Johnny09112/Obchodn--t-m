import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast, prepocitejOblastFirmy } from "../src/oblast.js";
import { zalozKampan, nastavUzemi } from "../src/kampan.js";
import { objednejPruzkum } from "../src/pruzkum.js";
import { nastavGeo, zalozFirmu } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const STRED = { lat: 49.6, lng: 13.2 };
const OBLAST = { typ: "kruh" as const, stred: STRED, polomerM: 3000 };

async function oblast(nazev: string): Promise<string> {
  return zalozOblast(db, { nazev, oblast: OBLAST });
}

/** Jak se zachová cizí klíč při mazání: 'r' = restrict, 'c' = cascade. */
async function chovaniPriMazani(tabulka: string): Promise<string> {
  const r = await db.query<{ confdeltype: string }>(
    `select c.confdeltype from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     join pg_class o on o.oid = c.confrelid
     where t.relname = $1 and o.relname = 'oblasti' and c.contype = 'f'`,
    [tabulka],
  );
  return r[0]?.confdeltype ?? "?";
}

describe("co drží oblast naživu", () => {
  it("průzkum oblast ochrání — jeho záznam se nesmí smazat s ní", async () => {
    // Dřív to byla kaskáda: smazání oblasti tiše smazalo i doklad o tom,
    // jaké území se kdy analyzovalo. To je evidence, ne odvozenina.
    expect(await chovaniPriMazani("pruzkumy")).toBe("r");
  });

  it("kampaň oblast ochrání taky", async () => {
    // Od migrace 0030 drží ochranu vazební tabulka, ne sloupec `kampane.oblast_id`
    // — ten zmizel, když kampaň dostala víc oblastí. Kdyby se cizí klíč
    // nepřenesl, úklid oblastí by se tiše otevřel.
    expect(await chovaniPriMazani("kampan_oblasti")).toBe("r");
  });

  it("seznam firem v oblasti zmizí s ní — je to jen odvozenina z tvaru", async () => {
    expect(await chovaniPriMazani("oblast_firmy")).toBe("c");
  });
});

describe("mazání oblasti", () => {
  it("nepoužitá oblast se smaže i se svým seznamem firem", async () => {
    const id = await oblast("Ke smazání");
    const zaznam: AresZaznam = {
      ico: "25232657", nazev: "Blízká s.r.o.", adresa: "x", obec: "Zbůch",
      czNace: ["25610"], velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
    };
    await zalozFirmu(db, zaznam);
    await nastavGeo(db, zaznam.ico, {
      lat: STRED.lat, lng: STRED.lng, jidelnaId: null, vzdalenostM: 0, vZone: true,
    });
    expect(await prepocitejOblastFirmy(db, id)).toBe(1);

    await db.query("delete from oblasti where id = $1", [id]);

    expect(await db.query("select 1 from oblasti where id = $1", [id])).toHaveLength(0);
    expect(
      await db.query("select 1 from oblast_firmy where oblast_id = $1", [id]),
    ).toHaveLength(0);
  });

  it("oblast s objednaným průzkumem se smazat nedá", async () => {
    const id = await oblast("Prozkoumaná");
    await objednejPruzkum(db, { oblastId: id, pozadal: "a@b.cz" });

    await expect(db.query("delete from oblasti where id = $1", [id])).rejects.toThrow();
    expect(await db.query("select 1 from oblasti where id = $1", [id])).toHaveLength(1);
  });

  it("oblast použitá kampaní se smazat nedá", async () => {
    const id = await oblast("V kampani");
    const kampanId = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    await nastavUzemi(db, kampanId, { oblastiIds: [id] });

    await expect(db.query("delete from oblasti where id = $1", [id])).rejects.toThrow();
  });
});

describe("kdo smí oblasti měnit", () => {
  /** Text pravidla pro daný příkaz. */
  async function pravidlo(cmd: string): Promise<string> {
    const p = await db.query<{ qual: string | null; with_check: string | null }>(
      `select qual, with_check from pg_policies where tablename = 'oblasti' and cmd = $1`,
      [cmd],
    );
    return p.map((x) => `${x.qual ?? ""} ${x.with_check ?? ""}`).join(" ");
  }

  it("kreslit a upravovat smí celý tým", async () => {
    expect(await pravidlo("INSERT")).toContain("uzivatel");
    expect(await pravidlo("UPDATE")).toContain("uzivatel");
  });

  it("mazat smí jen admin a výš", async () => {
    // Mazání dat rozhoduje majitel — stejné pravidlo jako u kampaní.
    const text = await pravidlo("DELETE");
    expect(text).toContain("admin");
    expect(text).not.toContain("'uzivatel'");
  });

  it("staré pravidlo pro všechno naráz už neexistuje", async () => {
    // Regrese: `oblasti_zapis` bylo ALL, takže i mazání pouštělo běžnému
    // uživateli — a s kaskádou by mu vzalo i historii průzkumů.
    const p = await db.query(
      `select 1 from pg_policies where tablename = 'oblasti' and cmd = 'ALL'`,
    );
    expect(p).toHaveLength(0);
  });
});
