import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { rozpadKontaktuKampane, zalozKampan } from "../src/kampan.js";
import { zalozFirmu, zapisKontakt } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const zaznam = (ico: string): AresZaznam => ({
  ico,
  nazev: `Firma ${ico}`,
  adresa: "x",
  obec: "Zbůch",
  czNace: ["25610"],
  velikostKategorie: "stredni",
  kodObce: 559661,
  pravniForma: "112",
});

/** Firma v kampani, volitelně s kontaktem dané úrovně adresy. */
async function firmaVKampani(kampanId: string, ico: string, uroven?: 1 | 2 | 3) {
  await zalozFirmu(db, zaznam(ico));
  await db.query("insert into kampan_firmy (kampan_id, ico) values ($1,$2)", [kampanId, ico]);
  if (uroven) {
    await zapisKontakt(db, ico, {
      email: `k${ico}@example.cz`,
      urovenAdresy: uroven,
      zdrojUrl: "https://example.cz/kontakty",
      citace: "kontakt uvedený na stránkách",
    });
  }
}

describe("rozpad kontaktů v kampani", () => {
  it("roztřídí firmy podle úrovně adresy", async () => {
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    await firmaVKampani(id, "25232657", 1);
    await firmaVKampani(id, "48362956", 2);
    await firmaVKampani(id, "17439523", 3);
    await firmaVKampani(id, "60193531");

    expect(await rozpadKontaktuKampane(db, id)).toEqual({
      jmenna: 1,
      proNabidky: 1,
      obecna: 1,
      zadny: 1,
    });
  });

  it("firmu s víc kontakty počítá podle toho nejlepšího", async () => {
    // Jinak by jedna firma přispěla do dvou sloupců a součet by nesouhlasil
    // s počtem firem v kampani.
    const id = await zalozKampan(db, { nazev: "K2", spravce: "a@b.cz" });
    await firmaVKampani(id, "25232657", 3);
    await zapisKontakt(db, "25232657", {
      email: "reditel@example.cz",
      urovenAdresy: 1,
      zdrojUrl: "https://example.cz/vedeni",
      citace: "ředitel společnosti",
    });

    expect(await rozpadKontaktuKampane(db, id)).toEqual({
      jmenna: 1,
      proNabidky: 0,
      obecna: 0,
      zadny: 0,
    });
  });

  it("ručně vyřazené firmy do rozpadu nepatří", async () => {
    const id = await zalozKampan(db, { nazev: "K3", spravce: "a@b.cz" });
    await firmaVKampani(id, "25232657", 1);
    await db.query(
      "update kampan_firmy set stav = 'vyrazena', duvod_vyrazeni = 'ručně' where ico = $1",
      ["25232657"],
    );

    expect(await rozpadKontaktuKampane(db, id)).toEqual({
      jmenna: 0,
      proNabidky: 0,
      obecna: 0,
      zadny: 0,
    });
  });

  it("prázdná kampaň dá samé nuly, ne chybu", async () => {
    const id = await zalozKampan(db, { nazev: "K4", spravce: "a@b.cz" });
    expect(await rozpadKontaktuKampane(db, id)).toEqual({
      jmenna: 0,
      proNabidky: 0,
      obecna: 0,
      zadny: 0,
    });
  });
});
