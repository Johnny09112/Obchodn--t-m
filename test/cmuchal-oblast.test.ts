import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import { objednejPruzkum } from "../src/pruzkum.js";

let db: Db;
let pruzkumId: string;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  const oblastId = await zalozOblast(db, {
    nazev: "Území",
    oblast: { typ: "kruh", stred: { lat: 49.6, lng: 13.2 }, polomerM: 3000 },
  });
  pruzkumId = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
});

describe("schéma úseků průzkumu", () => {
  it("tatáž jednotka se do jedné objednávky nedostane dvakrát", async () => {
    await db.query(
      "insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi) values ($1,554791,'Zbůch',1)",
      [pruzkumId],
    );
    await expect(
      db.query(
        "insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi) values ($1,554791,'Zbůch',2)",
        [pruzkumId],
      ),
    ).rejects.toThrow();
  });

  it("neúspěšný úsek bez popisu chyby neprojde", async () => {
    await expect(
      db.query(
        `insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi, stav)
         values ($1,554791,'Zbůch',1,'selhalo')`,
        [pruzkumId],
      ),
    ).rejects.toThrow();
  });

  it("objednávka smí čekat na rozhodnutí člověka", async () => {
    // Nový stav: tvar nezabírá žádnou obec a čeká se na odpověď.
    await db.query("update pruzkumy set stav = 'ceka_na_rozhodnuti' where id = $1", [pruzkumId]);
    const r = await db.query<{ stav: string }>("select stav from pruzkumy where id = $1", [pruzkumId]);
    expect(r[0]?.stav).toBe("ceka_na_rozhodnuti");
  });
});
