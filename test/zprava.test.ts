import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { ulozSablonu } from "../src/obsah.js";
import { SABLONA_HLAVNI } from "../src/obsah-schvaleny.js";

/**
 * Skládání zprávy pro kampaň (druhá dodávka nastavení zprávy).
 *
 * Zadání: docs/superpowers/specs/2026-08-18-nastaveni-zpravy-design.md
 */

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("pole šablony", () => {
  it("uložená šablona dostane pole podle zástupných údajů v textu", async () => {
    await ulozSablonu(db, SABLONA_HLAVNI);

    const r = await db.query<{ kod: string; povinne: boolean }>(
      `select p.kod, p.povinne from pole_sablony p
         join templates t on t.id = p.template_id
        order by p.poradi`,
    );
    expect(r.map((x) => x.kod)).toEqual([
      "osloveni",
      "vzdalenost",
      "od_vasi_firmy",
      "cena",
    ]);
    // Jméno je jediné pole s náhradou, ostatní firmu vyřadí.
    expect(r.map((x) => x.povinne)).toEqual([false, true, true, true]);
  });

  it("pole má lidský název, ne kód", async () => {
    await ulozSablonu(db, SABLONA_HLAVNI);
    const [r] = await db.query<{ nazev: string }>(
      "select nazev from pole_sablony where kod = 'od_vasi_firmy'",
    );
    expect(r?.nazev).toBe("Obor firmy");
  });

  it("průvodce kampaní má nově pět kroků", async () => {
    const [o] = await db.query<{ id: string }>(
      `insert into oblasti (nazev, typ, stred_lat, stred_lng, polomer_m)
       values ('Zkušební', 'kruh', 49.6, 13.2, 3000) returning id`,
    );
    // Kampaň stojí na množině oblastí (kampan_oblasti, migrace 0030) —
    // sloupec kampane.oblast_id byl zrušen.
    const [k] = await db.query<{ id: string }>(
      `insert into kampane (nazev, spravce, krok) values ('Zkušební', 'majitel', 5) returning id`,
    );
    await db.query("insert into kampan_oblasti (kampan_id, oblast_id) values ($1, $2)", [
      k!.id,
      o!.id,
    ]);
    const [ulozena] = await db.query<{ krok: number }>("select krok from kampane");
    expect(ulozena?.krok).toBe(5);
  });
});
