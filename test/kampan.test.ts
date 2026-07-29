import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiKampan, seznamKampani, zalozKampan } from "../src/kampan.js";

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

describe("založení kampaně", () => {
  it("založí a přečte kampaň ve výchozím stavu", async () => {
    const id = await zalozKampan(db, {
      nazev: "Vary — kapacita od srpna",
      spravce: "laub@cantinero.cz",
      kontext: "Jídelna ve Varech nabízí 30 obědů od srpna.",
    });
    const k = await nactiKampan(db, id);
    expect(k?.nazev).toBe("Vary — kapacita od srpna");
    expect(k?.stav).toBe("rozpracovana");
    expect(k?.krok).toBe(1);
    expect(k?.oblastId).toBeNull();
  });

  it("neznámé id vrátí null, ne výjimku", async () => {
    expect(await nactiKampan(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("seznam vrací nejnovější první", async () => {
    await zalozKampan(db, { nazev: "První", spravce: "a@b.cz" });
    await zalozKampan(db, { nazev: "Druhá", spravce: "a@b.cz" });
    const seznam = await seznamKampani(db);
    expect(seznam.map((k) => k.nazev)).toEqual(["Druhá", "První"]);
  });
});
