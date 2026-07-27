import { beforeAll, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiDataProMapu, sestavHtml } from "../src/mapa.js";
import { nastavGeo, nastavSkore, zalozFirmu } from "../src/repo.js";

let db: Db;

beforeAll(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  const j = await db.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, lat, lng, kod_obce, kapacita_volna)
     values ('ZŠ Testovací', 'Školní 1, Bezdružice', 49.906, 12.974, 560740, 120)
     returning id`,
  );
  await zalozFirmu(db, {
    ico: "25596641",
    nazev: "Firma <script>alert(1)</script> s.r.o.",
    adresa: "Náměstí 1",
    obec: "Bezdružice",
    czNace: [],
    velikostKategorie: null,
  });
  await nastavGeo(db, "25596641", {
    lat: 49.907,
    lng: 12.976,
    jidelnaId: j[0]!.id,
    vzdalenostM: 180,
    vZone: true,
  });
  await nastavSkore(db, "25596641", 77);
});

describe("nactiDataProMapu", () => {
  it("vrátí jídelny a jen firmy se souřadnicemi", async () => {
    const { jidelny, firmy } = await nactiDataProMapu(db);
    expect(jidelny).toHaveLength(1);
    expect(jidelny[0]!.lat).toBeCloseTo(49.906, 3);
    expect(firmy).toHaveLength(1);
    expect(firmy[0]!.skore).toBe(77);
    expect(firmy[0]!.vzdalenost_m).toBe(180);
  });

  it("vynechá firmy bez souřadnic", async () => {
    await zalozFirmu(db, {
      ico: "00006947",
      nazev: "Bez souřadnic",
      adresa: null,
      obec: null,
      czNace: [],
      velikostKategorie: null,
    });
    const { firmy } = await nactiDataProMapu(db);
    expect(firmy.map((f) => f.ico)).not.toContain("00006947");
  });
});

describe("sestavHtml", () => {
  it("zapeče data a neumožní rozbití stránky názvem firmy", async () => {
    const { jidelny, firmy } = await nactiDataProMapu(db);
    const html = sestavHtml(jidelny, firmy, "1. 1. 2026 12:00");
    expect(html).toContain("ZŠ Testovací");
    expect(html).toContain("leaflet");
    // Název obsahuje </script> — nesmí se do stránky dostat doslova.
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("\\u003cscript>alert(1)");
  });

  it("prázdná databáze dá stránku s prázdným stavem", () => {
    const html = sestavHtml([], [], "1. 1. 2026 12:00");
    expect(html).toContain("Zatím žádná data");
    expect(html).toContain("firem na mapě: <b>0</b>");
  });
});
