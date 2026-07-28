import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiPrevod, kategorieProNace, priradKategorie } from "../src/kategorie.js";
import { zalozFirmu } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

const firma = (ico: string, nazev: string, czNace: string[]): AresZaznam => ({
  ico, nazev, adresa: "x", obec: "Zbůch", czNace,
  velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("zařazení oboru do kategorie", () => {
  it("pozná kategorii podle dvoumístného oddílu", async () => {
    const p = await nactiPrevod(db);
    expect(kategorieProNace(p, ["25610"])).toBe("vyroba"); // kovovýroba
    expect(kategorieProNace(p, ["43120"])).toBe("stavebnictvi");
    expect(kategorieProNace(p, ["49410"])).toBe("doprava");
    expect(kategorieProNace(p, ["47110"])).toBe("obchod");
    expect(kategorieProNace(p, ["84110"])).toBe("urady");
    expect(kategorieProNace(p, ["85310"])).toBe("skolstvi");
    expect(kategorieProNace(p, ["86900"])).toBe("zdravotnictvi");
  });

  it("restaurace mají vlastní kategorii, oddělenou od ubytování", async () => {
    const p = await nactiPrevod(db);
    expect(kategorieProNace(p, ["56100"])).toBe("pohostinstvi");
    expect(kategorieProNace(p, ["55100"])).toBe("sluzby"); // hotel není restaurace
  });

  it("zvládne kódy různé délky — rejstřík je míchá", async () => {
    // Reálně chodí „25", „2561" i „25610" a někdy jen písmeno sekce.
    const p = await nactiPrevod(db);
    expect(kategorieProNace(p, ["25"])).toBe("vyroba");
    expect(kategorieProNace(p, ["2561"])).toBe("vyroba");
    expect(kategorieProNace(p, ["G"])).toBe("ostatni"); // sekce se nezařadí
  });

  it("u víc oborů rozhodne první zařaditelný", async () => {
    const p = await nactiPrevod(db);
    // „00" nic neznamená, „25610" ano.
    expect(kategorieProNace(p, ["00", "25610", "46900"])).toBe("vyroba");
  });

  it("neznámý obor spadne do ostatních, ne do prázdna", async () => {
    const p = await nactiPrevod(db);
    expect(kategorieProNace(p, ["01500"])).toBe("ostatni"); // zemědělství
    expect(kategorieProNace(p, [])).toBe("ostatni");
  });
});

describe("doplnění kategorií do kartotéky", () => {
  it("zařadí firmy a vrátí rozpad", async () => {
    await zalozFirmu(db, firma("25232657", "KOVOVÝROBA HONZÍK", ["25610"]));
    await zalozFirmu(db, firma("48362956", "ROLDECO", ["49410"]));
    await zalozFirmu(db, firma("17439523", "Neznámý obor", ["01500"]));

    const v = await priradKategorie(db);
    expect(v.zarazeno).toBe(3);

    const f = await db.query<{ ico: string; kategorie: string }>(
      "select ico, kategorie from companies order by ico",
    );
    expect(f.find((x) => x.ico === "25232657")!.kategorie).toBe("vyroba");
    expect(f.find((x) => x.ico === "48362956")!.kategorie).toBe("doprava");
    expect(f.find((x) => x.ico === "17439523")!.kategorie).toBe("ostatni");
  });

  it("řekne, co skončilo v ostatních — ať jde členění dobrousit", async () => {
    await zalozFirmu(db, firma("17439523", "Zemědělec", ["01500"]));
    await zalozFirmu(db, firma("64358836", "Těžař", ["08120"]));

    const v = await priradKategorie(db);
    expect(v.vOstatnich).toHaveLength(2);
    expect(v.vOstatnich.map((x) => x.oddil).sort()).toEqual(["01", "08"]);
  });

  it("opakované spuštění nic nerozbije", async () => {
    await zalozFirmu(db, firma("25232657", "KOVOVÝROBA", ["25610"]));
    await priradKategorie(db);
    const v = await priradKategorie(db);
    expect(v.zarazeno).toBe(1);
  });
});
