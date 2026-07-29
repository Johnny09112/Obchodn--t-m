import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiKampan, seznamKampani, zalozKampan } from "../src/kampan.js";
import { zalozOblast } from "../src/oblast.js";
import { nastavGeo, zalozFirmu } from "../src/repo.js";
import { firmyKampane, naplnZOblasti, nastavUzemi, vyradFirmu } from "../src/kampan.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const STRED = { lat: 49.6, lng: 13.2 };
const severne = (m: number) => ({ lat: STRED.lat + m / 111_320, lng: STRED.lng });

const zaznam = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "x", obec: "Zbůch", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

/** Založí dvě firmy uvnitř a jednu daleko, a k tomu kruhovou oblast 3 km. */
async function pripravUzemi(): Promise<string> {
  for (const [ico, nazev, m] of [
    ["25232657", "Blízká s.r.o.", 500],
    ["48362956", "Prostřední s.r.o.", 2000],
    ["17439523", "Daleká s.r.o.", 9000],
  ] as const) {
    await zalozFirmu(db, zaznam(ico, nazev));
    const p = severne(m);
    // `jidelnaId` je v GeoVstup povinné, ale tyhle firmy k žádné jídelně
    // nepatří. Stejný obrat používá test/oblast-db.test.ts.
    await nastavGeo(db, ico, {
      lat: p.lat, lng: p.lng, jidelnaId: null as unknown as string,
      vzdalenostM: m, vZone: true,
    });
  }
  return zalozOblast(db, {
    nazev: "Zkušební", oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
  });
}

describe("firmy v kampani", () => {
  it("naplní se z oblasti jen firmy uvnitř", async () => {
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastId });

    const vysledek = await naplnZOblasti(db, id);
    expect(vysledek.pridano).toBe(2);
    expect(vysledek.jizBylo).toBe(0);

    const firmy = await firmyKampane(db, id);
    expect(firmy.map((f) => f.ico).sort()).toEqual(["25232657", "48362956"]);
  });

  it("vyřazená firma zůstane vyřazená i po doplnění nových", async () => {
    // Regrese: naplnit znovu nesmí vzkřísit ručně vyřazenou firmu.
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "K2", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastId });
    await naplnZOblasti(db, id);

    await vyradFirmu(db, id, "25232657", "má vlastní jídelnu");

    const znovu = await naplnZOblasti(db, id);
    expect(znovu.pridano).toBe(0);
    expect(znovu.jizBylo).toBe(2);

    const firmy = await firmyKampane(db, id);
    const vyrazena = firmy.find((f) => f.ico === "25232657");
    expect(vyrazena?.stav).toBe("vyrazena");
    expect(vyrazena?.duvodVyrazeni).toBe("má vlastní jídelnu");
  });

  it("vyřazení bez důvodu neprojde", async () => {
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "K3", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastId });
    await naplnZOblasti(db, id);
    await expect(vyradFirmu(db, id, "25232657", "  ")).rejects.toThrow();
  });
});

describe("schéma kampaní", () => {
  it("název kampaně je jedinečný bez ohledu na velikost písmen", async () => {
    await db.query("insert into kampane (nazev, spravce) values ($1,$2)", [
      "Západní Čechy", "laub@cantinero.cz",
    ]);
    await expect(
      db.query("insert into kampane (nazev, spravce) values ($1,$2)", [
        "západní čechy", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("zrušení bez důvodu neprojde", async () => {
    await expect(
      db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'zrusena')", [
        "Bez důvodu", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("INSERT se stavem schválena bez firem s kontaktem padne", async () => {
    await expect(
      db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'schvalena')", [
        "Schválená bez firem", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("INSERT se stavem rozpracovana projde", async () => {
    const rows = await db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'rozpracovana') returning id", [
      "Rozpracovaná kampaň", "laub@cantinero.cz",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty("id");
  });
});

describe("založení kampaně", () => {
  it("založí a přečte kampaň ve výchozím stavu", async () => {
    const id = await zalozKampan(db, {
      nazev: "Vary — kapacita od srpna",
      spravce: "laub@cantinero.cz",
      kontext: "Jídelna ve Varech nabízí 30 obědů od srpna.",
    });
    const k = await nactiKampan(db, id);
    expect(k?.nazev).toBe("Vary — kapacita od srpna");
    expect(k?.stav).toBe("rozpracovana");
    expect(k?.krok).toBe(1);
    expect(k?.oblastId).toBeNull();
  });

  it("neznámé id vrátí null, ne výjimku", async () => {
    expect(await nactiKampan(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("seznam vrací nejnovější první", async () => {
    await zalozKampan(db, { nazev: "První", spravce: "a@b.cz" });
    await zalozKampan(db, { nazev: "Druhá", spravce: "a@b.cz" });
    const seznam = await seznamKampani(db);
    expect(seznam.map((k) => k.nazev)).toEqual(["Druhá", "První"]);
  });
});
