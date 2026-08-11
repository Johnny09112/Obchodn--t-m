import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { porovnejAZapamatuj } from "../src/snimky.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("porovnání běhů", () => {
  // Kdyby první běh hlásil, bylo by při zavedení „nových" všech 13 919 firem
  // a obrazovku by nikdo nepřečetl.
  it("první běh nehlásí nic, jen si zapamatuje stav", async () => {
    const z = await porovnejAZapamatuj(db, "mpsv", [
      { klic: "25232657", otisk: "a" },
      { klic: "25242407", otisk: "b" },
    ]);
    expect(z).toEqual([]);
  });

  it("podruhé pozná, co přibylo a co se změnilo", async () => {
    await porovnejAZapamatuj(db, "mpsv", [
      { klic: "25232657", otisk: "a" },
      { klic: "25242407", otisk: "b" },
    ]);
    const z = await porovnejAZapamatuj(db, "mpsv", [
      { klic: "25232657", otisk: "a" },      // beze změny
      { klic: "25242407", otisk: "jine" },   // změnilo se
      { klic: "00263664", otisk: "c" },      // nové
    ]);
    // Obojí zvlášť: kdyby test tvrdil jen počet, splynulo by „nové"
    // se „změněným" a mechanismus by šel rozbít napůl.
    expect(z.find((x) => x.klic === "00263664")?.druh).toBe("nove");
    expect(z.find((x) => x.klic === "25242407")?.druh).toBe("zmeneno");
    expect(z.find((x) => x.klic === "25242407")?.predchozi).toBe("b");
    expect(z.map((x) => x.klic).sort()).toEqual(["00263664", "25242407"]);
  });

  it("beze změny nehlásí nic, i po mnoha bězích", async () => {
    const stav = [{ klic: "25232657", otisk: "a" }];
    await porovnejAZapamatuj(db, "mpsv", stav);
    await porovnejAZapamatuj(db, "mpsv", stav);
    expect(await porovnejAZapamatuj(db, "mpsv", stav)).toEqual([]);
  });

  it("zdroje se nemíchají — týž klíč v jiném zdroji je jiná věc", async () => {
    await porovnejAZapamatuj(db, "mpsv", [{ klic: "25232657", otisk: "a" }]);
    await porovnejAZapamatuj(db, "oblast", [{ klic: "25232657", otisk: "a" }]);
    // Druhý zdroj měl svůj první běh, takže taky nehlásí nic…
    const z = await porovnejAZapamatuj(db, "oblast", [{ klic: "25232657", otisk: "zmena" }]);
    expect(z).toHaveLength(1);
    // …a mpsv zůstalo nedotčené.
    expect(await porovnejAZapamatuj(db, "mpsv", [{ klic: "25232657", otisk: "a" }])).toEqual([]);
  });

  it("prázdná dávka nesmaže paměť", async () => {
    await porovnejAZapamatuj(db, "mpsv", [{ klic: "25232657", otisk: "a" }]);
    expect(await porovnejAZapamatuj(db, "mpsv", [])).toEqual([]);
    // Kdyby prázdná dávka paměť vymazala, další běh by hlásil všechno jako nové.
    expect(await porovnejAZapamatuj(db, "mpsv", [{ klic: "25232657", otisk: "a" }])).toEqual([]);
  });

  it("nový stav se opravdu zapamatuje, ne jen ohlásí", async () => {
    await porovnejAZapamatuj(db, "mpsv", [{ klic: "25232657", otisk: "a" }]);
    await porovnejAZapamatuj(db, "mpsv", [{ klic: "25232657", otisk: "b" }]);
    // Kdyby se zápis nepovedl, ohlásila by se tatáž změna znovu.
    expect(await porovnejAZapamatuj(db, "mpsv", [{ klic: "25232657", otisk: "b" }])).toEqual([]);
  });
});
