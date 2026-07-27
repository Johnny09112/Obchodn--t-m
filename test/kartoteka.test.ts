import { beforeAll, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiKartoteku, sestavKartoteku } from "../src/kartoteka.js";
import { nastavGeo, nastavSkore, nastavStav, zalozFirmu, zapisAtribut } from "../src/repo.js";

let db: Db;

beforeAll(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  const j = await db.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, kapacita_volna)
     values ('ZŠ Bezdružice','Školní 183','Bezdružice',49.9,12.97,560740,10) returning id`,
  );
  await zalozFirmu(db, {
    ico: "18200061", nazev: 'Firma "<b>zlá</b>" s.r.o.', adresa: "a",
    obec: "Hustopeče", czNace: ["25610"], velikostKategorie: "korporat", kodObce: 1,
  });
  await nastavGeo(db, "18200061", {
    lat: 49.9, lng: 12.97, jidelnaId: j[0]!.id, vzdalenostM: 262, vZone: true,
  });
  await nastavSkore(db, "18200061", 71);
  await nastavStav(db, "18200061", "kvalifikovany");
  await zapisAtribut(db, "18200061", "ucel_adresy", "bezdruzice@signumcz.com", {
    zdrojUrl: "https://signumcz.com/zinkovna/bezdruzice/",
    citace: "Úterská 291, 349 53 Bezdružice — bezdruzice@signumcz.com",
  });
});

describe("nactiKartoteku", () => {
  it("načte firmy, jídelny, evidenci i běhy", async () => {
    const d = await nactiKartoteku(db);
    expect(d.firmy).toHaveLength(1);
    expect(d.jidelny).toHaveLength(1);
    expect(d.evidence).toHaveLength(1);
    expect(d.evidence[0]!.citace).toContain("Úterská");
  });
});

describe("sestavKartoteku", () => {
  it("vypíše firmu, skóre i citaci zdroje", async () => {
    const html = sestavKartoteku(await nactiKartoteku(db), "1. 1. 2026");
    expect(html).toContain("71");
    expect(html).toContain("signumcz.com");
    expect(html).toContain("Úterská 291");
    expect(html).toContain("kvalifikovaná");
  });

  it("ošetří HTML v názvu firmy", async () => {
    const html = sestavKartoteku(await nactiKartoteku(db), "1. 1. 2026");
    expect(html).not.toContain("<b>zlá</b>");
    expect(html).toContain("&lt;b&gt;zlá&lt;/b&gt;");
  });

  it("prázdná kartotéka se pozná", () => {
    const html = sestavKartoteku(
      { jidelny: [], firmy: [], kontakty: [], evidence: [], vyrazeni: [], behy: [] },
      "1. 1. 2026",
    );
    expect(html).toContain("Kartotéka je zatím prázdná");
  });
});

describe("členění podle oblastí a deník vyřazení", () => {
  it("seskupí firmy podle obce jídelny a vypíše počty", async () => {
    const html = sestavKartoteku(await nactiKartoteku(db), "1. 1. 2026");
    expect(html).toContain("Bezdružice");
    expect(html).toContain("obědů/den volných");
    expect(html).toContain("nad 25 zaměstnanců");
  });

  it("vypíše vyřazené kandidáty i s důvodem", async () => {
    const d = await nactiKartoteku(db);
    d.vyrazeni = [
      { nazev: "Prázdná schránka s.r.o.", ico: "05499861", zdroj: "ares",
        duvod: "bez_zamestnancu", detail: "statistický registr: bez zaměstnanců",
        oblast: "Bezdružice" },
      { nazev: "Agentura X s.r.o.", ico: "21033137", zdroj: "mpsv",
        duvod: "agentura", detail: "nabírá pro SIGNUM", oblast: "Bezdružice" },
    ];
    const html = sestavKartoteku(d, "1. 1. 2026");
    expect(html).toContain("Vyřazení kandidáti (2)");
    expect(html).toContain("bez zaměstnanců");
    expect(html).toContain("agentura práce");
    expect(html).toContain("nabírá pro SIGNUM");
  });
});
