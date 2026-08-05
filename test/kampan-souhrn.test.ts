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
  // Pozor na počty: kdyby měla každá úroveň jednu firmu, test by projel
  // i s pootočenými popisky. Právě to se stalo — obrazovka i příkazová řádka
  // hlásily úroveň 1 jako jmenovanou osobu, ačkoli TP-6 říká opak.
  it("roztřídí firmy podle úrovně adresy — pořadí podle TP-6", async () => {
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    // Úroveň 1 = adresa pro nabídky
    await firmaVKampani(id, "25232657", 1);
    // Úroveň 2 = obecná firemní adresa
    await firmaVKampani(id, "48362956", 2);
    await firmaVKampani(id, "17439523", 2);
    // Úroveň 3 = jmenovaná osoba (ta, u které patří do zprávy poučení
    // podle čl. 14 GDPR — proto se nesmí splést s ostatními)
    await firmaVKampani(id, "60193531", 3);
    await firmaVKampani(id, "26353130", 3);
    await firmaVKampani(id, "23967102", 3);
    await firmaVKampani(id, "00255211");

    expect(await rozpadKontaktuKampane(db, id)).toEqual({
      proNabidky: 1,
      obecna: 2,
      jmenna: 3,
      zadny: 1,
    });
  });

  it("firmu s víc kontakty počítá podle toho nejlepšího", async () => {
    // Jinak by jedna firma přispěla do dvou sloupců a součet by nesouhlasil
    // s počtem firem v kampani.
    const id = await zalozKampan(db, { nazev: "K2", spravce: "a@b.cz" });
    // Firma má jmenovanou osobu (úroveň 3)…
    await firmaVKampani(id, "25232657", 3);
    // …a k tomu adresu zveřejněnou pro příjem nabídek (úroveň 1).
    await zapisKontakt(db, "25232657", {
      email: "poptavky@example.cz",
      urovenAdresy: 1,
      zdrojUrl: "https://example.cz/pro-dodavatele",
      citace: "Nabídky posílejte na poptavky@example.cz",
    });

    // Píše se na poptávkovou adresu — je to pozvánka a nevyžaduje poučení
    // podle čl. 14 GDPR, na rozdíl od psaní jmenované osobě.
    expect(await rozpadKontaktuKampane(db, id)).toEqual({
      proNabidky: 1,
      obecna: 0,
      jmenna: 0,
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
