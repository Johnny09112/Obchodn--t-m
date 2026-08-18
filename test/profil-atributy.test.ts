import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiAtributyProfilu, overProfilKod, profilProKampan } from "../src/atributy.js";
import { zalozKampan } from "../src/kampan.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("atributy profilu", () => {
  it("výchozí profil sbírá dnešních jedenáct", async () => {
    const a = await nactiAtributyProfilu(db, "cantinero");
    expect(a.map((x) => x.kod).sort()).toEqual([
      "adresa", "kontakt", "ma_vlastni_jidelnu", "obor", "oznaceni", "smenny_provoz",
      "ucel_adresy", "velikost_kategorie", "web", "zamestnanci_odhad", "zpusob_stravovani",
    ]);
  });

  // Migrace 0039: web se přidal do OBOU dnešních profilů, ne jen do
  // Cantinera — narozdíl od smenny_provoz (0037), který má jen Cantinero.
  it("web sbírají oba dnešní profily", async () => {
    const cantinero = await nactiAtributyProfilu(db, "cantinero");
    const business = await nactiAtributyProfilu(db, "cantinero-business");
    expect(cantinero.map((x) => x.kod)).toContain("web");
    expect(business.map((x) => x.kod)).toContain("web");
  });

  // Jádro nastavitelnosti: atribut v rejstříku, ale mimo profil, se nesbírá.
  it("atribut mimo profil se nesbírá", async () => {
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('test_atribut', 'testovací', 'test', false)`,
    );
    const a = await nactiAtributyProfilu(db, "cantinero");
    expect(a.map((x) => x.kod)).not.toContain("test_atribut");
  });

  it("přidání do profilu ho zpřístupní", async () => {
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('test_atribut', 'testovací', 'test', false)`,
    );
    await db.query(
      "insert into profil_atributy (profil_kod, atribut_kod) values ('cantinero','test_atribut')",
    );
    const a = await nactiAtributyProfilu(db, "cantinero");
    expect(a.map((x) => x.kod)).toContain("test_atribut");
    expect(a.find((x) => x.kod === "test_atribut")?.popis).toContain("test");
  });

  // Rozhodnutí majitele k briefu: návratový typ je Atribut, který od úkolu 2
  // obsahuje hledaAgent. Dotaz v briefu ho nenačítal — kdyby zůstalo undefined,
  // filtr v úkolu 4 by vyházel všechno a ostrá dávka by doběhla s nulou.
  // Ověřeno napřímo v obou směrech (true i false), stejně jako u nactiAtributy.
  it("nactiAtributyProfilu vrací hledaAgent se správnou hodnotou v obou směrech", async () => {
    const a = await nactiAtributyProfilu(db, "cantinero");
    const hledajiSe = a.filter((x) => x.hledaAgent).map((x) => x.kod).sort();
    expect(hledajiSe).toEqual(
      ["ma_vlastni_jidelnu", "obor", "oznaceni", "smenny_provoz", "ucel_adresy", "web", "zpusob_stravovani"].sort(),
    );
    const nehledajiSe = a.filter((x) => !x.hledaAgent).map((x) => x.kod).sort();
    expect(nehledajiSe).toEqual(
      ["adresa", "kontakt", "velikost_kategorie", "zamestnanci_odhad"].sort(),
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

// Nález závěrečné revize: `--profil peklplot` u neexistujícího kódu i profil
// založený po migraci 0036 (bez řádků v profil_atributy) dřív procházely
// tiše — `nactiAtributyProfilu` vrátí prázdné pole, `chybi` obsahuje jen
// `spojeni` a nikdo se to nedozví. `overProfilKod` se volá vždy, když CLI
// dostane profilKod (ať z --profil, nebo z profilProKampan), a rozliší obě
// situace: neznámý kód je pád, prázdný profil je jen varování.
describe("ověření kódu profilu (overProfilKod)", () => {
  it("neexistující kód profilu padá se srozumitelnou hláškou", async () => {
    await expect(overProfilKod(db, "peklplot")).rejects.toThrow(/peklplot/);
  });

  it("existující profil se všemi atributy vrátí jejich počet", async () => {
    // 8 původních + smenny_provoz (0037) + web (0039).
    expect(await overProfilKod(db, "cantinero")).toBe(11);
  });

  it("profil bez řádků v profil_atributy vrátí 0, nepadá", async () => {
    await db.query(
      `insert into profily (kod, nazev) values ('novy-profil', 'Nový profil')`,
    );
    expect(await overProfilKod(db, "novy-profil")).toBe(0);
  });
});
