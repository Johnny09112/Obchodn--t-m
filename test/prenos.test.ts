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
});
