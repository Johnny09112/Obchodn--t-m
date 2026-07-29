import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import {
  dalsiPruzkum, dokoncPruzkum, nedokonceneProKampan, objednejPruzkum,
  selhalPruzkum, zahajPruzkum,
} from "../src/pruzkum.js";
import { zalozKampan } from "../src/kampan.js";

let db: Db;
let oblastId: string;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  oblastId = await zalozOblast(db, {
    nazev: "Území", oblast: { typ: "kruh", stred: { lat: 49.6, lng: 13.2 }, polomerM: 3000 },
  });
});

describe("fronta průzkumů", () => {
  it("objednávka čeká a dá se vyzvednout", async () => {
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    const dalsi = await dalsiPruzkum(db);
    expect(dalsi?.id).toBe(id);
    expect(dalsi?.stav).toBe("ceka");
  });

  it("vyzvedává se nejstarší objednávka první", async () => {
    const prvni = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    expect((await dalsiPruzkum(db))?.id).toBe(prvni);
  });

  it("zahájená objednávka se už nevyzvedne podruhé", async () => {
    // Jinak by dva běhy agenta dělaly tutéž práci.
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);
    expect(await dalsiPruzkum(db)).toBeNull();
  });

  it("dokončení zapíše počty a uzavře objednávku", async () => {
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);
    await dokoncPruzkum(db, id, { firemPrevzato: 12, firemNovych: 3 });
    const r = await db.query<{ stav: string; firem_novych: number }>(
      "select stav, firem_novych from pruzkumy where id = $1", [id],
    );
    expect(r[0]?.stav).toBe("hotovo");
    expect(r[0]?.firem_novych).toBe(3);
  });

  it("selhání bez popisu chyby neprojde", async () => {
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await expect(selhalPruzkum(db, id, "  ")).rejects.toThrow();
  });

  it("spočítá nedokončené objednávky kampaně", async () => {
    const kampanId = await zalozKampan(db, { nazev: "K", spravce: "a@b.cz" });
    await objednejPruzkum(db, { oblastId, kampanId, pozadal: "a@b.cz" });
    expect(await nedokonceneProKampan(db, kampanId)).toBe(1);

    const id = await objednejPruzkum(db, { oblastId, kampanId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);
    await dokoncPruzkum(db, id, { firemPrevzato: 0, firemNovych: 0 });
    expect(await nedokonceneProKampan(db, kampanId)).toBe(1);
  });
});
