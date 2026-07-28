import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiProfil, oborProchazi, seznamProfilu, zvolProfil } from "../src/profil.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("výchozí profily", () => {
  it("Cantinero je aktivní a vylučuje stravování", async () => {
    const p = await nactiProfil(db);
    expect(p.kod).toBe("cantinero");
    expect(p.minZamestnancu).toBe(10);
    expect(oborProchazi(p, ["56100"])).toBe(false); // restaurace ven
    expect(oborProchazi(p, ["25610"])).toBe(true); // kovovýroba dovnitř
  });

  it("Cantinero Business je pravý opak — bere JEN stravování a školy", async () => {
    const p = await nactiProfil(db, "cantinero-business");
    expect(oborProchazi(p, ["56100"])).toBe(true); // restaurace je CÍL
    expect(oborProchazi(p, ["85310"])).toBe(true); // školní jídelny
    expect(oborProchazi(p, ["25610"])).toBe(false); // kovovýroba nezajímá
  });

  it("u jídelen se velikost neposuzuje — ptáme se na kapacitu, ne na odběr", async () => {
    const p = await nactiProfil(db, "cantinero-business");
    expect(p.minZamestnancu).toBeNull();
  });

  it("agentury práce nechce ani jeden profil", async () => {
    expect(oborProchazi(await nactiProfil(db, "cantinero"), ["78100"])).toBe(false);
    expect(oborProchazi(await nactiProfil(db, "cantinero-business"), ["78100"])).toBe(false);
  });

  it("živnostník projde jen u Business — restauraci často provozuje fyzická osoba", async () => {
    expect((await nactiProfil(db, "cantinero")).formy.has("101")).toBe(false);
    expect((await nactiProfil(db, "cantinero-business")).formy.has("101")).toBe(true);
  });
});

describe("pravidla oborů", () => {
  it("bez seznamu „jen tyhle“ projde všechno kromě vyloučených", async () => {
    const p = await nactiProfil(db, "cantinero");
    expect(oborProchazi(p, ["43120"])).toBe(true);
    expect(oborProchazi(p, [])).toBe(true); // neznámý obor nevyřazujeme
  });

  it("stačí jediný vyloučený obor a firma neprojde", async () => {
    // Firma mívá oborů víc; kdyby stačil jeden povolený, prošla by
    // i restaurace, která má vedle toho zapsaný obchod.
    const p = await nactiProfil(db, "cantinero");
    expect(oborProchazi(p, ["47110", "56100"])).toBe(false);
  });

  it("u seznamu „jen tyhle“ stačí, když sedí jeden obor", async () => {
    const p = await nactiProfil(db, "cantinero-business");
    expect(oborProchazi(p, ["47110", "56100"])).toBe(true);
  });
});

describe("přepínání profilu", () => {
  it("aktivní je vždy právě jeden", async () => {
    await zvolProfil(db, "cantinero-business");
    expect((await nactiProfil(db)).kod).toBe("cantinero-business");

    const aktivni = await db.query("select 1 from profily where aktivni");
    expect(aktivni).toHaveLength(1);
  });

  it("seznam ukáže, který profil zrovna platí", async () => {
    const s = await seznamProfilu(db);
    expect(s.find((p) => p.kod === "cantinero")!.aktivni).toBe(true);
    expect(s.find((p) => p.kod === "cantinero-business")!.aktivni).toBe(false);
  });

  it("neexistující profil se zvolit nedá", async () => {
    await expect(zvolProfil(db, "neexistuje")).rejects.toThrow(/nezná/i);
  });
});
