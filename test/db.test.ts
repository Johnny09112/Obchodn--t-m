import { beforeAll, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

let db: Db;

beforeAll(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("migrace a tvrdá pravidla v DB", () => {
  it("system_state má jediný řádek se sending_enabled=false", async () => {
    const rows = await db.query<{ sending_enabled: boolean }>(
      "select sending_enabled from system_state",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sending_enabled).toBe(false);
  });

  it("odmítne druhý řádek system_state", async () => {
    await expect(
      db.query("insert into system_state (id) values (false)"),
    ).rejects.toThrow();
  });

  it("odmítne company s nevalidním formátem IČO", async () => {
    await expect(
      db.query("insert into companies (ico, nazev) values ($1, $2)", [
        "abc",
        "Test",
      ]),
    ).rejects.toThrow();
  });

  it("odmítne evidence bez zdroj_url", async () => {
    await db.query("insert into companies (ico, nazev) values ($1, $2)", [
      "25596641",
      "Seznam.cz",
    ]);
    await expect(
      db.query(
        "insert into evidence (ico, atribut, hodnota, zdroj_url) values ($1,$2,$3,$4)",
        ["25596641", "zpusob_stravovani", "x", null],
      ),
    ).rejects.toThrow();
  });

  it("odmítne evidence s atributem mimo whitelist", async () => {
    await expect(
      db.query(
        "insert into evidence (ico, atribut, hodnota, zdroj_url) values ($1,$2,$3,$4)",
        ["25596641", "plat_reditele", "x", "https://example.com"],
      ),
    ).rejects.toThrow();
  });

  it("odmítne citaci delší než 200 znaků", async () => {
    await expect(
      db.query(
        "insert into evidence (ico, atribut, hodnota, zdroj_url, citace) values ($1,$2,$3,$4,$5)",
        ["25596641", "zpusob_stravovani", "x", "https://example.com", "a".repeat(201)],
      ),
    ).rejects.toThrow();
  });

  it("tx se při chybě celá odvolá", async () => {
    await expect(
      db.tx(async (t) => {
        await t.query(
          "insert into companies (ico, nazev) values ($1,$2)",
          ["00006947", "ČÚS"],
        );
        throw new Error("rollback test");
      }),
    ).rejects.toThrow("rollback test");
    const rows = await db.query("select 1 from companies where ico = $1", [
      "00006947",
    ]);
    expect(rows).toHaveLength(0);
  });
});
