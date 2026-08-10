import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozFirmu, zapisAtribut } from "../src/repo.js";
import { popisZdroje, spolehlivostZdroje, tridaZdroje } from "../src/zdroje.js";

describe("třída zdroje", () => {
  it("úřední zdroje pozná", () => {
    expect(tridaZdroje("https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json")).toBe("urad");
    expect(tridaZdroje("https://ares.gov.cz/ekonomicke-subjekty/25232657")).toBe("urad");
  });

  it("katalogy pozná i v poddoméně", () => {
    // Přesně ten tvar, který agent 10. 8. použil u DFA Hrobce.
    expect(tridaZdroje("https://rejstrik-firem.kurzy.cz/19548869/dfa-hrobce/")).toBe("katalog");
    expect(tridaZdroje("https://www.firmy.cz/detail/13015388-roxaco-oil-hrobce.html")).toBe("katalog");
  });

  it("web firmy je všechno ostatní", () => {
    expect(tridaZdroje("https://pluspap.cz/o-nas")).toBe("web-firmy");
    expect(tridaZdroje("https://videstav.webnode.cz/")).toBe("web-firmy");
  });

  // Past, kvůli které se porovnává na hranici domény, ne přes `includes`:
  // cizí doména, která má název katalogu jako předponu, katalog NENÍ.
  it("cizí doména s názvem katalogu v sobě není katalog", () => {
    expect(tridaZdroje("https://mojefirmy.cz.example.com/o-nas")).toBe("web-firmy");
    expect(tridaZdroje("https://nefirmy.cz/kontakt")).toBe("web-firmy");
  });

  it("nesmyslnou adresu radši podcení, než přecení", () => {
    expect(tridaZdroje("tohle není url")).toBe("katalog");
  });

  it("spolehlivost odlišuje všechny tři třídy", () => {
    const urad = spolehlivostZdroje("https://ares.gov.cz/x");
    const web = spolehlivostZdroje("https://pluspap.cz/o-nas");
    const katalog = spolehlivostZdroje("https://www.firmy.cz/detail/1");
    expect(urad).toBeGreaterThan(web);
    expect(web).toBeGreaterThan(katalog);
    // Podmínka na sloupci `evidence.confidence` je 0..1 (0001_init.sql).
    for (const h of [urad, web, katalog]) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it("popis pro člověka řekne u katalogu, že je to katalog", () => {
    expect(popisZdroje("https://www.firmy.cz/detail/1")).toMatch(/katalog/i);
    expect(popisZdroje("https://pluspap.cz/")).not.toMatch(/katalog/i);
  });
});

describe("zápis atributu doplní spolehlivost podle zdroje", () => {
  let db: Db;

  beforeEach(async () => {
    db = await pripojPglite();
    await spustMigrace(db);
    await zalozFirmu(db, {
      ico: "25232657",
      nazev: "Firma 25232657",
      pravniForma: "112",
      czNace: [],
    } as never);
  });

  it("obor z katalogu má nižší spolehlivost než obor z webu firmy", async () => {
    await zapisAtribut(db, "25232657", "obor", "velkoobchod s oleji", {
      zdrojUrl: "https://www.firmy.cz/detail/13015388-roxaco-oil-hrobce.html",
      citace: "Nabízíme stáčení motorových olejů.",
    });
    await zapisAtribut(db, "25232657", "web", "https://pluspap.cz/", {
      zdrojUrl: "https://pluspap.cz/kontakt",
      citace: "PLUSPAP a.s. Ke Hřišti 23, 411 83 Hrobce",
    });

    const r = await db.query<{ atribut: string; confidence: string | null }>(
      "select atribut, confidence from evidence where ico = '25232657' order by atribut",
    );
    const dle = Object.fromEntries(r.map((x) => [x.atribut, Number(x.confidence)]));
    // Obě hodnoty tvrdíme zvlášť — test, kde je jen jedna, mapování neověří.
    expect(dle["obor"]).toBe(0.5);
    expect(dle["web"]).toBe(0.8);
  });

  it("vyslovená spolehlivost přebije odvozenou", async () => {
    await zapisAtribut(db, "25232657", "obor", "pekárna", {
      zdrojUrl: "https://www.firmy.cz/detail/1",
      citace: "Rodinná pekárna.",
      confidence: 0.95,
    });
    const r = await db.query<{ confidence: string }>(
      "select confidence from evidence where ico = '25232657'",
    );
    expect(Number(r[0]!.confidence)).toBe(0.95);
  });
});
