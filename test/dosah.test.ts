import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nastavGeo, nastavStav, zalozFirmu, zapisDosah } from "../src/repo.js";
import { prepocitejDosah, firmyVDosahu } from "../src/dosah.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;
let zbuch: string;
let tlucna: string;

const firma = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "x", obec: "Zbůch", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  // Zbůch a Tlučná jsou od sebe ~5 km a obě mají zónu 3 km — pruh mezi nimi
  // patří oběma. Přesně ten případ, kvůli kterému tabulka vznikla.
  const z = await db.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, zona_metru)
     values ('ZŠ Zbůch','x','Zbůch',49.6000,13.2000,559661,3000) returning id`,
  );
  zbuch = z[0]!.id;
  const t = await db.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, zona_metru)
     values ('ZŠ Tlučná','x','Tlučná',49.6449,13.2000,559491,3000) returning id`,
  );
  tlucna = t[0]!.id;
});

/** Firma v místě, které leží v zóně obou jídelen. */
async function firmaMeziNimi(ico: string): Promise<void> {
  await zalozFirmu(db, firma(ico, "Firma mezi obcemi"));
  await nastavGeo(db, ico, {
    lat: 49.6225, lng: 13.2, jidelnaId: zbuch, vzdalenostM: 2500, vZone: true,
  });
  await nastavStav(db, ico, "kvalifikovany");
}

describe("firma v dosahu víc jídelen", () => {
  it("zaznamená ji u obou, ne jen u té, která ji našla první", async () => {
    await firmaMeziNimi("25232657");
    await prepocitejDosah(db);

    const d = await db.query<{ obec: string; vzdalenost_m: number; v_zone: boolean }>(
      `select j.obec, d.vzdalenost_m, d.v_zone from dosah d
       join jidelny j on j.id = d.jidelna_id where d.ico = '25232657' order by j.obec`,
    );
    expect(d.map((x) => x.obec)).toEqual(["Tlučná", "Zbůch"]);
    expect(d.every((x) => x.v_zone)).toBe(true);
  });

  it("statistika každé jídelny ji obsahuje — obchodní potenciál oblasti", async () => {
    await firmaMeziNimi("25232657");
    await prepocitejDosah(db);

    expect((await firmyVDosahu(db, zbuch)).map((f) => f.ico)).toEqual(["25232657"]);
    expect((await firmyVDosahu(db, tlucna)).map((f) => f.ico)).toEqual(["25232657"]);
  });

  it("firmu mimo zónu si nepřivlastní ani jedna", async () => {
    await zalozFirmu(db, firma("48362956", "Firma daleko"));
    await nastavGeo(db, "48362956", {
      lat: 49.9, lng: 13.2, jidelnaId: zbuch, vzdalenostM: 33000, vZone: false,
    });
    await nastavStav(db, "48362956", "cekajici_na_jidelnu");
    await prepocitejDosah(db);

    expect(await firmyVDosahu(db, zbuch)).toHaveLength(0);
    // Vzdálenost se ale zaznamená, ať jde poznat, jak daleko to je.
    const d = await db.query("select 1 from dosah where ico = '48362956'");
    expect(d.length).toBeGreaterThan(0);
  });

  it("přepočet je opakovatelný — nezdvojí záznamy", async () => {
    await firmaMeziNimi("25232657");
    await prepocitejDosah(db);
    await prepocitejDosah(db);

    const d = await db.query("select 1 from dosah where ico = '25232657'");
    expect(d).toHaveLength(2); // dvě jídelny, ne čtyři
  });

  it("zápis jednoho dosahu jde i přímo a přepíše starou vzdálenost", async () => {
    await firmaMeziNimi("25232657");
    await zapisDosah(db, "25232657", zbuch, { vzdalenostM: 100, vZone: true });
    await zapisDosah(db, "25232657", zbuch, { vzdalenostM: 250, vZone: true });

    const d = await db.query<{ vzdalenost_m: number }>(
      "select vzdalenost_m from dosah where ico = '25232657' and jidelna_id = $1",
      [zbuch],
    );
    expect(d).toHaveLength(1);
    expect(d[0]!.vzdalenost_m).toBe(250);
  });

  it("neaktivní jídelnu do dosahu nepočítá", async () => {
    await db.query("update jidelny set aktivni = false where id = $1", [tlucna]);
    await firmaMeziNimi("25232657");
    await prepocitejDosah(db);

    const d = await db.query("select 1 from dosah where ico = '25232657'");
    expect(d).toHaveLength(1);
  });
});
