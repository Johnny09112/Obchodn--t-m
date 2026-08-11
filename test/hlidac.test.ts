import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { stavZdroju, zaznamenejObjem } from "../src/hlidac.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("hlídač zdrojů", () => {
  it("první běh nehlásí nic — nemá s čím porovnávat", async () => {
    const r = await zaznamenejObjem(db, "mpsv", 39_000);
    expect(r.podezrele).toBe(false);
    expect(r.obvykly).toBeNull();
    expect(r.duvod).toBeNull();
  });

  // Hranice je „tři předchozí běhy". Test ji tvrdí z OBOU stran — kdyby
  // tvrdil jen jednu, posunutí hranice by prošlo nepovšimnuto.
  it("po dvou bězích ještě mlčí, po třech se ozve", async () => {
    for (const n of [39_000, 38_500]) await zaznamenejObjem(db, "mpsv", n);
    expect((await zaznamenejObjem(db, "mpsv", 0)).podezrele).toBe(false);

    await db.query("delete from zdroje_objem");
    for (const n of [39_000, 38_500, 39_200]) await zaznamenejObjem(db, "mpsv", n);
    expect((await zaznamenejObjem(db, "mpsv", 0)).podezrele).toBe(true);
  });

  it("nula po ustálených bězích je podezření na rozbitou čtečku", async () => {
    for (const n of [39_000, 38_500, 39_200, 38_800]) await zaznamenejObjem(db, "mpsv", n);
    const r = await zaznamenejObjem(db, "mpsv", 0);
    expect(r.podezrele).toBe(true);
    expect(r.duvod).toMatch(/nevrátil nic/i);
    // Věta musí říct, co se čekalo — jinak z ní člověk nepozná, jak moc je to zle.
    expect(r.duvod).toMatch(/38|39/);
  });

  it("propad pod polovinu je taky podezřelý, i když to není nula", async () => {
    for (const n of [1000, 1000, 1000, 1000]) await zaznamenejObjem(db, "mpsv", n);
    const r = await zaznamenejObjem(db, "mpsv", 300);
    expect(r.podezrele).toBe(true);
    expect(r.duvod).toMatch(/méně než polovin/i);
  });

  // Kdyby hlídač ječel na běžné kolísání, do měsíce se začne ignorovat —
  // a to je horší než žádný hlídač.
  it("běžné kolísání nehlásí", async () => {
    for (const n of [1000, 1100, 900, 1050]) await zaznamenejObjem(db, "mpsv", n);
    const r = await zaznamenejObjem(db, "mpsv", 850);
    expect(r.podezrele).toBe(false);
  });

  it("trvalý pokles přestane ječet — průměr se posune", async () => {
    for (const n of [1000, 1000, 1000, 1000]) await zaznamenejObjem(db, "mpsv", n);
    // Zdroj se natrvalo zúžil. První běh zaječí…
    expect((await zaznamenejObjem(db, "mpsv", 300)).podezrele).toBe(true);
    // …ale po několika bězích na nové úrovni se hlídač přizpůsobí.
    for (let i = 0; i < 8; i++) await zaznamenejObjem(db, "mpsv", 300);
    expect((await zaznamenejObjem(db, "mpsv", 300)).podezrele).toBe(false);
  });

  it("zdroje se hlídají každý zvlášť", async () => {
    for (const n of [1000, 1000, 1000, 1000]) await zaznamenejObjem(db, "mpsv", n);
    // Jiný zdroj má vlastní historii — nula u něj je první běh, ne poplach.
    const r = await zaznamenejObjem(db, "registr-smluv", 0);
    expect(r.podezrele).toBe(false);
    expect(r.obvykly).toBeNull();
  });

  it("záporný objem je chyba volajícího, ne tichý zápis", async () => {
    await expect(zaznamenejObjem(db, "mpsv", -1)).rejects.toThrow(/nezáporné/i);
  });

  it("přehled ukáže obvyklý i poslední objem", async () => {
    await zaznamenejObjem(db, "mpsv", 1000);
    await zaznamenejObjem(db, "ares", 50);
    const s = await stavZdroju(db);
    expect(s.map((x) => x.zdroj)).toEqual(["ares", "mpsv"]);
    // Obě hodnoty zvlášť — přehled, kde by seděla jen jedna, nic nedokazuje.
    expect(s.find((x) => x.zdroj === "mpsv")?.posledni).toBe(1000);
    expect(s.find((x) => x.zdroj === "ares")?.posledni).toBe(50);
  });

  it("podezření se zapamatuje, ať jde poznat opakované selhání", async () => {
    for (const n of [1000, 1000, 1000, 1000]) await zaznamenejObjem(db, "mpsv", n);
    expect((await stavZdroju(db))[0]!.posledniPodezreniAt).toBeNull();
    await zaznamenejObjem(db, "mpsv", 0);
    expect((await stavZdroju(db))[0]!.posledniPodezreniAt).not.toBeNull();
  });
});
