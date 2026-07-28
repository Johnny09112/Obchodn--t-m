import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nastavGeo, nastavStav, zalozFirmu } from "../src/repo.js";
import {
  firmyVOblasti, nactiOblast, prepocitejOblastFirmy, prirad, zalozOblast,
} from "../src/oblast.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

const firma = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "x", obec: "Zbůch", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

/** 0,001° zeměpisné šířky ≈ 111 m. */
const STRED = { lat: 49.6, lng: 13.2 };
const severne = (m: number) => ({ lat: STRED.lat + m / 111_320, lng: STRED.lng });

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  for (const [ico, nazev, metru] of [
    ["25232657", "Blízká s.r.o.", 500],
    ["48362956", "Střední s.r.o.", 2500],
    ["17439523", "Daleká s.r.o.", 9000],
  ] as const) {
    await zalozFirmu(db, firma(ico, nazev));
    const p = severne(metru);
    await nastavGeo(db, ico, {
      lat: p.lat, lng: p.lng, jidelnaId: null as unknown as string,
      vzdalenostM: metru, vZone: true,
    });
    await nastavStav(db, ico, "kvalifikovany");
  }
});

describe("oblast bez jídelny — obrácený postup", () => {
  it("založí se i když žádná jídelna neexistuje", async () => {
    // Tohle je celý smysl: nejdřív území, jídelna až po jednání.
    const id = await zalozOblast(db, {
      nazev: "Průzkum Zbůch",
      oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
      poznamka: "podklad na jednání se školou",
    });

    const o = await nactiOblast(db, id);
    expect(o).toMatchObject({ nazev: "Průzkum Zbůch", jidelnaId: null });
    expect(o!.oblast).toMatchObject({ typ: "kruh", polomerM: 3000 });
  });

  it("jídelna se přiřadí až dodatečně", async () => {
    const id = await zalozOblast(db, {
      nazev: "Průzkum", oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    const j = await db.query<{ id: string }>(
      `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce)
       values ('ZŠ Zbůch','x','Zbůch',49.6,13.2,559661) returning id`,
    );
    await prirad(db, id, j[0]!.id);

    expect((await nactiOblast(db, id))!.jidelnaId).toBe(j[0]!.id);
  });

  it("kruh bez poloměru databáze odmítne — tiše by nevybral nic", async () => {
    await expect(
      db.query(`insert into oblasti (nazev, typ, stred_lat, stred_lng)
                values ('Vadná','kruh',49.6,13.2)`),
    ).rejects.toThrow();
  });
});

describe("které firmy do oblasti spadají", () => {
  it("kruh vybere jen firmy do poloměru", async () => {
    const id = await zalozOblast(db, {
      nazev: "Kruh 3 km", oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    expect(await prepocitejOblastFirmy(db, id)).toBe(2);

    const f = await firmyVOblasti(db, id);
    expect(f.map((x) => x.ico).sort()).toEqual(["25232657", "48362956"]);
  });

  it("u kruhu si pamatuje i vzdálenost", async () => {
    const id = await zalozOblast(db, {
      nazev: "Kruh", oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    await prepocitejOblastFirmy(db, id);

    const blizka = (await firmyVOblasti(db, id)).find((x) => x.ico === "25232657");
    expect(blizka!.vzdalenostM).toBeGreaterThan(400);
    expect(blizka!.vzdalenostM).toBeLessThan(600);
  });

  it("nakreslený tvar vybere podle tvaru, ne podle vzdálenosti", async () => {
    // Úzký pruh na sever: pojme i vzdálenou firmu, ale jen tímhle směrem.
    const id = await zalozOblast(db, {
      nazev: "Pruh na sever",
      oblast: {
        typ: "polygon",
        body: [
          { lat: 49.59, lng: 13.19 },
          { lat: 49.70, lng: 13.19 },
          { lat: 49.70, lng: 13.21 },
          { lat: 49.59, lng: 13.21 },
        ],
      },
    });
    expect(await prepocitejOblastFirmy(db, id)).toBe(3); // i ta 9 km daleko
  });

  it("přepočet je opakovatelný a po zúžení firmy odebere", async () => {
    const id = await zalozOblast(db, {
      nazev: "Kruh", oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    await prepocitejOblastFirmy(db, id);
    await db.query("update oblasti set polomer_m = 1000 where id = $1", [id]);

    expect(await prepocitejOblastFirmy(db, id)).toBe(1);
    expect(await firmyVOblasti(db, id)).toHaveLength(1);
  });

  it("firmu bez souřadnic nezařadí — nemá podle čeho", async () => {
    await zalozFirmu(db, firma("64358836", "Nezaměřená s.r.o."));
    const id = await zalozOblast(db, {
      nazev: "Kruh", oblast: { typ: "kruh", stred: STRED, polomerM: 50_000 },
    });
    const pocet = await prepocitejOblastFirmy(db, id);
    expect(pocet).toBe(3); // tři zaměřené, nezaměřená ne
  });
});
