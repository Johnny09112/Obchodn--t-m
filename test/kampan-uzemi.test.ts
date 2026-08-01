import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import { naplnZOblasti, nastavUzemi, oblastiKampane, zalozKampan } from "../src/kampan.js";
import { nastavGeo, zalozFirmu } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

/** Dvě místa daleko od sebe, ať se kruhy nepřekrývají. */
const PLZEN = { lat: 49.7475, lng: 13.3776 };
const KLATOVY = { lat: 49.3955, lng: 13.2952 };

async function kruh(nazev: string, stred: { lat: number; lng: number }): Promise<string> {
  return zalozOblast(db, { nazev, oblast: { typ: "kruh", stred, polomerM: 5000 } });
}

async function firma(ico: string, kde: { lat: number; lng: number }): Promise<void> {
  const zaznam: AresZaznam = {
    ico, nazev: `Firma ${ico}`, adresa: "x", obec: "Obec",
    czNace: ["25610"], velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
  };
  await zalozFirmu(db, zaznam);
  await nastavGeo(db, ico, { ...kde, jidelnaId: null, vzdalenostM: 0, vZone: true });
}

async function kampan(): Promise<string> {
  return zalozKampan(db, { nazev: "Západ", spravce: "a@b.cz" });
}

describe("území kampaně", () => {
  it("kampaň může stát na víc oblastech", async () => {
    const id = await kampan();
    const a = await kruh("Plzeňsko", PLZEN);
    const b = await kruh("Klatovsko", KLATOVY);

    await nastavUzemi(db, id, { oblastiIds: [a, b] });

    expect((await oblastiKampane(db, id)).map((o) => o.nazev)).toEqual([
      "Plzeňsko",
      "Klatovsko",
    ]);
  });

  it("nastavení území nahradí celou množinu, nepřidává", async () => {
    // Jinak by se z opravy výběru stalo hromadění: kdo Klatovsko odebere,
    // musí ho opravdu odebrat.
    const id = await kampan();
    const a = await kruh("Plzeňsko", PLZEN);
    const b = await kruh("Klatovsko", KLATOVY);
    await nastavUzemi(db, id, { oblastiIds: [a, b] });

    await nastavUzemi(db, id, { oblastiIds: [b] });

    expect((await oblastiKampane(db, id)).map((o) => o.nazev)).toEqual(["Klatovsko"]);
  });

  it("kampaň bez území je v pořádku — území se vybírá až v druhém kroku", async () => {
    const id = await kampan();
    await nastavUzemi(db, id, { oblastiIds: [] });
    expect(await oblastiKampane(db, id)).toEqual([]);
  });

  it("dvakrát tatáž oblast se zapíše jednou", async () => {
    const id = await kampan();
    const a = await kruh("Plzeňsko", PLZEN);
    await nastavUzemi(db, id, { oblastiIds: [a, a] });
    expect(await oblastiKampane(db, id)).toHaveLength(1);
  });

  it("výběrem území se kampaň posune do druhého kroku", async () => {
    const id = await kampan();
    const a = await kruh("Plzeňsko", PLZEN);
    await nastavUzemi(db, id, { oblastiIds: [a] });

    const k = await db.query<{ krok: number }>("select krok from kampane where id = $1", [id]);
    expect(k[0]!.krok).toBeGreaterThanOrEqual(2);
  });
});

describe("naplnění z více oblastí", () => {
  it("sebere firmy ze všech oblastí kampaně", async () => {
    const id = await kampan();
    const a = await kruh("Plzeňsko", PLZEN);
    const b = await kruh("Klatovsko", KLATOVY);
    await nastavUzemi(db, id, { oblastiIds: [a, b] });
    await firma("25232657", PLZEN);
    await firma("26185610", KLATOVY);

    const v = await naplnZOblasti(db, id);

    expect(v.pridano).toBe(2);
  });

  it("firma ve dvou oblastech je v kampani jednou", async () => {
    // TP-5: na jednu firmu smí odejít jen jedno oslovení. Překryv oblastí
    // z toho nesmí udělat dvě.
    const id = await kampan();
    const velka = await zalozOblast(db, {
      nazev: "Celý kraj",
      oblast: { typ: "kruh", stred: PLZEN, polomerM: 60000 },
    });
    const mala = await kruh("Plzeňsko", PLZEN);
    await nastavUzemi(db, id, { oblastiIds: [velka, mala] });
    await firma("25232657", PLZEN);

    const v = await naplnZOblasti(db, id);

    expect(v.pridano).toBe(1);
    const radky = await db.query("select 1 from kampan_firmy where kampan_id = $1", [id]);
    expect(radky).toHaveLength(1);
  });

  it("vynechaná firma se hlásí jednou, i když leží ve dvou oblastech", async () => {
    const id = await kampan();
    const velka = await zalozOblast(db, {
      nazev: "Celý kraj",
      oblast: { typ: "kruh", stred: PLZEN, polomerM: 60000 },
    });
    const mala = await kruh("Plzeňsko", PLZEN);
    await nastavUzemi(db, id, { oblastiIds: [velka, mala] });
    await firma("25232657", PLZEN);
    await db.query("update companies set ma_vlastni_jidelnu = true where ico = $1", ["25232657"]);

    const v = await naplnZOblasti(db, id);

    expect(v.pridano).toBe(0);
    expect(v.vynechano).toHaveLength(1);
    expect(v.vynechano[0]!.duvod).toBe("vlastni_jidelna");
  });

  it("kampaň bez území nedoplní nic a nespadne", async () => {
    const id = await kampan();
    expect(await naplnZOblasti(db, id)).toEqual({ pridano: 0, jizBylo: 0, vynechano: [] });
  });
});
