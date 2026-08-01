import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import {
  nastavUzemi,
  objednejPruzkumyProKampan,
  pruzkumyKampane,
  zalozKampan,
} from "../src/kampan.js";
import { dokoncPruzkum, objednejPruzkum, selhalPruzkum, zahajPruzkum } from "../src/pruzkum.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const PLZEN = { lat: 49.7475, lng: 13.3776 };

async function kruh(nazev: string): Promise<string> {
  return zalozOblast(db, { nazev, oblast: { typ: "kruh", stred: PLZEN, polomerM: 5000 } });
}

async function kampanNad(nazvy: string[]): Promise<{ id: string; oblasti: string[] }> {
  const id = await zalozKampan(db, { nazev: "Západ", spravce: "a@b.cz" });
  const oblasti: string[] = [];
  for (const n of nazvy) oblasti.push(await kruh(n));
  await nastavUzemi(db, id, { oblastiIds: oblasti });
  return { id, oblasti };
}

describe("objednání průzkumu pro kampaň nad více oblastmi", () => {
  it("objedná pro každou oblast zvlášť — agent bere po jedné", async () => {
    const { id } = await kampanNad(["Plzeňsko", "Klatovsko", "Rokycansko"]);

    const v = await objednejPruzkumyProKampan(db, id, "a@b.cz");

    expect(v.objednano).toEqual(["Plzeňsko", "Klatovsko", "Rokycansko"]);
    expect(v.preskoceno).toEqual([]);
    expect(await pruzkumyKampane(db, id)).toHaveLength(3);
  });

  it("hotovou oblast neobjedná znovu — data už máme", async () => {
    const { id, oblasti } = await kampanNad(["Plzeňsko", "Klatovsko"]);
    const drivejsi = await objednejPruzkum(db, { oblastId: oblasti[0]!, pozadal: "x@y.cz" });
    await zahajPruzkum(db, drivejsi);
    await dokoncPruzkum(db, drivejsi, { firemPrevzato: 10, firemNovych: 2 });

    const v = await objednejPruzkumyProKampan(db, id, "a@b.cz");

    expect(v.objednano).toEqual(["Klatovsko"]);
    expect(v.preskoceno).toEqual(["Plzeňsko"]);
  });

  it("čekající objednávku nezdvojí", async () => {
    const { id, oblasti } = await kampanNad(["Plzeňsko"]);
    await objednejPruzkum(db, { oblastId: oblasti[0]!, pozadal: "x@y.cz" });

    const v = await objednejPruzkumyProKampan(db, id, "a@b.cz");

    expect(v.objednano).toEqual([]);
    expect(v.preskoceno).toEqual(["Plzeňsko"]);
  });

  it("po neúspěchu se objedná znovu — selhání není výsledek", async () => {
    const { id, oblasti } = await kampanNad(["Plzeňsko"]);
    const spatny = await objednejPruzkum(db, { oblastId: oblasti[0]!, pozadal: "x@y.cz" });
    await zahajPruzkum(db, spatny);
    await selhalPruzkum(db, spatny, "ARES neodpovídal");

    const v = await objednejPruzkumyProKampan(db, id, "a@b.cz");

    expect(v.objednano).toEqual(["Plzeňsko"]);
  });

  it("kampaň bez území neobjedná nic", async () => {
    const id = await zalozKampan(db, { nazev: "Prázdná", spravce: "a@b.cz" });
    const v = await objednejPruzkumyProKampan(db, id, "a@b.cz");
    expect(v).toEqual({ objednano: [], preskoceno: [] });
  });

  it("objednávky nesou kampaň, ať jde poznat, ke které patří", async () => {
    const { id } = await kampanNad(["Plzeňsko", "Klatovsko"]);
    await objednejPruzkumyProKampan(db, id, "sef@firma.cz");

    const p = await pruzkumyKampane(db, id);
    expect(p.map((x) => x.oblastNazev)).toEqual(["Plzeňsko", "Klatovsko"]);
    expect(p.every((x) => x.stav === "ceka")).toBe(true);
  });

  it("dřívější průzkum oblasti se v přehledu kampaně započítá", async () => {
    // Oblast prozkoumal někdo jiný a dřív. Kampaň z toho těží — ale musí
    // o tom vědět, jinak by tvrdila, že se na průzkum čeká.
    const { id, oblasti } = await kampanNad(["Plzeňsko", "Klatovsko"]);
    const drivejsi = await objednejPruzkum(db, { oblastId: oblasti[0]!, pozadal: "x@y.cz" });
    await zahajPruzkum(db, drivejsi);
    await dokoncPruzkum(db, drivejsi, { firemPrevzato: 10, firemNovych: 2 });
    await objednejPruzkumyProKampan(db, id, "a@b.cz");

    const p = await pruzkumyKampane(db, id);
    expect(p.map((x) => [x.oblastNazev, x.stav])).toEqual([
      ["Plzeňsko", "hotovo"],
      ["Klatovsko", "ceka"],
    ]);
  });
});
