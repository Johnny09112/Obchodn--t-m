import { beforeAll, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { metrikyFaze1, prehledStavu } from "../src/metriky.js";
import { zalozFirmu, zapisAtribut, zapisKontakt } from "../src/repo.js";

let db: Db;

beforeAll(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  await db.query(
    `insert into jidelny (nazev, adresa, lat, lng, kapacita_volna, aktivni)
     values ('A','x',50,14,120,true), ('B','y',49,16,80,false)`,
  );
  await zalozFirmu(db, {
    ico: "25596641",
    nazev: "Alfa",
    adresa: "a",
    obec: "Praha",
    czNace: [],
    velikostKategorie: null,
  });
  await zalozFirmu(db, {
    ico: "00006947",
    nazev: "Beta",
    adresa: "b",
    obec: "Brno",
    czNace: [],
    velikostKategorie: null,
  });
  await db.query("update companies set stav = 'kvalifikovany' where ico = '25596641'");
  await zapisAtribut(db, "25596641", "zpusob_stravovani", "stravenky", {
    zdrojUrl: "https://alfa.cz",
    citace: "stravenky",
  });
  await zapisKontakt(db, "25596641", {
    email: "poptavky@alfa.cz",
    urovenAdresy: 1,
    zdrojUrl: "https://alfa.cz/kontakt",
    citace: "poptavky@alfa.cz",
  });
  await zapisKontakt(db, "25596641", {
    email: "info@alfa.cz",
    urovenAdresy: 2,
    zdrojUrl: "https://alfa.cz/kontakt",
    citace: "info@alfa.cz",
  });
});

describe("prehledStavu", () => {
  it("vrátí počty dle stavu a kapacitu aktivních jídelen", async () => {
    const p = await prehledStavu(db);
    expect(p.firmyDleStavu["kvalifikovany"]).toBe(1);
    expect(p.firmyDleStavu["novy"]).toBe(1);
    expect(p.kapacitaAktivnichJidelen).toBe(120);
    expect(p.aktivnichJidelen).toBe(1);
  });
});

describe("metrikyFaze1", () => {
  it("spočítá podíly dle SPEC fáze 1", async () => {
    const m = await metrikyFaze1(db);
    expect(m.kvalifikovanychFirem).toBe(1);
    expect(m.podilStravovaniOvereno).toBe(1); // Alfa má zpusob_stravovani
    expect(m.podilKontaktuUrovne1).toBe(0.5); // 1 z 2 kontaktů
    expect(m.kontaktuNaKvalifikovanouFirmu).toBe(2);
    expect(m.podilPoliSeZdrojem).toBe(1); // repo vrstva evidence vynucuje
  });
});
