import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import { nastavGeo, zalozFirmu, zapisKontakt } from "../src/repo.js";
import { naplnZOblasti, nastavUzemi, zalozKampan, zmenStav } from "../src/kampan.js";
import {
  dokoncPruzkum, objednejPruzkum, selhalPruzkum, zahajPruzkum,
} from "../src/pruzkum.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;
let oblastId: string;
let kampanId: string;

const STRED = { lat: 49.6, lng: 13.2 };

const zaznam = (ico: string): AresZaznam => ({
  ico, nazev: "Firma " + ico, adresa: "x", obec: "Zbůch", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  await zalozFirmu(db, zaznam("25232657"));
  await nastavGeo(db, "25232657", {
    ...STRED, jidelnaId: null as unknown as string, vzdalenostM: 0, vZone: true,
  });
  oblastId = await zalozOblast(db, {
    nazev: "Území", oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
  });
  kampanId = await zalozKampan(db, { nazev: "K", spravce: "a@b.cz" });
  await nastavUzemi(db, kampanId, { oblastId });
  await naplnZOblasti(db, kampanId);
});

describe("přechody stavů", () => {
  it("povolený přechod projde", async () => {
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "ceka_na_pruzkum")).resolves.toBeUndefined();
  });

  it("nepovolený přechod spadne", async () => {
    // Z rozpracované rovnou do schválené se nesmí — musí projít posouzením.
    await expect(zmenStav(db, kampanId, "schvalena")).rejects.toThrow(/přejít/);
  });

  it("zrušení bez důvodu spadne", async () => {
    await expect(zmenStav(db, kampanId, "zrusena")).rejects.toThrow(/důvod/);
  });

  it("do stavu bezi ani uzavrena se v této fázi nedá přejít", async () => {
    // TP-8: kód fáze 0–2 odesílání neimplementuje ani nezapíná.
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "bezi")).rejects.toThrow();
  });
});

describe("pojistky u schválení", () => {
  it("bez firmy s kontaktem schválit nejde", async () => {
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "schvalena")).rejects.toThrow(/kontakt/);
  });

  it("s firmou s kontaktem schválit jde", async () => {
    await zapisKontakt(db, "25232657", {
      email: "info@firma.cz", urovenAdresy: 2,
      zdrojUrl: "https://firma.cz/kontakt", citace: "info@firma.cz",
    });
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "schvalena")).resolves.toBeUndefined();
  });

  it("s nedokončeným průzkumem schválit nejde", async () => {
    await zapisKontakt(db, "25232657", {
      email: "info@firma.cz", urovenAdresy: 2,
      zdrojUrl: "https://firma.cz/kontakt", citace: "info@firma.cz",
    });
    const p = await objednejPruzkum(db, { oblastId, kampanId, pozadal: "a@b.cz" });
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "schvalena")).rejects.toThrow(/průzkum/);

    await zahajPruzkum(db, p);
    await dokoncPruzkum(db, p, { firemPrevzato: 1, firemNovych: 0 });
    await expect(zmenStav(db, kampanId, "schvalena")).resolves.toBeUndefined();
  });

  it("s neúspěšným průzkumem schválit nejde", async () => {
    // Regrese: dřív spoušť blokovala jen 'ceka'/'bezi', takže selhalý
    // průzkum schválení tiše propustil.
    await zapisKontakt(db, "25232657", {
      email: "info@firma.cz", urovenAdresy: 2,
      zdrojUrl: "https://firma.cz/kontakt", citace: "info@firma.cz",
    });
    const p = await objednejPruzkum(db, { oblastId, kampanId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, p);
    await selhalPruzkum(db, p, "zdroj nedostupný");

    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "schvalena")).rejects.toThrow(/průzkum/);
  });
});

describe("databázová zábrana proti stavům bezi/uzavrena (migrace 0020)", () => {
  // Webová aplikace zapisuje do `kampane` přímo, mimo `src/kampan.ts` —
  // tahle pojistka proto musí sedět v databázi, ne jen v kódu jádra.
  it("přímý UPDATE do 'bezi' databáze odmítne", async () => {
    await expect(
      db.query("update kampane set stav = 'bezi' where id = $1", [kampanId]),
    ).rejects.toThrow();
  });

  it("přímý UPDATE do 'uzavrena' databáze odmítne", async () => {
    await expect(
      db.query("update kampane set stav = 'uzavrena' where id = $1", [kampanId]),
    ).rejects.toThrow();
  });

  it("přímý INSERT rovnou ve stavu 'bezi' databáze odmítne", async () => {
    await expect(
      db.query(
        "insert into kampane (nazev, spravce, stav) values ($1,$2,'bezi')",
        ["Jiná kampaň", "a@b.cz"],
      ),
    ).rejects.toThrow();
  });

  it("přímý INSERT rovnou ve stavu 'uzavrena' databáze odmítne", async () => {
    await expect(
      db.query(
        "insert into kampane (nazev, spravce, stav) values ($1,$2,'uzavrena')",
        ["Jiná kampaň 2", "a@b.cz"],
      ),
    ).rejects.toThrow();
  });
});
