import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiAtributyProfilu, profilProKampan } from "../src/atributy.js";
import { zalozKampan } from "../src/kampan.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("atributy profilu", () => {
  it("výchozí profil sbírá dnešních osm", async () => {
    const a = await nactiAtributyProfilu(db, "cantinero");
    expect(a.map((x) => x.kod).sort()).toEqual([
      "adresa", "kontakt", "ma_vlastni_jidelnu", "obor",
      "ucel_adresy", "velikost_kategorie", "zamestnanci_odhad", "zpusob_stravovani",
    ]);
  });

  // Jádro nastavitelnosti: atribut v rejstříku, ale mimo profil, se nesbírá.
  it("atribut mimo profil se nesbírá", async () => {
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny', false)`,
    );
    const a = await nactiAtributyProfilu(db, "cantinero");
    expect(a.map((x) => x.kod)).not.toContain("smenny_provoz");
  });

  it("přidání do profilu ho zpřístupní", async () => {
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny', false)`,
    );
    await db.query(
      "insert into profil_atributy (profil_kod, atribut_kod) values ('cantinero','smenny_provoz')",
    );
    const a = await nactiAtributyProfilu(db, "cantinero");
    expect(a.map((x) => x.kod)).toContain("smenny_provoz");
    expect(a.find((x) => x.kod === "smenny_provoz")?.popis).toContain("směny");
  });

  // Rozhodnutí majitele k briefu: návratový typ je Atribut, který od úkolu 2
  // obsahuje hledaAgent. Dotaz v briefu ho nenačítal — kdyby zůstalo undefined,
  // filtr v úkolu 4 by vyházel všechno a ostrá dávka by doběhla s nulou.
  // Ověřeno napřímo v obou směrech (true i false), stejně jako u nactiAtributy.
  it("nactiAtributyProfilu vrací hledaAgent se správnou hodnotou v obou směrech", async () => {
    const a = await nactiAtributyProfilu(db, "cantinero");
    const hledajiSe = a.filter((x) => x.hledaAgent).map((x) => x.kod).sort();
    expect(hledajiSe).toEqual(
      ["ma_vlastni_jidelnu", "ucel_adresy", "zpusob_stravovani"].sort(),
    );
    const nehledajiSe = a.filter((x) => !x.hledaAgent).map((x) => x.kod).sort();
    expect(nehledajiSe).toEqual(
      ["adresa", "kontakt", "obor", "velikost_kategorie", "zamestnanci_odhad"].sort(),
    );
  });
});

describe("profil kampaně", () => {
  it("kampaň bez profilu padá na globálně aktivní", async () => {
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    expect(await profilProKampan(db, id)).toBe("cantinero");
  });

  it("kampaň s profilem přebije globální", async () => {
    const id = await zalozKampan(db, { nazev: "K2", spravce: "a@b.cz" });
    await db.query("update kampane set profil_kod = 'cantinero-business' where id = $1", [id]);
    expect(await profilProKampan(db, id)).toBe("cantinero-business");
  });
});
