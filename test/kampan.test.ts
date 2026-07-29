import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("schéma kampaní", () => {
  it("název kampaně je jedinečný bez ohledu na velikost písmen", async () => {
    await db.query("insert into kampane (nazev, spravce) values ($1,$2)", [
      "Západní Čechy", "laub@cantinero.cz",
    ]);
    await expect(
      db.query("insert into kampane (nazev, spravce) values ($1,$2)", [
        "západní čechy", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("zrušení bez důvodu neprojde", async () => {
    await expect(
      db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'zrusena')", [
        "Bez důvodu", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("INSERT se stavem schválena bez firem s kontaktem padne", async () => {
    await expect(
      db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'schvalena')", [
        "Schválená bez firem", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("INSERT se stavem rozpracovana projde", async () => {
    const rows = await db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'rozpracovana') returning id", [
      "Rozpracovaná kampaň", "laub@cantinero.cz",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty("id");
  });
});
