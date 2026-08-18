import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { prenesData } from "../src/prenos.js";
import { nastavGeo, nastavStav, zalozFirmu, zapisKontakt } from "../src/repo.js";
import { zalozOblast } from "../src/oblast.js";
import type { AresZaznam } from "../src/ares.js";

let zdroj: Db;
let cil: Db;
let jidelnaId: string;

const firma = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "Náves 1", obec: "Zbůch", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

// Limit se musí zvednout i přípravě, ne jen testům: pomalé je právě
// založení dvou databází a spuštění všech migrací v obou. S každou další
// migrací to roste, takže tady se to jinak bude opakovaně vracet.
beforeEach(async () => {
  zdroj = await pripojPglite();
  cil = await pripojPglite();
  await spustMigrace(zdroj);
  await spustMigrace(cil);

  const j = await zdroj.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, kapacita_volna, ico)
     values ('ZŠ Zbůch','Školní 1','Zbůch',49.6,13.2,559661,20,'60611201') returning id`,
  );
  jidelnaId = j[0]!.id;

  await zalozFirmu(zdroj, firma("25232657", "KOVOVÝROBA HONZÍK, s.r.o."));
  await nastavGeo(zdroj, "25232657", {
    lat: 49.6, lng: 13.2, jidelnaId, vzdalenostM: 500, vZone: true,
  });
  await nastavStav(zdroj, "25232657", "kvalifikovany");
  await zapisKontakt(zdroj, "25232657", {
    jmeno: "Tomáš", prijmeni: "Honzík", pozice: "jednatel", urovenAdresy: 3,
    zdrojUrl: "https://ares.gov.cz/ekonomicke-subjekty/25232657",
    citace: "veřejný rejstřík: jednatel Tomáš Honzík",
  });
  await zalozOblast(zdroj, {
    nazev: "Průzkum", oblast: { typ: "kruh", stred: { lat: 49.6, lng: 13.2 }, polomerM: 3000 },
  });
}, 60_000);

// Každý test zakládá DVĚ databáze a pouští v obou všechny migrace, takže
// je pomalejší než ostatní. S výchozím limitem 10 s to při běhu celé sady
// těsně padalo — a test, který visí na hraně, je nespolehlivý, i když zrovna
// prochází.
describe("přenos dat do sdílené databáze", { timeout: 60_000 }, () => {
  it("přenese jídelny, firmy, kontakty i oblasti", async () => {
    const v = await prenesData(zdroj, cil);

    expect(v.find((x) => x.tabulka === "jidelny")!.radku).toBe(1);
    expect(v.find((x) => x.tabulka === "companies")!.radku).toBe(1);
    expect(v.find((x) => x.tabulka === "contacts")!.radku).toBe(1);
    expect(v.find((x) => x.tabulka === "oblasti")!.radku).toBe(1);
  });

  it("údaje zůstanou beze změny, včetně evidence se zdrojem", async () => {
    await prenesData(zdroj, cil);

    const f = await cil.query<{ nazev: string; skore: number | null; ico: string }>(
      "select nazev, skore, ico from companies",
    );
    expect(f[0]).toMatchObject({ ico: "25232657", nazev: "KOVOVÝROBA HONZÍK, s.r.o." });

    const e = await cil.query<{ zdroj_url: string; citace: string }>(
      "select zdroj_url, citace from evidence where ico = '25232657' limit 1",
    );
    expect(e[0]!.zdroj_url).toContain("ares.gov.cz");
  });

  it("vazby drží — firma ukazuje na tutéž jídelnu", async () => {
    await prenesData(zdroj, cil);

    const v = await cil.query<{ obec: string }>(
      `select j.obec from companies c join jidelny j on j.id = c.nejblizsi_jidelna_id
       where c.ico = '25232657'`,
    );
    expect(v[0]!.obec).toBe("Zbůch");
  });

  it("do neprázdné databáze odmítne sáhnout — přepis by byl neopravitelný", async () => {
    await prenesData(zdroj, cil);
    await expect(prenesData(zdroj, cil)).rejects.toThrow(/není prázdná/i);
  });

  it("číselníky ze zdroje nepřenáší — cíl si je založil migrací sám", async () => {
    const v = await prenesData(zdroj, cil);
    expect(v.map((x) => x.tabulka)).not.toContain("kategorie");
    expect(v.map((x) => x.tabulka)).not.toContain("profily");

    // Ale existovat musí, jinak by neseděly vazby.
    expect((await cil.query("select 1 from kategorie")).length).toBeGreaterThan(0);
  });

  // Nález závěrečné revize: atributy a profil_atributy chyběly v TABULKY.
  // Dokud byl rejstřík atributů pevný výčet v kódu, obě databáze měly
  // schválně totožný obsah, stejně jako kategorie/profily — přenos je proto
  // vynechával. Jakmile ale někdo zavede VLASTNÍ atribut (přesně smysl téhle
  // práce), zdroj a cíl se rozejdou a je potřeba ten rozdíl přenést, aniž by
  // insert spadl na duplicitu osmi výchozích atributů, které cíl má už z
  // vlastní migrace.
  it("vlastní atribut a jeho zařazení do profilu se přenesou, výchozí osazení nekoliduje", async () => {
    await zdroj.query(
      `insert into atributy (kod, nazev, popis, do_zpravy, hleda_agent)
       values ('test_custom', 'testovací atribut', 'test přenosu', false, true)`,
    );
    await zdroj.query(
      "insert into profil_atributy (profil_kod, atribut_kod) values ('cantinero','test_custom')",
    );

    const v = await prenesData(zdroj, cil);

    // Reportuje se jen to, co v cíli skutečně přibylo — ne všech 10 řádků
    // zdroje, protože 10 z nich už v cíli je z jeho vlastní migrace.
    expect(v.find((x) => x.tabulka === "atributy")!.radku).toBe(1);
    expect(v.find((x) => x.tabulka === "profil_atributy")!.radku).toBe(1);

    const a = await cil.query<{ kod: string }>(
      "select kod from atributy where kod = 'test_custom'",
    );
    expect(a).toHaveLength(1);
    const pa = await cil.query(
      "select 1 from profil_atributy where profil_kod = 'cantinero' and atribut_kod = 'test_custom'",
    );
    expect(pa).toHaveLength(1);

    // Výchozích jedenáct atributů (8 původních + smenny_provoz + web +
    // oznaceni) zůstalo
    // v cíli jen jednou, ne zdvojených.
    const pocetVychozich = await cil.query<{ pocet: number }>(
      "select count(*)::int as pocet from atributy where kod <> 'test_custom'",
    );
    expect(pocetVychozich[0]!.pocet).toBe(11);
  });

  it("nabídky, vlastní parametr i vyplněné hodnoty se přenesou", async () => {
    // Cena u jídelny — kdyby se přenos parametrů odbyl, tichým následkem
    // by byla ztracená cena a mail bez čísla.
    const [nabidka] = await zdroj.query<{ nabidka_id: string }>(
      "select nabidka_id from jidelny where id = $1",
      [jidelnaId],
    );
    const [cena] = await zdroj.query<{ id: string }>(
      "select id from parametry_nabidky where kod = 'cena_obeda'",
    );
    await zdroj.query(
      `insert into hodnoty_parametru (nabidka_id, parametr_id, hodnota)
       values ($1, $2, '115')`,
      [nabidka!.nabidka_id, cena!.id],
    );
    await zdroj.query(
      `insert into parametry_nabidky (produkt_kod, kod, nazev, druh, poradi)
       values ('cantinero', 'rozvoz_zdarma_od', 'Rozvoz zdarma od', 'cislo', 9)`,
    );

    await prenesData(zdroj, cil);

    // Výchozí čtyři parametry má cíl z vlastní migrace, pátý přibyl přenosem.
    const p = await cil.query<{ pocet: number }>(
      "select count(*)::int as pocet from parametry_nabidky where produkt_kod = 'cantinero'",
    );
    expect(p[0]!.pocet).toBe(5);

    // Hodnota se musí najít pod parametrem CÍLE, ne pod id ze zdroje —
    // ta dvě id jsou různá, protože každá databáze si je vygenerovala sama.
    const h = await cil.query<{ hodnota: string }>(
      `select h.hodnota from hodnoty_parametru h
         join parametry_nabidky p on p.id = h.parametr_id
        where p.kod = 'cena_obeda'`,
    );
    expect(h.map((x) => x.hodnota)).toEqual(["115"]);
  });
});
